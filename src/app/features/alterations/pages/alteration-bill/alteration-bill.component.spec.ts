import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { AlterationsApiService } from '../../data-access/alterations-api.service';
import { AlterationStatus, type Alteration } from '../../models/alteration.model';
import { OrdersApiService } from '@features/orders/data-access/orders-api.service';
import { PaymentsApiService } from '@features/payments/data-access/payments-api.service';
import {
  PaymentMethod,
  PaymentStatus,
  type Payment,
} from '@features/payments/models/payment.model';
import { Role } from '@shared/models/user.model';
import {
  OrderPaymentStatus,
  OrderStatus,
  type OrderWithItems,
} from '@features/orders/models/order.model';
import { AlterationBillComponent } from './alteration-bill.component';

describe('AlterationBillComponent', () => {
  it('loads directly by both business IDs and renders a bill with empty items', async () => {
    const getByAlterationId = vi.fn(() => of(createAlteration()));
    const getByOrderId = vi.fn(() => of(createBillOrder()));
    await configure(getByAlterationId, getByOrderId);

    const fixture = TestBed.createComponent(AlterationBillComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getByAlterationId).toHaveBeenCalledWith('ALT-000123');
    expect(getByOrderId).toHaveBeenCalledWith('ORD-000099');
    expect(content).toContain('ORD-000099');
    expect(content).toContain('CUS-000001');
    expect(content).toContain('ORD-000002');
    expect(content).toContain('₹125.50');
    expect(content).toContain('This alteration bill has no order items.');
  });

  it('rejects an order that is not marked as an alteration bill', async () => {
    await configure(
      vi.fn(() => of(createAlteration())),
      vi.fn(() => of(createBillOrder('STANDARD'))),
    );
    const fixture = TestBed.createComponent(AlterationBillComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Not an alteration bill');
  });

  it('shows not-found and retryable API error states', async () => {
    const getByAlterationId = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiError('Missing', 404)))
      .mockReturnValueOnce(of(createAlteration()));
    const getByOrderId = vi.fn(() => of(createBillOrder()));
    await configure(getByAlterationId, getByOrderId);
    const fixture = TestBed.createComponent(AlterationBillComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alteration bill not found');

    const component = fixture.componentInstance;
    component.load();
    expect(component.error()).toBeNull();
  });

  it('loads payment history with the billing order ID', async () => {
    const getByOrderPayments = vi.fn(() => of(emptyPayments()));
    await configure(
      vi.fn(() => of(createAlteration())),
      vi.fn(() => of(createBillOrder())),
      {
        getByOrderPayments,
      },
    );
    const fixture = TestBed.createComponent(AlterationBillComponent);
    fixture.detectChanges();

    expect(getByOrderPayments).toHaveBeenCalledWith('ORD-000099', { limit: 20 });
    expect(getByOrderPayments).not.toHaveBeenCalledWith('ORD-000002', expect.anything());
  });

  it('creates a payment against the billing order and refreshes totals and history', async () => {
    const updatedBill = createBillOrder('ALTERATION', 50, 75.5);
    const payment = createPayment();
    const getByOrderId = vi
      .fn()
      .mockReturnValueOnce(of(createBillOrder()))
      .mockReturnValueOnce(of(updatedBill));
    const getByOrderPayments = vi.fn(() =>
      of({ data: [payment], meta: { limit: 100, hasNextPage: false, nextCursor: null } }),
    );
    const createPaymentRequest = vi.fn(() => of(payment));
    await configure(
      vi.fn(() => of(createAlteration())),
      getByOrderId,
      {
        getByOrderPayments,
        createPayment: createPaymentRequest,
      },
    );
    const fixture = TestBed.createComponent(AlterationBillComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.paymentForm.patchValue({ amount: 50, paymentMethod: PaymentMethod.Upi });
    component.submitPayment();

    expect(createPaymentRequest).toHaveBeenCalledWith({
      orderId: 'ORD-000099',
      customerId: 'CUS-000001',
      amount: 50,
      paymentMethod: PaymentMethod.Upi,
    });
    expect(createPaymentRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'ORD-000002' }),
    );
    expect(component.bill()?.order.paidAmount).toBe(50);
    expect(component.payments()).toEqual([payment]);
    expect(getByOrderPayments).toHaveBeenCalledWith('ORD-000099', { limit: 20 });
  });

  it('validates positive amounts and payment methods and does not collect an already-paid bill', async () => {
    const paidBill = createBillOrder('ALTERATION', 125.5, 0);
    const createPaymentRequest = vi.fn(() => of(createPayment()));
    await configure(
      vi.fn(() => of(createAlteration())),
      vi.fn(() => of(paidBill)),
      {
        createPayment: createPaymentRequest,
      },
    );
    const fixture = TestBed.createComponent(AlterationBillComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.paymentForm.patchValue({ amount: 1.234, paymentMethod: null });
    component.submitPayment();

    expect(component.paymentForm.invalid).toBe(true);
    expect(component.canCollectPayment()).toBe(false);
    expect(createPaymentRequest).not.toHaveBeenCalled();
  });

  it('keeps payment controls read-only for roles without payment permission', async () => {
    await configure(
      vi.fn(() => of(createAlteration())),
      vi.fn(() => of(createBillOrder())),
      {
        role: Role.Tailor,
      },
    );
    const fixture = TestBed.createComponent(AlterationBillComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.canCreatePayment()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Payment collection is read-only');
  });

  it('refreshes after an ambiguous payment result without claiming success', async () => {
    const createPaymentRequest = vi.fn(() => throwError(() => new Error('Network error')));
    const getByOrderId = vi.fn(() => of(createBillOrder()));
    const getByOrderPayments = vi.fn(() => of(emptyPayments()));
    await configure(
      vi.fn(() => of(createAlteration())),
      getByOrderId,
      {
        getByOrderPayments,
        createPayment: createPaymentRequest,
      },
    );
    const fixture = TestBed.createComponent(AlterationBillComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.paymentForm.patchValue({ amount: 10, paymentMethod: PaymentMethod.Cash });
    component.submitPayment();

    expect(component.paymentSubmitError()).toContain('result is uncertain');
    expect(component.paymentSuccess()).toBeNull();
    expect(getByOrderId).toHaveBeenCalledTimes(2);
    expect(getByOrderPayments).toHaveBeenCalledTimes(2);
  });
});

async function configure(
  getByAlterationId: () => unknown,
  getByOrderId: () => unknown,
  options: {
    getByOrderPayments?: () => unknown;
    createPayment?: () => unknown;
    role?: Role;
  } = {},
): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [AlterationBillComponent],
    providers: [
      provideRouter([]),
      { provide: AlterationsApiService, useValue: { getByAlterationId } },
      { provide: OrdersApiService, useValue: { getByOrderId } },
      {
        provide: PaymentsApiService,
        useValue: {
          getByOrder: options.getByOrderPayments ?? (() => of(emptyPayments())),
          create: options.createPayment ?? (() => of(createPayment())),
        },
      },
      { provide: AuthService, useValue: { user: signal({ role: options.role ?? Role.Manager }) } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: {
              get: (key: string) => (key === 'alterationId' ? 'ALT-000123' : 'ORD-000099'),
            },
          },
        },
      },
    ],
  }).compileComponents();
}

function emptyPayments() {
  return { data: [], meta: { limit: 100, hasNextPage: false, nextCursor: null } };
}

function createPayment(): Payment {
  return {
    paymentId: 'PAY-000001',
    orderId: 'ORD-000099',
    customerId: 'CUS-000001',
    amount: 50,
    paymentMethod: PaymentMethod.Upi,
    status: PaymentStatus.Success,
    createdBy: 'USR-000001',
    updatedBy: 'USR-000001',
    createdAt: '2026-01-21T10:30:00.000Z',
    updatedAt: '2026-01-21T10:30:00.000Z',
  };
}

function createAlteration(): Alteration {
  return {
    _id: 'mongo-alteration',
    alterationId: 'ALT-000123',
    customerId: 'CUS-000001',
    originalOrderId: 'ORD-000002',
    originalOrderItemId: 'item-1',
    description: 'Replace zipper',
    charge: 125.5,
    status: AlterationStatus.Completed,
    createdAt: '2026-01-15T10:30:00.000Z',
    updatedAt: '2026-01-15T10:30:00.000Z',
  };
}

function createBillOrder(
  orderType = 'ALTERATION',
  paidAmount = 0,
  balanceAmount = 125.5,
): OrderWithItems {
  return {
    order: {
      _id: 'mongo-order',
      orderId: 'ORD-000099',
      orderType,
      customerId: 'CUS-000001',
      originalOrderId: 'ORD-000002',
      orderDate: '2026-01-20T10:30:00.000Z',
      status: OrderStatus.Confirmed,
      totalAmount: 125.5,
      paidAmount,
      balanceAmount,
      createdBy: 'USR-000001',
      updatedBy: 'USR-000001',
      createdAt: '2026-01-20T10:30:00.000Z',
      updatedAt: '2026-01-20T10:30:00.000Z',
    },
    items: [],
    paymentStatus: OrderPaymentStatus.Unpaid,
  };
}

import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AlterationsApiService } from '../../data-access/alterations-api.service';
import { AlterationFormComponent } from './alteration-form.component';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import { CustomerGender, type Customer } from '@features/customers/models/customer.model';
import { OrdersApiService } from '@features/orders/data-access/orders-api.service';
import {
  OrderItemType,
  OrderPaymentStatus,
  OrderStatus,
  type OrderItem,
  type OrderWithItems,
} from '@features/orders/models/order.model';

describe('AlterationFormComponent', () => {
  it('loads customer orders and then order details, using the selected item _id', async () => {
    const orders = new Subject<readonly OrderWithItems[]>();
    const details = new Subject<OrderWithItems>();
    const getByCustomer = vi.fn(() => orders);
    const getByOrderId = vi.fn(() => details);
    const { component } = await configure({ getByCustomer, getByOrderId });
    const customer = createCustomer();

    component.selectCustomer(customer);
    expect(getByCustomer).toHaveBeenCalledWith('CUS-000001');
    orders.next([orderWithItems('ORD-000001', [tailoringItem(), fabricSaleItem()])]);
    expect(component.orders()).toHaveLength(1);

    component.selectOrder('ORD-000001');
    expect(getByOrderId).toHaveBeenCalledWith('ORD-000001');
    details.next(orderWithItems('ORD-000001', [tailoringItem(), fabricSaleItem()]));
    expect(component.orderItems()).toHaveLength(1);

    const item = component.orderItems()[0];
    component.selectItem(item._id);
    expect(component.form.controls.originalOrderItemId.value).toBe(item._id);
  });

  it('clears dependent selections when the customer or order changes', async () => {
    const getByCustomer = vi.fn(() => of([]));
    const getByOrderId = vi.fn(() => of(orderWithItems('ORD-000001', [tailoringItem()])));
    const { component } = await configure({ getByCustomer, getByOrderId });

    component.selectCustomer(createCustomer());
    component.orders.set([orderWithItems('ORD-000001', [tailoringItem()])]);
    component.selectOrder('ORD-000001');
    component.orderItems.set([tailoringItem()]);
    component.selectItem('item-1');
    expect(component.form.controls.originalOrderItemId.value).toBe('item-1');

    component.selectOrder('ORD-000002');
    expect(component.form.controls.originalOrderItemId.value).toBe('');
    expect(component.orderItems()).toEqual([]);

    component.selectCustomer(createCustomer({ customerId: 'CUS-000002' }));
    expect(component.form.controls.originalOrderId.value).toBe('');
    expect(component.form.controls.originalOrderItemId.value).toBe('');
    expect(component.selectedOrder()).toBeNull();
  });

  it('excludes alteration orders and fabric-sale-only items', async () => {
    const { component } = await configure({
      getByCustomer: vi.fn(() =>
        of([
          orderWithItems('ORD-000001', [tailoringItem()]),
          orderWithItems('ORD-000002', [tailoringItem()], 'ALTERATION'),
          orderWithItems('ORD-000003', [fabricSaleItem()]),
        ]),
      ),
      getByOrderId: vi.fn(() =>
        of(orderWithItems('ORD-000001', [tailoringItem(), fabricSaleItem()])),
      ),
    });

    component.selectCustomer(createCustomer());
    expect(component.orders().map((order) => order.order.orderId)).toEqual([
      'ORD-000001',
      'ORD-000003',
    ]);
    component.selectOrder('ORD-000001');
    expect(component.orderItems().map((item) => item._id)).toEqual(['item-1']);
  });

  it('validates description, notes, and optional charge', async () => {
    const { component } = await configure({
      getByCustomer: vi.fn(() => of([])),
      getByOrderId: vi.fn(),
    });
    component.form.controls.description.setValue('   ');
    component.form.controls.notes.setValue('x'.repeat(1001));
    component.form.controls.charge.setValue(-1);
    expect(component.form.controls.description.invalid).toBe(true);
    expect(component.form.controls.notes.hasError('maxlength')).toBe(true);
    expect(component.form.controls.charge.hasError('min')).toBe(true);
    component.form.controls.charge.setValue(12.345);
    expect(component.form.controls.charge.hasError('maxDecimalPlaces')).toBe(true);
    component.form.controls.charge.setValue(0);
    expect(component.form.controls.charge.valid).toBe(true);
  });

  it('submits only the confirmed creation fields and navigates on success', async () => {
    const create = vi.fn((request: unknown) => {
      void request;
      return of({});
    });
    const navigate = vi.fn();
    const { component } = await configure(
      { getByCustomer: vi.fn(() => of([])), getByOrderId: vi.fn() },
      { create, navigate },
    );
    component.customer.set(createCustomer());
    component.form.patchValue({
      customerId: 'CUS-000001',
      originalOrderId: 'ORD-000001',
      originalOrderItemId: 'item-1',
      description: '  Replace zipper  ',
      notes: '  Bring on Friday  ',
      charge: 125.5,
    });

    component.submit();

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toEqual({
      customerId: 'CUS-000001',
      originalOrderId: 'ORD-000001',
      originalOrderItemId: 'item-1',
      description: 'Replace zipper',
      notes: 'Bring on Friday',
      charge: 125.5,
    });
    expect(navigate).toHaveBeenCalledWith(['/alterations'], {
      state: { feedback: 'Alteration created successfully.' },
    });
  });

  it('prevents duplicate submission and exposes API errors', async () => {
    const createResponse = new Subject<unknown>();
    const create = vi.fn((request: unknown) => {
      void request;
      return createResponse;
    });
    const { component } = await configure(
      { getByCustomer: vi.fn(() => of([])), getByOrderId: vi.fn() },
      { create },
    );
    component.customer.set(createCustomer());
    component.form.patchValue({
      customerId: 'CUS-000001',
      originalOrderId: 'ORD-000001',
      originalOrderItemId: 'item-1',
      description: 'Replace zipper',
    });

    component.submit();
    component.submit();
    expect(create).toHaveBeenCalledOnce();
    expect(component.submitting()).toBe(true);
    createResponse.error(new ApiError('Validation failed', 422));
    expect(component.submitting()).toBe(false);
    expect(component.error()).toBe('Validation failed');
  });
});

async function configure(
  ordersApi: { getByCustomer: () => unknown; getByOrderId: () => unknown },
  alterationsApi: { create?: ReturnType<typeof vi.fn>; navigate?: ReturnType<typeof vi.fn> } = {},
): Promise<{ component: AlterationFormComponent }> {
  await TestBed.configureTestingModule({
    imports: [AlterationFormComponent],
    providers: [
      {
        provide: AlterationsApiService,
        useValue: {
          create:
            alterationsApi.create ??
            vi.fn((request: unknown) => {
              void request;
              return of({});
            }),
        },
      },
      {
        provide: CustomersApiService,
        useValue: { list: vi.fn(), getByCustomerId: vi.fn() },
      },
      { provide: OrdersApiService, useValue: ordersApi },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: { get: vi.fn(() => null) } } },
      },
      { provide: Router, useValue: { navigate: alterationsApi.navigate ?? vi.fn() } },
      provideRouter([]),
    ],
  }).compileComponents();
  return { component: TestBed.createComponent(AlterationFormComponent).componentInstance };
}

function createCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    _id: 'customer-id',
    customerId: 'CUS-000001',
    name: 'Asha Khan',
    phone: '9999999999',
    gender: CustomerGender.Female,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function orderWithItems(
  orderId: string,
  items: readonly OrderItem[],
  orderType?: string,
): OrderWithItems {
  return {
    order: {
      _id: `mongo-${orderId}`,
      orderId,
      customerId: 'CUS-000001',
      orderDate: '2026-01-01T00:00:00.000Z',
      status: OrderStatus.Confirmed,
      totalAmount: 1000,
      paidAmount: 0,
      balanceAmount: 1000,
      createdBy: 'USR-000001',
      updatedBy: 'USR-000001',
      createdAt: '',
      updatedAt: '',
      ...(orderType ? { orderType } : {}),
    } as OrderWithItems['order'],
    items,
    paymentStatus: OrderPaymentStatus.Unpaid,
  };
}

function tailoringItem(): OrderItem {
  return {
    _id: 'item-1',
    orderId: 'ORD-000001',
    itemType: OrderItemType.TAILORING,
    garmentTypeId: 'GRT-000001',
    quantity: 1,
    unitPrice: 1000,
    tailoringPricingSnapshot: {
      garmentTypeName: 'Shirt',
      garmentTypeCode: 'SHIRT',
      baseTailoringPrice: 1000,
      customizationGroups: [],
      calculatedCustomizationCharge: 0,
      calculatedPerGarmentTailoringAmount: 1000,
      quantity: 1,
      finalTailoringTotal: 1000,
    },
    createdAt: '',
    updatedAt: '',
  };
}

function fabricSaleItem(): OrderItem {
  return {
    ...tailoringItem(),
    _id: 'fabric-item-1',
    itemType: OrderItemType.FABRIC_SALE,
    fabricSaleSnapshot: {
      fabricId: 'FAB-000001',
      name: 'Linen',
      type: 'COTTON' as never,
      color: 'Blue',
      unit: 'METER' as never,
      pricePerUnit: 100,
      quantitySold: 2,
      lineTotal: 200,
    },
  };
}

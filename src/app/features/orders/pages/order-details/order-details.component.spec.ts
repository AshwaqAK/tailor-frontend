import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import { PaymentsApiService } from '@features/payments/data-access/payments-api.service';
import { OrdersApiService } from '../../data-access/orders-api.service';
import {
  OrderItemType,
  OrderPaymentStatus,
  OrderStatus,
  type Order,
  type OrderItem,
  type OrderWithItems,
} from '../../models/order.model';
import { OrderDetailsComponent } from './order-details.component';

describe('OrderDetailsComponent item rendering', () => {
  const order: Order = {
    _id: 'order-mongo-id',
    orderId: 'ORD-000001',
    customerId: 'CUS-000001',
    orderDate: '2026-01-15T00:00:00.000Z',
    status: OrderStatus.Confirmed,
    totalAmount: 1800,
    paidAmount: 0,
    balanceAmount: 1800,
    createdBy: 'USR-000001',
    updatedBy: 'USR-000001',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderDetailsComponent],
      providers: [
        {
          provide: OrdersApiService,
          useValue: {
            getByOrderId: vi.fn(() =>
              of({ order, items: [], paymentStatus: OrderPaymentStatus.Unpaid }),
            ),
            updateStatus: vi.fn(),
          },
        },
        { provide: CustomersApiService, useValue: { getByCustomerId: vi.fn(() => of(null)) } },
        {
          provide: PaymentsApiService,
          useValue: {
            getByOrder: vi.fn(() => of({ data: [], meta: {} })),
            create: vi.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => order.orderId } } },
        },
      ],
    }).compileComponents();
  });

  function item(overrides: Partial<OrderItem>): OrderItem {
    return {
      _id: 'item-mongo-id',
      orderId: order.orderId,
      quantity: 1,
      unitPrice: 800,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      ...overrides,
    };
  }

  function fabricSaleItem(): OrderItem {
    return item({
      itemType: OrderItemType.FabricSale,
      quantity: 2.5,
      unitPrice: 400,
      fabricSaleSnapshot: {
        fabricId: 'FAB-000001',
        name: 'Raymond',
        type: 'COTTON',
        color: 'Black',
        unit: 'METER',
        pricePerUnit: 400,
        quantitySold: 2.5,
        lineTotal: 1000,
      },
      notes: 'Cut from the black roll',
    });
  }

  function tailoringItem(): OrderItem {
    return item({
      itemType: OrderItemType.Tailoring,
      garmentTypeId: 'GRT-000001',
      tailoringPricingSnapshot: {
        garmentTypeName: 'Shirt',
        garmentTypeCode: 'SHIRT',
        baseTailoringPrice: 800,
        customizationGroups: [],
        calculatedCustomizationCharge: 0,
        calculatedPerGarmentTailoringAmount: 800,
        quantity: 1,
        finalTailoringTotal: 800,
      },
    });
  }

  function render(items: readonly OrderItem[]): string {
    const fixture = TestBed.createComponent(OrderDetailsComponent);
    const component = fixture.componentInstance;
    const response: OrderWithItems = {
      order,
      items,
      paymentStatus: OrderPaymentStatus.Unpaid,
    };
    component.result.set(response);
    component.loading.set(false);
    fixture.detectChanges();
    return fixture.nativeElement.textContent as string;
  }

  it('renders a fabric-sale snapshot without tailoring content or duplicate totals', () => {
    const content = render([fabricSaleItem()]);

    expect(content).toContain('Raymond');
    expect(content).toContain('2.5 METER');
    expect(content).toContain('Saved price per unit');
    expect(content).toContain('Fabric-sale line total');
    expect(content).toContain('₹1,000.00');
    expect(content).toContain('Cut from the black roll');
    expect(content).not.toContain('Tailoring (₹400.00 each)');
    expect(content.match(/₹1,000\.00/g)?.length).toBe(1);
  });

  it('preserves tailoring snapshot displays', () => {
    const content = render([tailoringItem()]);

    expect(content).toContain('Shirt');
    expect(content).toContain('Total tailoring amount');
    expect(content).toContain('₹800.00');
  });

  it('renders mixed orders as separate tailoring and fabric-sale lines', () => {
    const content = render([tailoringItem(), fabricSaleItem()]);

    expect(content).toContain('Shirt');
    expect(content).toContain('Raymond');
    expect(content).toContain('Total tailoring amount');
    expect(content).toContain('Fabric-sale line total');
  });

  it('treats missing itemType as tailoring and never displays an undefined garment name', () => {
    const legacy = item({ garmentTypeId: 'GRT-000009' });
    const fixture = TestBed.createComponent(OrderDetailsComponent);
    const component = fixture.componentInstance;

    expect(component.isFabricSale(legacy)).toBe(false);
    expect(component.garmentName(legacy)).toBe('Garment GRT-000009');

    const content = render([legacy]);
    expect(content).toContain('Garment GRT-000009');
    expect(content).not.toContain('undefined');
  });
});

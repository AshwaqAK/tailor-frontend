import '@angular/compiler';

import { ActivatedRoute, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import { FabricType, QuantityUnit } from '@features/fabrics/models/fabric.model';
import { PaymentsApiService } from '@features/payments/data-access/payments-api.service';
import { OrdersApiService } from '../../data-access/orders-api.service';
import {
  OrderItemType,
  OrderPaymentStatus,
  OrderStatus,
  type OrderItem,
  type OrderWithItems,
} from '../../models/order.model';
import { OrderDetailsComponent } from './order-details.component';

describe('OrderDetailsComponent item display', () => {
  let getByOrderId: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getByOrderId = vi.fn();

    await TestBed.configureTestingModule({
      imports: [OrderDetailsComponent],
      providers: [
        provideRouter([]),
        {
          provide: OrdersApiService,
          useValue: {
            getByOrderId,
            updateStatus: vi.fn(),
          },
        },
        {
          provide: CustomersApiService,
          useValue: { getByCustomerId: vi.fn(() => of(null)) },
        },
        {
          provide: PaymentsApiService,
          useValue: { getByOrder: vi.fn(() => of({ data: [] })) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn(() => 'ORD-000001') } } },
        },
      ],
    }).compileComponents();
  });

  function render(items: readonly OrderItem[], totalAmount = 300) {
    const response = orderWithItems(items, totalAmount);
    getByOrderId.mockReturnValue(of(response));
    const fixture = TestBed.createComponent(OrderDetailsComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('displays saved fabric-sale snapshot values without tailoring sections', () => {
    const fixture = render([fabricSaleItem()], 100);
    const item = fixture.nativeElement.querySelector('.fabric-sale-item') as HTMLElement;

    expect(item.textContent).toContain('Silk fabric');
    expect(item.textContent).toContain('Blue');
    expect(item.textContent).toContain('Quantity sold');
    expect(item.textContent).toContain('Saved price per unit');
    expect(item.textContent).toContain('Fabric sale total');
    expect(item.textContent?.match(/Fabric sale total/g)).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.amount-summary strong')?.textContent).toContain(
      '₹100.00',
    );
    expect(item.textContent).toContain('Cut from the blue roll');
    expect(item.querySelector('.pricing-snapshot')).toBeNull();
    expect(item.querySelector('.measurements-panel')).toBeNull();
    expect(item.querySelector('.garment-total')).toBeNull();
  });

  it('preserves fractional fabric-sale quantities and the saved line total', () => {
    const fixture = render([fabricSaleItem()], 560);
    const item = fixture.nativeElement.querySelector('.fabric-sale-item') as HTMLElement;

    expect(item.textContent).toContain('1.4');
    expect(item.textContent).toContain('₹400.00');
    expect(item.textContent).toContain('₹560.00');
    expect(item.textContent).not.toContain('Tailoring');
    expect(item.textContent).not.toContain('Garment total');
  });

  it('preserves tailoring snapshot and attached fabric-cost displays', () => {
    const fixture = render([tailoringItemWithFabric()], 225);
    const item = fixture.nativeElement.querySelector('.garment-item') as HTMLElement;

    expect(item.querySelector('.pricing-customizations')).not.toBeNull();
    expect(item.querySelector('.fabric-details')).not.toBeNull();
    expect(item.textContent).toContain('Fabric: Cotton / White');
    expect(item.textContent).toContain('₹25.00');
    expect(item.querySelector('.garment-total')?.textContent).toContain('₹225.00');
  });

  it('displays tailoring and fabric-sale lines separately in mixed orders', () => {
    const fixture = render([tailoringItem(), fabricSaleItem()]);
    const items = fixture.nativeElement.querySelectorAll('.garment-item');

    expect(items).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.pricing-snapshot')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.fabric-sale-details')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.measurements-panel')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.garment-total')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.fabric-sale-item .garment-line')).toHaveLength(
      4,
    );
    expect(fixture.nativeElement.querySelector('.amount-summary strong')?.textContent).toContain(
      '₹300.00',
    );
  });

  it('treats a missing itemType as a tailoring item', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { itemType: _itemType, ...legacyItem } = tailoringItem();
    const fixture = render([legacyItem as OrderItem]);

    expect(
      fixture.nativeElement.querySelector('.garment-item:not(.fabric-sale-item)'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Tailored shirt');
    expect(fixture.nativeElement.querySelector('.pricing-snapshot')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.measurements-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.fabric-sale-details')).toBeNull();
  });

  it('uses a clear fallback when a tailoring garment name is missing', () => {
    const fixture = render([
      {
        ...tailoringItem(),
        itemType: undefined,
        garmentTypeId: undefined,
        tailoringPricingSnapshot: undefined,
        clothingType: undefined,
      },
    ]);

    expect(fixture.nativeElement.textContent).toContain('Tailoring item');
    expect(fixture.nativeElement.textContent).not.toContain('undefined');
  });
});

function orderWithItems(items: readonly OrderItem[], totalAmount = 300): OrderWithItems {
  return {
    order: {
      _id: 'order-mongo-id',
      orderId: 'ORD-000001',
      customerId: 'CUS-000001',
      orderDate: '2026-01-01T00:00:00.000Z',
      status: OrderStatus.Confirmed,
      totalAmount,
      paidAmount: 100,
      balanceAmount: 200,
      createdBy: 'USR-000001',
      updatedBy: 'USR-000001',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    items,
    paymentStatus: OrderPaymentStatus.PartiallyPaid,
  };
}

function tailoringItem(): OrderItem {
  return {
    _id: 'item-tailoring',
    orderId: 'ORD-000001',
    itemType: OrderItemType.TAILORING,
    garmentTypeId: 'GRT-000001',
    quantity: 1,
    unitPrice: 200,
    tailoringPricingSnapshot: {
      garmentTypeName: 'Tailored shirt',
      garmentTypeCode: 'SHIRT',
      baseTailoringPrice: 180,
      customizationGroups: [
        {
          groupName: 'Collar',
          options: [],
          calculatedCharge: 20,
        },
      ],
      calculatedCustomizationCharge: 20,
      calculatedPerGarmentTailoringAmount: 200,
      quantity: 1,
      finalTailoringTotal: 200,
    },
    measurementSnapshot: {
      customerId: 'CUS-000001',
      measurementId: '507f1f77bcf86cd799439011',
      measurementVersion: 2,
      garmentTypeId: 'GRT-000001',
      measurements: { chest: 40 },
      measuredAt: '2026-01-01T00:00:00.000Z',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function tailoringItemWithFabric(): OrderItem {
  return {
    ...tailoringItem(),
    fabricSnapshot: {
      fabricId: 'FAB-000002',
      name: 'Cotton',
      type: 'COTTON',
      color: 'White',
      unit: 'METER',
      pricePerUnit: 50,
      quantityUsed: 0.5,
    },
  };
}

function fabricSaleItem(): OrderItem {
  return {
    _id: 'item-fabric-sale',
    orderId: 'ORD-000001',
    itemType: OrderItemType.FABRIC_SALE,
    quantity: 2,
    unitPrice: 400,
    fabricSaleSnapshot: {
      fabricId: 'FAB-000001',
      name: 'Silk fabric',
      type: FabricType.Silk,
      color: 'Blue',
      unit: QuantityUnit.Meter,
      pricePerUnit: 400,
      quantitySold: 1.4,
      lineTotal: 560,
    },
    notes: 'Cut from the blue roll',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

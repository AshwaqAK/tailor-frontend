import '@angular/compiler';

import { ActivatedRoute, provideRouter } from '@angular/router';
import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, vi, beforeEach, it } from 'vitest';

import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import { CustomerGender } from '@features/customers/models/customer.model';
import { GarmentTypeService } from '@features/garment-types/services/garment-type.service';
import { FabricsApiService } from '@features/fabrics/data-access/fabrics-api.service';
import { FabricType, QuantityUnit, type Fabric } from '@features/fabrics/models/fabric.model';
import { MeasurementsApiService } from '@features/customers/data-access/measurements-api.service';
import { OrderItemType } from '../../models/order.model';
import { OrdersApiService } from '../../data-access/orders-api.service';
import { OrderFormComponent } from './order-form.component';

describe('OrderFormComponent order item payloads', () => {
  let createOrder: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createOrder = vi.fn(() => of({ order: { orderId: 'ORD-000001' }, items: [] }));

    await TestBed.configureTestingModule({
      imports: [OrderFormComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: vi.fn(() => null) } } },
        },
        {
          provide: CustomersApiService,
          useValue: { list: vi.fn(), getByCustomerId: vi.fn() },
        },
        {
          provide: MeasurementsApiService,
          useValue: { getByCustomer: vi.fn(() => of([])) },
        },
        {
          provide: GarmentTypeService,
          useValue: { list: vi.fn(() => of([])) },
        },
        {
          provide: FabricsApiService,
          useValue: { list: vi.fn(() => of({ data: [] })) },
        },
        {
          provide: OrdersApiService,
          useValue: {
            create: createOrder,
            previewPricing: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(OrderFormComponent);
    const component = fixture.componentInstance;
    component.customer.set(customer());
    component.form.controls.customerId.setValue('CUS-000001');
    return { fixture, component };
  }

  function fillTailoringLine(component: OrderFormComponent, index = 0): void {
    const item = component.items.at(index);
    item.controls.garmentTypeId.setValue('GRT-000001');
    item.controls.measurementId.setValue('507f1f77bcf86cd799439011');
    item.controls.customizations.addControl('collar', new FormControl('French'));
  }

  it('serializes a tailoring-only line with the backend compatibility price and no shop fabric', () => {
    const { component } = createComponent();
    fillTailoringLine(component);

    component.submit();

    expect(createOrder).toHaveBeenCalledOnce();
    expect(createOrder.mock.calls[0][0].items).toEqual([
      {
        itemType: OrderItemType.TAILORING,
        garmentTypeId: 'GRT-000001',
        quantity: 1,
        unitPrice: 0,
        measurementId: '507f1f77bcf86cd799439011',
        customizations: { collar: 'French' },
      },
    ]);
  });

  it('shows and validates fabric quantity after selecting shop fabric', () => {
    const { fixture, component } = createComponent();
    const item = component.items.at(0);

    item.controls.garmentTypeId.setValue('GRT-000001');
    item.controls.fabricId.setValue('FAB-000001');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#fabric-quantity-0')).not.toBeNull();
    expect(item.controls.fabricQuantity.hasError('required')).toBe(true);

    item.controls.fabricQuantity.setValue(1.5);

    expect(item.controls.fabricQuantity.valid).toBe(true);
  });

  it('hides fabric quantity and clears its validation after clearing shop fabric', () => {
    const { fixture, component } = createComponent();
    const item = component.items.at(0);

    item.controls.fabricId.setValue('FAB-000001');
    item.controls.fabricQuantity.setValue(1.5);
    item.controls.fabricQuantity.markAsTouched();
    item.controls.fabricId.setValue('');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#fabric-quantity-0')).toBeNull();
    expect(item.controls.fabricQuantity.value).toBeNull();
    expect(item.controls.fabricQuantity.errors).toBeNull();
  });

  it('requires fabric and omits tailoring-only fields for a fabric-sale line', () => {
    const { component } = createComponent();
    const item = component.items.at(0);
    item.controls.itemType.setValue(OrderItemType.FABRIC_SALE);

    expect(component.form.invalid).toBe(true);
    item.controls.fabricId.setValue('FAB-000001');
    item.controls.quantity.setValue(2);

    component.submit();

    expect(createOrder).toHaveBeenCalledOnce();
    expect(createOrder.mock.calls[0][0].items).toEqual([
      {
        itemType: OrderItemType.FABRIC_SALE,
        fabricId: 'FAB-000001',
        quantity: 2,
      },
    ]);
  });

  it('validates decimal meter quantities and displays the estimated fabric cost', () => {
    const { fixture, component } = createComponent();
    component.fabrics.set([fabric(QuantityUnit.Meter, 400)]);
    const item = component.items.at(0);
    item.controls.itemType.setValue(OrderItemType.FABRIC_SALE);
    item.controls.fabricId.setValue('FAB-000001');
    item.controls.quantity.setValue(2.5);
    fixture.detectChanges();

    expect(item.controls.quantity.valid).toBe(true);
    const estimate = fixture.nativeElement.querySelector('.fabric-sale-estimate') as HTMLElement;
    expect(estimate.textContent).toContain('Raymond · Black');
    expect(estimate.textContent).toContain('METER');
    expect(estimate.textContent).toContain('₹1,000.00');
  });

  it('rejects fractional piece quantities and hides the estimate for invalid quantities', () => {
    const { fixture, component } = createComponent();
    component.fabrics.set([fabric(QuantityUnit.Piece, 400)]);
    const item = component.items.at(0);
    item.controls.itemType.setValue(OrderItemType.FABRIC_SALE);
    item.controls.fabricId.setValue('FAB-000001');
    item.controls.quantity.setValue(1.5);
    fixture.detectChanges();

    expect(item.controls.quantity.invalid).toBe(true);
    expect(component.fabricSaleEstimate(item)).toBeNull();
    expect(fixture.nativeElement.querySelector('.fabric-sale-estimate')).toBeNull();
  });

  it.each([0, -1, 1.2345])('rejects invalid meter quantity %s', (quantity: number) => {
    const { component } = createComponent();
    component.fabrics.set([fabric(QuantityUnit.Meter, 400)]);
    const item = component.items.at(0);
    item.controls.itemType.setValue(OrderItemType.FABRIC_SALE);
    item.controls.fabricId.setValue('FAB-000001');
    item.controls.quantity.setValue(quantity);

    expect(item.controls.quantity.invalid).toBe(true);
    expect(component.fabricSaleEstimate(item)).toBeNull();
  });

  it('serializes tailoring and fabric-sale lines together', () => {
    const { component } = createComponent();
    fillTailoringLine(component);
    component.addItem();
    const fabricSale = component.items.at(1);
    fabricSale.controls.itemType.setValue(OrderItemType.FABRIC_SALE);
    fabricSale.controls.fabricId.setValue('FAB-000001');
    fabricSale.controls.quantity.setValue(3);

    component.submit();

    expect(createOrder.mock.calls[0][0].items).toEqual([
      {
        itemType: OrderItemType.TAILORING,
        garmentTypeId: 'GRT-000001',
        quantity: 1,
        unitPrice: 0,
        measurementId: '507f1f77bcf86cd799439011',
        customizations: { collar: 'French' },
      },
      {
        itemType: OrderItemType.FABRIC_SALE,
        fabricId: 'FAB-000001',
        quantity: 3,
      },
    ]);
  });

  it('clears tailoring values when switching a line to fabric sale', () => {
    const { component } = createComponent();
    const item = component.items.at(0);
    fillTailoringLine(component);
    item.controls.fabricQuantity.setValue(1.5);

    item.controls.itemType.setValue(OrderItemType.FABRIC_SALE);

    expect(item.controls.garmentTypeId.value).toBeNull();
    expect(item.controls.measurementId.value).toBe('');
    expect(item.controls.fabricQuantity.value).toBeNull();
    expect(Object.keys(item.controls.customizations.controls)).toHaveLength(0);
  });

  it('restores whole-number tailoring quantity validation after switching from fractional meters', () => {
    const { component } = createComponent();
    component.fabrics.set([fabric(QuantityUnit.Meter, 400)]);
    const item = component.items.at(0);

    item.controls.itemType.setValue(OrderItemType.FABRIC_SALE);
    item.controls.fabricId.setValue('FAB-000001');
    item.controls.quantity.setValue(2.5);
    expect(item.controls.quantity.valid).toBe(true);

    item.controls.itemType.setValue(OrderItemType.TAILORING);

    expect(item.controls.quantity.value).toBe(1);
    expect(item.controls.quantity.valid).toBe(true);
  });
});

function customer() {
  return {
    _id: 'customer-mongo-id',
    customerId: 'CUS-000001',
    name: 'Test Customer',
    phone: '9999999999',
    gender: CustomerGender.Other,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as const;
}

function fabric(unit: QuantityUnit, pricePerUnit: number): Fabric {
  return {
    _id: 'fabric-mongo-id',
    fabricId: 'FAB-000001',
    name: 'Raymond',
    type: FabricType.Other,
    color: 'Black',
    quantity: 10,
    unit,
    pricePerUnit,
    isActive: true,
    createdBy: 'USR-000001',
    updatedBy: 'USR-000001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

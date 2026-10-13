import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import { MeasurementsApiService } from '@features/customers/data-access/measurements-api.service';
import type { Customer } from '@features/customers/models/customer.model';
import { GarmentTypeService } from '@features/garment-types/services/garment-type.service';
import { FabricsApiService } from '@features/fabrics/data-access/fabrics-api.service';
import { QuantityUnit, type Fabric } from '@features/fabrics/models/fabric.model';
import { OrderItemType, type Order } from '../../models/order.model';
import { OrdersApiService } from '../../data-access/orders-api.service';
import { OrderFormComponent } from './order-form.component';

describe('OrderFormComponent item types', () => {
  const customer = {
    _id: 'customer-mongo-id',
    customerId: 'CUS-000001',
    name: 'Asha Khan',
    phone: '9876543210',
    gender: 'FEMALE',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as Customer;
  const fabrics: readonly Fabric[] = [
    {
      _id: 'fabric-meter-mongo-id',
      fabricId: 'FAB-000001',
      name: 'Raymond',
      type: 'COTTON',
      color: 'Black',
      quantity: 20,
      unit: QuantityUnit.Meter,
      pricePerUnit: 400,
      isActive: true,
      createdBy: 'USR-000001',
      updatedBy: 'USR-000001',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Fabric,
    {
      _id: 'fabric-piece-mongo-id',
      fabricId: 'FAB-000002',
      name: 'Buttons',
      type: 'OTHER',
      color: 'Gold',
      quantity: 20,
      unit: QuantityUnit.Piece,
      pricePerUnit: 25,
      isActive: true,
      createdBy: 'USR-000001',
      updatedBy: 'USR-000001',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Fabric,
  ];

  let create: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    create = vi.fn(() => of({ order: { orderId: 'ORD-000001' } as Order, items: [] }));
  });

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [OrderFormComponent],
      providers: [
        {
          provide: CustomersApiService,
          useValue: {
            list: vi.fn(() => of({ data: [], meta: {} })),
            getByCustomerId: vi.fn(() => of(customer)),
          },
        },
        { provide: MeasurementsApiService, useValue: { getByCustomer: vi.fn(() => of([])) } },
        { provide: GarmentTypeService, useValue: { list: vi.fn(() => of([])) } },
        {
          provide: FabricsApiService,
          useValue: {
            list: vi.fn(() => of({ data: fabrics, meta: {} })),
          },
        },
        {
          provide: OrdersApiService,
          useValue: {
            create,
            previewPricing: vi.fn(() =>
              of({
                baseTailoringPrice: 1000,
                calculatedCustomizationCharge: 0,
                calculatedPerGarmentTailoringAmount: 1000,
                quantity: 1,
                finalTailoringTotal: 1000,
                customizationGroups: [],
              }),
            ),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderFormComponent);
    const component = fixture.componentInstance;
    component.customer.set(customer);
    component.form.controls.customerId.setValue(customer.customerId);
    return { fixture, component };
  }

  it('defaults every new line to tailoring and serializes a fabric sale without tailoring fields', async () => {
    const { component } = await createComponent();
    const item = component.items.at(0);

    expect(item.controls.itemType.value).toBe(OrderItemType.Tailoring);
    item.controls.itemType.setValue(OrderItemType.FabricSale);
    item.controls.fabricId.setValue('FAB-000001');
    item.controls.quantity.setValue(2.5);

    expect(item.controls.garmentTypeId.valid).toBe(true);
    expect(item.controls.measurementId.valid).toBe(true);
    expect(item.controls.quantity.valid).toBe(true);
    expect(component.fabricSaleCost(item)).toBe(1000);

    component.submit();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            itemType: OrderItemType.FabricSale,
            fabricId: 'FAB-000001',
            quantity: 2.5,
          },
        ],
      }),
    );
    expect(create.mock.calls[0][0].items[0]).not.toHaveProperty('garmentTypeId');
    expect(create.mock.calls[0][0].items[0]).not.toHaveProperty('unitPrice');
    expect(create.mock.calls[0][0].items[0]).not.toHaveProperty('fabricQuantity');
  });

  it('requires whole pieces but permits fractional meter quantities', async () => {
    const { component } = await createComponent();
    const item = component.items.at(0);
    item.controls.itemType.setValue(OrderItemType.FabricSale);

    item.controls.fabricId.setValue('FAB-000001');
    item.controls.quantity.setValue(1.25);
    expect(item.controls.quantity.valid).toBe(true);

    item.controls.fabricId.setValue('FAB-000002');
    item.controls.quantity.setValue(1.5);
    expect(item.controls.quantity.invalid).toBe(true);
    item.controls.quantity.setValue(2);
    expect(item.controls.quantity.valid).toBe(true);
  });

  it('keeps tailoring payload fields for tailoring lines and supports mixed orders', async () => {
    const { component } = await createComponent();
    const tailoring = component.items.at(0);
    tailoring.controls.garmentTypeId.setValue('GAR-000001');
    tailoring.controls.measurementId.setValue('measurement-1');

    component.addItem();
    const sale = component.items.at(1);
    sale.controls.itemType.setValue(OrderItemType.FabricSale);
    sale.controls.fabricId.setValue('FAB-000002');
    sale.controls.quantity.setValue(2);

    component.submit();

    expect(create.mock.calls[0][0].items).toEqual([
      expect.objectContaining({
        itemType: OrderItemType.Tailoring,
        garmentTypeId: 'GAR-000001',
        measurementId: 'measurement-1',
      }),
      expect.objectContaining({
        itemType: OrderItemType.FabricSale,
        fabricId: 'FAB-000002',
        quantity: 2,
      }),
    ]);
  });
});

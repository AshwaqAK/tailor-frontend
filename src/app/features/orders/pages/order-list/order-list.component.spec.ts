import '@angular/compiler';

import { ActivatedRoute, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '@core/auth/auth.service';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import { Role } from '@shared/models/user.model';
import type { CursorPaginatedOrders, OrderWithItems } from '../../models/order.model';
import { OrdersApiService } from '../../data-access/orders-api.service';
import { OrderListComponent } from './order-list.component';

describe('OrderListComponent cursor pagination', () => {
  let getAll: ReturnType<typeof vi.fn>;
  let fixture: ReturnType<typeof TestBed.createComponent<OrderListComponent>>;

  beforeEach(async () => {
    getAll = vi.fn(() => of(page([], { hasNextPage: true, nextCursor: 'opaque-token' })));
    await TestBed.configureTestingModule({
      imports: [OrderListComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user: () => ({ role: Role.Manager }) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        {
          provide: CustomersApiService,
          useValue: { list: vi.fn(() => of({ data: [] })) },
        },
        {
          provide: OrdersApiService,
          useValue: {
            getAll,
            getByCustomer: vi.fn(() => of([])),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OrderListComponent);
    fixture.detectChanges();
  });

  it('omits the cursor on the first request and sends the opaque next cursor unchanged', () => {
    expect(getAll).toHaveBeenNthCalledWith(1, undefined, 20);

    getAll.mockReturnValueOnce(
      of(page([order('ORD-000002')], { hasNextPage: true, nextCursor: 'opaque-token' })),
    );
    fixture.componentInstance.nextPage();
    expect(getAll).toHaveBeenNthCalledWith(2, 'opaque-token', 20);
    expect(fixture.componentInstance.orders()[0].order.orderId).toBe('ORD-000002');
  });

  it('keeps cursor history for Previous navigation and disables it on the first page', () => {
    expect(fixture.componentInstance.currentPage()).toBe(1);
    expect(fixture.componentInstance.currentPage()).toBe(1);

    getAll.mockReturnValueOnce(
      of(page([order('ORD-000002')], { hasNextPage: true, nextCursor: 'token-2' })),
    );
    fixture.componentInstance.nextPage();
    getAll.mockReturnValueOnce(
      of(page([order('ORD-000003')], { hasNextPage: false, nextCursor: null })),
    );
    fixture.componentInstance.nextPage();
    expect(fixture.componentInstance.currentPage()).toBe(3);

    getAll.mockReturnValueOnce(of(page([order('ORD-000002')])));
    fixture.componentInstance.previousPage();
    expect(getAll).toHaveBeenLastCalledWith('opaque-token', 20);
    expect(fixture.componentInstance.currentPage()).toBe(2);

    getAll.mockReturnValueOnce(of(page([order('ORD-000001')])));
    fixture.componentInstance.previousPage();
    expect(getAll).toHaveBeenLastCalledWith(undefined, 20);
    expect(fixture.componentInstance.currentPage()).toBe(1);
  });

  it('handles a final empty page without inventing totals', () => {
    getAll.mockReturnValueOnce(of(page([], { hasNextPage: false, nextCursor: null })));
    fixture.componentInstance.nextPage();

    expect(fixture.componentInstance.orders()).toHaveLength(0);
    expect(fixture.componentInstance.cursorMeta()).toEqual({
      limit: 20,
      hasNextPage: false,
      nextCursor: null,
    });
  });
});

function page(
  data: readonly OrderWithItems[],
  meta: Partial<CursorPaginatedOrders['meta']> = {},
): CursorPaginatedOrders {
  return {
    data,
    meta: { limit: 20, hasNextPage: false, nextCursor: null, ...meta },
  };
}

function order(orderId: string): OrderWithItems {
  return {
    order: {
      _id: `${orderId}-mongo-id`,
      orderId,
      customerId: 'CUS-000001',
      orderDate: '2026-01-01T00:00:00.000Z',
      status: 'CONFIRMED',
      totalAmount: 100,
      paidAmount: 0,
      balanceAmount: 100,
      createdBy: 'USR-000001',
      updatedBy: 'USR-000001',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    items: [],
    paymentStatus: 'UNPAID',
  } as OrderWithItems;
}

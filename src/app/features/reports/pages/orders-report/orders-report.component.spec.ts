import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { OrderStatus } from '@features/orders/models/order.model';
import type { OrdersReport } from '../../models/report.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import { OrdersReportComponent } from './orders-report.component';

function createReport(overrides: Partial<OrdersReport> = {}): OrdersReport {
  return {
    totalOrders: 2,
    ordersByStatus: {
      [OrderStatus.Draft]: 0,
      [OrderStatus.Confirmed]: 1,
      [OrderStatus.InProgress]: 0,
      [OrderStatus.Ready]: 0,
      [OrderStatus.Delivered]: 1,
      [OrderStatus.Cancelled]: 0,
    },
    orderTotals: { pending: 1, inProgress: 0, completed: 1, cancelled: 0 },
    orderCount: 2,
    orderValue: 5400,
    paidAmount: 2400,
    outstandingBalance: 3000,
    composition: {
      tailoringOnly: 1,
      fabricSaleOnly: 0,
      mixed: 1,
      amounts: {
        tailoringAmount: 3200,
        attachedFabricAmount: 800,
        fabricSaleAmount: 1400,
      },
    },
    ...overrides,
  };
}

describe('OrdersReportComponent', () => {
  it('renders backend order totals, status counts, and composition without recalculation', async () => {
    const getOrdersReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [OrdersReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getOrdersReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrdersReportComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getOrdersReport).toHaveBeenCalledWith({});
    expect(content).toContain('Order count');
    expect(content).toContain('₹5,400.00');
    expect(content).toContain('₹2,400.00');
    expect(content).toContain('₹3,000.00');
    expect(content).toContain('Confirmed');
    expect(content).toContain('Tailoring only');
    expect(content).toContain('Fabric-only sales');
    expect(content).toContain('Paid and outstanding amounts are current order snapshots');
  });

  it('validates filters and sends only the applied values', async () => {
    const getOrdersReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [OrdersReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getOrdersReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const component = TestBed.createComponent(OrdersReportComponent).componentInstance;
    component.reportDateForm.setValue({
      fromDate: '2026-03-10',
      toDate: '2026-03-01',
      customerId: 'CUS-000001',
    });
    component.applyFilters();
    expect(getOrdersReport).toHaveBeenCalledOnce();

    component.reportDateForm.setValue({
      fromDate: '2026-03-01',
      toDate: '2026-03-10',
      customerId: 'CUS-000001',
    });
    component.applyFilters();
    expect(getOrdersReport).toHaveBeenNthCalledWith(2, {
      fromDate: '2026-03-01',
      toDate: '2026-03-10',
      customerId: 'CUS-000001',
    });
  });

  it('renders an empty result state', async () => {
    const getOrdersReport = vi.fn(() => of(createReport({ orderCount: 0, totalOrders: 0 })));

    await TestBed.configureTestingModule({
      imports: [OrdersReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getOrdersReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrdersReportComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No orders matched the selected filters.');
  });

  it('renders a retryable API error', async () => {
    const getOrdersReport = vi
      .fn()
      .mockImplementation(() => throwError(() => new ApiError('Report unavailable', 503)));

    await TestBed.configureTestingModule({
      imports: [OrdersReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getOrdersReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrdersReportComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Report unavailable');
    expect(fixture.nativeElement.textContent).toContain('Try again');
  });
});

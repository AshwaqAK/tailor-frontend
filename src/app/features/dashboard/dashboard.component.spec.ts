import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { DashboardApiService } from './data-access/dashboard-api.service';
import type { DashboardSummary } from './models/dashboard.model';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  it('renders API-backed summary metrics and sales mix with INR formatting', async () => {
    const summary = {
      ordersToday: 4,
      revenue: { collected: 1200 },
      outstanding: { total: 450 },
      totalActiveFabrics: 7,
      lowStockFabrics: { count: 2 },
      orderValue: 5400,
      salesMix: {
        tailoringAmount: 3200,
        attachedFabricAmount: 800,
        fabricSaleAmount: 1400,
        totalOrderValue: 5400,
      },
      recentOrders: [
        {
          orderId: 'ORD-100',
          customerId: 'CUS-100',
          customerName: 'Asha Khan',
          totalAmount: 5400,
          paidAmount: 2400,
          balanceAmount: 3000,
          status: 'CONFIRMED',
          createdAt: '2026-01-15T00:00:00.000Z',
        },
      ],
    } as unknown as DashboardSummary;
    const getSummary = vi.fn(() => of(summary));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DashboardApiService, useValue: { getSummary } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getSummary).toHaveBeenCalledOnce();
    expect(content).toContain('Orders created today');
    expect(content).toContain('Collected revenue');
    expect(content).toContain('Outstanding balance');
    expect(content).toContain('Active fabrics');
    expect(content).toContain('Low-stock fabrics');
    expect(content).toContain('Total order value');
    expect(content).toContain('₹1,200.00');
    expect(content).toContain('₹450.00');
    expect(content).toContain('₹5,400.00');
    expect(content).toContain('Sales mix');
    expect(content).toContain('Tailoring');
    expect(content).toContain('Fabric used in tailoring');
    expect(content).toContain('Fabric-only sales');
    expect(content).toContain('₹3,200.00');
    expect(content).toContain('₹800.00');
    expect(content).toContain('₹1,400.00');
    expect(content).toContain('Recent orders');
    expect(content).toContain('ORD-100');
    expect(content).toContain('Asha Khan');
    expect(content).toContain('Confirmed');
    expect(content).toContain('View order');
  });

  it('renders zero values when optional summary sections are absent', async () => {
    const getSummary = vi.fn(() => of({} as DashboardSummary));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DashboardApiService, useValue: { getSummary } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('Orders created today');
    expect(content).toContain('₹0.00');
    expect(content).toContain('Low-stock fabrics');
    expect(content).toContain('No recent orders to display.');
  });

  it('validates the date range and sends the applied dates to the API', async () => {
    const getSummary = vi.fn(() => of({} as DashboardSummary));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DashboardApiService, useValue: { getSummary } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const component = TestBed.createComponent(DashboardComponent).componentInstance;

    component.dateRangeForm.setValue({ fromDate: '2026-02-30', toDate: '2026-03-01' });
    component.applyDateRange();
    expect(component.dateRangeForm.controls.fromDate.hasError('invalidDate')).toBe(true);
    expect(getSummary).toHaveBeenCalledOnce();

    component.dateRangeForm.setValue({ fromDate: '2026-03-10', toDate: '2026-03-01' });
    component.applyDateRange();
    expect(component.dateRangeForm.hasError('dateRange')).toBe(true);
    expect(getSummary).toHaveBeenCalledOnce();

    component.dateRangeForm.setValue({ fromDate: '2026-03-01', toDate: '2026-03-10' });
    component.applyDateRange();
    expect(getSummary).toHaveBeenLastCalledWith({
      fromDate: '2026-03-01',
      toDate: '2026-03-10',
    });
  });

  it('ignores an older in-flight response after a newer range is applied', async () => {
    const firstResponse = new Subject<DashboardSummary>();
    const secondResponse = new Subject<DashboardSummary>();
    const getSummary = vi
      .fn()
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DashboardApiService, useValue: { getSummary } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component.dateRangeForm.setValue({ fromDate: '2026-03-01', toDate: '2026-03-10' });
    component.applyDateRange();

    const staleSummary = { ordersToday: 1 } as unknown as DashboardSummary;
    const currentSummary = { ordersToday: 2 } as unknown as DashboardSummary;
    firstResponse.next(staleSummary);
    expect(component.summary()).toBeNull();

    secondResponse.next(currentSummary);
    expect(component.summary()).toBe(currentSummary);
    expect(component.loading()).toBe(false);
  });

  it('clears failed range results and retries without showing stale data', async () => {
    const initialSummary = { ordersToday: 1 } as unknown as DashboardSummary;
    const failedResponse = new Subject<DashboardSummary>();
    const retryResponse = new Subject<DashboardSummary>();
    const getSummary = vi
      .fn()
      .mockReturnValueOnce(of(initialSummary))
      .mockReturnValueOnce(failedResponse)
      .mockReturnValueOnce(retryResponse);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: DashboardApiService, useValue: { getSummary } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component.dateRangeForm.setValue({ fromDate: '2026-03-01', toDate: '2026-03-10' });
    component.applyDateRange();
    expect(component.summary()).toBeNull();

    failedResponse.error(new ApiError('Unable to load dashboard', 500));
    expect(component.summary()).toBeNull();
    expect(component.error()).toBe('Unable to load dashboard');

    component.retry();
    expect(component.loading()).toBe(true);
    retryResponse.next(initialSummary);
    expect(component.summary()).toBe(initialSummary);
    expect(component.error()).toBeNull();
  });
});

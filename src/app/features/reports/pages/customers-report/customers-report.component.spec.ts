import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import type { CustomersReport } from '../../models/report.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import { CustomersReportComponent } from './customers-report.component';

function createReport(overrides: Partial<CustomersReport> = {}): CustomersReport {
  return {
    totalCustomers: 4,
    activeCustomers: 3,
    inactiveCustomers: 1,
    registrationCount: 4,
    customerOrderCount: 2,
    repeatCustomerCount: 1,
    orderValue: 5400,
    currentPaidAmount: 2400,
    currentOutstandingBalance: 3000,
    customerBreakdown: {
      data: [
        {
          customerId: 'CUS-000001',
          customerName: 'Asha Khan',
          orderCount: 2,
          orderValue: 5400,
          currentPaidAmount: 2400,
          currentOutstandingBalance: 3000,
          latestOrderCreatedAt: '2026-01-31T10:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
    ...overrides,
  };
}

describe('CustomersReportComponent', () => {
  it('renders summary metrics and the backend customer breakdown', async () => {
    const getCustomersReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [CustomersReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getCustomersReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomersReportComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getCustomersReport).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(content).toContain('Active registered customers');
    expect(content).toContain('Customer registrations');
    expect(content).toContain('Customers with orders');
    expect(content).toContain('Repeat customers');
    expect(content).toContain('₹5,400.00');
    expect(content).toContain('Asha Khan');
    expect(content).toContain('CUS-000001');
    expect(content).toContain('Latest order');
  });

  it('sends date, customer, and pagination filters and resets to the first page', async () => {
    const getCustomersReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [CustomersReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getCustomersReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const component = TestBed.createComponent(CustomersReportComponent).componentInstance;
    component.customerFilterForm.setValue({
      fromDate: '2026-02-01',
      toDate: '2026-02-28',
      customerId: 'CUS-000002',
    });
    component.changePageSize('100');

    expect(getCustomersReport).toHaveBeenNthCalledWith(2, {
      fromDate: '2026-02-01',
      toDate: '2026-02-28',
      customerId: 'CUS-000002',
      page: 1,
      limit: 100,
    });

    component.changePage(2);
    expect(getCustomersReport).toHaveBeenCalledTimes(2);
  });

  it('handles an empty breakdown and null customer names safely', async () => {
    const getCustomersReport = vi.fn(() =>
      of(
        createReport({
          customerBreakdown: {
            data: [
              {
                customerId: 'CUS-000003',
                customerName: null,
                orderCount: 1,
                orderValue: 0,
                currentPaidAmount: 0,
                currentOutstandingBalance: 0,
                latestOrderCreatedAt: null,
              },
            ],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        }),
      ),
    );

    await TestBed.configureTestingModule({
      imports: [CustomersReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getCustomersReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomersReportComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('Unnamed customer');
    expect(content).toContain('—');
  });

  it('renders the empty and retryable error states', async () => {
    const emptyReport = createReport({
      customerBreakdown: {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    });
    const getCustomersReport = vi.fn(() => of(emptyReport));

    await TestBed.configureTestingModule({
      imports: [CustomersReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getCustomersReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomersReportComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No customer order rows found');

    TestBed.resetTestingModule();
    const failingRequest = vi
      .fn()
      .mockImplementation(() => throwError(() => new ApiError('Customers unavailable', 503)));

    await TestBed.configureTestingModule({
      imports: [CustomersReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getCustomersReport: failingRequest } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const errorFixture = TestBed.createComponent(CustomersReportComponent);
    errorFixture.detectChanges();
    expect(errorFixture.nativeElement.textContent).toContain('Customers unavailable');
    expect(errorFixture.nativeElement.textContent).toContain('Try again');
  });
});

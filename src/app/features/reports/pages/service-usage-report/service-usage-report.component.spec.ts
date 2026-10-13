import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import type { ServiceUsageReport } from '../../models/report.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import { ServiceUsageReportComponent } from './service-usage-report.component';

function createReport(overrides: Partial<ServiceUsageReport> = {}): ServiceUsageReport {
  return {
    serviceLineCount: 3,
    distinctServiceCount: 2,
    serviceAmount: 180,
    serviceBreakdown: {
      data: [
        {
          serviceId: 'SRV-000001',
          name: 'Shirt stitching',
          totalQuantity: 2,
          lineCount: 2,
          serviceAmount: 120,
        },
        {
          serviceId: 'SRV-000002',
          name: null,
          totalQuantity: 1,
          lineCount: 1,
          serviceAmount: 60,
        },
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    },
    ...overrides,
  };
}

describe('ServiceUsageReportComponent', () => {
  it('renders backend historical service totals and per-service rows', async () => {
    const getServiceUsageReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [ServiceUsageReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getServiceUsageReport } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ServiceUsageReportComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getServiceUsageReport).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(content).toContain('Service lines');
    expect(content).toContain('Distinct services used');
    expect(content).toContain('₹180.00');
    expect(content).toContain('Shirt stitching');
    expect(content).toContain('SRV-000001');
    expect(content).toContain('Unnamed service');
    expect(content).toContain('Historical amount');
  });

  it('validates filters and resets pagination when applying them', async () => {
    const getServiceUsageReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [ServiceUsageReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getServiceUsageReport } },
        provideRouter([]),
      ],
    }).compileComponents();

    const component = TestBed.createComponent(ServiceUsageReportComponent).componentInstance;
    component.filterForm.setValue({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      serviceId: 'SRV-000003',
    });
    component.changePageSize('100');

    expect(getServiceUsageReport).toHaveBeenNthCalledWith(2, {
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      serviceId: 'SRV-000003',
      page: 1,
      limit: 100,
    });
  });

  it('renders empty and retryable error states', async () => {
    const getServiceUsageReport = vi.fn(() =>
      of(
        createReport({
          serviceLineCount: 0,
          distinctServiceCount: 0,
          serviceAmount: 0,
          serviceBreakdown: {
            data: [],
            meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
          },
        }),
      ),
    );

    await TestBed.configureTestingModule({
      imports: [ServiceUsageReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getServiceUsageReport } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ServiceUsageReportComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No service usage matched the selected filters.',
    );

    TestBed.resetTestingModule();
    const failingRequest = vi
      .fn()
      .mockImplementation(() => throwError(() => new ApiError('Service usage unavailable', 503)));

    await TestBed.configureTestingModule({
      imports: [ServiceUsageReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getServiceUsageReport: failingRequest } },
        provideRouter([]),
      ],
    }).compileComponents();

    const errorFixture = TestBed.createComponent(ServiceUsageReportComponent);
    errorFixture.detectChanges();
    expect(errorFixture.nativeElement.textContent).toContain('Service usage unavailable');
    expect(errorFixture.nativeElement.textContent).toContain('Try again');
  });
});

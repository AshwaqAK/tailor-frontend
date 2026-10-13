import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { QuantityUnit } from '@features/fabrics/models/fabric.model';
import type { FabricSalesReport } from '../../models/report.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import { FabricSalesReportComponent } from './fabric-sales-report.component';

function createReport(overrides: Partial<FabricSalesReport> = {}): FabricSalesReport {
  return {
    saleCount: 3,
    quantitySoldByUnit: {
      [QuantityUnit.Meter]: 2.5,
      [QuantityUnit.Piece]: 2,
    },
    salesAmount: 1800,
    distinctFabricCount: 2,
    fabricBreakdown: {
      data: [
        {
          fabricId: 'FAB-000001',
          name: 'Raymond',
          type: 'COTTON',
          color: 'Black',
          unit: QuantityUnit.Meter,
          totalQuantitySold: 2.5,
          totalSalesAmount: 1000,
          saleLineCount: 1,
        },
        {
          fabricId: 'FAB-000002',
          name: null,
          type: null,
          color: null,
          unit: QuantityUnit.Piece,
          totalQuantitySold: 2,
          totalSalesAmount: 800,
          saleLineCount: 2,
        },
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    },
    ...overrides,
  };
}

describe('FabricSalesReportComponent', () => {
  it('renders backend summary, fractional meters, separate units, and fabric rows', async () => {
    const getFabricSalesReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [FabricSalesReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getFabricSalesReport } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FabricSalesReportComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getFabricSalesReport).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(content).toContain('Fabric-sale lines');
    expect(content).toContain('Distinct fabrics sold');
    expect(content).toContain('₹1,800.00');
    expect(content).toContain('2.5');
    expect(content).toContain('METER');
    expect(content).toContain('2');
    expect(content).toContain('PIECE');
    expect(content).toContain('Raymond');
    expect(content).toContain('FAB-000001');
    expect(content).toContain('Unnamed fabric');
  });

  it('validates filters and resets pagination when applying them', async () => {
    const getFabricSalesReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [FabricSalesReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getFabricSalesReport } },
        provideRouter([]),
      ],
    }).compileComponents();

    const component = TestBed.createComponent(FabricSalesReportComponent).componentInstance;
    component.filterForm.setValue({
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      fabricId: 'FAB-000003',
    });
    component.changePageSize('100');

    expect(getFabricSalesReport).toHaveBeenNthCalledWith(2, {
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      fabricId: 'FAB-000003',
      page: 1,
      limit: 100,
    });
  });

  it('renders empty and retryable error states', async () => {
    const getFabricSalesReport = vi.fn(() =>
      of(
        createReport({
          saleCount: 0,
          distinctFabricCount: 0,
          salesAmount: 0,
          quantitySoldByUnit: {
            [QuantityUnit.Meter]: 0,
            [QuantityUnit.Piece]: 0,
          },
          fabricBreakdown: {
            data: [],
            meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
          },
        }),
      ),
    );

    await TestBed.configureTestingModule({
      imports: [FabricSalesReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getFabricSalesReport } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FabricSalesReportComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No fabric-only sales matched the selected filters.',
    );

    TestBed.resetTestingModule();
    const failingRequest = vi
      .fn()
      .mockImplementation(() => throwError(() => new ApiError('Fabric sales unavailable', 503)));

    await TestBed.configureTestingModule({
      imports: [FabricSalesReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getFabricSalesReport: failingRequest } },
        provideRouter([]),
      ],
    }).compileComponents();

    const errorFixture = TestBed.createComponent(FabricSalesReportComponent);
    errorFixture.detectChanges();
    expect(errorFixture.nativeElement.textContent).toContain('Fabric sales unavailable');
    expect(errorFixture.nativeElement.textContent).toContain('Try again');
  });
});

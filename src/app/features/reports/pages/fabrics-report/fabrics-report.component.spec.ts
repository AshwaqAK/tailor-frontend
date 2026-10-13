import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { QuantityUnit } from '@features/fabrics/models/fabric.model';
import type { FabricsReport } from '../../models/report.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import { FabricsReportComponent } from './fabrics-report.component';

function createReport(overrides: Partial<FabricsReport> = {}): FabricsReport {
  return {
    totalFabrics: 3,
    activeFabrics: 2,
    inactiveFabrics: 1,
    lowStockFabrics: { count: 1, threshold: 5 },
    totalAvailableQuantity: null,
    availableQuantityByUnit: {
      [QuantityUnit.Meter]: 12.5,
      [QuantityUnit.Piece]: 4,
    },
    ...overrides,
  };
}

describe('FabricsReportComponent', () => {
  it('loads current stock without date filters and keeps units separate', async () => {
    const getFabricsReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [FabricsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getFabricsReport } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FabricsReportComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getFabricsReport).toHaveBeenCalledWith({});
    expect(content).toContain('Active fabrics');
    expect(content).toContain('Inactive fabrics');
    expect(content).toContain('Low-stock fabrics');
    expect(content).toContain('Threshold: 5 units');
    expect(content).toContain('12.5');
    expect(content).toContain('METER');
    expect(content).toContain('4');
    expect(content).toContain('PIECE');
    expect(content).toContain('current catalog stock');
  });

  it('renders zero quantities and an empty inventory state safely', async () => {
    const getFabricsReport = vi.fn(() =>
      of(
        createReport({
          totalFabrics: 0,
          activeFabrics: 0,
          inactiveFabrics: 0,
          lowStockFabrics: { count: 0, threshold: 5 },
          availableQuantityByUnit: {
            [QuantityUnit.Meter]: 0,
            [QuantityUnit.Piece]: 0,
          },
        }),
      ),
    );

    await TestBed.configureTestingModule({
      imports: [FabricsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getFabricsReport } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FabricsReportComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('No fabric records are available.');
    expect(content).toContain('Threshold: 5 units');
    expect(content).toContain('METER');
    expect(content).toContain('PIECE');
  });

  it('renders a retryable API error', async () => {
    const getFabricsReport = vi
      .fn()
      .mockImplementation(() => throwError(() => new ApiError('Fabrics unavailable', 503)));

    await TestBed.configureTestingModule({
      imports: [FabricsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getFabricsReport } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FabricsReportComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Fabrics unavailable');
    expect(fixture.nativeElement.textContent).toContain('Try again');
  });
});

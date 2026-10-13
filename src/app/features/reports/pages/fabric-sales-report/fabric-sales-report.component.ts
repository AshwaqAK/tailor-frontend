import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { QuantityUnit } from '@features/fabrics/models/fabric.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import type { FabricSalesReport, FabricSalesReportQuery } from '../../models/report.model';

const REPORT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PAGE_SIZES = [10, 20, 50, 100] as const;

function isValidReportDate(value: string): boolean {
  const match = REPORT_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function reportDateValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown;
  return value === '' || (typeof value === 'string' && isValidReportDate(value))
    ? null
    : { invalidDate: true };
}

function reportDateRangeValidator(control: AbstractControl): ValidationErrors | null {
  const fromDate = control.get('fromDate')?.value as unknown;
  const toDate = control.get('toDate')?.value as unknown;

  if (
    typeof fromDate !== 'string' ||
    typeof toDate !== 'string' ||
    !isValidReportDate(fromDate) ||
    !isValidReportDate(toDate)
  ) {
    return null;
  }

  return fromDate <= toDate ? null : { dateRange: true };
}

function fabricIdValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown;
  return value === '' || (typeof value === 'string' && /^FAB-\d{6}$/.test(value))
    ? null
    : { invalidFabricId: true };
}

@Component({
  selector: 'app-fabric-sales-report',
  imports: [CurrencyPipe, ReactiveFormsModule],
  templateUrl: './fabric-sales-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FabricSalesReportComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly reportsApi = inject(ReportsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<FabricSalesReportQuery>();

  readonly filterForm = this.formBuilder.nonNullable.group(
    {
      fromDate: ['', reportDateValidator],
      toDate: ['', reportDateValidator],
      fabricId: ['', fabricIdValidator],
    },
    { validators: reportDateRangeValidator },
  );
  readonly report = signal<FabricSalesReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly pageSizes = PAGE_SIZES;
  readonly quantityUnits = [QuantityUnit.Meter, QuantityUnit.Piece] as const;

  constructor() {
    this.loadRequests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.report.set(null);
        }),
        switchMap((query) =>
          this.reportsApi.getFabricSalesReport(query).pipe(
            map((report) => ({ report })),
            catchError((error: unknown) => of({ error })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);

        if ('error' in result) {
          this.error.set(
            result.error instanceof ApiError
              ? result.error.message
              : 'Fabric sales report could not be loaded. Please try again.',
          );
          return;
        }

        this.report.set(result.report);
        this.page.set(result.report.fabricBreakdown.meta.page);
        this.pageSize.set(result.report.fabricBreakdown.meta.limit);
      });

    this.loadReport(this.currentQuery());
  }

  applyFilters(): void {
    this.filterForm.markAllAsTouched();
    if (this.filterForm.invalid) return;

    this.page.set(1);
    this.loadReport(this.currentQuery(1));
  }

  retry(): void {
    this.loadReport(this.currentQuery());
  }

  changePage(page: number): void {
    const totalPages = this.report()?.fabricBreakdown.meta.totalPages ?? 0;
    if (this.loading() || page < 1 || page > totalPages || page === this.page()) return;

    this.page.set(page);
    this.loadReport(this.currentQuery(page));
  }

  changePageSize(value: string): void {
    const pageSize = Number(value);
    if (!PAGE_SIZES.includes(pageSize as (typeof PAGE_SIZES)[number])) return;

    this.pageSize.set(pageSize);
    this.page.set(1);
    this.loadReport(this.currentQuery(1, pageSize));
  }

  unitLabel(unit: QuantityUnit | null | undefined): string {
    if (unit === QuantityUnit.Meter) return 'Meters';
    if (unit === QuantityUnit.Piece) return 'Pieces';
    return 'Unknown unit';
  }

  fabricName(value: string | null | undefined): string {
    return value?.trim() || 'Unnamed fabric';
  }

  hasSales(): boolean {
    return (this.report()?.saleCount ?? 0) > 0;
  }

  quantity(unit: QuantityUnit): number {
    return this.report()?.quantitySoldByUnit?.[unit] ?? 0;
  }

  private loadReport(query: FabricSalesReportQuery): void {
    this.loadRequests.next(query);
  }

  private currentQuery(page = this.page(), limit = this.pageSize()): FabricSalesReportQuery {
    const { fromDate, toDate, fabricId } = this.filterForm.getRawValue();

    return {
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      ...(fabricId ? { fabricId: fabricId.trim() } : {}),
      page,
      limit,
    };
  }
}

import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { ReportsApiService } from '../../data-access/reports-api.service';
import type { CustomersReport, CustomersReportQuery } from '../../models/report.model';

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

function customerIdValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown;
  return value === '' || (typeof value === 'string' && /^CUS-\d{6}$/.test(value))
    ? null
    : { invalidCustomerId: true };
}

@Component({
  selector: 'app-customers-report',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './customers-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersReportComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly reportsApi = inject(ReportsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<CustomersReportQuery>();

  readonly customerFilterForm = this.formBuilder.nonNullable.group(
    {
      fromDate: ['', reportDateValidator],
      toDate: ['', reportDateValidator],
      customerId: ['', customerIdValidator],
    },
    { validators: reportDateRangeValidator },
  );
  readonly report = signal<CustomersReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly pageSizes = PAGE_SIZES;

  constructor() {
    this.loadRequests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.report.set(null);
        }),
        switchMap((query) =>
          this.reportsApi.getCustomersReport(query).pipe(
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
              : 'Customers report could not be loaded. Please try again.',
          );
          return;
        }

        this.report.set(result.report);
        this.page.set(result.report.customerBreakdown.meta.page);
        this.pageSize.set(result.report.customerBreakdown.meta.limit);
      });

    this.loadReport(this.currentQuery());
  }

  applyFilters(): void {
    this.customerFilterForm.markAllAsTouched();
    if (this.customerFilterForm.invalid) return;

    this.page.set(1);
    this.loadReport(this.currentQuery(1));
  }

  retry(): void {
    this.loadReport(this.currentQuery());
  }

  changePage(page: number): void {
    const totalPages = this.report()?.customerBreakdown.meta.totalPages ?? 0;
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

  customerName(value: string | null | undefined): string {
    return value?.trim() || 'Unnamed customer';
  }

  private loadReport(query: CustomersReportQuery): void {
    this.loadRequests.next(query);
  }

  private currentQuery(page = this.page(), limit = this.pageSize()): CustomersReportQuery {
    const { fromDate, toDate, customerId } = this.customerFilterForm.getRawValue();

    return {
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      ...(customerId ? { customerId: customerId.trim() } : {}),
      page,
      limit,
    };
  }
}

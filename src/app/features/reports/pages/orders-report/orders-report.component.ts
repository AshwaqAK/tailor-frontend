import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { ReportsApiService } from '../../data-access/reports-api.service';
import { OrderStatus } from '@features/orders/models/order.model';
import type { OrdersReport, OrdersReportQuery } from '../../models/report.model';

const REPORT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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
  selector: 'app-orders-report',
  imports: [CurrencyPipe, ReactiveFormsModule],
  templateUrl: './orders-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersReportComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly reportsApi = inject(ReportsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<OrdersReportQuery>();

  readonly reportDateForm = this.formBuilder.nonNullable.group(
    {
      fromDate: ['', reportDateValidator],
      toDate: ['', reportDateValidator],
      customerId: ['', customerIdValidator],
    },
    { validators: reportDateRangeValidator },
  );
  readonly report = signal<OrdersReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orderStatuses = Object.values(OrderStatus);

  constructor() {
    this.loadRequests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.report.set(null);
        }),
        switchMap((query) =>
          this.reportsApi.getOrdersReport(query).pipe(
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
              : 'Orders report could not be loaded. Please try again.',
          );
          return;
        }

        this.report.set(result.report);
      });

    this.loadReport({});
  }

  applyFilters(): void {
    this.reportDateForm.markAllAsTouched();
    if (this.reportDateForm.invalid) return;

    this.loadReport(this.currentQuery());
  }

  retry(): void {
    this.loadReport(this.currentQuery());
  }

  statusLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }

  statusCount(status: OrderStatus): number {
    return this.report()?.ordersByStatus?.[status] ?? 0;
  }

  private loadReport(query: OrdersReportQuery): void {
    this.loadRequests.next(query);
  }

  private currentQuery(): OrdersReportQuery {
    const { fromDate, toDate, customerId } = this.reportDateForm.getRawValue();

    return {
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      ...(customerId ? { customerId: customerId.trim() } : {}),
    };
  }
}

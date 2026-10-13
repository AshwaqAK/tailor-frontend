import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { PaymentMethod, PaymentStatus } from '@features/payments/models/payment.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import type { PaymentsReport, PaymentsReportQuery } from '../../models/report.model';

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
  selector: 'app-payments-report',
  imports: [CurrencyPipe, ReactiveFormsModule],
  templateUrl: './payments-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsReportComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly reportsApi = inject(ReportsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<PaymentsReportQuery>();

  readonly paymentFilterForm = this.formBuilder.nonNullable.group(
    {
      fromDate: ['', reportDateValidator],
      toDate: ['', reportDateValidator],
      customerId: ['', customerIdValidator],
      paymentMethod: ['' as PaymentMethod | ''],
    },
    { validators: reportDateRangeValidator },
  );
  readonly report = signal<PaymentsReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly paymentStatuses = Object.values(PaymentStatus);
  readonly paymentMethods = Object.values(PaymentMethod);

  constructor() {
    this.loadRequests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.report.set(null);
        }),
        switchMap((query) =>
          this.reportsApi.getPaymentsReport(query).pipe(
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
              : 'Payments report could not be loaded. Please try again.',
          );
          return;
        }

        this.report.set(result.report);
      });

    this.loadReport({});
  }

  applyFilters(): void {
    this.paymentFilterForm.markAllAsTouched();
    if (this.paymentFilterForm.invalid) return;

    this.loadReport(this.currentQuery());
  }

  retry(): void {
    this.loadReport(this.currentQuery());
  }

  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }

  statusCount(status: PaymentStatus): number {
    return this.report()?.paymentCounts.byStatus?.[status] ?? 0;
  }

  methodCount(method: PaymentMethod): number {
    return this.report()?.paymentCounts.byMethod?.[method] ?? 0;
  }

  hasPaymentActivity(): boolean {
    const report = this.report();
    if (!report) return false;

    return (
      report.grossCollections !== 0 ||
      report.refunds !== 0 ||
      report.netCollections !== 0 ||
      this.paymentStatuses.some((status) => this.statusCount(status) > 0) ||
      this.paymentMethods.some((method) => this.methodCount(method) > 0)
    );
  }

  private loadReport(query: PaymentsReportQuery): void {
    this.loadRequests.next(query);
  }

  private currentQuery(): PaymentsReportQuery {
    const { fromDate, toDate, customerId, paymentMethod } = this.paymentFilterForm.getRawValue();

    return {
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      ...(customerId ? { customerId: customerId.trim() } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
    };
  }
}

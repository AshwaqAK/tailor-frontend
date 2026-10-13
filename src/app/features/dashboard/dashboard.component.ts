import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { DashboardApiService } from './data-access/dashboard-api.service';
import type { DashboardSummary, DashboardSummaryQuery } from './models/dashboard.model';

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

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<DashboardSummaryQuery>();

  readonly user = inject(AuthService).user;
  readonly dateRangeForm = this.formBuilder.nonNullable.group(
    {
      fromDate: ['', reportDateValidator],
      toDate: ['', reportDateValidator],
    },
    { validators: reportDateRangeValidator },
  );
  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.loadRequests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.summary.set(null);
        }),
        switchMap((query) =>
          this.dashboardApi.getSummary(query).pipe(
            map((summary) => ({ summary })),
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
              : 'Dashboard summary could not be loaded. Please try again.',
          );
          return;
        }

        this.summary.set(result.summary);
      });

    this.loadSummary({});
  }

  retry(): void {
    this.loadSummary(this.currentQuery());
  }

  applyDateRange(): void {
    this.dateRangeForm.markAllAsTouched();
    if (this.dateRangeForm.invalid) return;

    this.loadSummary(this.currentQuery());
  }

  statusLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }

  private loadSummary(query: DashboardSummaryQuery): void {
    this.loadRequests.next(query);
  }

  private currentQuery(): DashboardSummaryQuery {
    const { fromDate, toDate } = this.dateRangeForm.getRawValue();

    return {
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    };
  }
}

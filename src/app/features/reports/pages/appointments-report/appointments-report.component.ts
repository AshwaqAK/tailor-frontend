import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import {
  AppointmentStatus,
  AppointmentType,
} from '@features/appointments/models/appointment.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import type { AppointmentsReport, AppointmentsReportQuery } from '../../models/report.model';

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
  selector: 'app-appointments-report',
  imports: [ReactiveFormsModule],
  templateUrl: './appointments-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentsReportComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly reportsApi = inject(ReportsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<AppointmentsReportQuery>();

  readonly dateRangeForm = this.formBuilder.nonNullable.group(
    {
      fromDate: ['', reportDateValidator],
      toDate: ['', reportDateValidator],
    },
    { validators: reportDateRangeValidator },
  );
  readonly report = signal<AppointmentsReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly appointmentStatuses = Object.values(AppointmentStatus);
  readonly appointmentTypes = Object.values(AppointmentType);

  constructor() {
    this.loadRequests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.report.set(null);
        }),
        switchMap((query) =>
          this.reportsApi.getAppointmentsReport(query).pipe(
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
              : 'Appointments report could not be loaded. Please try again.',
          );
          return;
        }

        this.report.set(result.report);
      });

    this.loadReport({});
  }

  applyDateRange(): void {
    this.dateRangeForm.markAllAsTouched();
    if (this.dateRangeForm.invalid) return;

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

  statusCount(status: AppointmentStatus): number {
    return this.report()?.appointmentsByStatus?.[status] ?? 0;
  }

  typeCount(type: AppointmentType): number {
    return this.report()?.appointmentsByType?.[type] ?? 0;
  }

  hasAppointments(): boolean {
    const report = this.report();
    return report ? report.totalAppointments > 0 : false;
  }

  private loadReport(query: AppointmentsReportQuery): void {
    this.loadRequests.next(query);
  }

  private currentQuery(): AppointmentsReportQuery {
    const { fromDate, toDate } = this.dateRangeForm.getRawValue();

    return {
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    };
  }
}

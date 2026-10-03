import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { MeasurementsApiService } from '../../data-access/measurements-api.service';
import type { Customer } from '../../models/customer.model';
import type { Measurement } from '../../models/measurement.model';

@Component({
  selector: 'app-measurement-history',
  imports: [DatePipe, RouterLink],
  templateUrl: './measurement-history.component.html',
  styleUrl: './measurement-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementHistoryComponent {
  private readonly api = inject(MeasurementsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly customer = input.required<Customer>();
  readonly measurements = signal<readonly Measurement[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly canCreate = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager || role === Role.Receptionist;
  });

  constructor() {
    effect(() => this.load(this.customer().customerId));
  }

  retry(): void {
    this.load(this.customer().customerId);
  }

  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  measurementCount(measurement: Measurement): number {
    return Object.keys(measurement.measurements).length;
  }

  private load(customerId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getByCustomer(customerId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (measurements) => this.measurements.set(measurements),
        error: (error: unknown) => {
          if (error instanceof ApiError && error.status === 404) {
            this.measurements.set([]);
            return;
          }
          this.error.set(
            error instanceof ApiError ? error.message : 'Measurement history could not be loaded.',
          );
        },
      });
  }
}

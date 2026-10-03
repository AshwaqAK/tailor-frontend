import { DatePipe, KeyValuePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, map, switchMap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { CustomersApiService } from '../../data-access/customers-api.service';
import { MeasurementsApiService } from '../../data-access/measurements-api.service';
import type { Customer } from '../../models/customer.model';
import type { Measurement } from '../../models/measurement.model';

@Component({
  selector: 'app-measurement-details',
  imports: [DatePipe, KeyValuePipe, RouterLink],
  templateUrl: './measurement-details.component.html',
  styleUrl: './measurement-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementDetailsComponent {
  private readonly customersApi = inject(CustomersApiService);
  private readonly measurementsApi = inject(MeasurementsApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly customerRecordId = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly measurementId = this.route.snapshot.paramMap.get('measurementId') ?? '';
  readonly customer = signal<Customer | null>(null);
  readonly measurement = signal<Measurement | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly canEdit = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager || role === Role.Receptionist;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.customersApi
      .getById(this.customerRecordId)
      .pipe(
        switchMap((customer) => {
          this.customer.set(customer);
          return this.measurementsApi.getByCustomer(customer.customerId);
        }),
        map((measurements) => measurements.find((item) => item._id === this.measurementId) ?? null),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (measurement) => {
          if (!measurement) {
            this.error.set('Measurement not found.');
            return;
          }
          this.measurement.set(measurement);
        },
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'Measurement could not be loaded.',
          ),
      });
  }

  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}

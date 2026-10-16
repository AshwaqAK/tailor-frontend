import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { ServicesApiService } from '../../data-access/services-api.service';
import type { Service } from '../../models/service.model';

@Component({
  selector: 'app-service-details',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './service-details.component.html',
  styleUrl: './service-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceDetailsComponent {
  private readonly api = inject(ServicesApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly serviceId = this.route.snapshot.paramMap.get('serviceId') ?? '';
  readonly service = signal<Service | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly updating = signal(false);
  readonly canManage = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager;
  });

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.serviceId) {
      this.loading.set(false);
      this.error.set('Service could not be found.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getById(this.serviceId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (service) => this.service.set(service),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'Service could not be loaded.',
          ),
      });
  }

  toggleActive(): void {
    const service = this.service();
    if (
      !service ||
      this.updating() ||
      !window.confirm(`${service.isActive ? 'Deactivate' : 'Activate'} ${service.name}?`)
    )
      return;
    this.updating.set(true);
    this.error.set(null);
    this.api
      .update(service.serviceId, { isActive: !service.isActive })
      .pipe(
        finalize(() => this.updating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => this.service.set(updated),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'Service status could not be updated.',
          ),
      });
  }

  deleteService(): void {
    const service = this.service();
    if (
      !service ||
      this.deleting() ||
      !window.confirm(
        `Permanently delete ${service.name}? This cannot be undone. Existing order snapshots remain, but service references may become unresolved.`,
      )
    )
      return;
    this.deleting.set(true);
    this.error.set(null);
    this.api
      .remove(service.serviceId)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigate(['/services']),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'Service could not be deleted.',
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

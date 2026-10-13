import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { GarmentTypeService } from '../../services/garment-type.service';
import type { GarmentType } from '../../models/garment-type.model';

@Component({
  selector: 'app-garment-types',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './garment-types.component.html',
  styleUrl: './garment-types.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarmentTypesComponent {
  private readonly service = inject(GarmentTypeService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly garmentTypes = signal<readonly GarmentType[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(
    typeof window !== 'undefined' && typeof window.history.state?.successMessage === 'string'
      ? window.history.state.successMessage
      : null,
  );
  readonly canManage = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager;
  });

  constructor() {
    this.load();
  }

  retry(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service
      .list()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.garmentTypes.set(response),
        error: (error: unknown) => {
          this.garmentTypes.set([]);
          this.error.set(
            error instanceof ApiError ? error.message : 'Garment types could not be loaded.',
          );
        },
      });
  }
}

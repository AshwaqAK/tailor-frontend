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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { FabricsApiService } from '../../data-access/fabrics-api.service';
import type { Fabric } from '../../models/fabric.model';

@Component({
  selector: 'app-fabric-details',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './fabric-details.component.html',
  styleUrl: './fabric-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FabricDetailsComponent {
  private readonly api = inject(FabricsApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fabricId = this.route.snapshot.paramMap.get('fabricId') ?? '';
  readonly fabric = signal<Fabric | null>(null);
  readonly loading = signal(true);
  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);
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
  remove(): void {
    const fabric = this.fabric();
    if (!fabric || this.deleting() || !window.confirm(`Permanently delete ${fabric.name}?`)) return;
    this.deleting.set(true);
    this.api
      .remove(fabric.fabricId)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigate(['/fabrics']),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'Fabric could not be deleted.',
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
  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getById(this.fabricId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (fabric) => this.fabric.set(fabric),
        error: (error: unknown) =>
          this.error.set(error instanceof ApiError ? error.message : 'Fabric could not be loaded.'),
      });
  }
}

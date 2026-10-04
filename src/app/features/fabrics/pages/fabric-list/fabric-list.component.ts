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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';

import { FabricsApiService } from '../../data-access/fabrics-api.service';
import {
  FabricType,
  QuantityUnit,
  type Fabric,
  type FabricListResponse,
  type FabricQuery,
} from '../../models/fabric.model';

const EMPTY_META: FabricListResponse['meta'] = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

@Component({
  selector: 'app-fabric-list',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './fabric-list.component.html',
  styleUrl: './fabric-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FabricListComponent {
  private readonly api = inject(FabricsApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly name = new FormControl('', {
    nonNullable: true,
  });

  readonly fabrics = signal<readonly Fabric[]>([]);
  readonly meta = signal<FabricListResponse['meta']>(EMPTY_META);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly types = Object.values(FabricType);
  readonly units = Object.values(QuantityUnit);

  readonly canManage = computed(() => {
    const role = this.auth.user()?.role;

    return role === Role.SuperAdmin || role === Role.Manager;
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const query = this.query();

      this.name.setValue(query.name ?? '', {
        emitEvent: false,
      });

      this.load(query);
    });

    this.name.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        this.navigate({
          name: name.trim() || null,
          page: 1,
        });
      });
  }

  filter(key: 'type' | 'color' | 'unit' | 'isActive', value: string): void {
    this.navigate({
      [key]: value || null,
      page: 1,
    });
  }

  page(page: number): void {
    if (page > 0 && page <= this.meta().totalPages) {
      this.navigate({ page });
    }
  }

  clear(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  retry(): void {
    this.load(this.query());
  }

  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private load(query: FabricQuery): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .list(query)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.fabrics.set(response.data);
          this.meta.set(response.meta);
        },
        error: (error: unknown) => {
          this.fabrics.set([]);
          this.meta.set(EMPTY_META);
          this.error.set(
            error instanceof ApiError ? error.message : 'Fabrics could not be loaded.',
          );
        },
      });
  }

  private query(): FabricQuery {
    const p = this.route.snapshot.queryParamMap;

    const int = (value: string | null, fallback: number) =>
      Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

    const type = p.get('type') as FabricType | null;
    const unit = p.get('unit') as QuantityUnit | null;
    const status = p.get('isActive');

    return {
      page: int(p.get('page'), 1),
      limit: 20,
      name: p.get('name')?.trim() || undefined,
      type: type && this.types.includes(type) ? type : undefined,
      color: p.get('color')?.trim() || undefined,
      unit: unit && this.units.includes(unit) ? unit : undefined,
      isActive: status === 'true' ? true : status === 'false' ? false : undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };
  }
}

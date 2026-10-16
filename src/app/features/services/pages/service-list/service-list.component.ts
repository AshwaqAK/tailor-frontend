import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { ServicesApiService } from '../../data-access/services-api.service';
import { ServiceCategory } from '../../models/service.model';
import type {
  Service,
  ServiceListResponse,
  ServiceQuery,
  ServiceSortField,
} from '../../models/service.model';

const EMPTY_META: ServiceListResponse['meta'] = {
  limit: 20,
  hasNextPage: false,
  nextCursor: null,
};

@Component({
  selector: 'app-service-list',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './service-list.component.html',
  styleUrl: './service-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceListComponent {
  private readonly api = inject(ServicesApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private requestSequence = 0;
  private cursorHistory: readonly (string | undefined)[] = [undefined];
  private cursorIndex = 0;
  private lastPageSize = 20;
  private lastSort = '';

  readonly services = signal<readonly Service[]>([]);
  readonly meta = signal<ServiceListResponse['meta']>(EMPTY_META);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly sortBy = new FormControl<ServiceSortField>('createdAt', { nonNullable: true });
  readonly sortOrder = new FormControl<'asc' | 'desc'>('desc', { nonNullable: true });
  readonly pageSize = new FormControl(20, { nonNullable: true });
  readonly name = new FormControl('', { nonNullable: true });
  readonly category = new FormControl<ServiceCategory | ''>('', { nonNullable: true });
  readonly active = new FormControl<'all' | 'active' | 'inactive'>('all', { nonNullable: true });
  readonly categories = Object.values(ServiceCategory);
  readonly sortFields: readonly ServiceSortField[] = [
    'serviceId',
    'name',
    'category',
    'price',
    'createdAt',
  ];
  readonly pageSizes = [20, 50, 100] as const;
  readonly canManage = () => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager;
  };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const query = this.queryFromParams(params);
      const sortKey = `${query.sortBy}:${query.sortOrder}`;
      if (this.lastSort && (this.lastSort !== sortKey || this.lastPageSize !== query.limit)) {
        this.resetCursor();
      }
      this.lastSort = sortKey;
      this.lastPageSize = query.limit;
      this.sortBy.setValue(query.sortBy, { emitEvent: false });
      this.sortOrder.setValue(query.sortOrder, { emitEvent: false });
      this.pageSize.setValue(query.limit, { emitEvent: false });
      this.name.setValue(query.name ?? '', { emitEvent: false });
      this.category.setValue(query.category ?? '', { emitEvent: false });
      this.active.setValue(
        query.isActive === undefined ? 'all' : query.isActive ? 'active' : 'inactive',
        { emitEvent: false },
      );
      this.load({ ...query, cursor: undefined }, this.cursorIndex + 1);
    });
  }

  applySorting(): void {
    this.resetCursor();
    const query: ServiceQuery = {
      limit: this.pageSizes.includes(this.pageSize.value as (typeof this.pageSizes)[number])
        ? this.pageSize.value
        : 20,
      sortBy: this.sortBy.value,
      sortOrder: this.sortOrder.value,
      name: this.name.value.trim() || undefined,
      category: this.category.value || undefined,
      isActive: this.active.value === 'all' ? undefined : this.active.value === 'active',
    };
    this.lastSort = `${query.sortBy}:${query.sortOrder}`;
    this.lastPageSize = query.limit;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sortBy: this.sortBy.value,
        sortOrder: this.sortOrder.value,
        limit: this.pageSize.value,
        name: this.name.value.trim() || null,
        category: this.category.value || null,
        isActive: this.active.value === 'all' ? null : this.active.value === 'active',
      },
      queryParamsHandling: 'merge',
    });
    this.load(query, 1);
  }

  nextPage(): void {
    const nextCursor = this.meta().nextCursor;
    if (this.loading() || !this.meta().hasNextPage || !nextCursor) return;
    const page = this.currentPage();
    this.cursorHistory = [...this.cursorHistory.slice(0, page + 1), nextCursor];
    this.cursorIndex = page;
    this.load(this.queryFromParams(this.route.snapshot.queryParamMap, nextCursor), page + 1);
  }

  previousPage(): void {
    if (this.loading() || this.cursorIndex === 0) return;
    this.cursorIndex -= 1;
    this.load(
      this.queryFromParams(this.route.snapshot.queryParamMap, this.cursorHistory[this.cursorIndex]),
      this.cursorIndex + 1,
    );
  }

  retry(): void {
    this.load(
      this.queryFromParams(this.route.snapshot.queryParamMap, this.cursorHistory[this.cursorIndex]),
      this.currentPage(),
    );
  }

  label(value: string | undefined): string {
    if (!value?.trim()) return '—';
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  categoryLabel(value: ServiceCategory): string {
    return this.label(value);
  }

  private load(query: ServiceQuery, page: number): void {
    const request = ++this.requestSequence;
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list(query)
      .pipe(
        finalize(() => {
          if (request === this.requestSequence) this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (request !== this.requestSequence) return;
          this.services.set(response.data);
          this.meta.set(response.meta);
          this.currentPage.set(page);
        },
        error: (error: unknown) => {
          if (request !== this.requestSequence) return;
          this.services.set([]);
          this.meta.set(EMPTY_META);
          this.error.set(
            error instanceof ApiError ? error.message : 'Services could not be loaded.',
          );
        },
      });
  }

  private resetCursor(): void {
    this.cursorHistory = [undefined];
    this.cursorIndex = 0;
  }

  private queryFromParams(
    params: { get(name: string): string | null },
    cursor?: string,
  ): ServiceQuery {
    const sortBy = params.get('sortBy') as ServiceSortField | null;
    const sortOrder = params.get('sortOrder');
    const limit = Number(params.get('limit'));
    const active = params.get('isActive');
    return {
      ...(cursor ? { cursor } : {}),
      limit: this.pageSizes.includes(limit as (typeof this.pageSizes)[number]) ? limit : 20,
      sortBy: sortBy && this.sortFields.includes(sortBy) ? sortBy : 'createdAt',
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
      name: params.get('name')?.trim() || undefined,
      category: Object.values(ServiceCategory).includes(params.get('category') as ServiceCategory)
        ? (params.get('category') as ServiceCategory)
        : undefined,
      isActive: active === 'true' ? true : active === 'false' ? false : undefined,
    };
  }
}

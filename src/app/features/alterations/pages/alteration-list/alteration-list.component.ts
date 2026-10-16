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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, finalize, of, switchMap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { AlterationsApiService } from '../../data-access/alterations-api.service';
import {
  AlterationStatus,
  type Alteration,
  type AlterationListMeta,
  type AlterationQuery,
  type AlterationSortField,
  type AlterationSortOrder,
} from '../../models/alteration.model';

const DEFAULT_QUERY: AlterationQuery = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
const DEFAULT_META: AlterationListMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };
const PAGE_SIZES = [10, 20, 50, 100] as const;

function businessIdValidator(prefix: 'CUS' | 'ORD') {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    return value === '' ||
      (typeof value === 'string' && new RegExp(`^${prefix}-\\d{6}$`).test(value))
      ? null
      : { invalidBusinessId: true };
  };
}

@Component({
  selector: 'app-alteration-list',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './alteration-list.component.html',
  styleUrl: './alteration-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlterationListComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(AlterationsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<AlterationQuery>();
  private requestVersion = 0;

  readonly filterForm = this.formBuilder.nonNullable.group({
    customerId: ['', businessIdValidator('CUS')],
    orderId: ['', businessIdValidator('ORD')],
    status: ['' as AlterationStatus | ''],
    sortBy: ['createdAt' as AlterationSortField],
    sortOrder: ['desc' as AlterationSortOrder],
    limit: [20],
  });
  readonly alterations = signal<readonly Alteration[]>([]);
  readonly meta = signal<AlterationListMeta>(DEFAULT_META);
  readonly currentQuery = signal<AlterationQuery>(DEFAULT_QUERY);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly feedback = signal<string | null>(this.navigationFeedback());
  readonly statuses = Object.values(AlterationStatus);
  readonly pageSizes = PAGE_SIZES;
  readonly canCreate = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager || role === Role.Receptionist;
  });

  constructor() {
    this.loadRequests
      .pipe(
        switchMap((query) => {
          const version = ++this.requestVersion;
          this.loading.set(true);
          this.error.set(null);
          this.alterations.set([]);

          return this.api.list(query).pipe(
            catchError((error: unknown) => {
              this.error.set(this.errorMessage(error));
              this.meta.set(DEFAULT_META);
              return of(null);
            }),
            finalize(() => {
              if (version === this.requestVersion) this.loading.set(false);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (!response) return;
        this.alterations.set(response.data);
        this.meta.set(response.meta);
      });

    this.load(DEFAULT_QUERY);
  }

  applyFilters(): void {
    this.filterForm.markAllAsTouched();
    if (this.filterForm.invalid) return;
    this.load(this.queryFromForm(1));
  }

  clearFilters(): void {
    this.filterForm.reset({
      customerId: '',
      orderId: '',
      status: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 20,
    });
    this.load(DEFAULT_QUERY);
  }

  retry(): void {
    this.load(this.currentQuery());
  }

  sortBy(field: AlterationSortField): void {
    const current = this.currentQuery();
    const sortOrder: AlterationSortOrder =
      current.sortBy === field && current.sortOrder === 'asc' ? 'desc' : 'asc';
    this.filterForm.controls.sortBy.setValue(field);
    this.filterForm.controls.sortOrder.setValue(sortOrder);
    this.load({ ...current, page: 1, sortBy: field, sortOrder });
  }

  goToPage(page: number): void {
    const totalPages = this.meta().totalPages;
    if (page < 1 || page > totalPages || page === this.meta().page) return;
    this.load({ ...this.currentQuery(), page });
  }

  pageNumbers(): readonly number[] {
    const total = this.meta().totalPages;
    const current = this.meta().page;
    const start = Math.max(1, Math.min(current - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, index) => start + index);
  }

  firstResult(): number {
    return this.meta().total === 0 ? 0 : (this.meta().page - 1) * this.meta().limit + 1;
  }

  lastResult(): number {
    return Math.min(this.meta().page * this.meta().limit, this.meta().total);
  }

  statusLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }

  sortIndicator(field: AlterationSortField): string | null {
    const query = this.currentQuery();
    if (query.sortBy !== field) return null;
    return query.sortOrder === 'asc' ? 'ascending' : 'descending';
  }

  private load(query: AlterationQuery): void {
    const normalizedQuery = { ...query, page: query.page ?? 1, limit: query.limit ?? 20 };
    this.currentQuery.set(normalizedQuery);
    this.loadRequests.next(normalizedQuery);
  }

  private queryFromForm(page: number): AlterationQuery {
    const values = this.filterForm.getRawValue();
    return {
      page,
      limit: Math.min(100, Math.max(1, values.limit)),
      ...(values.customerId.trim() ? { customerId: values.customerId.trim() } : {}),
      ...(values.orderId.trim() ? { orderId: values.orderId.trim() } : {}),
      ...(values.status ? { status: values.status } : {}),
      sortBy: values.sortBy,
      sortOrder: values.sortOrder,
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof ApiError
      ? error.message
      : 'Alterations could not be loaded. Please try again.';
  }

  private navigationFeedback(): string | null {
    const state = history.state as { feedback?: unknown };
    return typeof state.feedback === 'string' ? state.feedback : null;
  }
}

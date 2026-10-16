import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { CustomersApiService } from '../../data-access/customers-api.service';
import type {
  Customer,
  CustomerListMeta,
  CustomerQuery,
  CustomerSortField,
  SortOrder,
} from '../../models/customer.model';

const DEFAULT_META: CustomerListMeta = { limit: 20, hasNextPage: false, nextCursor: null };

@Component({
  selector: 'app-customer-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerListComponent {
  private readonly api = inject(CustomersApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly retryRequest = new Subject<void>();
  private feedbackTimeout?: ReturnType<typeof setTimeout>;
  private cursorHistory: readonly (string | undefined)[] = [undefined];
  private cursorIndex = 0;

  readonly deactivateDialog = viewChild<ElementRef<HTMLDialogElement>>('deactivateDialog');

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly customers = signal<readonly Customer[]>([]);
  readonly meta = signal<CustomerListMeta>(DEFAULT_META);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deactivating = signal<Customer | null>(null);
  readonly submittingDeactivate = signal(false);
  readonly feedback = signal<string | null>(this.navigationFeedback());
  readonly currentQuery = signal<CustomerQuery>(this.readQuery());

  readonly canCreate = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager || role === Role.Receptionist;
  });
  readonly canManage = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager;
  });
  readonly currentPage = computed(() => this.cursorIndex + 1);

  constructor() {
    if (this.feedback()) this.scheduleFeedbackDismissal();
    this.destroyRef.onDestroy(() => this.clearFeedbackTimeout());

    const query$ = this.route.queryParamMap.pipe(
      map(() => this.readQuery()),
      distinctUntilChanged(
        (previous, current) => JSON.stringify(previous) === JSON.stringify(current),
      ),
      tap((query) => {
        this.cursorHistory = [undefined];
        this.cursorIndex = 0;
        this.currentQuery.set(query);
        this.searchControl.setValue(query.search ?? '', { emitEvent: false });
      }),
    );

    combineLatest([query$, this.retryRequest.pipe(startWith(undefined))])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(([query]) =>
          this.api.list({ ...query, cursor: undefined }).pipe(
            catchError((error: unknown) => {
              this.customers.set([]);
              this.meta.set(DEFAULT_META);
              this.error.set(this.errorMessage(error));
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (!response) return;
        this.customers.set(response.data);
        this.meta.set(response.meta);
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.updateQuery({ search: search.trim() || null }));
  }

  retry(): void {
    this.retryRequest.next();
  }

  clearFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  setStatus(value: string): void {
    this.updateQuery({ isActive: value || null });
  }

  setLimit(value: string): void {
    this.updateQuery({ limit: Number(value) });
  }

  sortBy(field: CustomerSortField): void {
    const current = this.currentQuery();
    const sortOrder: SortOrder =
      current.sortBy === field && current.sortOrder === 'asc' ? 'desc' : 'asc';
    this.updateQuery({ sortBy: field, sortOrder });
  }

  nextPage(): void {
    const cursor = this.meta().nextCursor;
    if (this.loading() || !this.meta().hasNextPage || !cursor) return;
    this.cursorHistory = [...this.cursorHistory.slice(0, this.cursorIndex + 1), cursor];
    this.cursorIndex += 1;
    this.loadCursor({ ...this.currentQuery(), cursor });
  }

  previousPage(): void {
    if (this.loading() || this.cursorIndex === 0) return;
    this.cursorIndex -= 1;
    this.loadCursor({ ...this.currentQuery(), cursor: this.cursorHistory[this.cursorIndex] });
  }

  customerQueryParams(): Record<string, string | number> {
    const query = this.currentQuery();
    const params: Record<string, string | number> = {
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
    if (query.search) params['search'] = query.search;
    if (query.isActive !== undefined) params['isActive'] = String(query.isActive);
    return params;
  }

  requestDeactivate(customer: Customer): void {
    this.deactivating.set(customer);
    this.deactivateDialog()?.nativeElement.showModal();
  }

  activateCustomer(customer: Customer): void {
    if (this.submittingDeactivate() || !window.confirm(`Reactivate ${customer.name}?`)) return;
    this.submittingDeactivate.set(true);
    this.error.set(null);
    this.api
      .activate(customer._id)
      .pipe(
        finalize(() => this.submittingDeactivate.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.showFeedback(`${customer.name} was reactivated.`);
          this.retry();
        },
        error: (error: unknown) => this.error.set(this.errorMessage(error)),
      });
  }

  cancelDeactivate(): void {
    if (!this.submittingDeactivate()) this.deactivateDialog()?.nativeElement.close();
  }

  confirmDeactivate(): void {
    const customer = this.deactivating();
    if (!customer || this.submittingDeactivate()) return;

    this.submittingDeactivate.set(true);
    this.error.set(null);
    this.api
      .deactivate(customer._id)
      .pipe(
        finalize(() => this.submittingDeactivate.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.deactivateDialog()?.nativeElement.close();
          this.showFeedback(`${customer.name} was deactivated.`);
          this.retry();
        },
        error: (error: unknown) => {
          this.deactivateDialog()?.nativeElement.close();
          this.error.set(this.errorMessage(error));
        },
      });
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    this.scheduleFeedbackDismissal();
  }

  private scheduleFeedbackDismissal(): void {
    this.clearFeedbackTimeout();
    this.feedbackTimeout = setTimeout(() => this.feedback.set(null), 10_000);
  }

  private clearFeedbackTimeout(): void {
    if (this.feedbackTimeout !== undefined) clearTimeout(this.feedbackTimeout);
    this.feedbackTimeout = undefined;
  }

  dialogClosed(): void {
    this.deactivating.set(null);
  }

  dialogCancelled(event: Event): void {
    if (this.submittingDeactivate()) event.preventDefault();
  }

  sortIndicator(field: CustomerSortField): string {
    const query = this.currentQuery();
    if (query.sortBy !== field) return '';
    return query.sortOrder === 'asc' ? 'ascending' : 'descending';
  }

  private loadCursor(query: CustomerQuery): void {
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
          this.customers.set(response.data);
          this.meta.set(response.meta);
        },
        error: (error: unknown) => {
          this.customers.set([]);
          this.error.set(this.errorMessage(error));
        },
      });
  }

  private updateQuery(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private readQuery(): CustomerQuery {
    const params = this.route.snapshot.queryParamMap;
    const limitCandidate = this.positiveInteger(params.get('limit'), 20);
    const limit = Math.min(limitCandidate, 100);
    const sortFields: readonly CustomerSortField[] = ['name', 'phone', 'customerId', 'createdAt'];
    const sortByCandidate = params.get('sortBy') as CustomerSortField | null;
    const sortBy =
      sortByCandidate && sortFields.includes(sortByCandidate) ? sortByCandidate : 'createdAt';
    const sortOrder: SortOrder = params.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const status = params.get('isActive');
    const isActive = status === 'true' ? true : status === 'false' ? false : undefined;
    const search = params.get('search')?.trim().slice(0, 100) || undefined;
    return { limit, search, sortBy, sortOrder, isActive };
  }

  private positiveInteger(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private navigationFeedback(): string | null {
    const state = history.state as { feedback?: unknown };
    return typeof state.feedback === 'string' ? state.feedback : null;
  }

  private errorMessage(error: unknown): string {
    return error instanceof ApiError
      ? error.message
      : 'Customers could not be loaded. Please try again.';
  }
}

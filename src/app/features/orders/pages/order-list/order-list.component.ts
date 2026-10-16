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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import type { Customer } from '@features/customers/models/customer.model';
import { Role } from '@shared/models/user.model';
import { OrdersApiService } from '../../data-access/orders-api.service';
import type { CursorPaginatedOrders, OrderWithItems } from '../../models/order.model';

const EMPTY_CURSOR_META: CursorPaginatedOrders['meta'] = {
  limit: 20,
  hasNextPage: false,
  nextCursor: null,
};

@Component({
  selector: 'app-order-list',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderListComponent {
  private readonly customersApi = inject(CustomersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private requestSequence = 0;
  private customerSearchSequence = 0;
  private cursorHistory: readonly (string | undefined)[] = [undefined];
  readonly search = new FormControl('', { nonNullable: true });
  readonly results = signal<readonly Customer[]>([]);
  readonly customer = signal<Customer | null>(null);
  readonly orders = signal<readonly OrderWithItems[]>([]);
  readonly searching = signal(false);
  readonly loading = signal(false);
  readonly cursorMeta = signal<CursorPaginatedOrders['meta']>(EMPTY_CURSOR_META);
  readonly currentPage = signal(1);
  readonly error = signal<string | null>(null);
  readonly canCreate = computed(() =>
    [Role.SuperAdmin, Role.Manager, Role.Receptionist].includes(this.auth.user()?.role as Role),
  );
  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchCustomers(value));
    const customerId = this.route.snapshot.queryParamMap.get('customerId');
    if (customerId) this.loadCustomer(customerId);
    else this.loadAll(undefined, 1);
  }
  selectCustomer(customer: Customer): void {
    this.customer.set(customer);
    this.results.set([]);
    this.search.setValue(customer.name, { emitEvent: false });
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { customerId: customer.customerId },
      replaceUrl: true,
    });
    this.loadOrders(customer.customerId);
  }
  clearCustomer(): void {
    this.customer.set(null);
    this.search.setValue('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.loadAll(undefined, 1);
  }
  retry(): void {
    const customer = this.customer();
    if (customer) this.loadOrders(customer.customerId);
    else this.loadCurrentPage();
  }
  nextPage(): void {
    const meta = this.cursorMeta();
    const page = this.currentPage();
    if (this.customer() || this.loading() || !meta.hasNextPage || !meta.nextCursor) return;
    this.cursorHistory = [...this.cursorHistory.slice(0, page + 1), meta.nextCursor];
    this.loadAll(meta.nextCursor, page + 1);
  }
  previousPage(): void {
    const page = this.currentPage();
    if (this.customer() || this.loading() || page <= 1) return;
    this.loadAll(this.cursorHistory[page - 2], page - 1);
  }
  statusLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }
  private searchCustomers(value: string): void {
    const search = value.trim();
    if (search.length < 2 || this.customer()) {
      this.results.set([]);
      return;
    }
    const request = ++this.customerSearchSequence;
    this.searching.set(true);
    this.customersApi
      .list({ limit: 10, search, sortBy: 'name', sortOrder: 'asc', isActive: true })
      .pipe(
        finalize(() => {
          if (request === this.customerSearchSequence) this.searching.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (request === this.customerSearchSequence) this.results.set(response.data);
        },
        error: () => {
          if (request === this.customerSearchSequence) this.results.set([]);
        },
      });
  }
  private loadCustomer(customerId: string): void {
    const request = ++this.requestSequence;
    this.loading.set(true);
    this.customersApi
      .getByCustomerId(customerId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (customer) => {
          if (request !== this.requestSequence) return;
          this.customer.set(customer);
          this.search.setValue(customer.name, { emitEvent: false });
          this.loadOrders(customer.customerId);
        },
        error: (error: unknown) => {
          if (request !== this.requestSequence) return;
          this.error.set(
            error instanceof ApiError ? error.message : 'Customer could not be loaded.',
          );
        },
      });
  }
  private loadOrders(customerId: string): void {
    const request = ++this.requestSequence;
    this.loading.set(true);
    this.error.set(null);
    this.ordersApi
      .getByCustomer(customerId)
      .pipe(
        finalize(() => {
          if (request === this.requestSequence) this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (orders) => {
          if (request !== this.requestSequence) return;
          this.orders.set(orders);
          this.cursorMeta.set(EMPTY_CURSOR_META);
          this.currentPage.set(1);
          this.cursorHistory = [undefined];
        },
        error: (error: unknown) => {
          if (request !== this.requestSequence) return;
          this.error.set(error instanceof ApiError ? error.message : 'Orders could not be loaded.');
        },
      });
  }
  private loadCurrentPage(): void {
    const page = this.currentPage();
    this.loadAll(this.cursorHistory[page - 1], page);
  }
  private loadAll(cursor: string | undefined, page: number): void {
    const request = ++this.requestSequence;
    this.loading.set(true);
    this.error.set(null);
    this.ordersApi
      .getAll(cursor, 20)
      .pipe(
        finalize(() => {
          if (request === this.requestSequence) this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (request !== this.requestSequence) return;
          this.orders.set(response.data);
          this.cursorMeta.set(response.meta);
          this.currentPage.set(page);
        },
        error: (error: unknown) => {
          if (request !== this.requestSequence) return;
          this.error.set(error instanceof ApiError ? error.message : 'Orders could not be loaded.');
        },
      });
  }
}

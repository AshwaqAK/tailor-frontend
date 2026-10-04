import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { OrdersApiService } from '@features/orders/data-access/orders-api.service';
import type { OrderWithItems } from '@features/orders/models/order.model';
import { Role } from '@shared/models/user.model';
import type { Customer } from '../../models/customer.model';

@Component({
  selector: 'app-customer-order-history',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './customer-order-history.component.html',
  styleUrl: './customer-order-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOrderHistoryComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly customer = input.required<Customer>();
  readonly orders = signal<readonly OrderWithItems[]>([]);
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

  statusLabel(status: string): string {
    return status
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private load(customerId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.ordersApi
      .getByCustomer(customerId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (orders) => this.orders.set(orders),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'Order history could not be loaded.',
          ),
      });
  }
}

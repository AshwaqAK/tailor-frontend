import { CurrencyPipe, DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '@core/api/api-error';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import type { Customer } from '@features/customers/models/customer.model';
import { formatMeasurement } from '@features/customers/utils/measurement-fractions';
import { OrdersApiService } from '../../data-access/orders-api.service';
import {
  ORDER_STATUS_TRANSITIONS,
  type OrderItem,
  type OrderStatus,
  type OrderWithItems,
} from '../../models/order.model';

@Component({
  selector: 'app-order-details',
  imports: [CurrencyPipe, DatePipe, KeyValuePipe, RouterLink],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsComponent {
  private readonly api = inject(OrdersApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
  readonly result = signal<OrderWithItems | null>(null);
  readonly customer = signal<Customer | null>(null);
  readonly loading = signal(true);
  readonly updating = signal(false);
  readonly error = signal<string | null>(null);
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getByOrderId(this.orderId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.customersApi
            .getByCustomerId(result.order.customerId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: (customer) => this.customer.set(customer) });
        },
        error: (error: unknown) =>
          this.error.set(error instanceof ApiError ? error.message : 'Order could not be loaded.'),
      });
  }
  allowedStatuses(): readonly OrderStatus[] {
    const result = this.result();
    return result ? ORDER_STATUS_TRANSITIONS[result.order.status] : [];
  }
  updateStatus(status: OrderStatus): void {
    const result = this.result();
    if (!result || this.updating()) return;
    if (!window.confirm(`Change order status to ${this.label(status)}?`)) return;
    this.updating.set(true);
    this.error.set(null);
    this.api
      .updateStatus(result.order.orderId, status)
      .pipe(
        finalize(() => this.updating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (order) => this.result.update((current) => (current ? { ...current, order } : null)),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'Order status could not be updated.',
          ),
      });
  }
  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }
  formatValue(value: number): string {
    return formatMeasurement(value);
  }
  tailoringTotal(item: OrderItem): number {
    return item.quantity * item.unitPrice;
  }
  fabricTotal(item: OrderItem): number {
    const fabric = item.fabricSnapshot;
    return fabric ? fabric.quantityUsed * fabric.pricePerUnit : 0;
  }
  garmentTotal(item: OrderItem): number {
    return this.tailoringTotal(item) + this.fabricTotal(item);
  }
}

import { CurrencyPipe, DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '@core/api/api-error';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import type { Customer } from '@features/customers/models/customer.model';
import { formatMeasurement } from '@features/customers/utils/measurement-fractions';
import { PaymentsApiService } from '@features/payments/data-access/payments-api.service';
import { PaymentMethod, type Payment } from '@features/payments/models/payment.model';
import { OrdersApiService } from '../../data-access/orders-api.service';
import {
  ORDER_STATUS_TRANSITIONS,
  OrderItemType,
  type OrderItem,
  type OrderStatus,
  type OrderWithItems,
} from '../../models/order.model';

function hasAtMostTwoDecimalPlaces(
  control: AbstractControl<number | null>,
): ValidationErrors | null {
  const value = control.value;
  if (value === null || !Number.isFinite(value)) return null;

  const scaledValue = value * 100;
  return Math.abs(scaledValue - Math.round(scaledValue)) <= Number.EPSILON * Math.abs(scaledValue)
    ? null
    : { decimalPlaces: true };
}

@Component({
  selector: 'app-order-details',
  imports: [CurrencyPipe, DatePipe, KeyValuePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsComponent {
  private readonly api = inject(OrdersApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
  readonly result = signal<OrderWithItems | null>(null);
  readonly customer = signal<Customer | null>(null);
  readonly loading = signal(true);
  readonly updating = signal(false);
  readonly error = signal<string | null>(null);
  readonly payments = signal<readonly Payment[]>([]);
  readonly paymentMeta = signal({
    limit: 20,
    hasNextPage: false,
    nextCursor: null as string | null,
  });
  readonly paymentPage = signal(1);
  readonly paymentsLoading = signal(false);
  readonly paymentsError = signal<string | null>(null);
  readonly paymentFormOpen = signal(false);
  readonly paymentSubmitting = signal(false);
  readonly paymentSubmitError = signal<string | null>(null);
  readonly paymentSuccess = signal<string | null>(null);
  readonly paymentDetailsRefreshing = signal(false);
  readonly paymentRefreshError = signal<string | null>(null);
  readonly paymentMethods = Object.values(PaymentMethod);
  readonly paymentForm = new FormGroup({
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      hasAtMostTwoDecimalPlaces,
    ]),
    paymentMethod: new FormControl<PaymentMethod | null>(null, Validators.required),
    transactionId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200), Validators.pattern(/\S/)],
    }),
    notes: new FormControl('', { nonNullable: true, validators: Validators.maxLength(1000) }),
  });
  private paymentCursorHistory: readonly (string | undefined)[] = [undefined];
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
          this.loadPayments();
        },
        error: (error: unknown) =>
          this.error.set(error instanceof ApiError ? error.message : 'Order could not be loaded.'),
      });
  }
  loadPayments(cursor?: string, page = 1): void {
    if (this.paymentsLoading()) return;
    this.paymentsLoading.set(true);
    this.paymentsError.set(null);
    this.paymentsApi
      .getByOrder(this.orderId, { limit: 20, ...(cursor ? { cursor } : {}) })
      .pipe(
        finalize(() => this.paymentsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.payments.set(response.data);
          this.paymentMeta.set(response.meta);
          this.paymentPage.set(page);
        },
        error: (error: unknown) =>
          this.paymentsError.set(
            error instanceof ApiError ? error.message : 'Payments could not be loaded.',
          ),
      });
  }
  nextPaymentPage(): void {
    const meta = this.paymentMeta();
    const page = this.paymentPage();
    if (this.paymentsLoading() || !meta.hasNextPage || !meta.nextCursor) return;
    this.paymentCursorHistory = [...this.paymentCursorHistory.slice(0, page + 1), meta.nextCursor];
    this.loadPayments(meta.nextCursor, page + 1);
  }
  previousPaymentPage(): void {
    const page = this.paymentPage();
    if (this.paymentsLoading() || page <= 1) return;
    this.loadPayments(this.paymentCursorHistory[page - 2], page - 1);
  }
  openPaymentForm(): void {
    if (this.paymentDetailsRefreshing()) return;
    this.paymentSuccess.set(null);
    this.paymentSubmitError.set(null);
    this.paymentFormOpen.set(true);
  }
  closePaymentForm(): void {
    this.paymentForm.reset();
    this.paymentSubmitError.set(null);
    this.paymentFormOpen.set(false);
  }
  submitPayment(): void {
    const result = this.result();
    if (!result || this.paymentSubmitting()) return;
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const { amount, paymentMethod, transactionId, notes } = this.paymentForm.getRawValue();
    if (amount === null || paymentMethod === null) return;

    this.paymentSubmitting.set(true);
    this.paymentSubmitError.set(null);
    this.paymentsApi
      .create({
        orderId: result.order.orderId,
        customerId: result.order.customerId,
        amount,
        paymentMethod,
        ...(transactionId.trim() ? { transactionId: transactionId.trim() } : {}),
        ...(notes ? { notes } : {}),
      })
      .pipe(
        finalize(() => this.paymentSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.closePaymentForm();
          this.paymentSuccess.set('Payment recorded.');
          this.refreshPaymentData();
        },
        error: (error: unknown) =>
          this.paymentSubmitError.set(
            error instanceof ApiError ? error.message : 'Payment could not be recorded.',
          ),
      });
  }
  refreshPaymentData(): void {
    this.paymentDetailsRefreshing.set(true);
    this.paymentRefreshError.set(null);
    forkJoin({
      order: this.api.getByOrderId(this.orderId),
      payments: this.paymentsApi.getByOrder(this.orderId, { limit: 20 }),
    })
      .pipe(
        finalize(() => this.paymentDetailsRefreshing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ order, payments }) => {
          this.result.set(order);
          this.payments.set(payments.data);
          this.paymentMeta.set(payments.meta);
          this.paymentPage.set(1);
          this.paymentCursorHistory = [undefined];
        },
        error: (error: unknown) =>
          this.paymentRefreshError.set(
            error instanceof ApiError
              ? error.message
              : 'Latest payment details could not be refreshed.',
          ),
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
  label(value: string | null | undefined): string {
    if (!value?.trim()) return '';
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }
  formatValue(value: number): string {
    return formatMeasurement(value);
  }
  itemType(item: OrderItem): OrderItemType {
    return item.itemType ?? OrderItemType.TAILORING;
  }
  isFabricSale(item: OrderItem): boolean {
    return this.itemType(item) === OrderItemType.FABRIC_SALE;
  }
  fabricSaleName(item: OrderItem): string {
    return item.fabricSaleSnapshot?.name ?? 'Fabric sale';
  }
  fabricSaleQuantity(item: OrderItem): number {
    return item.fabricSaleSnapshot?.quantitySold ?? item.quantity;
  }
  fabricSaleUnit(item: OrderItem): string | null {
    return item.fabricSaleSnapshot?.unit ? this.label(item.fabricSaleSnapshot.unit) : null;
  }
  fabricSalePrice(item: OrderItem): number | null {
    return item.fabricSaleSnapshot?.pricePerUnit ?? null;
  }
  fabricSaleLineTotal(item: OrderItem): number | null {
    return item.fabricSaleSnapshot?.lineTotal ?? null;
  }
  tailoringTotal(item: OrderItem): number {
    return item.tailoringPricingSnapshot?.finalTailoringTotal ?? item.quantity * item.unitPrice;
  }
  fabricTotal(item: OrderItem): number {
    const fabric = item.fabricSnapshot;
    return fabric ? fabric.quantityUsed * fabric.pricePerUnit : 0;
  }
  garmentTotal(item: OrderItem): number {
    return this.tailoringTotal(item) + this.fabricTotal(item);
  }
  garmentName(item: OrderItem): string {
    const snapshotName = item.tailoringPricingSnapshot?.garmentTypeName?.trim();
    if (snapshotName) return snapshotName;
    if (item.garmentTypeId) return `Garment ${item.garmentTypeId}`;
    return 'Tailoring item';
  }
}

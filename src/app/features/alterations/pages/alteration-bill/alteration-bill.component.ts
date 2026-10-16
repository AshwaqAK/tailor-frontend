import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { AlterationsApiService } from '../../data-access/alterations-api.service';
import type { Alteration } from '../../models/alteration.model';
import { OrdersApiService } from '@features/orders/data-access/orders-api.service';
import type { OrderWithItems } from '@features/orders/models/order.model';
import { PaymentsApiService } from '@features/payments/data-access/payments-api.service';
import { PaymentMethod, type Payment } from '@features/payments/models/payment.model';

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
  selector: 'app-alteration-bill',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './alteration-bill.component.html',
  styleUrl: './alteration-bill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlterationBillComponent {
  private readonly alterationsApi = inject(AlterationsApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alterationId = this.route.snapshot.paramMap.get('alterationId')?.trim() ?? '';
  private readonly billingOrderId =
    this.route.snapshot.paramMap.get('billingOrderId')?.trim() ?? '';

  readonly alteration = signal<Alteration | null>(null);
  readonly bill = signal<OrderWithItems | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly invalidBill = signal(false);
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
  readonly canCreatePayment = computed(() =>
    [Role.SuperAdmin, Role.Manager, Role.Receptionist].includes(this.auth.user()?.role as Role),
  );
  readonly canCollectPayment = computed(
    () => this.canCreatePayment() && (this.bill()?.order.balanceAmount ?? 0) > 0,
  );

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.alterationId || !this.billingOrderId) {
      this.loading.set(false);
      this.paymentsLoading.set(false);
      this.notFound.set(true);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.invalidBill.set(false);
    forkJoin({
      alteration: this.alterationsApi.getByAlterationId(this.alterationId),
      bill: this.ordersApi.getByOrderId(this.billingOrderId),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ alteration, bill }) => {
          if (bill.order.orderType !== 'ALTERATION') {
            this.invalidBill.set(true);
            this.paymentsLoading.set(false);
            return;
          }
          this.alteration.set(alteration);
          this.bill.set(bill);
          this.loadPayments();
        },
        error: (error: unknown) => {
          if (error instanceof ApiError && error.status === 404) {
            this.notFound.set(true);
            this.paymentsLoading.set(false);
            return;
          }
          this.paymentsLoading.set(false);
          this.error.set(
            error instanceof ApiError
              ? error.message
              : 'The alteration bill could not be loaded. Please try again.',
          );
        },
      });
  }

  loadPayments(cursor?: string, page = 1): void {
    if (this.paymentsLoading()) return;
    this.paymentsLoading.set(true);
    this.paymentsError.set(null);
    this.paymentsApi
      .getByOrder(this.billingOrderId, { limit: 20, ...(cursor ? { cursor } : {}) })
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
    if (!this.canCollectPayment() || this.paymentDetailsRefreshing()) return;
    this.paymentForm.reset();
    this.paymentSubmitError.set(null);
    this.paymentSuccess.set(null);
    this.paymentFormOpen.set(true);
  }

  closePaymentForm(): void {
    this.paymentFormOpen.set(false);
    this.paymentForm.reset();
    this.paymentSubmitError.set(null);
  }

  submitPayment(): void {
    const currentBill = this.bill();
    if (!currentBill || this.paymentSubmitting()) return;
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
        orderId: currentBill.order.orderId,
        customerId: currentBill.order.customerId,
        amount,
        paymentMethod,
        ...(transactionId.trim() ? { transactionId: transactionId.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
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
        error: (error: unknown) => {
          const ambiguous = !(error instanceof ApiError) || error.status === 0;
          this.paymentSubmitError.set(
            ambiguous
              ? 'The payment result is uncertain. Bill totals and payment history are being refreshed. Verify the payment before retrying.'
              : error.message || 'Payment could not be recorded.',
          );
          if (ambiguous) this.refreshPaymentData();
        },
      });
  }

  refreshPaymentData(): void {
    if (this.paymentDetailsRefreshing()) return;
    this.paymentDetailsRefreshing.set(true);
    this.paymentRefreshError.set(null);
    forkJoin({
      bill: this.ordersApi.getByOrderId(this.billingOrderId),
      payments: this.paymentsApi.getByOrder(this.billingOrderId, { limit: 20 }),
    })
      .pipe(
        finalize(() => this.paymentDetailsRefreshing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ bill, payments }) => {
          this.bill.set(bill);
          this.payments.set(payments.data);
          this.paymentMeta.set(payments.meta);
          this.paymentPage.set(1);
          this.paymentCursorHistory = [undefined];
        },
        error: (error: unknown) => {
          const message =
            error instanceof ApiError
              ? error.message
              : 'The latest bill and payment history could not be refreshed.';
          this.paymentRefreshError.set(message);
          if (this.paymentSubmitError()) {
            this.paymentSubmitError.set(
              'The payment result is uncertain. Verify the bill and payment history before retrying.',
            );
          }
        },
      });
  }

  backToAlteration(): void {
    void this.router.navigate(['/alterations', this.alterationId]);
  }

  alterationIdForLink(): string {
    return this.alterationId;
  }

  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }
}

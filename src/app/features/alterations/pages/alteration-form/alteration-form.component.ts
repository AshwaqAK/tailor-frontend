import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
} from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AlterationsApiService } from '../../data-access/alterations-api.service';
import type { CreateAlterationRequest } from '../../models/alteration.model';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import type { Customer } from '@features/customers/models/customer.model';
import { OrdersApiService } from '@features/orders/data-access/orders-api.service';
import {
  OrderItemType,
  type Order,
  type OrderItem,
  type OrderWithItems,
} from '@features/orders/models/order.model';

const maxDecimalPlaces = (places: number): ValidatorFn => {
  const multiplier = 10 ** places;
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as number | null;
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    return Math.abs(value * multiplier - Math.round(value * multiplier)) < Number.EPSILON
      ? null
      : { maxDecimalPlaces: { places } };
  };
};

@Component({
  selector: 'app-alteration-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './alteration-form.component.html',
  styleUrl: './alteration-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlterationFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly alterationsApi = inject(AlterationsApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly customerRequests = new Subject<string>();
  private readonly orderRequests = new Subject<string>();
  private allowNavigation = false;

  readonly search = this.formBuilder.control('', { nonNullable: true });
  readonly searchResults = signal<readonly Customer[]>([]);
  readonly customer = signal<Customer | null>(null);
  readonly orders = signal<readonly OrderWithItems[]>([]);
  readonly selectedOrder = signal<OrderWithItems | null>(null);
  readonly orderItems = signal<readonly OrderItem[]>([]);
  readonly loadingSearch = signal(false);
  readonly loadingOrders = signal(false);
  readonly loadingOrderDetails = signal(false);
  readonly ordersError = signal<string | null>(null);
  readonly orderDetailsError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.formBuilder.nonNullable.group({
    customerId: ['', Validators.required],
    originalOrderId: ['', Validators.required],
    originalOrderItemId: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(1000), Validators.pattern(/\S/)]],
    notes: ['', Validators.maxLength(1000)],
    charge: this.formBuilder.control<number | null>(null, [Validators.min(0), maxDecimalPlaces(2)]),
  });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchCustomers(value));

    this.customerRequests
      .pipe(
        switchMap((customerId) => {
          this.loadingOrders.set(true);
          this.ordersError.set(null);
          return this.ordersApi.getByCustomer(customerId).pipe(
            catchError((error: unknown) => {
              this.ordersError.set(this.errorMessage(error, 'Orders could not be loaded.'));
              return of(null);
            }),
            finalize(() => this.loadingOrders.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (!response) {
          this.orders.set([]);
          return;
        }
        this.orders.set(response.filter((result) => !this.isAlterationOrder(result.order)));
      });

    this.orderRequests
      .pipe(
        switchMap((orderId) => {
          this.loadingOrderDetails.set(true);
          this.orderDetailsError.set(null);
          return this.ordersApi.getByOrderId(orderId).pipe(
            catchError((error: unknown) => {
              this.orderDetailsError.set(
                this.errorMessage(error, 'Order details could not be loaded.'),
              );
              return of(null);
            }),
            finalize(() => this.loadingOrderDetails.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (!response) {
          this.orderItems.set([]);
          return;
        }
        this.selectedOrder.set(response);
        this.orderItems.set(response.items.filter((item) => this.isEligibleItem(item)));
      });

    const customerId = this.route.snapshot.queryParamMap.get('customerId');
    if (customerId) this.loadCustomer(customerId);
  }

  selectCustomer(customer: Customer): void {
    if (
      this.form.dirty &&
      this.customer() &&
      !window.confirm('Changing customer will clear the selected order and item. Continue?')
    ) {
      return;
    }
    this.customer.set(customer);
    this.search.setValue(customer.name, { emitEvent: false });
    this.searchResults.set([]);
    this.form.controls.customerId.setValue(customer.customerId);
    this.clearOrderSelection();
    this.customerRequests.next(customer.customerId);
  }

  changeCustomer(): void {
    this.customer.set(null);
    this.search.setValue('');
    this.form.controls.customerId.reset('');
    this.clearOrderSelection();
    this.ordersError.set(null);
  }

  selectOrder(orderId: string): void {
    this.form.controls.originalOrderItemId.reset('');
    this.orderItems.set([]);
    this.selectedOrder.set(null);
    this.orderDetailsError.set(null);
    this.form.controls.originalOrderId.setValue(orderId);
    if (orderId) this.orderRequests.next(orderId);
  }

  selectItem(itemId: string): void {
    this.form.controls.originalOrderItemId.setValue(itemId);
  }

  retryOrders(): void {
    const customerId = this.customer()?.customerId;
    if (customerId) this.customerRequests.next(customerId);
  }

  retryOrderDetails(): void {
    const orderId = this.form.controls.originalOrderId.value;
    if (orderId) this.orderRequests.next(orderId);
  }

  submit(): void {
    if (!this.customer() || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: CreateAlterationRequest = {
      customerId: this.customer()!.customerId,
      originalOrderId: value.originalOrderId,
      originalOrderItemId: value.originalOrderItemId,
      description: value.description.trim(),
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
      ...(value.charge !== null ? { charge: value.charge } : {}),
    };

    this.submitting.set(true);
    this.error.set(null);
    this.alterationsApi
      .create(request)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.allowNavigation = true;
          this.form.markAsPristine();
          void this.router.navigate(['/alterations'], {
            state: { feedback: 'Alteration created successfully.' },
          });
        },
        error: (error: unknown) =>
          this.error.set(this.errorMessage(error, 'Alteration could not be created.')),
      });
  }

  cancel(): void {
    void this.router.navigate(['/alterations']);
  }

  canLeave(): boolean {
    return (
      this.allowNavigation || !this.form.dirty || window.confirm('Discard your unsaved alteration?')
    );
  }

  orderLabel(order: OrderWithItems): string {
    return `${order.order.orderId} · ${order.order.status}`;
  }

  itemLabel(item: OrderItem): string {
    const garmentName = item.tailoringPricingSnapshot?.garmentTypeName?.trim();
    const name =
      garmentName || (item.garmentTypeId ? `Garment ${item.garmentTypeId}` : 'Tailoring item');
    const clothing = item.clothingType ? ` · ${this.label(item.clothingType)}` : '';
    return `${name}${clothing} · Qty ${item.quantity}`;
  }

  private clearOrderSelection(): void {
    this.form.controls.originalOrderId.reset('');
    this.form.controls.originalOrderItemId.reset('');
    this.selectedOrder.set(null);
    this.orderItems.set([]);
  }

  private searchCustomers(value: string): void {
    const search = value.trim();
    if (search.length < 2 || this.customer()) {
      this.searchResults.set([]);
      return;
    }
    this.loadingSearch.set(true);
    this.customersApi
      .list({ page: 1, limit: 10, search, sortBy: 'name', sortOrder: 'asc', isActive: true })
      .pipe(
        finalize(() => this.loadingSearch.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.searchResults.set(response.data),
        error: () => this.searchResults.set([]),
      });
  }

  private loadCustomer(customerId: string): void {
    this.customersApi
      .getByCustomerId(customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customer) => this.selectCustomer(customer),
        error: (error: unknown) =>
          this.error.set(this.errorMessage(error, 'Customer could not be loaded.')),
      });
  }

  private isEligibleItem(item: OrderItem): boolean {
    return item.itemType !== OrderItemType.FABRIC_SALE;
  }

  private isAlterationOrder(order: Order): boolean {
    const responseOrder = order as Order & { readonly orderType?: string };
    return responseOrder.orderType === 'ALTERATION';
  }

  private label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof ApiError ? error.message : fallback;
  }
}

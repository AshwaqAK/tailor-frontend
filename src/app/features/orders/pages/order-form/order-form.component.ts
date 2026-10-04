import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { ApiError } from '@core/api/api-error';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import { MeasurementsApiService } from '@features/customers/data-access/measurements-api.service';
import type { Customer } from '@features/customers/models/customer.model';
import { ClothingType, type Measurement } from '@features/customers/models/measurement.model';
import { OrdersApiService } from '../../data-access/orders-api.service';
import type { CreateOrderRequest } from '../../models/order.model';

type ItemControls = {
  clothingType: FormControl<ClothingType | null>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
  measurementId: FormControl<string>;
  notes: FormControl<string>;
};
type ItemGroup = FormGroup<ItemControls>;

@Component({
  selector: 'app-order-form',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderFormComponent {
  private readonly customersApi = inject(CustomersApiService);
  private readonly measurementsApi = inject(MeasurementsApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private allowNavigation = false;
  readonly search = new FormControl('', { nonNullable: true });
  readonly searchResults = signal<readonly Customer[]>([]);
  readonly customer = signal<Customer | null>(null);
  readonly measurements = signal<readonly Measurement[]>([]);
  readonly searching = signal(false);
  readonly loadingMeasurements = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly clothingTypes = Object.values(ClothingType);
  readonly form = new FormGroup({
    customerId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    orderDate: new FormControl(this.today(), {
      nonNullable: true,
      validators: Validators.required,
    }),
    expectedDeliveryDate: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    items: new FormArray<ItemGroup>([], Validators.required),
  });
  constructor() {
    this.addItem(false);
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchCustomers(value));
    const customerId = this.route.snapshot.queryParamMap.get('customerId');
    if (customerId) this.loadCustomer(customerId);
  }
  get items(): FormArray<ItemGroup> {
    return this.form.controls.items;
  }
  addItem(markDirty = true): void {
    const group = new FormGroup<ItemControls>({
      clothingType: new FormControl<ClothingType | null>(null, Validators.required),
      quantity: new FormControl(1, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)],
      }),
      unitPrice: new FormControl(0, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
      measurementId: new FormControl('', { nonNullable: true, validators: Validators.required }),
      notes: new FormControl('', { nonNullable: true }),
    });
    group.controls.clothingType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => group.controls.measurementId.setValue(''));
    this.items.push(group);
    if (markDirty) this.form.markAsDirty();
  }
  removeItem(index: number): void {
    if (this.items.length === 1) return;
    this.items.removeAt(index);
    this.form.markAsDirty();
  }
  selectCustomer(customer: Customer): void {
    if (
      this.form.dirty &&
      this.customer() &&
      !window.confirm('Changing customer will clear garment selections. Continue?')
    )
      return;
    this.customer.set(customer);
    this.search.setValue(customer.name, { emitEvent: false });
    this.searchResults.set([]);
    this.form.controls.customerId.setValue(customer.customerId);
    this.items.controls.forEach((item) => item.controls.measurementId.setValue(''));
    this.loadMeasurements(customer.customerId);
  }
  changeCustomer(): void {
    this.customer.set(null);
    this.measurements.set([]);
    this.search.setValue('');
    this.form.controls.customerId.setValue('');
  }
  measurementsFor(type: ClothingType | null): readonly Measurement[] {
    return type
      ? this.measurements().filter((measurement) => measurement.clothingType === type)
      : [];
  }
  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }
  total(): number {
    return this.items.controls.reduce(
      (sum, item) => sum + item.controls.quantity.value * item.controls.unitPrice.value,
      0,
    );
  }
  submit(): void {
    const customer = this.customer();
    if (!customer || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: CreateOrderRequest = {
      customerId: customer.customerId,
      orderDate: new Date(`${value.orderDate}T00:00:00`).toISOString(),
      ...(value.expectedDeliveryDate
        ? { expectedDeliveryDate: new Date(`${value.expectedDeliveryDate}T00:00:00`).toISOString() }
        : {}),
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
      items: value.items.map((item) => ({
        clothingType: item.clothingType!,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        measurementId: item.measurementId,
        ...(item.notes.trim() ? { notes: item.notes.trim() } : {}),
      })),
    };
    this.submitting.set(true);
    this.error.set(null);
    this.ordersApi
      .create(request)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.allowNavigation = true;
          this.form.markAsPristine();
          void this.router.navigate(['/orders', result.order.orderId]);
        },
        error: (error: unknown) =>
          this.error.set(error instanceof ApiError ? error.message : 'Order could not be created.'),
      });
  }
  cancel(): void {
    void this.router.navigate(['/orders'], {
      queryParams: this.customer() ? { customerId: this.customer()!.customerId } : {},
    });
  }
  canLeave(): boolean {
    return (
      this.allowNavigation || !this.form.dirty || window.confirm('Discard your unsaved order?')
    );
  }
  private searchCustomers(value: string): void {
    const search = value.trim();
    if (search.length < 2 || this.customer()) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    this.customersApi
      .list({ page: 1, limit: 10, search, sortBy: 'name', sortOrder: 'asc', isActive: true })
      .pipe(
        finalize(() => this.searching.set(false)),
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
          this.error.set(
            error instanceof ApiError ? error.message : 'Customer could not be loaded.',
          ),
      });
  }
  private loadMeasurements(customerId: string): void {
    this.loadingMeasurements.set(true);
    this.measurementsApi
      .getByCustomer(customerId)
      .pipe(
        finalize(() => this.loadingMeasurements.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (measurements) => this.measurements.set(measurements),
        error: (error: unknown) => {
          if (error instanceof ApiError && error.status === 404) this.measurements.set([]);
          else
            this.error.set(
              error instanceof ApiError ? error.message : 'Measurements could not be loaded.',
            );
        },
      });
  }
  private today(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }
}

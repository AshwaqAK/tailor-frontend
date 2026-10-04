import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { ApiError } from '@core/api/api-error';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import { MeasurementsApiService } from '@features/customers/data-access/measurements-api.service';
import type { Customer } from '@features/customers/models/customer.model';
import { ClothingType, type Measurement } from '@features/customers/models/measurement.model';
import { FabricsApiService } from '@features/fabrics/data-access/fabrics-api.service';
import type { Fabric } from '@features/fabrics/models/fabric.model';
import { OrdersApiService } from '../../data-access/orders-api.service';
import type { CreateOrderRequest } from '../../models/order.model';

type ItemControls = {
  clothingType: FormControl<ClothingType | null>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
  measurementId: FormControl<string>;
  fabricId: FormControl<string>;
  fabricQuantity: FormControl<number | null>;
  notes: FormControl<string>;
};
type ItemGroup = FormGroup<ItemControls>;

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
  selector: 'app-order-form',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderFormComponent {
  private readonly customersApi = inject(CustomersApiService);
  private readonly measurementsApi = inject(MeasurementsApiService);
  private readonly fabricsApi = inject(FabricsApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private allowNavigation = false;
  readonly search = new FormControl('', { nonNullable: true });
  readonly searchResults = signal<readonly Customer[]>([]);
  readonly customer = signal<Customer | null>(null);
  readonly measurements = signal<readonly Measurement[]>([]);
  readonly fabrics = signal<readonly Fabric[]>([]);
  readonly searching = signal(false);
  readonly loadingMeasurements = signal(false);
  readonly loadingFabrics = signal(false);
  readonly fabricError = signal<string | null>(null);
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
    this.loadFabrics();
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
      fabricId: new FormControl('', { nonNullable: true }),
      fabricQuantity: new FormControl<number | null>(null),
      notes: new FormControl('', { nonNullable: true }),
    });
    group.controls.clothingType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => group.controls.measurementId.setValue(''));
    group.controls.fabricId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fabricId) => {
        const quantity = group.controls.fabricQuantity;
        quantity.reset(null, { emitEvent: false });
        quantity.setValidators(
          fabricId ? [Validators.required, Validators.min(0.001), maxDecimalPlaces(3)] : [],
        );
        quantity.updateValueAndValidity({ emitEvent: false });
      });
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
  fabricLabel(fabric: Fabric): string {
    return `${fabric.name} · ${fabric.color} (${fabric.quantity} ${fabric.unit.toLowerCase()})`;
  }
  fabricUnitPrice(item: ItemGroup): number {
    const fabricId = item.controls.fabricId.value;
    return this.fabrics().find((fabric) => fabric.fabricId === fabricId)?.pricePerUnit ?? 0;
  }
  tailoringTotal(item: ItemGroup): number {
    return item.controls.quantity.value * item.controls.unitPrice.value;
  }
  fabricCost(item: ItemGroup): number {
    return (item.controls.fabricQuantity.value ?? 0) * this.fabricUnitPrice(item);
  }
  garmentTotal(item: ItemGroup): number {
    return this.tailoringTotal(item) + this.fabricCost(item);
  }
  retryFabrics(): void {
    this.loadFabrics();
  }
  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }
  total(): number {
    return this.items.controls.reduce((sum, item) => sum + this.garmentTotal(item), 0);
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
        ...(item.fabricId
          ? { fabricId: item.fabricId, fabricQuantity: item.fabricQuantity as number }
          : {}),
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
  private loadFabrics(): void {
    this.loadingFabrics.set(true);
    this.fabricError.set(null);
    this.fabricsApi
      .list({
        page: 1,
        limit: 100,
        isActive: true,
        sortBy: 'name',
        sortOrder: 'asc',
      })
      .pipe(
        finalize(() => this.loadingFabrics.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.fabrics.set(response.data.filter((fabric) => fabric.quantity > 0)),
        error: (error: unknown) =>
          this.fabricError.set(
            error instanceof ApiError ? error.message : 'Available fabrics could not be loaded.',
          ),
      });
  }
  private today(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }
}

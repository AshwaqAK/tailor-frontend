import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  EMPTY,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { ApiError } from '@core/api/api-error';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import { MeasurementsApiService } from '@features/customers/data-access/measurements-api.service';
import type { Customer } from '@features/customers/models/customer.model';
import { ClothingType, type Measurement } from '@features/customers/models/measurement.model';
import { GarmentTypeService } from '@features/garment-types/services/garment-type.service';
import {
  CustomizationInputType,
  type CustomizationGroup,
  type GarmentType,
} from '@features/garment-types/models/garment-type.model';
import { FabricsApiService } from '@features/fabrics/data-access/fabrics-api.service';
import { QuantityUnit, type Fabric } from '@features/fabrics/models/fabric.model';
import { OrdersApiService } from '../../data-access/orders-api.service';
import {
  OrderItemType,
  type CreateOrderRequest,
  type PricingPreviewResponse,
} from '../../models/order.model';

type ItemControls = {
  itemType: FormControl<OrderItemType>;
  garmentTypeId: FormControl<string | null>;
  clothingType: FormControl<ClothingType | null>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
  measurementId: FormControl<string>;
  fabricId: FormControl<string>;
  fabricQuantity: FormControl<number | null>;
  customizations: FormGroup;
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
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderFormComponent {
  readonly OrderItemType = OrderItemType;
  private readonly customersApi = inject(CustomersApiService);
  private readonly measurementsApi = inject(MeasurementsApiService);
  private readonly garmentTypesApi = inject(GarmentTypeService);
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
  readonly garmentTypes = signal<readonly GarmentType[]>([]);
  readonly fabrics = signal<readonly Fabric[]>([]);
  readonly searching = signal(false);
  readonly loadingMeasurements = signal(false);
  readonly loadingGarmentTypes = signal(true);
  readonly garmentTypeError = signal<string | null>(null);
  readonly loadingFabrics = signal(false);
  readonly fabricError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly pricingPreviews = signal<ReadonlyMap<ItemGroup, PricingPreviewResponse>>(new Map());
  readonly pricingPreviewLoading = signal<ReadonlySet<ItemGroup>>(new Set());
  readonly pricingPreviewErrors = signal<ReadonlyMap<ItemGroup, string>>(new Map());
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
    this.loadGarmentTypes();
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
      itemType: new FormControl(OrderItemType.Tailoring, { nonNullable: true }),
      garmentTypeId: new FormControl<string | null>(null, Validators.required),
      clothingType: new FormControl<ClothingType | null>(null),
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
      customizations: new FormGroup({}),
      notes: new FormControl('', { nonNullable: true }),
    });
    group.controls.itemType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((itemType) => this.configureItemType(group, itemType));
    group.controls.garmentTypeId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((garmentTypeId) => {
        if (this.isFabricSale(group)) return;
        group.controls.measurementId.setValue('', { emitEvent: false });
        group.controls.clothingType.setValue(this.legacyClothingType(garmentTypeId), {
          emitEvent: false,
        });
        group.setControl('customizations', this.createCustomizationControls(garmentTypeId));
        if (garmentTypeId) this.clearIncompatibleMeasurement(group);
      });
    group.controls.fabricId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.isFabricSale(group)) {
        this.updateFabricSaleQuantityValidators(group);
        return;
      }
      this.updateTailoringFabricQuantityValidators(group, true);
    });
    group.valueChanges
      .pipe(
        map(() => this.pricingPreviewInputKey(group)),
        startWith(this.pricingPreviewInputKey(group)),
        distinctUntilChanged(),
        tap(() => this.clearPricingPreview(group)),
        debounceTime(300),
        switchMap(() => this.requestPricingPreview(group)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((preview) => this.setPricingPreview(group, preview));
    this.configureItemType(group, OrderItemType.Tailoring, false);
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
  measurementsFor(garmentTypeId: string | null): readonly Measurement[] {
    return garmentTypeId
      ? this.measurements().filter((measurement) => measurement.garmentTypeId === garmentTypeId)
      : [];
  }
  garmentTypeFor(garmentTypeId: string | null): GarmentType | null {
    return (
      this.garmentTypes().find((garmentType) => garmentType.garmentTypeId === garmentTypeId) ?? null
    );
  }
  garmentLabel(garmentType: GarmentType): string {
    return `${garmentType.name} (${garmentType.code})`;
  }
  customizationGroups(item: ItemGroup): readonly CustomizationGroup[] {
    return this.garmentTypeFor(item.controls.garmentTypeId.value)?.customizationGroups ?? [];
  }
  customizationType(group: CustomizationGroup): CustomizationInputType | null {
    return group.options[0]?.inputType ?? null;
  }
  customizationControl(item: ItemGroup, group: CustomizationGroup) {
    return item.controls.customizations.controls[group.name];
  }
  isMultiSelected(item: ItemGroup, group: CustomizationGroup, optionName: string): boolean {
    const value = this.customizationControl(item, group)?.value;
    return Array.isArray(value) && value.includes(optionName);
  }
  toggleMultiSelection(
    item: ItemGroup,
    group: CustomizationGroup,
    optionName: string,
    selected: boolean,
  ): void {
    const control = this.customizationControl(item, group);
    if (!control) return;
    const values = Array.isArray(control.value) ? [...control.value] : [];
    const index = values.indexOf(optionName);
    if (selected && index === -1) values.push(optionName);
    if (!selected && index !== -1) values.splice(index, 1);
    control.setValue(values);
    control.markAsTouched();
  }
  customizationError(item: ItemGroup, group: CustomizationGroup): string | null {
    const control = this.customizationControl(item, group);
    return control?.touched && control.invalid ? 'This customization is required.' : null;
  }
  pricingPreviewFor(item: ItemGroup): PricingPreviewResponse | null {
    return this.pricingPreviews().get(item) ?? null;
  }
  pricingPreviewIsLoading(item: ItemGroup): boolean {
    return this.pricingPreviewLoading().has(item);
  }
  pricingPreviewErrorFor(item: ItemGroup): string | null {
    return this.pricingPreviewErrors().get(item) ?? null;
  }
  fabricLabel(fabric: Fabric): string {
    return `${fabric.name} · ${fabric.color} (${fabric.quantity} ${fabric.unit.toLowerCase()})`;
  }
  fabricUnitPrice(item: ItemGroup): number {
    const fabricId = item.controls.fabricId.value;
    return this.fabrics().find((fabric) => fabric.fabricId === fabricId)?.pricePerUnit ?? 0;
  }
  selectedFabric(item: ItemGroup): Fabric | null {
    const fabricId = item.controls.fabricId.value;
    return this.fabrics().find((fabric) => fabric.fabricId === fabricId) ?? null;
  }
  isFabricSale(item: ItemGroup): boolean {
    return item.controls.itemType.value === OrderItemType.FabricSale;
  }
  saleQuantityStep(item: ItemGroup): string {
    return this.selectedFabric(item)?.unit === QuantityUnit.Piece ? '1' : '0.001';
  }
  saleQuantityMin(item: ItemGroup): number {
    return this.selectedFabric(item)?.unit === QuantityUnit.Piece ? 1 : 0.001;
  }
  saleQuantityInputMode(item: ItemGroup): 'numeric' | 'decimal' {
    return this.selectedFabric(item)?.unit === QuantityUnit.Piece ? 'numeric' : 'decimal';
  }
  saleQuantityUnit(item: ItemGroup): string {
    return this.selectedFabric(item)?.unit.toLowerCase() ?? 'unit';
  }
  fabricSaleCost(item: ItemGroup): number | null {
    const fabric = this.selectedFabric(item);
    const quantity = item.controls.quantity.value;
    return fabric && item.controls.quantity.valid ? fabric.pricePerUnit * quantity : null;
  }
  fabricSaleCostDisplay(item: ItemGroup): number {
    return this.fabricSaleCost(item) ?? 0;
  }
  tailoringPerGarment(item: ItemGroup): number | null {
    return this.pricingPreviewFor(item)?.calculatedPerGarmentTailoringAmount ?? null;
  }
  tailoringTotal(item: ItemGroup): number | null {
    return this.pricingPreviewFor(item)?.finalTailoringTotal ?? null;
  }
  fabricCost(item: ItemGroup): number {
    return (item.controls.fabricQuantity.value ?? 0) * this.fabricUnitPrice(item);
  }
  garmentTotal(item: ItemGroup): number | null {
    const tailoringTotal = this.tailoringTotal(item);
    return tailoringTotal === null ? null : tailoringTotal + this.fabricCost(item);
  }
  retryFabrics(): void {
    this.loadFabrics();
  }
  retryGarmentTypes(): void {
    this.loadGarmentTypes();
  }
  total(): number | null {
    const lineTotals = this.items.controls.map((item) =>
      this.isFabricSale(item) ? this.fabricSaleCost(item) : this.garmentTotal(item),
    );
    return lineTotals.some((value) => value === null)
      ? null
      : lineTotals.reduce<number>((sum, value) => sum + (value ?? 0), 0);
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
      items: value.items.map((item, index) => {
        if (item.itemType === OrderItemType.FabricSale) {
          return {
            itemType: OrderItemType.FabricSale,
            fabricId: item.fabricId,
            quantity: item.quantity,
            ...(item.notes.trim() ? { notes: item.notes.trim() } : {}),
          };
        }
        return {
          itemType: OrderItemType.Tailoring,
          garmentTypeId: item.garmentTypeId!,
          ...(item.clothingType ? { clothingType: item.clothingType } : {}),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          measurementId: item.measurementId,
          ...(this.customizationPayload(this.items.at(index))
            ? { customizations: this.customizationPayload(this.items.at(index)) }
            : {}),
          ...(item.fabricId
            ? { fabricId: item.fabricId, fabricQuantity: item.fabricQuantity as number }
            : {}),
          ...(item.notes.trim() ? { notes: item.notes.trim() } : {}),
        };
      }),
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
  private loadGarmentTypes(): void {
    this.loadingGarmentTypes.set(true);
    this.garmentTypeError.set(null);
    this.garmentTypesApi
      .list()
      .pipe(
        finalize(() => this.loadingGarmentTypes.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (garmentTypes) => this.garmentTypes.set(garmentTypes),
        error: (error: unknown) =>
          this.garmentTypeError.set(
            error instanceof ApiError ? error.message : 'Garment types could not be loaded.',
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
        next: (measurements) => {
          this.measurements.set(measurements);
          this.items.controls.forEach((item) => this.clearIncompatibleMeasurement(item));
        },
        error: (error: unknown) => {
          if (error instanceof ApiError && error.status === 404) this.measurements.set([]);
          else
            this.error.set(
              error instanceof ApiError ? error.message : 'Measurements could not be loaded.',
            );
        },
      });
  }
  private clearIncompatibleMeasurement(item: ItemGroup): void {
    const measurementId = item.controls.measurementId.value;
    if (
      measurementId &&
      !this.measurementsFor(item.controls.garmentTypeId.value).some(
        (measurement) => measurement._id === measurementId,
      )
    ) {
      item.controls.measurementId.setValue('');
    }
  }
  private configureItemType(item: ItemGroup, itemType: OrderItemType, clearValues = true): void {
    if (clearValues) {
      item.controls.garmentTypeId.reset(null, { emitEvent: false });
      item.controls.clothingType.reset(null, { emitEvent: false });
      item.controls.measurementId.reset('', { emitEvent: false });
      item.controls.quantity.reset(1, { emitEvent: false });
      item.controls.unitPrice.reset(0, { emitEvent: false });
      item.controls.fabricId.reset('', { emitEvent: false });
      item.controls.fabricQuantity.reset(null, { emitEvent: false });
      item.setControl('customizations', this.createCustomizationControls(null));
      item.controls.notes.reset('', { emitEvent: false });
      this.clearPricingPreview(item);
    }

    if (itemType === OrderItemType.FabricSale) {
      item.controls.garmentTypeId.clearValidators();
      item.controls.measurementId.clearValidators();
      item.controls.unitPrice.clearValidators();
      item.controls.fabricId.setValidators(Validators.required);
      item.controls.fabricQuantity.clearValidators();
      this.updateFabricSaleQuantityValidators(item);
    } else {
      item.controls.garmentTypeId.setValidators(Validators.required);
      item.controls.measurementId.setValidators(Validators.required);
      item.controls.unitPrice.setValidators([Validators.required, Validators.min(0)]);
      item.controls.fabricId.clearValidators();
      this.updateTailoringFabricQuantityValidators(item, false);
      item.controls.quantity.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.pattern(/^\d+$/),
      ]);
    }
    item.controls.garmentTypeId.updateValueAndValidity({ emitEvent: false });
    item.controls.measurementId.updateValueAndValidity({ emitEvent: false });
    item.controls.unitPrice.updateValueAndValidity({ emitEvent: false });
    item.controls.fabricId.updateValueAndValidity({ emitEvent: false });
    item.controls.fabricQuantity.updateValueAndValidity({ emitEvent: false });
    item.controls.quantity.updateValueAndValidity({ emitEvent: false });
  }
  private updateTailoringFabricQuantityValidators(item: ItemGroup, clearValue: boolean): void {
    const quantity = item.controls.fabricQuantity;
    if (clearValue) quantity.reset(null, { emitEvent: false });
    quantity.setValidators(
      item.controls.fabricId.value
        ? [Validators.required, Validators.min(0.001), maxDecimalPlaces(3)]
        : [],
    );
    quantity.updateValueAndValidity({ emitEvent: false });
  }
  private updateFabricSaleQuantityValidators(item: ItemGroup): void {
    const quantity = item.controls.quantity;
    const isPiece = this.selectedFabric(item)?.unit === QuantityUnit.Piece;
    quantity.setValidators(
      isPiece
        ? [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]
        : [Validators.required, Validators.min(0.001), maxDecimalPlaces(3)],
    );
    quantity.updateValueAndValidity({ emitEvent: false });
  }
  private legacyClothingType(garmentTypeId: string | null): ClothingType | null {
    const code = this.garmentTypeFor(garmentTypeId)?.code;
    return code && Object.values(ClothingType).includes(code as ClothingType)
      ? (code as ClothingType)
      : null;
  }
  private createCustomizationControls(garmentTypeId: string | null): FormGroup {
    const garmentType = this.garmentTypeFor(garmentTypeId);
    const controls: Record<string, FormControl> = {};
    for (const group of garmentType?.customizationGroups ?? []) {
      const type = this.customizationType(group);
      const required = this.isCustomizationRequired(group);
      if (type === CustomizationInputType.MultiSelect) {
        controls[group.name] = new FormControl<string[]>([], {
          nonNullable: true,
          validators: required ? Validators.required : [],
        });
      } else if (type === CustomizationInputType.Boolean) {
        controls[group.name] = new FormControl(false, { nonNullable: true });
      } else if (type === CustomizationInputType.Number) {
        controls[group.name] = new FormControl<number | null>(null, {
          validators: [Validators.min(0), ...(required ? [Validators.required] : [])],
        });
      } else {
        controls[group.name] = new FormControl<string | null>(null, {
          validators: required ? Validators.required : [],
        });
      }
    }
    return new FormGroup(controls);
  }
  private isCustomizationRequired(group: CustomizationGroup): boolean {
    const configured = group as CustomizationGroup & { readonly required?: boolean };
    return configured.required === true;
  }
  private customizationPayload(item: ItemGroup): Readonly<Record<string, unknown>> | undefined {
    const values = item.controls.customizations.getRawValue() as Record<string, unknown>;
    const selected: Record<string, unknown> = {};
    for (const [groupName, value] of Object.entries(values)) {
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'boolean' && !value) continue;
      selected[groupName] = value;
    }
    return Object.keys(selected).length ? selected : undefined;
  }
  private pricingPreviewInputKey(item: ItemGroup): string {
    return JSON.stringify({
      itemType: item.controls.itemType.value,
      garmentTypeId: item.controls.garmentTypeId.value,
      quantity: item.controls.quantity.value,
      customizations: item.controls.customizations.getRawValue(),
    });
  }
  private requestPricingPreview(item: ItemGroup) {
    if (this.isFabricSale(item)) return EMPTY;
    const garmentTypeId = item.controls.garmentTypeId.value;
    const quantity = item.controls.quantity.value;
    if (
      !garmentTypeId ||
      item.controls.quantity.invalid ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      item.controls.customizations.invalid
    ) {
      return EMPTY;
    }
    this.setPricingPreviewLoading(item, true);
    return this.ordersApi
      .previewPricing({
        garmentTypeId,
        quantity,
        ...(this.customizationPayload(item)
          ? { customizations: this.customizationPayload(item) }
          : {}),
      })
      .pipe(
        catchError((error: unknown) => {
          this.setPricingPreviewError(
            item,
            error instanceof ApiError
              ? error.message
              : 'Tailoring price preview could not be loaded.',
          );
          return EMPTY;
        }),
        finalize(() => this.setPricingPreviewLoading(item, false)),
      );
  }
  private clearPricingPreview(item: ItemGroup): void {
    this.pricingPreviews.update((previews) => {
      const next = new Map(previews);
      next.delete(item);
      return next;
    });
    this.setPricingPreviewError(item, null);
    this.setPricingPreviewLoading(item, false);
  }
  private setPricingPreview(item: ItemGroup, preview: PricingPreviewResponse): void {
    this.pricingPreviews.update((previews) => new Map(previews).set(item, preview));
    this.setPricingPreviewError(item, null);
  }
  private setPricingPreviewLoading(item: ItemGroup, loading: boolean): void {
    this.pricingPreviewLoading.update((items) => {
      const next = new Set(items);
      if (loading) next.add(item);
      else next.delete(item);
      return next;
    });
  }
  private setPricingPreviewError(item: ItemGroup, message: string | null): void {
    this.pricingPreviewErrors.update((errors) => {
      const next = new Map(errors);
      if (message) next.set(item, message);
      else next.delete(item);
      return next;
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

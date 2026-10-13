import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormRecord,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, map, of } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { CustomersApiService } from '../../data-access/customers-api.service';
import { MeasurementsApiService } from '../../data-access/measurements-api.service';
import { GarmentTypeService } from '@features/garment-types/services/garment-type.service';
import type { Customer } from '../../models/customer.model';
import {
  ClothingType,
  FitPreference,
  type CreateMeasurementRequest,
  type Measurement,
  type UpdateMeasurementRequest,
} from '../../models/measurement.model';
import type {
  GarmentType,
  MeasurementField,
} from '@features/garment-types/models/garment-type.model';
import {
  FRACTION_OPTIONS,
  adjustMeasurement,
  combineMeasurement,
  formatMeasurement,
  splitMeasurement,
} from '../../utils/measurement-fractions';

type EntryControls = { whole: FormControl<number | null>; fraction: FormControl<number> };
type EntryGroup = FormGroup<EntryControls>;

const entryValidator =
  (required: boolean): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as { whole: number | null; fraction: number };
    if (value.whole === null) {
      if (value.fraction > 0) return { incompleteMeasurement: true };
      return required ? { requiredMeasurement: true } : null;
    }
    if (!Number.isInteger(value.whole)) return { wholeInches: true };
    if (value.whole < 0) return { negativeMeasurement: true };
    return combineMeasurement(value.whole, value.fraction) > 0 ? null : { zeroMeasurement: true };
  };

@Component({
  selector: 'app-measurement-form-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './measurement-form-page.component.html',
  styleUrl: './measurement-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementFormPageComponent {
  private readonly customersApi = inject(CustomersApiService);
  private readonly measurementsApi = inject(MeasurementsApiService);
  private readonly garmentTypesApi = inject(GarmentTypeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private configuredGarmentTypeId: string | null = null;
  private allowNavigation = false;
  private focusFirst = false;

  readonly customerRecordId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly measurementId = this.route.snapshot.paramMap.get('measurementId');
  readonly editMode = this.measurementId !== null;
  readonly wholeInputs = viewChildren<ElementRef<HTMLInputElement>>('wholeInput');
  readonly customer = signal<Customer | null>(null);
  readonly garmentTypes = signal<readonly GarmentType[]>([]);
  readonly fields = signal<readonly MeasurementField[]>([]);
  readonly activeField = signal<string | null>(null);
  readonly completedFields = signal(0);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly copying = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly copyMessage = signal<string | null>(null);
  readonly clothingTypes = Object.values(ClothingType);
  readonly fitPreferences = Object.values(FitPreference);
  readonly fractions = FRACTION_OPTIONS;
  readonly progressPercent = computed(() =>
    this.fields().length ? Math.round((this.completedFields() / this.fields().length) * 100) : 0,
  );

  readonly form = new FormGroup({
    garmentTypeId: new FormControl<string | null>(null, Validators.required),
    clothingType: new FormControl<ClothingType | null>(null),
    fitPreference: new FormControl<FitPreference | null>(null),
    measuredAt: new FormControl(this.currentLocalDateTime(), {
      nonNullable: true,
      validators: Validators.required,
    }),
    notes: new FormControl('', { nonNullable: true, validators: Validators.maxLength(1000) }),
    measurements: new FormRecord<EntryGroup>({}),
  });

  constructor() {
    effect(() => {
      const inputs = this.wholeInputs();
      if (this.focusFirst && inputs.length) {
        this.focusFirst = false;
        queueMicrotask(() => inputs[0]?.nativeElement.focus());
      }
    });
    this.form.controls.garmentTypeId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((garmentTypeId) => this.changeGarmentType(garmentTypeId));
    this.form.controls.measurements.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateProgress());
    this.loadData();
  }

  entry(field: MeasurementField): EntryGroup {
    const control = this.form.controls.measurements.controls[field.key];
    if (!control) throw new Error(`Missing measurement control: ${field.key}`);
    return control;
  }

  formattedValue(field: MeasurementField): string {
    const value = this.decimalValue(this.entry(field));
    return value === null ? 'Not entered' : formatMeasurement(value);
  }

  fieldError(field: MeasurementField): string | null {
    const control = this.entry(field);
    if (!control.touched || !control.errors) return null;
    if (control.hasError('requiredMeasurement')) return `${field.name} is required.`;
    if (control.hasError('incompleteMeasurement')) return 'Enter whole inches for this fraction.';
    if (control.hasError('wholeInches')) return 'Use a whole number for whole inches.';
    if (control.hasError('negativeMeasurement')) return 'Measurement cannot be negative.';
    if (control.hasError('zeroMeasurement')) return 'Measurement must be greater than zero.';
    return null;
  }

  activate(field: MeasurementField): void {
    this.activeField.set(field.key);
  }
  clearField(field: MeasurementField): void {
    this.entry(field).reset({ whole: null, fraction: 0 });
    this.entry(field).markAsDirty();
  }
  adjust(field: MeasurementField, direction: 1 | -1): void {
    const control = this.entry(field);
    const current = this.decimalValue(control);
    if (current === null && direction === -1) return;
    this.setEntryValue(control, adjustMeasurement(current ?? 0, direction));
    control.markAsDirty();
    control.markAsTouched();
  }
  focusNext(index: number, event: Event): void {
    event.preventDefault();
    this.wholeInputs()[index + 1]?.nativeElement.focus();
  }

  copyLatest(): void {
    const customer = this.customer();
    const garmentTypeId = this.form.controls.garmentTypeId.value;
    if (!customer || !garmentTypeId || this.copying()) return;
    if (
      this.completedFields() &&
      !window.confirm('Replace the entered values with the latest measurement?')
    )
      return;
    this.copying.set(true);
    this.copyMessage.set(null);
    this.measurementsApi
      .getByCustomer(customer.customerId)
      .pipe(
        finalize(() => this.copying.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (items) => {
          const latest = items.find((item) => item.garmentTypeId === garmentTypeId);
          if (!latest) {
            this.copyMessage.set('No previous measurement exists for this garment type.');
            return;
          }
          for (const field of this.fields()) {
            const value = latest.measurements[field.key];
            if (Number.isFinite(value)) {
              this.setEntryValue(this.entry(field), value);
            } else {
              this.entry(field).reset({ whole: null, fraction: 0 });
            }
          }
          this.form.controls.measurements.markAsDirty();
          this.updateProgress();
          this.copyMessage.set(`Copied version ${latest.version}. Review values before saving.`);
          this.focusFirst = true;
        },
        error: (error: unknown) =>
          this.copyMessage.set(
            error instanceof ApiError && error.status !== 404
              ? error.message
              : 'No previous measurement exists for this garment type.',
          ),
      });
  }

  submit(): void {
    const customer = this.customer();
    if (!customer || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!value.garmentTypeId) return;
    const measurements: Record<string, number> = {};
    const unusual: string[] = [];
    for (const field of this.fields()) {
      const decimal = this.decimalValue(this.entry(field));
      if (decimal === null) continue;
      measurements[field.key] = decimal;
      if (decimal > 100) unusual.push(`${field.name}: ${formatMeasurement(decimal)}`);
    }
    if (
      unusual.length &&
      !window.confirm(
        `These measurements are unusually large:\n\n${unusual.join('\n')}\n\nSave them anyway?`,
      )
    )
      return;
    const commonRequest: UpdateMeasurementRequest = {
      garmentTypeId: value.garmentTypeId,
      ...(value.clothingType ? { clothingType: value.clothingType } : {}),
      measurements,
      ...(value.fitPreference ? { fitPreference: value.fitPreference } : {}),
      notes: value.notes.trim(),
      measuredAt: new Date(value.measuredAt).toISOString(),
    };
    const createRequest: CreateMeasurementRequest = {
      customerId: customer.customerId,
      version: 1,
      ...commonRequest,
      garmentTypeId: value.garmentTypeId,
      measurements,
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
      measuredAt: new Date(value.measuredAt).toISOString(),
    };
    this.submitting.set(true);
    this.serverError.set(null);
    const operation =
      this.editMode && this.measurementId
        ? this.measurementsApi.update(this.measurementId, commonRequest)
        : this.measurementsApi.create(createRequest);
    operation
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.allowNavigation = true;
          this.form.markAsPristine();
          void this.router.navigate(['/customers', customer._id], {
            state: {
              feedback: this.editMode
                ? 'Measurement updated successfully.'
                : 'Measurement added successfully.',
            },
          });
        },
        error: (error: unknown) =>
          this.serverError.set(
            error instanceof ApiError ? error.message : 'Measurement could not be saved.',
          ),
      });
  }

  cancel(): void {
    void this.router.navigate(['/customers', this.customerRecordId]);
  }
  canLeave(): boolean {
    return (
      this.allowNavigation ||
      !this.form.dirty ||
      window.confirm('Discard your unsaved measurement changes?')
    );
  }
  label(value: string): string {
    return value.charAt(0) + value.slice(1).toLowerCase();
  }

  selectedGarmentTypeName(): string {
    const garmentTypeId = this.form.controls.garmentTypeId.value;
    return (
      this.garmentTypes().find((garmentType) => garmentType.garmentTypeId === garmentTypeId)
        ?.name ?? 'Garment'
    );
  }

  private changeGarmentType(garmentTypeId: string | null): void {
    const garmentType = this.garmentTypes().find((item) => item.garmentTypeId === garmentTypeId);
    const nextFields = [...(garmentType?.measurementFields ?? [])].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );
    const nextKeys = new Set(nextFields.map((field) => field.key));
    const incompatible = this.fields().some(
      (field) => !nextKeys.has(field.key) && this.decimalValue(this.entry(field)) !== null,
    );
    if (
      incompatible &&
      !window.confirm('Changing garment type will clear measurements that do not apply. Continue?')
    ) {
      this.form.controls.garmentTypeId.setValue(this.configuredGarmentTypeId, {
        emitEvent: false,
      });
      return;
    }
    const previous = new Map<string, number>();
    for (const field of this.fields()) {
      const value = this.decimalValue(this.entry(field));
      if (value !== null && nextKeys.has(field.key)) previous.set(field.key, value);
    }
    for (const key of Object.keys(this.form.controls.measurements.controls))
      this.form.controls.measurements.removeControl(key, { emitEvent: false });
    for (const field of nextFields) {
      const control = this.createEntry(field.required);
      const prior = previous.get(field.key);
      if (prior !== undefined) this.setEntryValue(control, prior);
      this.form.controls.measurements.addControl(field.key, control, { emitEvent: false });
    }
    this.configuredGarmentTypeId = garmentTypeId;
    this.fields.set(nextFields);
    this.activeField.set(nextFields[0]?.key ?? null);
    this.updateProgress();
    this.focusFirst = !!nextFields.length;
  }

  private createEntry(required: boolean): EntryGroup {
    return new FormGroup<EntryControls>(
      {
        whole: new FormControl<number | null>(null, Validators.min(0)),
        fraction: new FormControl(0, { nonNullable: true }),
      },
      { validators: entryValidator(required) },
    );
  }
  private decimalValue(control: EntryGroup): number | null {
    const { whole, fraction } = control.getRawValue();
    return whole === null || !Number.isFinite(whole) ? null : combineMeasurement(whole, fraction);
  }
  private setEntryValue(control: EntryGroup, value: number): void {
    control.setValue(splitMeasurement(value));
  }
  private updateProgress(): void {
    this.completedFields.set(
      this.fields().filter((field) => (this.decimalValue(this.entry(field)) ?? 0) > 0).length,
    );
  }
  private loadData(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const measurement$ = this.editMode
      ? this.measurementsApi
          .getByCustomer(this.customerRecordId)
          .pipe(
            map(
              (measurements) =>
                measurements.find((measurement) => measurement._id === this.measurementId) ?? null,
            ),
          )
      : of(null);

    forkJoin({
      customer: this.customersApi.getById(this.customerRecordId),
      garmentTypes: this.garmentTypesApi.list(),
      measurement: measurement$,
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ customer, garmentTypes, measurement }) => {
          this.customer.set(customer);
          this.garmentTypes.set(garmentTypes);
          if (this.editMode && !measurement) {
            this.loadError.set('Measurement not found.');
            return;
          }
          if (measurement) {
            this.populateMeasurement(measurement);
          }
        },
        error: (error: unknown) =>
          this.loadError.set(
            error instanceof ApiError ? error.message : 'Measurement setup could not be loaded.',
          ),
      });
  }
  private populateMeasurement(measurement: Measurement): void {
    this.form.controls.garmentTypeId.setValue(measurement.garmentTypeId, { emitEvent: false });
    this.form.controls.clothingType.setValue(measurement.clothingType ?? null);
    this.form.controls.fitPreference.setValue(measurement.fitPreference ?? null);
    this.form.controls.measuredAt.setValue(this.toLocalDateTime(measurement.measuredAt));
    this.form.controls.notes.setValue(measurement.notes ?? '');
    this.changeGarmentType(measurement.garmentTypeId);
    for (const field of this.fields()) {
      const value = measurement.measurements[field.key];
      if (Number.isFinite(value)) this.setEntryValue(this.entry(field), value);
    }
    this.updateProgress();
    this.form.markAsPristine();
  }
  private toLocalDateTime(value: string): string {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
  private currentLocalDateTime(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
}

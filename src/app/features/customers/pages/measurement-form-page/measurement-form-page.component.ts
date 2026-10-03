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
import { finalize, map, of, switchMap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { CustomersApiService } from '../../data-access/customers-api.service';
import { MeasurementsApiService } from '../../data-access/measurements-api.service';
import type { Customer } from '../../models/customer.model';
import {
  MEASUREMENT_FIELDS,
  type MeasurementFieldDefinition,
  type MeasurementFieldKey,
} from '../../models/measurement-fields.config';
import {
  ClothingType,
  FitPreference,
  type CreateMeasurementRequest,
  type Measurement,
  type UpdateMeasurementRequest,
} from '../../models/measurement.model';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private configuredType: ClothingType | null = null;
  private allowNavigation = false;
  private focusFirst = false;

  readonly customerRecordId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly measurementId = this.route.snapshot.paramMap.get('measurementId');
  readonly editMode = this.measurementId !== null;
  readonly wholeInputs = viewChildren<ElementRef<HTMLInputElement>>('wholeInput');
  readonly customer = signal<Customer | null>(null);
  readonly fields = signal<readonly MeasurementFieldDefinition[]>([]);
  readonly activeField = signal<MeasurementFieldKey | null>(null);
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
    clothingType: new FormControl<ClothingType | null>(null, Validators.required),
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
    this.form.controls.clothingType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.changeType(type));
    this.form.controls.measurements.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateProgress());
    this.loadData();
  }

  entry(field: MeasurementFieldDefinition): EntryGroup {
    const control = this.form.controls.measurements.controls[field.key];
    if (!control) throw new Error(`Missing measurement control: ${field.key}`);
    return control;
  }

  formattedValue(field: MeasurementFieldDefinition): string {
    const value = this.decimalValue(this.entry(field));
    return value === null ? 'Not entered' : formatMeasurement(value);
  }

  fieldError(field: MeasurementFieldDefinition): string | null {
    const control = this.entry(field);
    if (!control.touched || !control.errors) return null;
    if (control.hasError('requiredMeasurement')) return `${field.label} is required.`;
    if (control.hasError('incompleteMeasurement')) return 'Enter whole inches for this fraction.';
    if (control.hasError('wholeInches')) return 'Use a whole number for whole inches.';
    if (control.hasError('negativeMeasurement')) return 'Measurement cannot be negative.';
    if (control.hasError('zeroMeasurement')) return 'Measurement must be greater than zero.';
    return null;
  }

  activate(field: MeasurementFieldDefinition): void {
    this.activeField.set(field.key);
  }
  clearField(field: MeasurementFieldDefinition): void {
    this.entry(field).reset({ whole: null, fraction: 0 });
    this.entry(field).markAsDirty();
  }
  adjust(field: MeasurementFieldDefinition, direction: 1 | -1): void {
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
    const type = this.form.controls.clothingType.value;
    if (!customer || !type || this.copying()) return;
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
          const latest = items.find((item) => item.clothingType === type);
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
    if (!value.clothingType) return;
    const measurements: Record<string, number> = {};
    const unusual: string[] = [];
    for (const field of this.fields()) {
      const decimal = this.decimalValue(this.entry(field));
      if (decimal === null) continue;
      measurements[field.key] = decimal;
      if (decimal > 100) unusual.push(`${field.label}: ${formatMeasurement(decimal)}`);
    }
    if (
      unusual.length &&
      !window.confirm(
        `These measurements are unusually large:\n\n${unusual.join('\n')}\n\nSave them anyway?`,
      )
    )
      return;
    const commonRequest: UpdateMeasurementRequest = {
      clothingType: value.clothingType,
      measurements,
      ...(value.fitPreference ? { fitPreference: value.fitPreference } : {}),
      notes: value.notes.trim(),
      measuredAt: new Date(value.measuredAt).toISOString(),
    };
    const createRequest: CreateMeasurementRequest = {
      customerId: customer.customerId,
      version: 1,
      ...commonRequest,
      clothingType: value.clothingType,
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

  private changeType(type: ClothingType | null): void {
    const nextFields = type ? MEASUREMENT_FIELDS[type] : [];
    const nextKeys = new Set(nextFields.map((field) => field.key));
    const incompatible = this.fields().some(
      (field) => !nextKeys.has(field.key) && this.decimalValue(this.entry(field)) !== null,
    );
    if (
      incompatible &&
      !window.confirm('Changing garment type will clear measurements that do not apply. Continue?')
    ) {
      this.form.controls.clothingType.setValue(this.configuredType, { emitEvent: false });
      return;
    }
    const previous = new Map<MeasurementFieldKey, number>();
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
    this.configuredType = type;
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
    this.customersApi
      .getById(this.customerRecordId)
      .pipe(
        switchMap((customer) => {
          if (!this.editMode) return of({ customer, measurement: null });
          return this.measurementsApi.getByCustomer(customer.customerId).pipe(
            map((measurements) => ({
              customer,
              measurement:
                measurements.find((measurement) => measurement._id === this.measurementId) ?? null,
            })),
          );
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ customer, measurement }) => {
          this.customer.set(customer);
          if (this.editMode && !measurement) {
            this.loadError.set('Measurement not found.');
            return;
          }
          if (measurement) this.populateMeasurement(measurement);
        },
        error: (error: unknown) =>
          this.loadError.set(
            error instanceof ApiError ? error.message : 'Customer could not be loaded.',
          ),
      });
  }
  private populateMeasurement(measurement: Measurement): void {
    this.form.controls.clothingType.setValue(measurement.clothingType);
    this.form.controls.fitPreference.setValue(measurement.fitPreference ?? null);
    this.form.controls.measuredAt.setValue(this.toLocalDateTime(measurement.measuredAt));
    this.form.controls.notes.setValue(measurement.notes ?? '');
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

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { GarmentTypeService } from '../../services/garment-type.service';
import type {
  CustomizationGroup,
  CustomizationInputType,
  CustomizationOption,
  CreateGarmentTypeRequest,
  GarmentType,
  MeasurementField,
  PricingType,
  UpdateGarmentTypeRequest,
} from '../../models/garment-type.model';
import {
  CustomizationInputType as InputType,
  MeasurementUnit,
  PricingType as PriceType,
} from '../../models/garment-type.model';

@Component({
  selector: 'app-garment-type-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './garment-type-form.component.html',
  styleUrl: './garment-type-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarmentTypeFormComponent {
  private readonly service = inject(GarmentTypeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private allowNavigation = false;

  readonly garmentTypeId = this.route.snapshot.paramMap.get('garmentTypeId');
  readonly editMode = this.garmentTypeId !== null;

  readonly loading = signal(this.editMode);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly customizationError = signal<string | null>(null);
  readonly measurementError = signal<string | null>(null);
  readonly inputTypes = Object.values(InputType);
  readonly pricingTypes = Object.values(PriceType);
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    code: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(50),
        Validators.pattern(/^[A-Z0-9_-]+$/),
      ],
    }),
    basePrice: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    customizationGroups: new FormArray<FormGroup>([]),
    measurementFields: new FormArray<FormGroup>([]),
  });

  constructor() {
    if (this.garmentTypeId) this.load();
  }

  submit(): void {
    this.customizationError.set(this.validateCustomizations());
    this.measurementError.set(this.validateMeasurementFields());
    if (
      this.form.invalid ||
      this.customizationError() ||
      this.measurementError() ||
      this.submitting()
    ) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: UpdateGarmentTypeRequest = {
      name: value.name.trim(),
      code: value.code.trim().toUpperCase(),
      tailoringService: {
        serviceId: this.loadedGarmentType?.tailoringService.serviceId ?? 'SRV-000001',
        basePrice: value.basePrice,
      },
      customizationGroups: this.customizationPayload(),
      measurementFields: this.measurementPayload(),
    };

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

    const operation =
      this.editMode && this.garmentTypeId
        ? this.service.update(this.garmentTypeId, request)
        : this.service.create(request as CreateGarmentTypeRequest);

    operation
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.allowNavigation = true;
          this.form.markAsPristine();
          void this.router.navigate(['/garment-types'], {
            state: {
              successMessage: `Garment type ${this.editMode ? 'updated' : 'created'} successfully.`,
            },
          });
        },
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError
              ? error.message
              : `Garment type could not be ${this.editMode ? 'updated' : 'created'}.`,
          ),
      });
  }

  cancel(): void {
    void this.router.navigate(['/garment-types']);
  }

  canLeave(): boolean {
    return (
      this.allowNavigation ||
      !this.form.dirty ||
      window.confirm('Discard your unsaved garment type changes?')
    );
  }

  get groups(): FormArray<FormGroup> {
    return this.form.controls.customizationGroups;
  }

  get measurementFields(): FormArray<FormGroup> {
    return this.form.controls.measurementFields;
  }

  groupOptions(groupIndex: number): FormArray<FormGroup> {
    return this.groups.at(groupIndex).controls['options'] as FormArray<FormGroup>;
  }

  addGroup(): void {
    this.groups.push(this.createGroupForm());
    this.form.markAsDirty();
  }

  removeGroup(groupIndex: number): void {
    this.groups.removeAt(groupIndex);
    this.form.markAsDirty();
  }

  addOption(groupIndex: number): void {
    this.groupOptions(groupIndex).push(this.createOptionForm());
    this.form.markAsDirty();
  }

  removeOption(groupIndex: number, optionIndex: number): void {
    this.groupOptions(groupIndex).removeAt(optionIndex);
    this.form.markAsDirty();
  }

  isTextOption(groupIndex: number, optionIndex: number): boolean {
    return this.groupOptions(groupIndex).at(optionIndex).get('inputType')?.value === InputType.Text;
  }

  inputTypeChanged(groupIndex: number, optionIndex: number): void {
    const option = this.groupOptions(groupIndex).at(optionIndex);
    if (option.get('inputType')?.value === InputType.Text) {
      option.patchValue({ pricingType: PriceType.Fixed, price: 0 });
    }
    this.form.markAsDirty();
  }

  addMeasurementField(): void {
    this.measurementFields.push(this.createMeasurementFieldForm());
    this.measurementFields.controls.forEach((field, index) =>
      field.get('sortOrder')?.setValue(index),
    );
    this.form.markAsDirty();
  }

  removeMeasurementField(fieldIndex: number): void {
    this.measurementFields.removeAt(fieldIndex);
    this.normalizeMeasurementOrder();
    this.form.markAsDirty();
  }

  moveMeasurementField(fieldIndex: number, direction: -1 | 1): void {
    const targetIndex = fieldIndex + direction;
    if (targetIndex < 0 || targetIndex >= this.measurementFields.length) return;

    const fields = [...this.measurementFields.controls];
    [fields[fieldIndex], fields[targetIndex]] = [fields[targetIndex], fields[fieldIndex]];
    this.measurementFields.clear({ emitEvent: false });
    fields.forEach((field) => this.measurementFields.push(field, { emitEvent: false }));
    this.normalizeMeasurementOrder();
    this.form.markAsDirty();
  }

  measurementSortOrderChanged(): void {
    this.sortMeasurementFields();
    this.form.markAsDirty();
  }

  private loadedGarmentType: GarmentType | null = null;

  private createGroupForm(group?: CustomizationGroup): FormGroup {
    const options = new FormArray<FormGroup>([]);
    for (const option of group?.options ?? []) options.push(this.createOptionForm(option));

    return new FormGroup({
      name: new FormControl(group?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)],
      }),
      sortOrder: new FormControl(group?.sortOrder ?? this.groups.length, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
      options,
    });
  }

  private createOptionForm(option?: CustomizationOption): FormGroup {
    const inputType = option?.inputType ?? InputType.SingleSelect;
    const isText = inputType === InputType.Text;

    return new FormGroup({
      name: new FormControl(option?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)],
      }),
      inputType: new FormControl<CustomizationInputType>(inputType, { nonNullable: true }),
      price: new FormControl(isText ? 0 : (option?.price ?? 0), {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
      pricingType: new FormControl<PricingType>(
        isText ? PriceType.Fixed : (option?.pricingType ?? PriceType.Fixed),
        { nonNullable: true },
      ),
      sortOrder: new FormControl(option?.sortOrder ?? 0, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
    });
  }

  private createMeasurementFieldForm(field?: MeasurementField): FormGroup {
    return new FormGroup({
      key: new FormControl(field?.key ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
        ],
      }),
      name: new FormControl(field?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)],
      }),
      unit: new FormControl<MeasurementUnit>(field?.unit ?? MeasurementUnit.Inch, {
        nonNullable: true,
      }),
      required: new FormControl(field?.required ?? false, { nonNullable: true }),
      sortOrder: new FormControl(field?.sortOrder ?? this.measurementFields.length, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
    });
  }

  private customizationPayload(): readonly CustomizationGroup[] {
    return this.groups.getRawValue().map((group) => ({
      name: group['name'].trim(),
      sortOrder: group['sortOrder'],
      options: group['options'].map(
        (option: CustomizationOption & { inputType: CustomizationInputType }) => ({
          name: option.name.trim(),
          inputType: option.inputType,
          price: option.inputType === InputType.Text ? 0 : option.price,
          pricingType: option.inputType === InputType.Text ? PriceType.Fixed : option.pricingType,
          sortOrder: option.sortOrder,
        }),
      ),
    }));
  }

  private validateCustomizations(): string | null {
    const groupNames = new Set<string>();

    for (const group of this.groups.controls) {
      const name = String(group.get('name')?.value ?? '')
        .trim()
        .toLowerCase();
      if (name && groupNames.has(name)) return 'Customization group names/keys must be unique.';
      if (name) groupNames.add(name);

      const optionNames = new Set<string>();
      const options = group.get('options') as FormArray<FormGroup>;
      for (const option of options.controls) {
        const optionName = String(option.get('name')?.value ?? '')
          .trim()
          .toLowerCase();
        if (optionName && optionNames.has(optionName)) {
          return 'Option names must be unique within each customization group.';
        }
        if (optionName) optionNames.add(optionName);

        const inputType = option.get('inputType')?.value;
        const price = Number(option.get('price')?.value);
        const pricingType = option.get('pricingType')?.value;
        if (inputType === InputType.Text && (price !== 0 || pricingType !== PriceType.Fixed)) {
          return 'TEXT options cannot have automatic pricing.';
        }
      }
    }

    return null;
  }

  private measurementPayload(): readonly MeasurementField[] {
    return this.measurementFields.getRawValue().map((field) => ({
      key: field['key'].trim(),
      name: field['name'].trim(),
      unit: MeasurementUnit.Inch,
      required: field['required'],
      sortOrder: field['sortOrder'],
    }));
  }

  private validateMeasurementFields(): string | null {
    const keys = new Set<string>();

    for (const field of this.measurementFields.controls) {
      const key = String(field.get('key')?.value ?? '')
        .trim()
        .toLowerCase();
      if (key && keys.has(key)) return 'Measurement field keys must be unique.';
      if (key) keys.add(key);
      if (field.get('unit')?.value !== MeasurementUnit.Inch) {
        return 'Measurement fields must use INCH units.';
      }
      const sortOrder = Number(field.get('sortOrder')?.value);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        return 'Measurement field sort order must be a whole number of 0 or greater.';
      }
    }

    return null;
  }

  private normalizeMeasurementOrder(): void {
    this.measurementFields.controls.forEach((field, index) =>
      field.get('sortOrder')?.setValue(index, { emitEvent: false }),
    );
  }

  private sortMeasurementFields(): void {
    const fields = [...this.measurementFields.controls].sort(
      (left, right) => Number(left.get('sortOrder')?.value) - Number(right.get('sortOrder')?.value),
    );
    this.measurementFields.clear({ emitEvent: false });
    fields.forEach((field) => this.measurementFields.push(field, { emitEvent: false }));
  }

  private load(): void {
    if (!this.garmentTypeId) return;

    this.service
      .getById(this.garmentTypeId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (garmentType) => {
          this.loadedGarmentType = garmentType;
          this.form.reset({
            name: garmentType.name,
            code: garmentType.code,
            basePrice: garmentType.tailoringService.basePrice,
          });
          this.groups.clear();
          for (const group of garmentType.customizationGroups) {
            this.groups.push(this.createGroupForm(group));
          }
          this.measurementFields.clear();
          for (const field of [...garmentType.measurementFields].sort(
            (left, right) => left.sortOrder - right.sortOrder,
          )) {
            this.measurementFields.push(this.createMeasurementFieldForm(field));
          }
          this.form.markAsPristine();
        },
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'Garment type could not be loaded.',
          ),
      });
  }
}

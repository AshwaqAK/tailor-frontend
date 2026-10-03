import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl } from '@angular/forms';

import type { ApiError } from '@core/api/api-error';
import type { CreateCustomerRequest, Customer } from '../../models/customer.model';
import { CustomerGender } from '../../models/customer.model';

type CustomerFormControls = {
  name: FormControl<string>;
  phone: FormControl<string>;
  alternatePhone: FormControl<string>;
  email: FormControl<string>;
  gender: FormControl<CustomerGender | ''>;
  photo: FormControl<string>;
  notes: FormControl<string>;
};

@Component({
  selector: 'app-customer-form',
  imports: [ReactiveFormsModule],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFormComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input.required<'create' | 'edit'>();
  readonly customer = input<Customer | null>(null);
  readonly submitting = input(false);
  readonly serverError = input<string | null>(null);
  readonly save = output<CreateCustomerRequest>();
  readonly cancelForm = output<void>();

  readonly genders = [
    { value: CustomerGender.Male, label: 'Male' },
    { value: CustomerGender.Female, label: 'Female' },
    { value: CustomerGender.Other, label: 'Other' },
  ] as const;

  readonly form = new FormGroup<CustomerFormControls>({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    alternatePhone: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(255)],
    }),
    gender: new FormControl<CustomerGender | ''>('', { nonNullable: true }),
    photo: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  constructor() {
    const controls: readonly AbstractControl[] = Object.values(this.form.controls);
    controls.forEach((control) => {
      control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        if (!control.hasError('server')) return;
        const remaining = { ...control.errors };
        delete remaining['server'];
        control.setErrors(Object.keys(remaining).length ? remaining : null);
      });
    });

    effect(() => this.applyPhoneValidators(this.mode() === 'edit'));
    effect(() => {
      const customer = this.customer();
      if (!customer) return;
      this.form.reset({
        name: customer.name,
        phone: this.editablePhone(customer.phone),
        alternatePhone: this.editablePhone(customer.alternatePhone ?? ''),
        email: customer.email ?? '',
        gender: customer.gender,
        photo: customer.photo ?? '',
        notes: customer.notes ?? '',
      });
    });
  }

  submit(): void {
    this.clearServerErrors();
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: CreateCustomerRequest = {
      name: value.name.trim(),
      phone: value.phone.trim(),
      ...this.optional('alternatePhone', value.alternatePhone),
      ...this.optional('email', value.email),
      ...(value.gender ? { gender: value.gender } : {}),
      ...this.optional('photo', value.photo),
      ...this.optional('notes', value.notes),
    };
    this.save.emit(request);
  }

  cancel(): void {
    this.cancelForm.emit();
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  markSaved(): void {
    this.form.markAsPristine();
  }

  applyServerErrors(error: ApiError): void {
    const messages = [error.message, ...error.details];
    const fields = Object.keys(this.form.controls) as (keyof CustomerFormControls)[];

    for (const message of messages) {
      const field = fields.find((candidate) => message.startsWith(`${candidate} `));
      if (!field) continue;
      const control = this.form.controls[field];
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
    }
  }

  errorFor(field: keyof CustomerFormControls): string | null {
    const control = this.form.controls[field];
    if (!control.touched || !control.errors) return null;
    if (typeof control.errors['server'] === 'string') return control.errors['server'];
    if (control.hasError('required')) return 'This field is required.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('maxlength'))
      return `Use no more than ${control.getError('maxlength').requiredLength} characters.`;
    if (control.hasError('pattern')) return 'Enter a valid Indian 10-digit mobile number.';
    return 'Check this value.';
  }

  private applyPhoneValidators(editMode: boolean): void {
    const createPattern = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
    const updatePattern = /^[0-9]{10}$/;
    const pattern = editMode ? updatePattern : createPattern;
    this.form.controls.phone.setValidators([Validators.required, Validators.pattern(pattern)]);
    this.form.controls.alternatePhone.setValidators([Validators.pattern(pattern)]);
    this.form.controls.phone.updateValueAndValidity({ emitEvent: false });
    this.form.controls.alternatePhone.updateValueAndValidity({ emitEvent: false });
  }

  private editablePhone(phone: string): string {
    return phone.startsWith('+91') ? phone.slice(3) : phone;
  }

  private optional<Key extends 'alternatePhone' | 'email' | 'photo' | 'notes'>(
    key: Key,
    value: string,
  ): Partial<Record<Key, string>> {
    const trimmed = value.trim();
    return trimmed ? ({ [key]: trimmed } as Record<Key, string>) : {};
  }

  private clearServerErrors(): void {
    Object.values(this.form.controls).forEach((control) => {
      if (!control.hasError('server')) return;
      const remaining = { ...control.errors };
      delete remaining['server'];
      control.setErrors(Object.keys(remaining).length ? remaining : null);
    });
  }
}

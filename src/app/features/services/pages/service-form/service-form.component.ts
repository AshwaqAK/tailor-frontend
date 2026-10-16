import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { ServicesApiService } from '../../data-access/services-api.service';
import { ServiceCategory, type CreateServiceRequest } from '../../models/service.model';

function maxTwoDecimals(control: { value: number | null }): { decimalPlaces: true } | null {
  const value = control.value;
  if (value === null || !Number.isFinite(value)) return null;
  return Number.isInteger(value * 100) ? null : { decimalPlaces: true };
}

@Component({
  selector: 'app-service-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './service-form.component.html',
  styleUrl: './service-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFormComponent {
  private readonly api = inject(ServicesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private allowNavigation = false;
  readonly serviceId = this.route.snapshot.paramMap.get('serviceId');
  readonly editMode = this.serviceId !== null;
  readonly loading = signal(this.editMode);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly categories = Object.values(ServiceCategory);
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)],
    }),
    category: new FormControl<ServiceCategory | null>(null, Validators.required),
    price: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      maxTwoDecimals,
    ]),
    description: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    if (this.serviceId) this.load();
  }

  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!value.category || value.price === null) return;
    const request: CreateServiceRequest = {
      name: value.name.trim(),
      category: value.category,
      price: value.price,
      ...(value.description.trim() ? { description: value.description.trim() } : {}),
      isActive: value.isActive,
    };
    this.submitting.set(true);
    this.error.set(null);
    const operation =
      this.editMode && this.serviceId
        ? this.api.update(this.serviceId, request)
        : this.api.create(request);
    operation
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (service) => {
          this.allowNavigation = true;
          this.form.markAsPristine();
          void this.router.navigate(['/services', service.serviceId]);
        },
        error: (error: unknown) =>
          this.error.set(error instanceof ApiError ? error.message : 'Service could not be saved.'),
      });
  }

  cancel(): void {
    void this.router.navigate(['/services']);
  }

  canLeave(): boolean {
    return (
      this.allowNavigation ||
      !this.form.dirty ||
      window.confirm('Discard your unsaved service changes?')
    );
  }

  private load(): void {
    if (!this.serviceId) return;
    this.api
      .getById(this.serviceId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (service) => {
          this.form.reset({
            name: service.name,
            category: service.category,
            price: service.price,
            description: service.description ?? '',
            isActive: service.isActive,
          });
          this.form.markAsPristine();
        },
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'Service could not be loaded.',
          ),
      });
  }
}

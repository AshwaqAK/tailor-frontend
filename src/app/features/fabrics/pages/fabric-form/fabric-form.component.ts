import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '@core/api/api-error';
import { FabricsApiService } from '../../data-access/fabrics-api.service';
import { FabricType, QuantityUnit, type CreateFabricRequest } from '../../models/fabric.model';

@Component({
  selector: 'app-fabric-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './fabric-form.component.html',
  styleUrl: './fabric-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FabricFormComponent {
  private readonly api = inject(FabricsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private allowNavigation = false;
  readonly fabricId = this.route.snapshot.paramMap.get('fabricId');
  readonly editMode = this.fabricId !== null;
  readonly loading = signal(this.editMode);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly types = Object.values(FabricType);
  readonly units = Object.values(QuantityUnit);
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    type: new FormControl<FabricType | null>(null, Validators.required),
    color: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    quantity: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
    unit: new FormControl<QuantityUnit | null>(null, Validators.required),
    pricePerUnit: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
    supplier: new FormControl('', { nonNullable: true, validators: Validators.maxLength(200) }),
    description: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
    isActive: new FormControl(true, { nonNullable: true }),
  });
  constructor() {
    if (this.fabricId) this.load();
  }
  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!value.type || !value.unit) return;
    const request: CreateFabricRequest = {
      name: value.name.trim(),
      type: value.type,
      color: value.color.trim(),
      quantity: value.quantity,
      unit: value.unit,
      pricePerUnit: value.pricePerUnit,
      ...(value.supplier.trim() ? { supplier: value.supplier.trim() } : {}),
      ...(value.description.trim() ? { description: value.description.trim() } : {}),
      isActive: value.isActive,
    };
    this.submitting.set(true);
    this.error.set(null);
    const operation =
      this.editMode && this.fabricId
        ? this.api.update(this.fabricId, request)
        : this.api.create(request);
    operation
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (fabric) => {
          this.allowNavigation = true;
          this.form.markAsPristine();
          void this.router.navigate(['/fabrics', fabric.fabricId]);
        },
        error: (error: unknown) =>
          this.error.set(error instanceof ApiError ? error.message : 'Fabric could not be saved.'),
      });
  }
  cancel(): void {
    void this.router.navigate(['/fabrics']);
  }
  canLeave(): boolean {
    return (
      this.allowNavigation ||
      !this.form.dirty ||
      window.confirm('Discard your unsaved fabric changes?')
    );
  }
  label(value: string): string {
    return value.charAt(0) + value.slice(1).toLowerCase();
  }
  private load(): void {
    if (!this.fabricId) return;
    this.api
      .getById(this.fabricId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (fabric) => {
          this.form.reset({
            name: fabric.name,
            type: fabric.type,
            color: fabric.color,
            quantity: fabric.quantity,
            unit: fabric.unit,
            pricePerUnit: fabric.pricePerUnit,
            supplier: fabric.supplier ?? '',
            description: fabric.description ?? '',
            isActive: fabric.isActive,
          });
          this.form.markAsPristine();
        },
        error: (error: unknown) =>
          this.error.set(error instanceof ApiError ? error.message : 'Fabric could not be loaded.'),
      });
  }
}

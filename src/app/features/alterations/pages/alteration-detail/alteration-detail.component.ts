import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { AlterationsApiService } from '../../data-access/alterations-api.service';
import {
  ALTERATION_STATUS_TRANSITIONS,
  AlterationStatus,
  type Alteration,
  type AlterationStatus as AlterationStatusValue,
} from '../../models/alteration.model';

@Component({
  selector: 'app-alteration-detail',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './alteration-detail.component.html',
  styleUrl: './alteration-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlterationDetailComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(AlterationsApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private allowNavigation = false;
  private readonly alterationId = this.route.snapshot.paramMap.get('alterationId')?.trim() ?? '';

  readonly alteration = signal<Alteration | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly updatingStatus = signal(false);
  readonly creatingBill = signal(false);
  readonly billError = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly statuses = AlterationStatus;
  readonly canUpdate = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager || role === Role.Receptionist;
  });
  readonly form = this.formBuilder.nonNullable.group({
    description: ['', [Validators.required, Validators.maxLength(1000), Validators.pattern(/\S/)]],
    notes: ['', Validators.maxLength(1000)],
  });

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.alterationId) {
      this.loading.set(false);
      this.notFound.set(true);
      this.error.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.api
      .getByAlterationId(this.alterationId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (alteration) => {
          this.alteration.set(alteration);
          this.form.reset({ description: alteration.description, notes: alteration.notes ?? '' });
          this.form.markAsPristine();
        },
        error: (error: unknown) => {
          if (error instanceof ApiError && error.status === 404) {
            this.notFound.set(true);
            return;
          }
          this.error.set(this.errorMessage(error, 'Alteration could not be loaded.'));
        },
      });
  }

  allowedStatuses(): readonly AlterationStatusValue[] {
    const current = this.alteration()?.status;
    return current ? ALTERATION_STATUS_TRANSITIONS[current] : [];
  }

  updateStatus(status: AlterationStatusValue): void {
    const alteration = this.alteration();
    if (
      !alteration ||
      !this.canUpdate() ||
      this.updatingStatus() ||
      !this.allowedStatuses().includes(status)
    ) {
      return;
    }
    if (
      (status === AlterationStatus.Cancelled || status === AlterationStatus.Completed) &&
      !window.confirm(`Change alteration status to ${this.label(status)}?`)
    ) {
      return;
    }

    this.updatingStatus.set(true);
    this.error.set(null);
    this.api
      .update(alteration.alterationId, { status })
      .pipe(
        finalize(() => this.updatingStatus.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.feedback.set('Alteration status updated.');
          this.updatingStatus.set(false);
          this.load();
        },
        error: (error: unknown) =>
          this.error.set(this.errorMessage(error, 'Alteration status could not be updated.')),
      });
  }

  createBill(): void {
    const alteration = this.alteration();
    if (
      !alteration ||
      !this.canUpdate() ||
      alteration.status !== AlterationStatus.Completed ||
      alteration.charge <= 0 ||
      this.creatingBill()
    ) {
      return;
    }
    if (!window.confirm('Create an alteration bill for this charge?')) return;

    this.creatingBill.set(true);
    this.billError.set(null);
    this.api
      .createBill(alteration.alterationId)
      .pipe(
        finalize(() => this.creatingBill.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (order) => {
          if (!order.orderId) {
            this.billError.set(
              'The bill was created without a usable order ID. Verify the bill before retrying.',
            );
            return;
          }
          void this.router.navigate([
            '/alterations',
            alteration.alterationId,
            'bill',
            order.orderId,
          ]);
        },
        error: (error: unknown) => {
          this.billError.set(this.billErrorMessage(error));
          if (!(error instanceof ApiError) || error.status === 0 || error.status === 409) {
            // There is no bill-discovery endpoint; refresh the alteration state before retrying.
            this.load();
          }
        },
      });
  }

  saveDetails(): void {
    const alteration = this.alteration();
    if (!alteration || !this.canUpdate() || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .update(alteration.alterationId, {
        description: value.description.trim(),
        notes: value.notes.trim(),
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.alteration.set(updated);
          this.form.reset({ description: updated.description, notes: updated.notes ?? '' });
          this.form.markAsPristine();
          this.feedback.set('Alteration details updated.');
        },
        error: (error: unknown) =>
          this.error.set(this.errorMessage(error, 'Alteration details could not be updated.')),
      });
  }

  cancelEditing(): void {
    const alteration = this.alteration();
    if (!alteration) return;
    this.form.reset({ description: alteration.description, notes: alteration.notes ?? '' });
    this.form.markAsPristine();
  }

  backToAlterations(): void {
    this.allowNavigation = true;
    void this.router.navigate(['/alterations']);
  }

  canLeave(): boolean {
    return (
      this.allowNavigation || !this.form.dirty || window.confirm('Discard your unsaved changes?')
    );
  }

  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof ApiError ? error.message : fallback;
  }

  private billErrorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 409) {
      return 'A bill may already exist for this alteration. Verify the bill before retrying.';
    }
    if (!(error instanceof ApiError) || error.status === 0) {
      return 'The bill result is uncertain. Verify the bill before retrying.';
    }
    return error.message || 'The bill could not be created.';
  }
}

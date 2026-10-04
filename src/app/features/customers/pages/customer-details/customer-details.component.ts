import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { CustomersApiService } from '../../data-access/customers-api.service';
import { MeasurementHistoryComponent } from '../../components/measurement-history/measurement-history.component';
import { CustomerOrderHistoryComponent } from '../../components/customer-order-history/customer-order-history.component';
import type { Customer } from '../../models/customer.model';

@Component({
  selector: 'app-customer-details',
  imports: [DatePipe, RouterLink, MeasurementHistoryComponent, CustomerOrderHistoryComponent],
  templateUrl: './customer-details.component.html',
  styleUrl: './customer-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailsComponent {
  private readonly api = inject(CustomersApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  private feedbackTimeout?: ReturnType<typeof setTimeout>;

  readonly deactivateDialog = viewChild<ElementRef<HTMLDialogElement>>('deactivateDialog');

  readonly customer = signal<Customer | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deactivating = signal(false);
  readonly feedback = signal<string | null>(this.navigationFeedback());
  readonly listQueryParams = this.route.snapshot.queryParams;
  readonly canManage = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.feedbackTimeout !== undefined) clearTimeout(this.feedbackTimeout);
    });
    if (this.feedback()) this.feedbackTimeout = setTimeout(() => this.feedback.set(null), 10_000);
    this.loadCustomer();
  }

  loadCustomer(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getById(this.id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (customer) => this.customer.set(customer),
        error: (error: unknown) =>
          this.error.set(this.messageFor(error, 'Customer could not be loaded.')),
      });
  }

  requestDeactivate(): void {
    const customer = this.customer();
    if (!customer || this.deactivating()) return;
    this.error.set(null);
    this.deactivateDialog()?.nativeElement.showModal();
  }

  activate(): void {
    const customer = this.customer();
    if (!customer || this.deactivating() || !window.confirm(`Reactivate ${customer.name}?`)) return;
    this.deactivating.set(true);
    this.error.set(null);
    this.api
      .activate(customer._id)
      .pipe(
        finalize(() => this.deactivating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.customer.set(updated);
          this.feedback.set(`${updated.name} was reactivated.`);
          this.feedbackTimeout = setTimeout(() => this.feedback.set(null), 10_000);
        },
        error: (error: unknown) =>
          this.error.set(this.messageFor(error, 'Customer could not be reactivated.')),
      });
  }

  cancelDeactivate(): void {
    if (!this.deactivating()) this.deactivateDialog()?.nativeElement.close();
  }

  confirmDeactivate(): void {
    const customer = this.customer();
    if (!customer || this.deactivating()) return;

    this.deactivating.set(true);
    this.api
      .deactivate(customer._id)
      .pipe(
        finalize(() => this.deactivating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.customer.set(updated);
          this.deactivateDialog()?.nativeElement.close();
          this.feedback.set(`${updated.name} was deactivated.`);
          this.feedbackTimeout = setTimeout(() => this.feedback.set(null), 10_000);
        },
        error: (error: unknown) => {
          this.deactivateDialog()?.nativeElement.close();
          this.error.set(this.messageFor(error, 'Customer could not be deactivated.'));
        },
      });
  }

  dialogCancelled(event: Event): void {
    if (this.deactivating()) event.preventDefault();
  }

  backToCustomers(): void {
    void this.router.navigate(['/customers'], { queryParams: this.listQueryParams });
  }

  genderLabel(value: string): string {
    return value.charAt(0) + value.slice(1).toLowerCase();
  }

  private messageFor(error: unknown, fallback: string): string {
    return error instanceof ApiError ? error.message : fallback;
  }

  private navigationFeedback(): string | null {
    const state = history.state as { feedback?: unknown };
    return typeof state.feedback === 'string' ? state.feedback : null;
  }
}

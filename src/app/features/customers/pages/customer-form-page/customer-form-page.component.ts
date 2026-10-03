import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { CustomerFormComponent } from '../../components/customer-form/customer-form.component';
import { CustomersApiService } from '../../data-access/customers-api.service';
import type { CreateCustomerRequest, Customer } from '../../models/customer.model';

@Component({
  selector: 'app-customer-form-page',
  imports: [CustomerFormComponent, RouterLink],
  templateUrl: './customer-form-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFormPageComponent {
  private readonly api = inject(CustomersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = this.route.snapshot.paramMap.get('id');
  private allowNavigation = false;

  @ViewChild(CustomerFormComponent) private formComponent?: CustomerFormComponent;

  readonly mode: 'create' | 'edit' = this.id ? 'edit' : 'create';
  readonly customer = signal<Customer | null>(null);
  readonly loading = signal(this.mode === 'edit');
  readonly loadError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly listQueryParams = this.route.snapshot.queryParams;

  constructor() {
    if (this.id) this.loadCustomer();
  }

  loadCustomer(): void {
    if (!this.id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .getById(this.id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (customer) => this.customer.set(customer),
        error: (error: unknown) =>
          this.loadError.set(this.messageFor(error, 'Customer could not be loaded.')),
      });
  }

  save(request: CreateCustomerRequest): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.serverError.set(null);
    const operation = this.id ? this.api.update(this.id, request) : this.api.create(request);

    operation
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (customer) => {
          this.allowNavigation = true;
          this.formComponent?.markSaved();
          void this.router.navigate(['/customers'], {
            queryParams: this.listQueryParams,
            state: {
              feedback:
                this.mode === 'create'
                  ? `${customer.name} was added successfully.`
                  : `${customer.name} was updated successfully.`,
            },
          });
        },
        error: (error: unknown) => {
          if (error instanceof ApiError) this.formComponent?.applyServerErrors(error);
          this.serverError.set(this.messageFor(error, 'Customer could not be saved.'));
        },
      });
  }

  cancel(): void {
    void this.router.navigate(['/customers'], { queryParams: this.listQueryParams });
  }

  canLeave(): boolean {
    if (this.allowNavigation || !this.formComponent?.hasUnsavedChanges()) return true;
    return window.confirm('Discard your unsaved customer changes?');
  }

  private messageFor(error: unknown, fallback: string): string {
    return error instanceof ApiError ? error.message : fallback;
  }
}

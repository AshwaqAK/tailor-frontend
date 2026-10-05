import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { CustomersApiService } from '@features/customers/data-access/customers-api.service';
import type { Customer } from '@features/customers/models/customer.model';
import { Role } from '@shared/models/user.model';
import { AppointmentsApiService } from '../../data-access/appointments-api.service';
import { OrdersApiService } from '../../../orders/data-access/orders-api.service';
import type { OrderWithItems } from '../../../orders/models/order.model';
import {
  AppointmentStatus,
  AppointmentType,
  type Appointment,
  type AppointmentQuery,
  type PaginatedAppointments,
} from '../../models/appointment.model';

type AppointmentAction =
  | {
    readonly kind: 'status';
    readonly appointment: Appointment;
    readonly status: AppointmentStatus;
  }
  | { readonly kind: 'delete'; readonly appointment: Appointment };

const EMPTY_META: PaginatedAppointments['meta'] = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

const APPOINTMENT_STATUS_TRANSITIONS: Readonly<
  Record<AppointmentStatus, readonly AppointmentStatus[]>
> = {
  [AppointmentStatus.Scheduled]: [
    AppointmentStatus.Confirmed,
    AppointmentStatus.Cancelled,
    AppointmentStatus.NoShow,
  ],
  [AppointmentStatus.Confirmed]: [
    AppointmentStatus.Completed,
    AppointmentStatus.Cancelled,
    AppointmentStatus.NoShow,
  ],
  [AppointmentStatus.Completed]: [],
  [AppointmentStatus.Cancelled]: [],
  [AppointmentStatus.NoShow]: [],
};

@Component({
  selector: 'app-appointment-list',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './appointment-list.component.html',
  styleUrl: './appointment-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentListComponent {
  private readonly api = inject(AppointmentsApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly actionDialog = viewChild<ElementRef<HTMLDialogElement>>('actionDialog');

  readonly appointments = signal<readonly Appointment[]>([]);
  readonly meta = signal<PaginatedAppointments['meta']>(EMPTY_META);
  readonly currentQuery = signal<AppointmentQuery>({ page: 1, limit: EMPTY_META.limit });
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly createFormOpen = signal(false);
  readonly editingAppointment = signal<Appointment | null>(null);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly pendingAction = signal<AppointmentAction | null>(null);
  readonly processingAction = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly customerSearch = new FormControl('', { nonNullable: true });
  readonly customerResults = signal<readonly Customer[]>([]);
  readonly selectedCustomer = signal<Customer | null>(null);
  readonly searchingCustomers = signal(false);
  readonly orders = signal<readonly OrderWithItems[]>([]);
  readonly loadingOrders = signal(false);
  readonly ordersError = signal<string | null>(null);
  readonly appointmentTypes = Object.values(AppointmentType);
  readonly appointmentStatuses = Object.values(AppointmentStatus);
  readonly canCreate = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager || role === Role.Receptionist;
  });
  readonly canDelete = computed(() => {
    const role = this.auth.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager;
  });
  readonly createForm = new FormGroup({
    customerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^CUS-\d{6}$/)],
    }),
    orderId: new FormControl('', {
      nonNullable: true,
      validators: Validators.pattern(/^ORD-\d{6}$/),
    }),
    appointmentDate: new FormControl('', { nonNullable: true, validators: Validators.required }),
    appointmentTime: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/)],
    }),
    type: new FormControl<AppointmentType | null>(null, Validators.required),
    notes: new FormControl('', { nonNullable: true, validators: Validators.maxLength(1000) }),
  });
  readonly filterForm = new FormGroup({
    customerId: new FormControl('', {
      nonNullable: true,
      validators: Validators.pattern(/^CUS-\d{6}$/),
    }),
    appointmentDate: new FormControl('', { nonNullable: true }),
    status: new FormControl<AppointmentStatus | ''>('', { nonNullable: true }),
  });

  constructor() {
    this.load();
    this.customerSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchCustomers(value));
  }

  load(page = this.currentQuery().page ?? 1): void {
    const query = { ...this.currentQuery(), page, limit: EMPTY_META.limit };
    this.currentQuery.set(query);
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list(query)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.appointments.set(response.data);
          this.meta.set(response.meta);
        },
        error: (error: unknown) => {
          this.appointments.set([]);
          this.meta.set(EMPTY_META);
          this.error.set(
            error instanceof ApiError ? error.message : 'Appointments could not be loaded.',
          );
        },
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.meta().totalPages || page === this.meta().page) return;
    this.load(page);
  }

  applyFilters(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    const { customerId, appointmentDate, status } = this.filterForm.getRawValue();
    this.currentQuery.set({
      page: 1,
      limit: EMPTY_META.limit,
      ...(customerId.trim() ? { customerId: customerId.trim() } : {}),
      ...(appointmentDate
        ? { appointmentDate: this.appointmentDateQueryValue(appointmentDate) }
        : {}),
      ...(status ? { status } : {}),
    });
    this.load();
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.currentQuery.set({ page: 1, limit: EMPTY_META.limit });
    this.load();
  }

  hasActiveFilters(): boolean {
    const query = this.currentQuery();
    return Boolean(query.customerId || query.appointmentDate || query.status);
  }

  openCreateForm(): void {
    this.feedback.set(null);
    this.createError.set(null);
    this.editingAppointment.set(null);
    this.createFormOpen.set(true);
  }

  closeCreateForm(force = false): void {
    if (this.creating() && !force) return;
    this.createForm.reset();
    this.customerSearch.setValue('', { emitEvent: false });
    this.customerResults.set([]);
    this.selectedCustomer.set(null);
    this.orders.set([]);
    this.ordersError.set(null);
    this.createError.set(null);
    this.editingAppointment.set(null);
    this.createFormOpen.set(false);
  }

  openEditForm(appointment: Appointment): void {
    if (this.creating()) return;
    this.feedback.set(null);
    this.createError.set(null);
    this.editingAppointment.set(appointment);
    this.createForm.reset({
      customerId: appointment.customerId,
      orderId: appointment.orderId ?? '',
      appointmentDate: this.dateInputValue(appointment.appointmentDate),
      appointmentTime: appointment.appointmentTime,
      type: appointment.type,
      notes: appointment.notes ?? '',
    });
    this.customerSearch.setValue('', { emitEvent: false });
    this.customerResults.set([]);
    this.selectedCustomer.set(null);
    this.orders.set([]);
    this.ordersError.set(null);
    this.createFormOpen.set(true);
    this.loadCustomer(appointment.customerId);
    this.loadOrders(appointment.customerId);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.customerSearch.setValue(customer.name, { emitEvent: false });
    this.customerResults.set([]);
    this.createForm.controls.customerId.setValue(customer.customerId);
    this.createForm.controls.orderId.setValue('');
    this.loadOrders(customer.customerId);
  }

  changeCustomer(): void {
    this.selectedCustomer.set(null);
    this.customerSearch.setValue('');
    this.customerResults.set([]);
    this.orders.set([]);
    this.ordersError.set(null);
    this.createForm.controls.customerId.setValue('');
    this.createForm.controls.orderId.setValue('');
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.creating()) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { customerId, orderId, appointmentDate, appointmentTime, type, notes } =
      this.createForm.getRawValue();
    if (!type) return;

    const request = {
      customerId,
      ...(orderId ? { orderId } : {}),
      appointmentDate: new Date(`${appointmentDate}T00:00:00`).toISOString(),
      appointmentTime,
      type,
      notes: notes.trim(),
    };
    const editing = this.editingAppointment();

    this.creating.set(true);
    this.createError.set(null);
    const saveRequest = editing
      ? this.api.update(editing.appointmentId, request)
      : this.api.create({ ...request, ...(notes.trim() ? { notes: notes.trim() } : {}) });
    saveRequest
      .pipe(
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.closeCreateForm(true);
          this.feedback.set(editing ? 'Appointment updated.' : 'Appointment created.');
          this.load();
        },
        error: (error: unknown) =>
          this.createError.set(
            error instanceof ApiError
              ? error.message
              : editing
                ? 'Appointment could not be updated.'
                : 'Appointment could not be created.',
          ),
      });
  }

  statusLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }

  statusClass(status: Appointment['status']): string {
    return `status-${status.toLowerCase().replace('_', '-')}`;
  }

  allowedStatusTransitions(appointment: Appointment): readonly AppointmentStatus[] {
    return APPOINTMENT_STATUS_TRANSITIONS[appointment.status];
  }

  statusActionLabel(status: AppointmentStatus): string {
    switch (status) {
      case AppointmentStatus.Confirmed:
        return 'Confirm';
      case AppointmentStatus.Completed:
        return 'Complete';
      case AppointmentStatus.Cancelled:
        return 'Cancel';
      case AppointmentStatus.NoShow:
        return 'Mark no show';
      default:
        return this.statusLabel(status);
    }
  }

  requestStatusChange(appointment: Appointment, status: AppointmentStatus): void {
    if (
      !this.canCreate() ||
      this.processingAction() ||
      !this.allowedStatusTransitions(appointment).includes(status)
    )
      return;

    this.actionError.set(null);
    this.pendingAction.set({ kind: 'status', appointment, status });
    this.actionDialog()?.nativeElement.showModal();
  }

  requestDelete(appointment: Appointment): void {
    if (!this.canDelete() || this.processingAction()) return;

    this.actionError.set(null);
    this.pendingAction.set({ kind: 'delete', appointment });
    this.actionDialog()?.nativeElement.showModal();
  }

  cancelPendingAction(): void {
    if (!this.processingAction()) this.actionDialog()?.nativeElement.close();
  }

  confirmPendingAction(): void {
    const action = this.pendingAction();
    if (!action || this.processingAction()) return;

    this.processingAction.set(true);
    this.actionError.set(null);
    const request =
      action.kind === 'delete'
        ? this.api.remove(action.appointment.appointmentId)
        : this.api.update(action.appointment.appointmentId, { status: action.status });
    request
      .pipe(
        finalize(() => this.processingAction.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.actionDialog()?.nativeElement.close();
          this.feedback.set(
            action.kind === 'delete'
              ? 'Appointment deleted.'
              : `Appointment marked ${this.statusLabel(action.status).toLowerCase()}.`,
          );
          this.load();
        },
        error: (error: unknown) =>
          this.actionError.set(
            error instanceof ApiError
              ? error.message
              : action.kind === 'delete'
                ? 'Appointment could not be deleted.'
                : 'Appointment status could not be updated.',
          ),
      });
  }

  actionTitle(): string {
    const action = this.pendingAction();
    if (!action) return '';
    return action.kind === 'delete'
      ? 'Delete appointment?'
      : `${this.statusActionLabel(action.status)} appointment?`;
  }

  actionDescription(): string {
    const action = this.pendingAction();
    if (!action) return '';
    return action.kind === 'delete'
      ? `${action.appointment.appointmentId} will be permanently deleted.`
      : `${action.appointment.appointmentId} will be marked ${this.statusLabel(action.status).toLowerCase()}.`;
  }

  actionButtonLabel(): string {
    const action = this.pendingAction();
    return action?.kind === 'delete'
      ? 'Delete appointment'
      : this.statusActionLabel(action?.status ?? AppointmentStatus.Scheduled);
  }

  dialogClosed(): void {
    this.pendingAction.set(null);
    this.actionError.set(null);
  }

  dialogCancelled(event: Event): void {
    if (this.processingAction()) event.preventDefault();
  }

  private searchCustomers(value: string): void {
    const search = value.trim();
    if (search.length < 2 || this.selectedCustomer()) {
      this.customerResults.set([]);
      return;
    }

    this.searchingCustomers.set(true);
    this.customersApi
      .list({ page: 1, limit: 10, search, sortBy: 'name', sortOrder: 'asc', isActive: true })
      .pipe(
        finalize(() => this.searchingCustomers.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.customerResults.set(response.data),
        error: () => this.customerResults.set([]),
      });
  }

  private loadOrders(customerId: string): void {
    this.loadingOrders.set(true);
    this.ordersError.set(null);
    this.ordersApi
      .getByCustomer(customerId)
      .pipe(
        finalize(() => this.loadingOrders.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (orders) => this.orders.set(orders),
        error: (error: unknown) =>
          this.ordersError.set(
            error instanceof ApiError ? error.message : 'Customer orders could not be loaded.',
          ),
      });
  }

  private loadCustomer(customerId: string): void {
    this.customersApi
      .getByCustomerId(customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customer) => {
          if (this.createForm.controls.customerId.value !== customerId) return;
          this.selectedCustomer.set(customer);
          this.customerSearch.setValue(customer.name, { emitEvent: false });
        },
        error: (error: unknown) =>
          this.createError.set(
            error instanceof ApiError ? error.message : 'Appointment customer could not be loaded.',
          ),
      });
  }

  private dateInputValue(value: string): string {
    return new Date(value).toISOString().slice(0, 10);
  }

  private appointmentDateQueryValue(value: string): string {
    return new Date(`${value}T00:00:00`).toISOString();
  }
}

import type { Routes } from '@angular/router';

import { roleGuard } from '@core/auth/role.guard';
import { Role } from '@shared/models/user.model';
import { pendingCustomerChangesGuard } from './guards/pending-customer-changes.guard';
import { pendingMeasurementChangesGuard } from './guards/pending-measurement-changes.guard';

const CREATE_ROLES = [Role.SuperAdmin, Role.Manager, Role.Receptionist] as const;
const MANAGE_ROLES = [Role.SuperAdmin, Role.Manager] as const;

export const CUSTOMER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/customer-list/customer-list.component').then(
        (component) => component.CustomerListComponent,
      ),
    title: 'Customers | Tailor',
  },
  {
    path: 'new',
    canMatch: [roleGuard(CREATE_ROLES)],
    canDeactivate: [pendingCustomerChangesGuard],
    loadComponent: () =>
      import('./pages/customer-form-page/customer-form-page.component').then(
        (component) => component.CustomerFormPageComponent,
      ),
    title: 'New customer | Tailor',
  },
  {
    path: ':id/edit',
    canMatch: [roleGuard(MANAGE_ROLES)],
    canDeactivate: [pendingCustomerChangesGuard],
    loadComponent: () =>
      import('./pages/customer-form-page/customer-form-page.component').then(
        (component) => component.CustomerFormPageComponent,
      ),
    title: 'Edit customer | Tailor',
  },
  {
    path: ':id/measurements/new',
    canMatch: [roleGuard(CREATE_ROLES)],
    canDeactivate: [pendingMeasurementChangesGuard],
    loadComponent: () =>
      import('./pages/measurement-form-page/measurement-form-page.component').then(
        (component) => component.MeasurementFormPageComponent,
      ),
    title: 'New measurement | Tailor',
  },
  {
    path: ':id/measurements/:measurementId/edit',
    canMatch: [roleGuard(CREATE_ROLES)],
    canDeactivate: [pendingMeasurementChangesGuard],
    loadComponent: () =>
      import('./pages/measurement-form-page/measurement-form-page.component').then(
        (component) => component.MeasurementFormPageComponent,
      ),
    title: 'Edit measurement | Tailor',
  },
  {
    path: ':id/measurements/:measurementId',
    loadComponent: () =>
      import('./pages/measurement-details/measurement-details.component').then(
        (component) => component.MeasurementDetailsComponent,
      ),
    title: 'Measurement details | Tailor',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/customer-details/customer-details.component').then(
        (component) => component.CustomerDetailsComponent,
      ),
    title: 'Customer details | Tailor',
  },
];

import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { Role } from '@shared/models/user.model';
import { pendingServiceChangesGuard } from './guards/pending-service-changes.guard';

export const SERVICE_READ_ROLES = [
  Role.SuperAdmin,
  Role.Manager,
  Role.Receptionist,
  Role.Tailor,
] as const;
export const SERVICE_MANAGE_ROLES = [Role.SuperAdmin, Role.Manager] as const;

export const SERVICE_ROUTES: Routes = [
  {
    path: 'new',
    canMatch: [roleGuard(SERVICE_MANAGE_ROLES)],
    canDeactivate: [pendingServiceChangesGuard],
    loadComponent: () =>
      import('./pages/service-form/service-form.component').then(
        (component) => component.ServiceFormComponent,
      ),
    title: 'New service | Tailor',
  },
  {
    path: ':serviceId/edit',
    canMatch: [roleGuard(SERVICE_MANAGE_ROLES)],
    canDeactivate: [pendingServiceChangesGuard],
    loadComponent: () =>
      import('./pages/service-form/service-form.component').then(
        (component) => component.ServiceFormComponent,
      ),
    title: 'Edit service | Tailor',
  },
  {
    path: ':serviceId',
    canMatch: [roleGuard(SERVICE_READ_ROLES)],
    loadComponent: () =>
      import('./pages/service-details/service-details.component').then(
        (component) => component.ServiceDetailsComponent,
      ),
    title: 'Service details | Tailor',
  },
  {
    path: '',
    canMatch: [roleGuard(SERVICE_READ_ROLES)],
    loadComponent: () =>
      import('./pages/service-list/service-list.component').then(
        (component) => component.ServiceListComponent,
      ),
    title: 'Services | Tailor',
  },
];

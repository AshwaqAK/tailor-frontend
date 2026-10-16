import type { Routes } from '@angular/router';

import { roleGuard } from '@core/auth/role.guard';
import { Role } from '@shared/models/user.model';
import { pendingAlterationChangesGuard } from './guards/pending-alteration-changes.guard';
import { pendingAlterationDetailChangesGuard } from './guards/pending-alteration-detail-changes.guard';

export const ALTERATION_READ_ROLES = [
  Role.SuperAdmin,
  Role.Manager,
  Role.Receptionist,
  Role.Tailor,
] as const;
export const ALTERATION_CREATE_ROLES = [Role.SuperAdmin, Role.Manager, Role.Receptionist] as const;

export const ALTERATION_ROUTES: Routes = [
  {
    path: 'new',
    canMatch: [roleGuard(ALTERATION_CREATE_ROLES)],
    canDeactivate: [pendingAlterationChangesGuard],
    loadComponent: () =>
      import('./pages/alteration-form/alteration-form.component').then(
        (component) => component.AlterationFormComponent,
      ),
    title: 'Create alteration | Tailor',
  },
  {
    path: ':alterationId/bill/:billingOrderId',
    canMatch: [roleGuard(ALTERATION_READ_ROLES)],
    loadComponent: () =>
      import('./pages/alteration-bill/alteration-bill.component').then(
        (component) => component.AlterationBillComponent,
      ),
    title: 'Alteration bill | Tailor',
  },
  {
    path: ':alterationId',
    canMatch: [roleGuard(ALTERATION_READ_ROLES)],
    canDeactivate: [pendingAlterationDetailChangesGuard],
    loadComponent: () =>
      import('./pages/alteration-detail/alteration-detail.component').then(
        (component) => component.AlterationDetailComponent,
      ),
    title: 'Alteration details | Tailor',
  },
  {
    path: '',
    canMatch: [roleGuard(ALTERATION_READ_ROLES)],
    loadComponent: () =>
      import('./pages/alteration-list/alteration-list.component').then(
        (component) => component.AlterationListComponent,
      ),
    title: 'Alterations | Tailor',
  },
];

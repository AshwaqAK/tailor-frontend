import type { Routes } from '@angular/router';

import { roleGuard } from '@core/auth/role.guard';
import { Role } from '@shared/models/user.model';
import { pendingGarmentTypeChangesGuard } from './guards/pending-garment-type-changes.guard';

const MANAGE_ROLES = [Role.SuperAdmin, Role.Manager] as const;

export const GARMENT_TYPE_ROUTES: Routes = [
  {
    path: 'new',
    canMatch: [roleGuard(MANAGE_ROLES)],
    canDeactivate: [pendingGarmentTypeChangesGuard],
    loadComponent: () =>
      import('./pages/garment-type-form/garment-type-form.component').then(
        (component) => component.GarmentTypeFormComponent,
      ),
    title: 'New garment type | Tailor',
  },
  {
    path: ':garmentTypeId/edit',
    canMatch: [roleGuard(MANAGE_ROLES)],
    canDeactivate: [pendingGarmentTypeChangesGuard],
    loadComponent: () =>
      import('./pages/garment-type-form/garment-type-form.component').then(
        (component) => component.GarmentTypeFormComponent,
      ),
    title: 'Edit garment type | Tailor',
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/garment-types/garment-types.component').then(
        (component) => component.GarmentTypesComponent,
      ),
    title: 'Garment types | Tailor',
  },
];

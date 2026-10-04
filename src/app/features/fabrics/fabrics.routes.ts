import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { Role } from '@shared/models/user.model';
import { pendingFabricChangesGuard } from './guards/pending-fabric-changes.guard';

const MANAGE_ROLES = [Role.SuperAdmin, Role.Manager] as const;

export const FABRIC_ROUTES: Routes = [
  {
    path: 'new',
    canMatch: [roleGuard(MANAGE_ROLES)],
    canDeactivate: [pendingFabricChangesGuard],
    loadComponent: () =>
      import('./pages/fabric-form/fabric-form.component').then(
        (component) => component.FabricFormComponent,
      ),
    title: 'New fabric | Tailor',
  },
  {
    path: ':fabricId/edit',
    canMatch: [roleGuard(MANAGE_ROLES)],
    canDeactivate: [pendingFabricChangesGuard],
    loadComponent: () =>
      import('./pages/fabric-form/fabric-form.component').then(
        (component) => component.FabricFormComponent,
      ),
    title: 'Edit fabric | Tailor',
  },
  {
    path: ':fabricId',
    loadComponent: () =>
      import('./pages/fabric-details/fabric-details.component').then(
        (component) => component.FabricDetailsComponent,
      ),
    title: 'Fabric details | Tailor',
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/fabric-list/fabric-list.component').then(
        (component) => component.FabricListComponent,
      ),
    title: 'Fabrics | Tailor',
  },
];

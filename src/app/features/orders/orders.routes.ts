import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { Role } from '@shared/models/user.model';
import { pendingOrderChangesGuard } from './guards/pending-order-changes.guard';
const CREATE_ROLES = [Role.SuperAdmin, Role.Manager, Role.Receptionist] as const;
export const ORDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/order-list/order-list.component').then((m) => m.OrderListComponent),
    title: 'Orders | Tailor',
  },
  {
    path: 'new',
    canMatch: [roleGuard(CREATE_ROLES)],
    canDeactivate: [pendingOrderChangesGuard],
    loadComponent: () =>
      import('./pages/order-form/order-form.component').then((m) => m.OrderFormComponent),
    title: 'New order | Tailor',
  },
  {
    path: ':orderId',
    loadComponent: () =>
      import('./pages/order-details/order-details.component').then((m) => m.OrderDetailsComponent),
    title: 'Order details | Tailor',
  },
];

import type { Routes } from '@angular/router';

import { roleGuard } from '@core/auth/role.guard';
import { Role } from '@shared/models/user.model';

const AUDIT_LOG_ROLES = [Role.SuperAdmin, Role.Manager] as const;

export const AUDIT_LOG_ROUTES: Routes = [
  {
    path: ':auditLogId',
    canMatch: [roleGuard(AUDIT_LOG_ROLES)],
    loadComponent: () =>
      import('./pages/audit-log-details/audit-log-details.component').then(
        (component) => component.AuditLogDetailsComponent,
      ),
    title: 'Audit Log details | Tailor',
  },
  {
    path: '',
    canMatch: [roleGuard(AUDIT_LOG_ROLES)],
    loadComponent: () =>
      import('./pages/audit-log-list/audit-log-list.component').then(
        (component) => component.AuditLogListComponent,
      ),
    title: 'Audit Logs | Tailor',
  },
];

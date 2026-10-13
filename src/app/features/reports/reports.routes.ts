import type { Routes } from '@angular/router';

import { roleGuard } from '@core/auth/role.guard';
import { Role } from '@shared/models/user.model';

const REPORT_ROLES = [Role.SuperAdmin, Role.Manager] as const;

export const REPORT_ROUTES: Routes = [
  {
    path: '',
    canMatch: [roleGuard(REPORT_ROLES)],
    loadComponent: () =>
      import('./reports-shell.component').then((component) => component.ReportsShellComponent),
    children: [
      {
        path: 'orders',
        canMatch: [roleGuard(REPORT_ROLES)],
        loadComponent: () =>
          import('./pages/orders-report/orders-report.component').then(
            (component) => component.OrdersReportComponent,
          ),
        title: 'Orders report | Tailor',
      },
      {
        path: 'payments',
        canMatch: [roleGuard(REPORT_ROLES)],
        loadComponent: () =>
          import('./pages/payments-report/payments-report.component').then(
            (component) => component.PaymentsReportComponent,
          ),
        title: 'Payments report | Tailor',
      },
      {
        path: 'customers',
        canMatch: [roleGuard(REPORT_ROLES)],
        loadComponent: () =>
          import('./pages/customers-report/customers-report.component').then(
            (component) => component.CustomersReportComponent,
          ),
        title: 'Customers report | Tailor',
      },
      {
        path: 'appointments',
        canMatch: [roleGuard(REPORT_ROLES)],
        loadComponent: () =>
          import('./pages/appointments-report/appointments-report.component').then(
            (component) => component.AppointmentsReportComponent,
          ),
        title: 'Appointments report | Tailor',
      },
      {
        path: 'fabrics',
        canMatch: [roleGuard(REPORT_ROLES)],
        loadComponent: () =>
          import('./pages/fabrics-report/fabrics-report.component').then(
            (component) => component.FabricsReportComponent,
          ),
        title: 'Fabrics report | Tailor',
      },
      {
        path: 'fabric-sales',
        canMatch: [roleGuard(REPORT_ROLES)],
        loadComponent: () =>
          import('./pages/fabric-sales-report/fabric-sales-report.component').then(
            (component) => component.FabricSalesReportComponent,
          ),
        title: 'Fabric sales report | Tailor',
      },
      {
        path: 'service-usage',
        canMatch: [roleGuard(REPORT_ROLES)],
        loadComponent: () =>
          import('./pages/service-usage-report/service-usage-report.component').then(
            (component) => component.ServiceUsageReportComponent,
          ),
        title: 'Service usage report | Tailor',
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'orders',
      },
    ],
  },
];

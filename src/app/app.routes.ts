import type { Routes } from '@angular/router';

import { authGuard } from '@core/auth/auth.guard';
import { guestGuard } from '@core/auth/guest.guard';
import { AppShellComponent } from '@core/layout/app-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('@features/auth/login/login.component').then((component) => component.LoginComponent),
    title: 'Sign in | Tailor',
  },
  {
    path: 'unauthorized',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@features/errors/unauthorized.component').then(
        (component) => component.UnauthorizedComponent,
      ),
    title: 'Access denied | Tailor',
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('@features/dashboard/dashboard.component').then(
            (component) => component.DashboardComponent,
          ),
        title: 'Dashboard | Tailor',
      },
      {
        path: 'customers',
        loadChildren: () =>
          import('@features/customers/customers.routes').then((routes) => routes.CUSTOMER_ROUTES),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('@features/errors/not-found.component').then(
        (component) => component.NotFoundComponent,
      ),
    title: 'Page not found | Tailor',
  },
];

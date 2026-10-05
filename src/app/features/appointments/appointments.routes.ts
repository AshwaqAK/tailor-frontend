import type { Routes } from '@angular/router';

export const APPOINTMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/appointment-list/appointment-list.component').then(
        (component) => component.AppointmentListComponent,
      ),
    title: 'Appointments | Tailor',
  },
];

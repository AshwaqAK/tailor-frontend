import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main class="container d-flex min-vh-100 align-items-center justify-content-center text-center">
      <div>
        <p class="display-1 fw-bold text-primary mb-0">404</p>
        <h1 class="h3">Page not found</h1>
        <p class="text-body-secondary">The page you requested does not exist.</p>
        <a class="btn btn-primary" routerLink="/">Return home</a>
      </div>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  imports: [RouterLink],
  template: `
    <main class="container d-flex min-vh-100 align-items-center justify-content-center text-center">
      <div>
        <p class="display-1 fw-bold text-danger mb-0">403</p>
        <h1 class="h3">Access denied</h1>
        <p class="text-body-secondary">Your account does not have permission to view this page.</p>
        <a class="btn btn-primary" routerLink="/dashboard">Return to dashboard</a>
      </div>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnauthorizedComponent {}

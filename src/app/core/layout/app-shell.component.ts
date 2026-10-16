import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly canViewReports = computed(() => {
    const role = this.user()?.role;
    return role === Role.SuperAdmin || role === Role.Manager;
  });
  readonly canViewAuditLogs = this.canViewReports;
  readonly canViewAlterations = computed(() => {
    const role = this.user()?.role;
    return (
      role === Role.SuperAdmin ||
      role === Role.Manager ||
      role === Role.Receptionist ||
      role === Role.Tailor
    );
  });
  readonly sidebarOpen = signal(false);
  readonly signingOut = signal(false);

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  signOut(): void {
    if (this.signingOut()) return;

    this.signingOut.set(true);
    this.auth
      .logout()
      .pipe(finalize(() => this.signingOut.set(false)))
      .subscribe(() => void this.router.navigate(['/login']));
  }
}

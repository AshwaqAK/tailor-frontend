import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  readonly user = inject(AuthService).user;
}

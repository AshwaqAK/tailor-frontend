import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-reports-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './reports-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsShellComponent {}

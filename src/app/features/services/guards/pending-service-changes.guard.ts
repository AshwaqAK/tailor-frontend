import type { CanDeactivateFn } from '@angular/router';
import type { ServiceFormComponent } from '../pages/service-form/service-form.component';

export const pendingServiceChangesGuard: CanDeactivateFn<ServiceFormComponent> = (component) =>
  component.canLeave();

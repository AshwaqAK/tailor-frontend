import type { CanDeactivateFn } from '@angular/router';
import type { OrderFormComponent } from '../pages/order-form/order-form.component';
export const pendingOrderChangesGuard: CanDeactivateFn<OrderFormComponent> = (component) =>
  component.canLeave();

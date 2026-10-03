import type { CanDeactivateFn } from '@angular/router';

import type { CustomerFormPageComponent } from '../pages/customer-form-page/customer-form-page.component';

export const pendingCustomerChangesGuard: CanDeactivateFn<CustomerFormPageComponent> = (
  component,
) => component.canLeave();

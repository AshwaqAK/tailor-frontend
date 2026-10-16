import type { CanDeactivateFn } from '@angular/router';

import type { AlterationDetailComponent } from '../pages/alteration-detail/alteration-detail.component';

export const pendingAlterationDetailChangesGuard: CanDeactivateFn<AlterationDetailComponent> = (
  component,
) => component.canLeave();

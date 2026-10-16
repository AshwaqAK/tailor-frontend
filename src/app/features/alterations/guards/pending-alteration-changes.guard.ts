import type { CanDeactivateFn } from '@angular/router';

import type { AlterationFormComponent } from '../pages/alteration-form/alteration-form.component';

export const pendingAlterationChangesGuard: CanDeactivateFn<AlterationFormComponent> = (
  component,
) => component.canLeave();

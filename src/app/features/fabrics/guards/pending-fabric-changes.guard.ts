import type { CanDeactivateFn } from '@angular/router';

import type { FabricFormComponent } from '../pages/fabric-form/fabric-form.component';

export const pendingFabricChangesGuard: CanDeactivateFn<FabricFormComponent> = (component) =>
  component.canLeave();

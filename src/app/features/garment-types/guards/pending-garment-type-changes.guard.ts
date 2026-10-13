import type { CanDeactivateFn } from '@angular/router';

import type { GarmentTypeFormComponent } from '../pages/garment-type-form/garment-type-form.component';

export const pendingGarmentTypeChangesGuard: CanDeactivateFn<GarmentTypeFormComponent> = (
  component,
) => component.canLeave();

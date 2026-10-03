import type { CanDeactivateFn } from '@angular/router';

import type { MeasurementFormPageComponent } from '../pages/measurement-form-page/measurement-form-page.component';

export const pendingMeasurementChangesGuard: CanDeactivateFn<MeasurementFormPageComponent> = (
  component,
) => component.canLeave();

import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { Router } from '@angular/router';

import type { Role } from '@shared/models/user.model';
import { AuthService } from './auth.service';

export const roleGuard = (allowedRoles: readonly Role[]): CanMatchFn => {
  return () => {
    const user = inject(AuthService).user();
    return user && allowedRoles.includes(user.role)
      ? true
      : inject(Router).createUrlTree(['/dashboard']);
  };
};

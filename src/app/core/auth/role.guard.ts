import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { Router } from '@angular/router';

import type { Role } from '@shared/models/user.model';
import { AuthService } from './auth.service';

export const roleGuard = (allowedRoles: readonly Role[]): CanMatchFn => {
  return (_route, segments) => {
    const router = inject(Router);
    const user = inject(AuthService).user();

    if (!user) {
      const returnUrl = `/${segments.map((segment) => segment.path).join('/')}`;
      return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
    }

    return allowedRoles.includes(user.role) ? true : router.createUrlTree(['/unauthorized']);
  };
};

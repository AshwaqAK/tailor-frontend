import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  UrlSegment,
} from '@angular/router';

import { Role, type User } from '@shared/models/user.model';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { roleGuard } from './role.guard';

describe('authentication guards', () => {
  const authenticated = signal(false);
  const user = signal<User | null>(null);
  let router: Router;

  beforeEach(() => {
    authenticated.set(false);
    user.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isAuthenticated: authenticated.asReadonly(), user: user.asReadonly() },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('allows authenticated users to activate protected routes', () => {
    authenticated.set(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });

  it('redirects anonymous users to login with their intended URL', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot),
    );

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/login?returnUrl=%2Fdashboard',
    );
  });

  it('allows a user whose role is permitted', () => {
    user.set(createUser(Role.Manager));

    const result = TestBed.runInInjectionContext(() =>
      roleGuard([Role.SuperAdmin, Role.Manager])(
        {} as never,
        [new UrlSegment('admin', {})],
        {} as never,
      ),
    );

    expect(result).toBe(true);
  });

  it('redirects an authenticated user with an unapproved role to unauthorized', () => {
    user.set(createUser(Role.Tailor));

    const result = TestBed.runInInjectionContext(() =>
      roleGuard([Role.SuperAdmin])({} as never, [new UrlSegment('admin', {})], {} as never),
    );

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/unauthorized',
    );
  });

  function createUser(role: Role): User {
    return {
      id: 'mongo-id',
      userId: 'USR-000001',
      name: 'Test User',
      email: 'test@example.com',
      role,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { Role, type User } from '@shared/models/user.model';
import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent alterations navigation', () => {
  it.each([Role.SuperAdmin, Role.Manager, Role.Receptionist, Role.Tailor])(
    'shows Alterations for %s',
    async (role) => {
      await configure(role);
      const fixture = TestBed.createComponent(AppShellComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Alterations');
      expect(fixture.nativeElement.querySelectorAll('a[routerlink="/alterations"]')).toHaveLength(
        1,
      );
    },
  );

  it('hides Alterations for an unsupported role', async () => {
    await configure(undefined);
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Alterations');
  });
});

describe('AppShellComponent services navigation', () => {
  it('shows one Services navigation item for an authenticated user', async () => {
    await configure(Role.Tailor);
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('a[routerlink="/services"]')).toHaveLength(1);
  });
});

async function configure(role: Role | undefined): Promise<void> {
  const user = role
    ? ({
        id: 'id',
        userId: 'USR-000001',
        name: 'Test user',
        email: 'test@example.com',
        role,
        isActive: true,
        createdAt: '',
        updatedAt: '',
      } as User)
    : null;
  await TestBed.configureTestingModule({
    imports: [AppShellComponent],
    providers: [
      { provide: AuthService, useValue: { user: signal(user).asReadonly(), logout: vi.fn() } },
      provideRouter([]),
    ],
  }).compileComponents();
}

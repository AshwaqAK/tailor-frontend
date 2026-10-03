import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { apiInterceptor } from '@core/api/api.interceptor';
import { APP_CONFIG } from '@core/config/app-config';
import { Role, type User } from '@shared/models/user.model';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let http: HttpTestingController;
  let router: Router;

  const user: User = {
    id: 'mongo-id',
    userId: 'USR-000001',
    name: 'Test User',
    email: 'test@example.com',
    role: Role.Manager,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it('marks required fields invalid when an empty form is submitted', () => {
    const component = TestBed.createComponent(LoginComponent).componentInstance;

    component.submit();

    expect(component.loginForm.invalid).toBe(true);
    expect(component.loginForm.controls.email.touched).toBe(true);
    expect(component.loginForm.controls.password.touched).toBe(true);
  });

  it('submits the exact backend login fields, shows loading, and redirects to dashboard', () => {
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const component = TestBed.createComponent(LoginComponent).componentInstance;
    component.loginForm.setValue({ email: 'test@example.com', password: 'password' });

    component.submit();
    expect(component.submitting()).toBe(true);

    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.body).toEqual({ email: 'test@example.com', password: 'password' });
    login.flush({ success: true, data: { accessToken: 'access-token' } });
    http.expectOne('/api/v1/auth/me').flush({ success: true, data: user });

    expect(component.submitting()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('renders the backend message and resets loading after a failed login', () => {
    const component = TestBed.createComponent(LoginComponent).componentInstance;
    component.loginForm.setValue({ email: 'test@example.com', password: 'wrong' });

    component.submit();
    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { success: false, message: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(component.errorMessage()).toBe('Invalid credentials');
    expect(component.submitting()).toBe(false);
  });
});

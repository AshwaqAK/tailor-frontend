import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_CONFIG } from '@core/config/app-config';
import { Role, type User } from '@shared/models/user.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

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

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('logs in, retains only the access token in memory, and loads the user', () => {
    service.login({ email: 'test@example.com', password: 'password' }).subscribe();

    expect(service.loading()).toBe(true);
    completeLogin();

    expect(service.user()).toEqual(user);
    expect(service.accessToken()).toBe('access-token');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.loading()).toBe(false);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('does not authenticate when login fails', () => {
    let receivedError = false;
    service.login({ email: 'test@example.com', password: 'wrong' }).subscribe({
      error: () => (receivedError = true),
    });

    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { success: false, message: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(receivedError).toBe(true);
    expect(service.user()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.loading()).toBe(false);
  });

  it('refreshes the access token through the backend cookie flow', () => {
    let result: string | undefined;
    service.refreshAccessToken().subscribe((token) => (result = token));

    const request = http.expectOne('/api/v1/auth/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: { accessToken: 'refreshed-token' } });

    expect(result).toBe('refreshed-token');
    expect(service.accessToken()).toBe('refreshed-token');
  });

  it('shares one in-flight refresh request between subscribers', () => {
    const tokens: string[] = [];
    service.refreshAccessToken().subscribe((token) => tokens.push(token));
    service.refreshAccessToken().subscribe((token) => tokens.push(token));

    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ success: true, data: { accessToken: 'shared-token' } });

    expect(tokens).toEqual(['shared-token', 'shared-token']);
  });

  it('restores a session from the refresh cookie and marks initialization complete', async () => {
    const restored = service.restoreSession();
    expect(service.loading()).toBe(true);

    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ success: true, data: { accessToken: 'restored-token' } });
    http.expectOne('/api/v1/auth/me').flush({ success: true, data: user });

    await restored;
    expect(service.initialized()).toBe(true);
    expect(service.loading()).toBe(false);
    expect(service.user()).toEqual(user);
  });

  it('treats an invalid refresh cookie as an anonymous session', async () => {
    const restored = service.restoreSession();
    http
      .expectOne('/api/v1/auth/refresh')
      .flush(
        { success: false, message: 'Invalid refresh token' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await restored;
    expect(service.initialized()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
  });

  it('logs out through the backend and clears all client authentication state', () => {
    service.login({ email: 'test@example.com', password: 'password' }).subscribe();
    completeLogin();

    service.logout().subscribe();
    const request = http.expectOne('/api/v1/auth/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: { message: 'Logged out successfully' } });

    expect(service.user()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.loading()).toBe(false);
  });

  it('clears local state even when the logout endpoint fails', () => {
    service.login({ email: 'test@example.com', password: 'password' }).subscribe();
    completeLogin();

    service.logout().subscribe();
    http
      .expectOne('/api/v1/auth/logout')
      .flush(
        { success: false, message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(service.user()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.loading()).toBe(false);
  });

  function completeLogin(): void {
    const loginRequest = http.expectOne('/api/v1/auth/login');
    expect(loginRequest.request.method).toBe('POST');
    expect(loginRequest.request.body).toEqual({
      email: 'test@example.com',
      password: 'password',
    });
    expect(loginRequest.request.withCredentials).toBe(true);
    loginRequest.flush({ success: true, data: { accessToken: 'access-token' } });

    const meRequest = http.expectOne('/api/v1/auth/me');
    expect(meRequest.request.withCredentials).toBe(true);
    meRequest.flush({ success: true, data: user });
  }
});

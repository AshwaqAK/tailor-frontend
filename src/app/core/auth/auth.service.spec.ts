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

  it('logs in, retains the access token in memory, and loads the user', () => {
    service.login({ email: 'test@example.com', password: 'password' }).subscribe((result) => {
      expect(result).toEqual(user);
      expect(service.user()).toEqual(user);
      expect(service.accessToken()).toBe('access-token');
    });

    const loginRequest = http.expectOne('/api/v1/auth/login');
    expect(loginRequest.request.withCredentials).toBe(true);
    loginRequest.flush({ success: true, data: { accessToken: 'access-token' } });

    const meRequest = http.expectOne('/api/v1/auth/me');
    expect(meRequest.request.withCredentials).toBe(true);
    meRequest.flush({ success: true, data: user });
  });

  it('clears local state even when the logout endpoint fails', () => {
    service.logout().subscribe(() => {
      expect(service.user()).toBeNull();
      expect(service.accessToken()).toBeNull();
    });

    http
      .expectOne('/api/v1/auth/logout')
      .flush(
        { success: false, message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );
  });
});

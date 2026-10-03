import { HttpClient, provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { APP_CONFIG } from '@core/config/app-config';
import { ApiError } from './api-error';
import { apiInterceptor } from './api.interceptor';

describe('apiInterceptor', () => {
  let http: HttpTestingController;
  const token = signal<string | null>('access-token');
  const refreshAccessToken = vi.fn(() => of('refreshed-token'));

  beforeEach(() => {
    token.set('access-token');
    refreshAccessToken.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        {
          provide: AuthService,
          useValue: { accessToken: token.asReadonly(), refreshAccessToken },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('adds the bearer token and credentials to backend API requests', () => {
    const client = TestBed.inject(HttpClient);
    client.get('/api/v1/auth/me').subscribe();

    const request = http.expectOne('/api/v1/auth/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: {} });
  });

  it('does not leak the access token to non-API requests', () => {
    const client = TestBed.inject(HttpClient);
    client.get('/config/app-config.json').subscribe();

    const request = http.expectOne('/config/app-config.json');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ apiBaseUrl: '/api/v1' });
  });

  it('refreshes once after a protected request receives 401 and retries with the new token', () => {
    const client = TestBed.inject(HttpClient);
    client.get('/api/v1/auth/me').subscribe();

    http
      .expectOne('/api/v1/auth/me')
      .flush(
        { success: false, message: 'Invalid or expired access token' },
        { status: 401, statusText: 'Unauthorized' },
      );

    const retry = http.expectOne('/api/v1/auth/me');
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
    retry.flush({ success: true, data: {} });
  });

  it('does not attempt refresh for a failed login', () => {
    let error: unknown;
    const client = TestBed.inject(HttpClient);
    client.post('/api/v1/auth/login', {}).subscribe({ error: (value: unknown) => (error = value) });

    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { success: false, message: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Invalid credentials');
  });

  it('normalizes backend validation messages into a central API error', () => {
    let error: unknown;
    const client = TestBed.inject(HttpClient);
    client.post('/api/v1/auth/login', {}).subscribe({ error: (value: unknown) => (error = value) });

    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { success: false, message: ['email must be an email', 'password must be a string'] },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: 'email must be an email',
      details: ['password must be a string'],
    });
  });
});

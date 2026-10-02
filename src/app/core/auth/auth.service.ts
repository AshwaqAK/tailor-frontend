import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import type { Observable } from 'rxjs';

import { APP_CONFIG } from '@core/config/app-config';
import type { ApiSuccess } from '@shared/models/api.model';
import type { User } from '@shared/models/user.model';
import type { AccessTokenResponse, LoginRequest, LogoutResponse } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly userState = signal<User | null>(null);
  private readonly tokenState = signal<string | null>(null);
  private refreshRequest?: Observable<string>;

  readonly user = this.userState.asReadonly();
  readonly accessToken = this.tokenState.asReadonly();
  readonly isAuthenticated = computed(() => this.userState() !== null);

  login(credentials: LoginRequest): Observable<User> {
    return this.http
      .post<ApiSuccess<AccessTokenResponse>>(`${this.config.apiBaseUrl}/auth/login`, credentials, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => this.tokenState.set(response.data.accessToken)),
        switchMap(() => this.loadCurrentUser()),
      );
  }

  logout(): Observable<void> {
    return this.http
      .post<
        ApiSuccess<LogoutResponse>
      >(`${this.config.apiBaseUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
        tap(() => this.clearSession()),
      );
  }

  refreshAccessToken(): Observable<string> {
    if (this.refreshRequest) {
      return this.refreshRequest;
    }

    this.refreshRequest = this.http
      .post<
        ApiSuccess<AccessTokenResponse>
      >(`${this.config.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        map((response) => response.data.accessToken),
        tap((token) => this.tokenState.set(token)),
        catchError((error: unknown) => {
          this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => (this.refreshRequest = undefined)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.refreshRequest;
  }

  restoreSession(): Promise<void> {
    return firstValueFrom(
      this.refreshAccessToken().pipe(
        switchMap(() => this.loadCurrentUser()),
        map(() => undefined),
        catchError(() => of(undefined)),
      ),
    );
  }

  clearSession(): void {
    this.tokenState.set(null);
    this.userState.set(null);
  }

  private loadCurrentUser(): Observable<User> {
    return this.http
      .get<ApiSuccess<User>>(`${this.config.apiBaseUrl}/auth/me`, { withCredentials: true })
      .pipe(
        map((response) => response.data),
        tap((user) => this.userState.set(user)),
      );
  }
}

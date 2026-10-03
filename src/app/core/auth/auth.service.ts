import { computed, inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  defer,
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

import type { User } from '@shared/models/user.model';
import { AuthApiService } from './auth-api.service';
import type { AuthState, LoginRequest } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly state = signal<AuthState>({ user: null, initialized: false, loading: false });
  private readonly tokenState = signal<string | null>(null);
  private pendingAuthRequests = 0;
  private refreshRequest?: Observable<string>;

  readonly user = computed(() => this.state().user);
  readonly initialized = computed(() => this.state().initialized);
  readonly loading = computed(() => this.state().loading);
  readonly accessToken = this.tokenState.asReadonly();
  readonly isAuthenticated = computed(() => this.state().user !== null);

  login(credentials: LoginRequest): Observable<User> {
    return this.trackLoading(
      this.authApi.login(credentials).pipe(
        tap((response) => this.tokenState.set(response.accessToken)),
        switchMap(() => this.loadCurrentUser()),
      ),
    );
  }

  logout(): Observable<void> {
    return this.trackLoading(
      this.authApi.logout().pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
        tap(() => this.clearSession()),
      ),
    );
  }

  refreshAccessToken(): Observable<string> {
    if (this.refreshRequest) {
      return this.refreshRequest;
    }

    this.refreshRequest = this.trackLoading(
      this.authApi.refresh().pipe(
        map((response) => response.accessToken),
        tap((token) => this.tokenState.set(token)),
        catchError((error: unknown) => {
          this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => (this.refreshRequest = undefined)),
        shareReplay({ bufferSize: 1, refCount: false }),
      ),
    );

    return this.refreshRequest;
  }

  restoreSession(): Promise<void> {
    return firstValueFrom(
      this.trackLoading(
        this.refreshAccessToken().pipe(
          switchMap(() => this.loadCurrentUser()),
          map(() => undefined),
          catchError(() => of(undefined)),
          finalize(() => this.patchState({ initialized: true })),
        ),
      ),
    );
  }

  clearSession(): void {
    this.tokenState.set(null);
    this.patchState({ user: null });
  }

  private loadCurrentUser(): Observable<User> {
    return this.authApi.getCurrentUser().pipe(tap((user) => this.patchState({ user })));
  }

  private trackLoading<T>(request: Observable<T>): Observable<T> {
    return defer(() => {
      this.pendingAuthRequests += 1;
      this.patchState({ loading: true });
      return request.pipe(
        finalize(() => {
          this.pendingAuthRequests = Math.max(0, this.pendingAuthRequests - 1);
          this.patchState({ loading: this.pendingAuthRequests > 0 });
        }),
      );
    });
  }

  private patchState(patch: Partial<AuthState>): void {
    this.state.update((state) => ({ ...state, ...patch }));
  }
}

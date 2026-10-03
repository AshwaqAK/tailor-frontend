import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type { User } from '@shared/models/user.model';
import type { AccessTokenResponse, LoginRequest, LogoutResponse } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiService);

  login(credentials: LoginRequest): Observable<AccessTokenResponse> {
    return this.api.post<AccessTokenResponse, LoginRequest>('auth/login', credentials);
  }

  refresh(): Observable<AccessTokenResponse> {
    return this.api.post<AccessTokenResponse>('auth/refresh', {});
  }

  getCurrentUser(): Observable<User> {
    return this.api.get<User>('auth/me');
  }

  logout(): Observable<LogoutResponse> {
    return this.api.post<LogoutResponse>('auth/logout', {});
  }
}

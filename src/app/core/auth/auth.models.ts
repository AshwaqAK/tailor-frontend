import type { User } from '@shared/models/user.model';

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface AccessTokenResponse {
  readonly accessToken: string;
}

export interface LogoutResponse {
  readonly message: string;
}

export interface AuthState {
  readonly user: User | null;
  readonly initialized: boolean;
}

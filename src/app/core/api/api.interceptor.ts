import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { APP_CONFIG } from '@core/config/app-config';
import type { ApiErrorBody } from '@shared/models/api.model';
import { ApiError } from './api-error';

const AUTH_PATHS = ['/auth/login', '/auth/refresh'];

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const config = inject(APP_CONFIG);
  const isApiRequest = request.url.startsWith(config.apiBaseUrl);
  const isPublicAuthRequest = AUTH_PATHS.some((path) => request.url.endsWith(path));
  const token = auth.accessToken();
  const authorizedRequest =
    isApiRequest && token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
      : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isPublicAuthRequest &&
        token
      ) {
        return auth.refreshAccessToken().pipe(
          switchMap((newToken) =>
            next(
              request.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
                withCredentials: true,
              }),
            ),
          ),
          catchError((refreshError: unknown) => throwError(() => normalizeError(refreshError))),
        );
      }

      return throwError(() => normalizeError(error));
    }),
  );
};

function normalizeError(error: unknown): unknown {
  if (!(error instanceof HttpErrorResponse)) {
    return error;
  }

  const body = error.error as Partial<ApiErrorBody> | null;
  const messages = Array.isArray(body?.message)
    ? body.message
    : body?.message
      ? [body.message]
      : [];

  return new ApiError(
    messages[0] ?? 'The request could not be completed.',
    error.status,
    messages.slice(1),
    body?.path,
  );
}

import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import {
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { apiInterceptor } from '@core/api/api.interceptor';
import { AuthService } from '@core/auth/auth.service';
import { GlobalErrorHandler } from '@core/errors/global-error-handler';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withXhr(), withInterceptors([apiInterceptor])),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};

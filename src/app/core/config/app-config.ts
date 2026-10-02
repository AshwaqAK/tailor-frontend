import { InjectionToken } from '@angular/core';

export interface AppConfig {
  readonly apiBaseUrl: string;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiBaseUrl: '/api/v1',
};

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  factory: () => DEFAULT_APP_CONFIG,
});

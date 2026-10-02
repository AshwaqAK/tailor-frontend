import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { APP_CONFIG, DEFAULT_APP_CONFIG, type AppConfig } from './app/core/config/app-config';

async function loadRuntimeConfig(): Promise<AppConfig> {
  try {
    const response = await fetch('/config/app-config.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Runtime configuration request failed with status ${response.status}`);
    }

    const config = (await response.json()) as Partial<AppConfig>;
    return { ...DEFAULT_APP_CONFIG, ...config };
  } catch (error: unknown) {
    console.warn('Using default runtime configuration.', error);
    return DEFAULT_APP_CONFIG;
  }
}

loadRuntimeConfig()
  .then((runtimeConfig) =>
    bootstrapApplication(AppComponent, {
      ...appConfig,
      providers: [...(appConfig.providers ?? []), { provide: APP_CONFIG, useValue: runtimeConfig }],
    }),
  )
  .catch((error: unknown) => console.error(error));

# Frontend architecture

The application uses Angular standalone components and a feature-first directory layout.

```text
src/app/
├── core/       # singleton infrastructure: auth, API, config, errors, layout
├── features/   # lazy-loaded routed business capabilities
└── shared/     # reusable stateless UI and cross-feature types
```

## Design rules

- Feature routes are lazy loaded. A feature owns its pages, forms, domain types, and data access.
- `core` code is application-wide and must not import from a feature.
- `shared` code contains no business workflow and must not depend on a feature.
- Components use `OnPush` change detection and signals for local/view state.
- Unit tests run on Angular's current Vitest builder; critical browser flows use Playwright.
- API calls use typed success and error envelopes. Domain services may compose `ApiService` but views do not call `HttpClient` directly.
- Route guards improve navigation UX; backend authorization remains authoritative.

## Authentication

The backend returns a short-lived access token in the response body and rotates a refresh token in an HttpOnly cookie. `AuthApiService` owns the exact backend calls while `AuthService` owns signal-based session state. The frontend keeps the access token and current user in memory only. On startup it calls the refresh endpoint with credentials, then loads the current user. The HTTP interceptor attaches the bearer token and performs a single shared refresh when concurrent authenticated requests receive `401`.

This avoids placing tokens in `localStorage` or `sessionStorage` while preserving sessions across page reloads. Authentication guards send anonymous users to login with an internal return URL; role guards send authenticated users without a required backend-defined role to the unauthorized page. Backend authorization remains authoritative.

## Configuration

`public/config/app-config.json` is loaded before Angular bootstraps. The default API base URL is same-origin `/api/v1`. Development requests are proxied to `http://localhost:3000`; the production Nginx container proxies them to `BACKEND_URL`.

## Adding a feature

1. Create `src/app/features/<feature>`.
2. Expose a lazy route from `app.routes.ts` or a feature routes file.
3. Add typed API contracts and a feature data service.
4. Apply `roleGuard` for navigation access where useful.
5. Add unit tests for behavior and an end-to-end test for the critical user path.

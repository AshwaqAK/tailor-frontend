# Tailor Frontend

Production-ready Angular frontend foundation for the Tailor Management System, built with strict TypeScript, standalone components, Angular Router, SCSS, and Bootstrap 5.

## Requirements

- Node.js 24.15.0+ within the Node 24 line (24.20.0 is pinned in `.nvmrc`)
- npm 10+
- Tailor backend running on `http://localhost:3000` for local API calls

The project uses Angular 22.2.1 with TypeScript 6.0 and Node.js 24.20.0.

## Start locally

```bash
npm ci
npm start
```

Open `http://localhost:5173`. The development server proxies `/api` to the backend, matching the backend's documented local CORS origin and avoiding cross-origin cookie issues.

## Commands

| Command                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `npm start`            | Development server on port 5173 with API proxy |
| `npm run build`        | Optimized production build with bundle budgets |
| `npm test`             | Vitest unit tests in watch mode                |
| `npm run test:ci`      | Vitest unit tests with coverage                |
| `npm run e2e`          | Playwright critical-path tests                 |
| `npm run lint`         | TypeScript and template linting                |
| `npm run format:check` | Verify formatting                              |
| `npm run check`        | Run the local quality gate                     |

## Runtime configuration

The browser loads `public/config/app-config.json` before bootstrap. API traffic defaults to same-origin `/api/v1`. For local development, edit `proxy.conf.json` only when the backend host changes.

## Docker

```bash
docker compose up --build
```

The app is served at `http://localhost:8080`. Set `BACKEND_URL` to the backend origin when it is not reachable at `http://host.docker.internal:3000`:

```bash
BACKEND_URL=http://backend:3000 docker compose up --build
```

The final image serves immutable static assets with Nginx, supports SPA route fallback, proxies `/api`, adds baseline security headers, and exposes `/healthz` for container health checks.

## Architecture and API contract

- [Architecture](docs/ARCHITECTURE.md)
- [Backend contract snapshot](docs/BACKEND_CONTRACT.md)
- Backend reference: <https://github.com/AshwaqAK/tailor-backend>

Access tokens remain in memory. Refresh tokens are managed only through the backend's HttpOnly cookie. CI verifies linting, formatting, Vitest unit tests, the production build, Playwright tests, and the container build.

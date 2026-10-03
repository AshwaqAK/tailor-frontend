# Backend contract reference

Snapshot reviewed from backend commit `191556b27910c92c68afe21f06ee0b431c5369ee` on 2026-10-03. The backend remains the source of truth.

## Transport

- Base path: `/api/v1`
- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "message": string | string[] }`
- CORS enables credentials for the configured single origin.
- Unknown request properties are rejected by the backend validation pipe.

## Authentication

| Method | Route           | Purpose                                                               |
| ------ | --------------- | --------------------------------------------------------------------- |
| POST   | `/auth/login`   | Email/password login; returns an access token and sets refresh cookie |
| POST   | `/auth/refresh` | Rotates HttpOnly refresh cookie and returns a new access token        |
| GET    | `/auth/me`      | Returns the authenticated user                                        |
| POST   | `/auth/logout`  | Revokes refresh state and clears the cookie                           |

Roles are `SUPER_ADMIN`, `MANAGER`, `RECEPTIONIST`, and `TAILOR`. Protected calls use `Authorization: Bearer <access-token>`.

The access token defaults to a 15-minute lifetime. The refresh token defaults to seven days, is rotated on every refresh, and is stored by the backend as a bcrypt hash. Its cookie defaults to `refreshToken`, `HttpOnly`, `SameSite=Lax`, and path `/api/v1/auth`. The cookie has no explicit `Max-Age` or `Expires`, so browsers treat it as a session cookie even though the JWT can remain valid longer.

## Current resources

| Resource          | Routes observed                                     |
| ----------------- | --------------------------------------------------- |
| Health            | `GET /health`                                       |
| Users             | list, detail, create, update, current user          |
| Customers         | create, list/search, lookup, detail, update, status |
| Measurements      | create, latest, history, by customer                |
| Orders            | create, detail, by customer, status update          |
| Payments          | create, detail, list, by order/customer, refund     |
| Appointments      | create, detail, list, update, status update         |
| Fabrics           | create, detail, list, update, delete                |
| Services          | create, detail, list, update, delete                |
| Dashboard/reports | summary and date-filtered business reports          |

Refer to the backend controllers and DTOs before implementing each feature because field-level constraints and role matrices may evolve.

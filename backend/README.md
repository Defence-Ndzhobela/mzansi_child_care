# Backend

Express API on Neon PostgreSQL. Requires Node.js 19 or later.

## Structure

```
backend/
├── server.js                 starts the HTTP server (graceful shutdown on SIGINT/SIGTERM)
├── src/
│   ├── app.js                builds the Express app: middleware, routes, error handling
│   ├── config/               env.js (validated settings), database.js (Neon client)
│   ├── routes/               endpoints + middleware per route (auth, child, family, socialWorker)
│   ├── controllers/          HTTP only: read request, call a service, send the response
│   ├── services/             business logic and all SQL (auth, child, family)
│   ├── validators/           request validation middleware
│   ├── middleware/           JWT auth, role checks, rate limit, central error handler
│   └── utils/                apiResponse, asyncHandler, encryptIdNumber, helpers
├── database/
│   ├── schema.sql            current full schema (for a brand-new database)
│   ├── migrations/           001_initial_schema.sql, 002_child_linking.sql
│   ├── seeds/demoData.sql    fictional demo users and records (development only)
│   └── migrate.js            migration runner
└── tests/                    node:test suites (fake database, no network)
```

There is no backend code yet for maintenance arrangements, payments, evidence
uploads or notifications. Those tables exist in the schema, but the dashboard
still keeps that data in the browser. Add the matching controller, service,
route and validator files, plus upload middleware and storage config for
evidence, when those features are built.

## Run locally

1. `cd backend && npm install`
2. Copy `.env.example` to `.env`; set `DATABASE_URL` (Neon connection string) and
   `JWT_SECRET` (random, at least 32 bytes). Keep both secret. `.env` is Git-ignored
   and existing environment variables take precedence. The server refuses to
   start if a required variable is missing or invalid.
3. `npm run db:migrate` to apply pending migrations.
4. `npm start` (API at `BACKEND_URL`, port 5000 by default).
5. In `frontend`: copy `.env.example` to `.env.local` (sets `VITE_API_URL`), then `npm install` and `npm run dev`.
6. `npm test` for the backend tests.

The same `start`, `db:migrate` and `test` scripts also work from the repository root.

## Configuration

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NODE_ENV` | backend | `development` (default), `production` or `test`. Production requires https URLs and Secure cookies. |
| `PORT` | backend | Listen port. Render injects it; the fallback is 5000. |
| `HOST` | backend | Optional bind address. Leave unset in production. |
| `FRONTEND_URL` | backend | Origin of the frontend. Required; always allowed by CORS. |
| `BACKEND_URL` | backend | Public origin of this API. Required; always allowed by CORS. |
| `CORS_ORIGINS` | backend | Extra allowed browser origins, comma separated, exact match. `*` is rejected. |
| `COOKIE_SAME_SITE` | backend | `strict` (default), `lax` or `none`. |
| `DATABASE_URL`, `JWT_SECRET` | backend | Secrets. Never expose to the frontend. |
| `VITE_API_URL` | frontend | API base including `/api`. Read only in `frontend/src/config/api.ts`. |
| `VITE_BACKEND_URL` | frontend | Backend origin without `/api`, for links to backend-served files. |

Every frontend request goes through `apiFetch` (`frontend/src/services/apiClient.ts`),
which prefixes `VITE_API_URL` and sends cookies (`credentials: 'include'`).

## Deploying: Vercel (frontend) and Render (backend)

Set these in the dashboards; no source edits are needed.

- **Vercel**: `VITE_API_URL=https://<backend>.onrender.com/api`,
  `VITE_BACKEND_URL=https://<backend>.onrender.com`.
- **Render**: `NODE_ENV=production`, `FRONTEND_URL=https://<project>.vercel.app`,
  `BACKEND_URL=https://<backend>.onrender.com`, `CORS_ORIGINS=https://<project>.vercel.app`
  (add any extra origins, such as preview domains, comma separated), `DATABASE_URL`,
  `JWT_SECRET`, and `COOKIE_SAME_SITE=none`. Do not set `PORT`: Render provides it.
  Build command `npm install`, start command `npm start`, root directory `backend`.

Sessions use an HttpOnly cookie. `vercel.app` and `onrender.com` are different
sites, so the cookie must be `SameSite=None; Secure` (`COOKIE_SAME_SITE=none`), and
browsers that block third-party cookies (Safari, and Chrome in some modes) will not
keep the session. For reliable sessions, serve both apps under one registrable
domain (for example `app.example.com` and `api.example.com`) and keep
`COOKIE_SAME_SITE=strict`.

CORS is an exact-match allow-list. A request whose `Origin` header is not listed is
rejected with 403 for every method, which also blocks cross-site form or script
requests that would carry the session cookie. Requests with no `Origin` header
(curl, health checks, same-origin navigation) are not affected but still need
authentication.

Render's filesystem is ephemeral. There is no upload endpoint yet; when evidence
uploads are added, store files in external object storage (the schema already
keeps only a `file_url`) and build public links from `BACKEND_URL` or the
storage provider's URL, never from a hard-coded host.

# Authentication

The frontend calls the API at `VITE_API_URL`; CORS (above) permits the configured
origins. Do not expose the database connection string or JWT secret to the
frontend.

`POST /api/auth/login` accepts JSON email and password, and returns a JWT and
the user's ID, full name, email and role. The browser uses the HttpOnly session
cookie (SameSite=Strict by default; see `COOKIE_SAME_SITE`) rather than storing
the JWT in localStorage.
`GET /api/auth/me` checks the session; `/api/parent/me` and
`/api/social-worker/me` additionally enforce their respective roles.
`POST /api/auth/logout` clears the cookie. Tokens expire after eight hours.
Logout does not revoke a previously copied bearer token before it expires.

`POST /api/auth/register` accepts `fullName`, `email`, `phone`, `password`,
`confirmPassword` and `accountType` (`PARENT_CAREGIVER` or `PAYING_PARENT`).
Both choices create an active `PARENT_CAREGIVER` user; the schema does not store
the choice separately. Email is normalized to lowercase, passwords must contain
at least 10 characters including uppercase, lowercase and a number, and must
not exceed bcrypt's 72-byte limit. Successful registration returns the new
user's ID, name, email and role, without signing in automatically.
Public registration cannot create social workers.

The five fictional accounts in `database/seeds/demoData.sql` use `Demo@12345`.
These are public demo credentials and must not be used in production. Load the
seed only into a development database. `schema.sql` is intended for a new
database; do not rerun it against an existing one.

Run `npm run db:migrate` to apply pending migrations from `database/migrations/`
to the configured Neon database. Applied versions are tracked in
`schema_migrations`. On a database created before the migrations were
renumbered, `001_initial_schema` is recorded as the baseline without running,
and `002_child_linking` is recorded because it was already applied as
`001_child_linking` (that history row is kept). Migrations are additive and
idempotent. `002_child_linking` adds a keyed child-ID lookup digest and the
pending-link request table; it does not recreate tables or modify existing child
records. Child South African ID numbers are validated in the backend and never
stored as plain text. Neon stores only an HMAC-SHA-256 digest
(`src/utils/encryptIdNumber.js`; it is a digest, not reversible encryption) keyed
from `JWT_SECRET`. Keep that secret backed up and stable.

Rotating `JWT_SECRET` also changes the digest key, so existing digests would
stop matching and linking to existing children would silently fail. Do not
rotate it without this plan: (1) back up the database; (2) since the plain ID
numbers are not stored, a re-key needs each ID number to be re-supplied, so
first add a new digest column (a new numbered migration) and support both keys
in lookups; (3) have creators re-enter or confirm the ID number to populate the
new digest; (4) only after every child has the new digest, retire the old
secret and column. Changing the digest algorithm or its purpose label requires
the same plan. A known-answer test guards against accidental changes.

`POST /api/parent/children` creates a child and its creator relationship in
Neon. `GET /api/parent/children` returns only children created by or linked to
the authenticated parent. `POST /api/parent/children/link-requests` performs a
rate-limited digest lookup and creates a request without revealing whether an
ID matched. The profile creator reviews requests in the Child Profiles page.
Only approval creates the second `family_relationships` row. Rejecting a
request creates no relationship. ID possession is not proof of legal
guardianship; verify the requester through an appropriate out-of-band process
before approving. No email or SMS notification is configured; pending requests
appear in the creator's in-app Child Profiles page.

Child profiles and family relationships are fetched from Neon and are not
persisted in browser localStorage. Other dashboard records, arrangements, and
payments remain browser-local demo data and are not protected Neon records.

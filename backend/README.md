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
   and existing environment variables take precedence.
3. `npm run db:migrate` to apply pending migrations.
4. `npm start` (API at `http://127.0.0.1:3001`), and `npm run dev` in `frontend`.
5. `npm test` for the backend tests.

The same `start`, `db:migrate` and `test` scripts also work from the repository root.

# Authentication

Vite proxies `/api` to the backend at `127.0.0.1:3001`. For production, serve
the frontend and API on the same HTTPS origin and set `NODE_ENV=production` so
session cookies are marked Secure. Do not expose the database connection string
or JWT secret to the frontend.

`POST /api/auth/login` accepts JSON email and password, and returns a JWT and
the user's ID, full name, email and role. The browser uses the HttpOnly,
SameSite=Strict session cookie rather than storing the JWT in localStorage.
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

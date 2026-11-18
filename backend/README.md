# Backend

Express API on Neon PostgreSQL. Requires Node.js 19 or later.

## Structure

```
backend/
├── server.js                 starts the HTTP server (graceful shutdown on SIGINT/SIGTERM)
├── src/
│   ├── app.js                builds the Express app: middleware, routes, error handling
│   ├── config/               env.js (validated settings), database.js (Neon client)
│   ├── routes/               endpoints + middleware per route (auth, child, family, arrangement, payment, socialWorker)
│   ├── controllers/          HTTP only: read request, call a service, send the response
│   ├── services/             business logic and all SQL (auth, child, family, arrangement, payment)
│   ├── validators/           request validation middleware
│   ├── middleware/           JWT auth, role checks, rate limit, central error handler
│   └── utils/                apiResponse, asyncHandler, encryptIdNumber, payment summary, helpers
├── database/
│   ├── schema.sql            current full schema (for a brand-new database)
│   ├── migrations/           001_initial_schema.sql … 006_messaging.sql
│   ├── rollbacks/            005_admin_dashboard.rollback.sql (run by hand, never automatic)
│   ├── seedAdmin.js          creates/updates the administrator (npm run admin:seed)
│   ├── seeds/demoData.sql    fictional demo users and records (development only)
│   └── migrate.js            migration runner
└── tests/                    node:test suites (fake database), plus one Neon integration suite
```

Not built yet: evidence file uploads (only metadata is stored) and notifications.

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

Child profiles, family relationships, maintenance arrangements, payments,
confirmations and evidence metadata are fetched from Neon and are not persisted
in browser localStorage. Social worker reviews, professional notes, concerns and
notifications remain browser-local demo data.

## Maintenance arrangements and payments

All routes below are under `/api/parent` and need a signed-in `PARENT_CAREGIVER`.
There is one parent role. Whether someone pays or receives is decided per
arrangement from `paying_user_id` and `receiving_user_id`, never from the
registration choice, and the client can never send those IDs (requests with
unknown fields are rejected with 400).

| Endpoint | Who may call it |
| --- | --- |
| `POST /arrangements` | A parent who is one of the two parties; both must already be approved family members of the child. The server derives payer and receiver from `myRole` and the session. |
| `GET /arrangements`, `GET /payments` | Only a party to the record. Others get nothing, or 404 for a single record. |
| `PATCH /arrangements/:id` | Either party; changes terms only, never the child, payer or receiver. |
| `POST /payments` | Only the arrangement's paying parent, on an active arrangement. The receiving parent gets 403. |
| `POST /payments/:id/evidence` | Only the payment's paying parent (metadata only; file contents are not stored yet). |
| `POST /payments/:id/confirmation` | Only the payment's receiving parent, once, while the payment is awaiting confirmation (`CONFIRM_FULL`, `CONFIRM_PARTIAL` or `DISPUTE` with a reason). The payer gets 403. |
| `GET /dashboard-summary?month=YYYY-MM` | Returns separate `paying` and `receiving` totals; only confirmed amounts reduce what is outstanding. |

Social workers can read the arrangements and payments of actively assigned
children at `GET /api/social-worker/arrangements` and `/payments`.

## Administrator dashboard

Administrators sign in through the normal login page and land on `/admin/dashboard`. There is no
separate authentication system: an administrator is a row in `users` with `role = 'ADMIN'`.

**One-time setup (run by hand, in this order):**

1. `npm run db:migrate` applies `005_admin_dashboard.sql` (allows the ADMIN role, adds
   `users.registration_number`, `social_worker_assignments.maintenance_arrangement_id` and
   `ended_by`). To undo it, review and run `database/rollbacks/005_admin_dashboard.rollback.sql`
   by hand in the Neon SQL editor.
2. Create the administrator. The password is read from the environment, hashed with bcrypt and never
   stored or printed (PowerShell shown):

   ```powershell
   $env:ADMIN_EMAIL = "admin@example.com"; $env:ADMIN_PASSWORD = "<strong password>"; npm run admin:seed
   ```

   Running it again updates that administrator instead of creating a second one. An email that already
   belongs to a parent or social worker is refused, so no account is silently promoted.

Every `/api/admin/*` route sits behind authentication and `requireRole("ADMIN")` (one `router.use`
in `src/routes/adminRoutes.js`). Roles come from the database on every request; request bodies cannot
carry a role.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/admin/dashboard/stats` | Live counts for the dashboard cards |
| `GET/POST /api/admin/social-workers`, `GET/PUT/DELETE /api/admin/social-workers/:id` | Social worker CRUD with `search`, `status`, `page`, `pageSize`. Accounts are created with role `SOCIAL_WORKER` only. Deactivating or removing a worker with active cases is refused. A worker with case history, notes or reviews is deactivated instead of deleted. |
| `GET/POST /api/admin/social-worker-assignments`, `PUT /…/:id`, `PATCH /…/:id/end` | List (active or history), assign through an arrangement, reassign, end. Each change is one SQL statement, old rows are kept (`CLOSED` / `TRANSFERRED`), and `assigned_by` / `ended_by` record the administrator. |
| `GET /api/admin/child-supporters`, `…/:id` | Parents who pay in an arrangement or are linked as `PAYING_PARENT` |
| `GET /api/admin/children`, `…/:id` | Children with parents, arrangements, current worker and assignment history |
| `GET /api/admin/maintenance-arrangements`, `…/:id` | Read-only arrangements with a payment summary |
| `GET /api/admin/reports/summary` | Caseloads, arrangements and payments by status, children without a worker |

A child still has one active social worker (`uq_active_child_assignment`), so assigning through an
arrangement replaces any earlier worker for that child and keeps the old row as history. Assigning
never changes an arrangement amount or a payment.

## Social worker assignment

A social worker only ever sees children with an ACTIVE row in
`social_worker_assignments`, so every child needs one. A child has at most one
active worker (a unique index enforces this) and every parent linked to the
child sees that same worker.

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/parent/social-workers` | Active `SOCIAL_WORKER` accounts (id and name only) for the dropdowns. Parents only. |
| `POST /api/parent/children` | `socialWorkerId` is required. The child, its creator relationship and its ACTIVE assignment are written by one statement, so a child never exists without a worker. An inactive, unknown or non-worker ID is rejected with 400 and nothing is saved. If the ID number matches an existing child, only a link request is filed and the child keeps its current worker. |
| `POST /api/parent/arrangements` | `socialWorkerId` is optional. A child that already has a worker keeps it (choosing a different one gets 409). A child with none needs a valid `socialWorkerId`, which is assigned in the same statement as the arrangement. |
| `PUT /api/parent/children/:childId/social-worker` | Assigns or replaces the worker. Only the person who created the child profile may do this. The old row becomes `TRANSFERRED` with `ended_at` and a new `ACTIVE` row is added in one transaction, so history is preserved. Choosing the current worker is a no-op. |

Child and arrangement responses include `socialWorker` (`{ id, fullName }` or
`null`). Legacy profiles created before assignments existed stay unassigned
until their creator assigns a worker or a parent creates an arrangement.

These rules are enforced in the SQL of each statement and again by the
database: `payments` has a composite foreign key to the arrangement's payer and
receiver, and `payment_confirmations` can only store the payment's receiving
user as the decision maker.

`npm test` includes `tests/maintenance.integration.test.js`, which runs against
the Neon database in `DATABASE_URL`. It creates accounts tagged with a per-run
id and deletes them afterwards. It is skipped when `DATABASE_URL` is not set.

## AI assistant (public pages)

`POST /api/ai/chat` powers the floating "Mzansi ChildCare Assistant" on the six public pages. It is
public (no login) and is given **no account data**: only the visitor's own chat messages.

| Item | Detail |
| --- | --- |
| Body | `{ "messages": [{ "role": "user" \| "assistant", "content": "…" }] }`, 1 to 12 messages, each up to 500 plain-text characters, ending with a `user` message. No `system` role and no other fields are accepted. |
| Reply | `{ "reply": "…" }`. A provider failure, a missing key or a busy service gives a generic 503 and never includes provider text or the key. |
| Knowledge | `src/config/assistantKnowledge.js` holds the system prompt: what is implemented, what is only planned, the legal limits and the developer answer. Edit it there. |
| Privacy | Only the last 10 messages are sent. 13-digit ID numbers, email addresses and long digit strings are removed first. Requests use `store: false`. Message text is never logged. |
| Limits | 20 requests per visitor (IP) per 5 minutes and 300 per hour overall. Behind Render set `TRUST_PROXY=true` so each visitor's real address is used. |

Environment variables (backend only): `OPENAI_API_KEY` (optional; without it the assistant says it is
unavailable), `OPENAI_MODEL` (default `gpt-4o-mini`) and `TRUST_PROXY`. The key is read in `server.js`
and never reaches the frontend. `tests/ai.test.js` uses a fake client, so it needs no key and costs nothing.

## Parent / social worker messaging

Run `database/migrations/006_messaging.sql` (`npm run db:migrate`, or paste it into the Neon SQL
editor) to create `conversations` and `messages`. `database/rollbacks/006_messaging.rollback.sql`
undoes it by hand and **deletes all messages**.

All routes are under `/api/messages` and need a signed-in `PARENT_CAREGIVER` or `SOCIAL_WORKER`.
Administrators get 403: there is no admin route to message contents.

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/messages/contacts` | Who the user may start a conversation with: a parent's linked children that have an ACTIVE social worker; a worker's actively assigned children with their linked parents. Includes the arrangements both sides share. |
| `GET /api/messages/conversations` | The user's conversations with unread counts, last message and `canSend`. Filters: `search` (names and message text), `childId`, `unread=true`. |
| `POST /api/messages/conversations` | `{ childId, arrangementId? }` from a parent; a worker also sends `parentUserId`. The worker is always the child's ACTIVE assignment, never a client value. Returns the existing conversation (200) for the same parent, child and worker instead of a duplicate (201 when new). |
| `GET /api/messages/conversations/:id` | One conversation. 404 for anyone who is not one of its two people, so IDs cannot be probed. |
| `GET /api/messages/conversations/:id/messages` | Oldest first, `limit` (max 100) and `before=<messageId>` to page backwards. Does not mark anything read. |
| `POST /api/messages/conversations/:id/messages` | `{ message }`, 1 to 2000 characters of plain text. The sender is the signed-in user. 403 once the worker is no longer assigned. Limited to 30 per minute per user. |
| `PATCH /api/messages/:id/read` | Marks one received message read (idempotent). Messages you sent cannot be marked. |
| `PATCH /api/messages/conversations/:id/read` | Marks everything received in the conversation read. |
| `GET /api/messages/unread-count` | `{ unreadCount, conversations[] }` for the sidebar badge and notification bell. Names the sender and child only, never message text. |

A parent must still be linked to the child (`family_relationships`) to read or send; a worker
must hold the ACTIVE assignment to send. When an assignment ends or is reassigned, the
conversation stays readable by its two people but becomes read-only, and the new worker gets a
separate conversation. Messages are never deleted by the API, and the database blocks edits,
un-reading, foreign senders and deleting a conversation that has messages. Message text is never
logged. Real-time updates are polling (5 s in an open conversation, 15 s for the badge); the
frontend `usePolling` hook is the single place to swap for WebSockets later.

`tests/messaging.integration.test.js` runs against Neon like the other integration suites, and
skips with a reminder until migration 006 has been applied.

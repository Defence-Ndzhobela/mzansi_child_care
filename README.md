# Mzansi ChildCare

A child maintenance record and payment tracking system for South African families. Parents and
caregivers keep a shared, auditable record of maintenance arrangements and payments. Assigned social
workers can review the families they support, and administrators manage social workers and
assignments.

> **Status: working system, not yet a legal record.** Accounts, child profiles, parent linking,
> social worker assignment, maintenance arrangements, payments, payment confirmations, messaging and
> the administrator dashboard are stored in PostgreSQL. A few social worker features (case reviews,
> professional notes, concerns, in-app notifications) and evidence *file contents* are not
> database-backed yet. See [Known limitations](#known-limitations).

## What the system does

### Three kinds of user

| Role | Who | Can do |
| --- | --- | --- |
| `PARENT_CAREGIVER` | Parents and caregivers, paying or receiving | Register, create child profiles, link to an existing child, approve or reject link requests, create arrangements, record and confirm payments, message the child's social worker |
| `SOCIAL_WORKER` | Authorised professionals | See only the children, arrangements and payments they are actively assigned to; message the parents of those children |
| `ADMIN` | System administrators | Manage social workers, assign and reassign them to cases, manage families, and view arrangements and reports |

Anyone can register publicly, but only as a parent/caregiver. "Parent / Caregiver" and "Paying
Parent" both create a `PARENT_CAREGIVER` account. Social worker accounts are created by an
administrator, and the administrator account is created from the command line (see
[Create the administrator](#4-create-the-administrator-optional)). Roles are read from the database on
every request and enforced on the server, so the browser can never choose or change a role.

### Child profiles and linking two parents

1. **Parent A** creates a child profile with the child's 13-digit South African ID number and picks
   the child's social worker. The child, the parent's link to it and the social worker assignment are
   saved together, so a child never exists without a worker.
2. **Parent B** registers, chooses *Link Existing Child* and enters the same ID number.
3. If a profile matches, a **pending request** goes to Parent A. Parent B is told only that the
   request was submitted, whether or not a match exists, so ID numbers cannot be guessed.
4. **Parent A approves or rejects** it on the Child Profiles page. Knowing an ID number never grants
   access. On approval both parents see the same child profile; rejection creates no link.

Approval is the verification step. An ID number is not proof of guardianship, so confirm the
requester out of band (for example by phone) before approving.

### Maintenance arrangements and payments

- Either parent of a child can create an arrangement, but both parties must already be approved
  family members. The server works out who pays and who receives from the signed-in user and the
  chosen role, never from the registration choice or from client-sent IDs.
- Only the **paying parent** can record a payment or attach evidence details. Only the **receiving
  parent** can confirm it, once: confirm in full, confirm part, or dispute with a reason.
- Only confirmed amounts reduce what is outstanding on the dashboard summary, which shows separate
  paying and receiving totals.
- A child has at most one active social worker. The child's creator can assign or replace the worker;
  the old assignment is kept as history.

### Messaging

Parents and social workers can message each other about a shared child. A conversation exists per
parent, child and social worker. When a social worker is reassigned, the old conversation stays
readable but becomes read-only and the new worker gets their own. Messages are never deleted, and
administrators have no access to message contents. Updates arrive by polling, with unread badges.

### Administrator dashboard

Admins sign in on the normal login page and land on `/admin/dashboard`. They can:

- create, edit, deactivate and remove social workers (a worker with active cases cannot be removed);
- assign, reassign and end social worker assignments, with full history;
- view parents who pay, children, families and arrangements, and edit or archive a family
  (archiving keeps all payments, messages and history);
- view summary reports: caseloads, arrangements and payments by status, children without a worker.

### AI assistant

A floating assistant on the public pages answers questions about the system. It is optional, public
and receives **no account data**: ID numbers, emails and long digit strings are stripped before the
visitor's message is sent, nothing is logged, and it is rate limited. Without an `OPENAI_API_KEY` it
simply says it is unavailable.

### What is stored where

| Data | Storage |
| --- | --- |
| Users, sign-in, password hashes | PostgreSQL (Neon) |
| Child profiles, family links, link requests, social worker assignments | PostgreSQL |
| Maintenance arrangements, payments, confirmations, evidence **details** | PostgreSQL |
| Conversations and messages | PostgreSQL |
| Social worker payment reviews, professional notes, concerns, in-app notifications | Browser `localStorage` (demo data) |
| Evidence file contents | Not stored yet (only the details are saved) |

## Security

- Passwords are hashed with bcrypt (cost 12) and never returned by the API. Registration needs 10+
  characters with upper case, lower case and a number.
- Sign-in issues a JWT (8 hour expiry) in an `HttpOnly` cookie, so page scripts cannot read it. The
  API also accepts it as a `Bearer` header.
- Child ID numbers are validated (format, birth date, checksum) and **never stored**. Only a keyed
  HMAC-SHA-256 digest is saved. The key is derived from `JWT_SECRET`, so keep that secret stable:
  rotating it breaks existing child lookups (see [backend/README.md](backend/README.md) for the
  safe migration plan).
- All SQL uses bound parameters. Requests are validated on the server, and unknown fields on
  sensitive requests are rejected.
- Parents only see children they created or were approved to link to. Social workers only see active
  assignments. Records that belong to other people return 404, so IDs cannot be probed.
- The database itself enforces key rules (one active social worker per child, payer and receiver
  consistency, no edits or deletion of message history).
- Child ID submissions, messages and assistant requests are rate limited.
- CORS is an exact-match allow-list from environment variables; unlisted origins are rejected.
- `DATABASE_URL`, `JWT_SECRET` and `OPENAI_API_KEY` live only in the backend environment and are
  never sent to the frontend. `.env` files are Git-ignored.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router, Recharts
- **Backend:** Node.js 19+, Express, Neon serverless PostgreSQL, bcryptjs, jsonwebtoken, OpenAI SDK
  (assistant only)
- **Hosting:** Vercel (frontend, with an SPA rewrite in `frontend/vercel.json`) and Render (backend)
- **Tests:** Node's built-in test runner (backend)

## Project layout

```
mzansi_child_care/
├── frontend/              React app
│   └── src/
│       ├── config/api.ts          API URLs from VITE_ variables (single source)
│       ├── services/apiClient.ts  apiFetch: every request goes through here
│       ├── context/               auth and data providers
│       ├── components/            shared UI, messaging, assistant
│       └── pages/                 public, parent, social-worker and admin pages
├── backend/               Express API
│   ├── server.js                  starts the server
│   ├── src/                       routes → validators → controllers → services (all SQL),
│   │                              plus config, middleware and utils
│   ├── database/                  schema.sql, migrations/, rollbacks/, seeds/,
│   │                              migrate.js, seedAdmin.js
│   └── tests/                     unit and integration tests
└── package.json           root scripts that delegate to backend
```

The database has 13 tables (users, children, family_relationships, child_link_requests,
maintenance_arrangements, payments, payment_evidence, payment_confirmations,
social_worker_assignments, payment_reviews, professional_notes, conversations, messages).
[backend/README.md](backend/README.md) documents every endpoint, the configuration table and the
deployment notes.

## Run it locally

You need Node.js 19 or later and a PostgreSQL database (the project uses [Neon](https://neon.tech)).
Use a development or test database, not live data.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `backend/.env` and set `DATABASE_URL` (your Neon connection string) and `JWT_SECRET` (random,
at least 32 bytes). Optionally set `OPENAI_API_KEY` for the assistant.

### 2. Create the database tables

```bash
npm run db:migrate          # applies migrations 001 to 007; safe to re-run
```

For a brand-new database `database/schema.sql` shows the final schema, but migrations are the way to
change an existing database. Rollback scripts in `database/rollbacks/` are run by hand and never
automatically.

### 3. Start the API

```bash
npm start                   # http://localhost:5000
```

### 4. Create the administrator (optional)

The password is read from the environment, hashed, and never stored or printed (PowerShell shown):

```powershell
$env:ADMIN_EMAIL = "admin@example.com"; $env:ADMIN_PASSWORD = "<strong password>"; npm run admin:seed
```

Running it again updates that administrator. An email that already belongs to another role is
refused, so no account is silently promoted.

### 5. Frontend (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env        # sets VITE_API_URL=http://localhost:5000/api
npm run dev                 # http://localhost:3000
```

Restart `npm run dev` after changing `frontend/.env`.

### Demo accounts

The login page lists fictional demo accounts for a caregiver who receives, a caregiver who pays, a
social worker and an administrator; they only work if those users exist in your database.
`backend/database/seeds/demoData.sql` holds fictional development data. Never load it into, or use
demo credentials on, a production database. You can always register your own parent account.

## Commands

| Where | Command | Purpose |
| --- | --- | --- |
| `backend` | `npm start` | Run the API |
| `backend` | `npm test` | Run the backend tests |
| `backend` | `npm run db:migrate` | Apply pending migrations (additive, safe to re-run) |
| `backend` | `npm run admin:seed` | Create or update the administrator |
| `frontend` | `npm run dev` | Run the app in development |
| `frontend` | `npm run lint` | Type-check |
| `frontend` | `npm run build` | Production build |

`npm start`, `npm test` and `npm run db:migrate` also work from the repository root.

Some backend suites are integration tests that run against the database in `DATABASE_URL`. They
create temporary, tagged accounts and delete them afterwards, and skip themselves when
`DATABASE_URL` is not set. Point them at a development database.

## Configuration

URLs and secrets come from environment variables, so switching between local and production never
needs a code change. The backend reads `NODE_ENV`, `PORT`, `FRONTEND_URL`, `BACKEND_URL`,
`CORS_ORIGINS`, `COOKIE_SAME_SITE`, `DATABASE_URL`, `JWT_SECRET`, and optionally `OPENAI_API_KEY`,
`OPENAI_MODEL` and `TRUST_PROXY`. The frontend reads `VITE_API_URL` and `VITE_BACKEND_URL`. The
backend refuses to start if a required value is missing or invalid. See
[backend/README.md](backend/README.md) for the full table.

## Deployment (Vercel + Render)

- **Frontend on Vercel** (root directory `frontend`): set `VITE_API_URL=https://<backend>.onrender.com/api`
  and `VITE_BACKEND_URL=https://<backend>.onrender.com`. `frontend/vercel.json` rewrites all paths to
  `index.html` so refreshing a page such as `/parent/dashboard` works.
- **Backend on Render** (root directory `backend`, build `npm install`, start `npm start`): set
  `NODE_ENV=production`, `FRONTEND_URL`, `BACKEND_URL`, `CORS_ORIGINS`, `COOKIE_SAME_SITE=none`,
  `DATABASE_URL`, `JWT_SECRET`, and `TRUST_PROXY=true`. Add `OPENAI_API_KEY` to enable the
  assistant. Render provides `PORT`. Run migrations against the production database deliberately,
  after taking a backup.

`vercel.app` and `onrender.com` are different sites, so the session cookie is sent cross-site and
browsers that block third-party cookies will not keep the session. Putting both apps under one
domain (for example `app.example.com` and `api.example.com`) with `COOKIE_SAME_SITE=strict` is the
reliable setup. Add any Vercel preview URLs to `CORS_ORIGINS` or they will be rejected.

## Known limitations

- Social worker case reviews, professional notes, concerns and in-app notifications are still browser
  demo data, so they are not shared between devices or visible to other users.
- Evidence uploads save only details such as the file name. File contents are not stored; real
  uploads will need external object storage because Render's disk is not permanent.
- No email or SMS notifications; link requests, messages and unread counts are shown in the app and
  refresh by polling (no real-time push).
- Logging out clears the cookie but does not revoke a token copied earlier (tokens expire after 8
  hours).
- Rate limits are held in memory, so they reset on restart and are per server process.
- Approval-based linking is not automated guardianship verification; there is no Home Affairs check
  of ID numbers beyond format, date and checksum.
- Legacy child profiles created before assignments existed stay unassigned until their creator
  assigns a social worker or an arrangement is created.
- This is not legal advice or a court-recognised record.

# Mzansi ChildCare

A child maintenance record and payment tracking system for South African families. Parents and
caregivers keep a shared, auditable record of child maintenance arrangements and payments, and
assigned social workers can review the records of the families they support.

> **Status: working prototype.** Accounts, sign-in, child profiles and parent linking are real and
> stored in a PostgreSQL database. Maintenance arrangements, payments, evidence and social-worker
> reports are still fictional demo data kept in the browser. Do not enter real personal information
> into those screens.

## What the system does

### Two kinds of user

| Role | Who | Can do |
| --- | --- | --- |
| `PARENT_CAREGIVER` | Parents, caregivers, paying or receiving parents | Register, sign in, create child profiles, link to an existing child, approve or reject link requests, view their own children |
| `SOCIAL_WORKER` | Authorised professionals | Sign in and view only the children assigned to them |

Anyone can register publicly, but only as a parent/caregiver. Choosing "Parent / Caregiver" or
"Paying Parent" both create a `PARENT_CAREGIVER` account. Social worker accounts cannot be
created through the public form; they must be created by an administrator. Roles are enforced on
the server, so users cannot reach the other role's pages or API routes.

### How two parents are linked to one child

1. **Parent A** creates a child profile and enters the child's 13-digit South African ID number.
2. **Parent B** registers, chooses *Link Existing Child* and enters the same ID number.
3. If a profile matches, a **pending request** goes to Parent A. Parent B is told only that the
   request was submitted, whether or not a match exists, so ID numbers cannot be guessed.
4. **Parent A approves or rejects** the request in the Child Profiles page. Knowing an ID number
   never grants access.
5. On approval, Parent B is linked through the `family_relationships` table and both parents can
   see the same child profile. Rejection creates no link.

Approval is the verification step. Having an ID number is not proof of guardianship, so confirm
who the requester is (for example by phone) before approving. Requests appear in the app only;
there is no email or SMS notification yet.

### What is stored where

| Data | Storage |
| --- | --- |
| Users, sign-in, password hashes | PostgreSQL (Neon) |
| Child profiles, family relationships, link requests | PostgreSQL (Neon) |
| Maintenance arrangements, payments, evidence, reviews, notes, reports | Browser `localStorage` demo data (database tables exist but are not used by the API yet) |

## Security

- Passwords are hashed with bcrypt (cost 12) and never returned by the API. Registration needs
  10+ characters with upper case, lower case and a number.
- Sign-in issues a JWT (8 hour expiry) held in an `HttpOnly` cookie, so page scripts cannot read
  it. The API also accepts the token as a `Bearer` header.
- Child ID numbers are validated (date and checksum) and **never stored**. Only a keyed
  HMAC-SHA-256 digest is saved. The key is derived from `JWT_SECRET`, so keep that secret stable:
  rotating it breaks existing child lookups (see [backend/README.md](backend/README.md) for the
  safe migration plan).
- All SQL uses bound parameters. Input is validated on the server.
- Parents only see children they created or were approved to link to. Social workers only see
  active assignments.
- Child ID submissions are rate limited per user (5 per 15 minutes).
- CORS is an exact-match allow-list from environment variables; unlisted origins are rejected.
- Secrets (`DATABASE_URL`, `JWT_SECRET`) live only in the backend environment and are never sent
  to the frontend. `.env` files are Git-ignored.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router, Recharts
- **Backend:** Node.js 19+, Express, Neon serverless PostgreSQL, bcryptjs, jsonwebtoken
- **Tests:** Node's built-in test runner (backend)

## Project layout

```
mzansi_child_care/
├── frontend/              React app (pages, contexts, central API client)
│   └── src/
│       ├── config/api.ts          API URLs from VITE_ variables (single source)
│       ├── services/apiClient.ts  apiFetch: every request goes through here
│       ├── context/               auth and data providers
│       └── pages/                 public, parent and social-worker pages
├── backend/               Express API
│   ├── server.js                  starts the server
│   ├── src/                       app, config, routes, controllers, services,
│   │                              validators, middleware, utils
│   ├── database/                  schema.sql, migrations/, seeds/, migrate.js
│   └── tests/                     API, CORS, env and ID-digest tests
└── package.json           root scripts that delegate to backend
```

The backend follows routes → validators → controllers → services (all SQL lives in services).
See [backend/README.md](backend/README.md) for the API details, configuration table and deployment
notes.

## Run it locally

You need Node.js 19 or later and a PostgreSQL database (the project uses [Neon](https://neon.tech)).

**1. Backend**

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `backend/.env` and set `DATABASE_URL` (your Neon connection string) and `JWT_SECRET`
(random, at least 32 bytes). Then:

```bash
npm run db:migrate          # apply database migrations
npm start                   # API on http://localhost:5000
```

**2. Frontend** (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env        # sets VITE_API_URL=http://localhost:5000/api
npm run dev                 # app on http://localhost:3000
```

Restart `npm run dev` after changing `frontend/.env`.

**3. Demo accounts (optional)**

On a development database only, load `backend/database/seeds/demoData.sql` to create fictional
users. They all use the password `Demo@12345` and must never be used in production:

| Email | Role |
| --- | --- |
| `parent@demo.co.za` | Parent / caregiver |
| `sipho@demo.co.za` | Parent / caregiver |
| `lerato.khumalo@demo.co.za` | Parent / caregiver |
| `kabelo.khumalo@demo.co.za` | Parent / caregiver |
| `worker@demo.co.za` | Social worker |

You can also create your own parent account on the Register page.

## Commands

| Where | Command | Purpose |
| --- | --- | --- |
| `backend` | `npm start` | Run the API |
| `backend` | `npm test` | Run the backend tests |
| `backend` | `npm run db:migrate` | Apply pending migrations (additive, safe to re-run) |
| `frontend` | `npm run dev` | Run the app in development |
| `frontend` | `npm run lint` | Type-check |
| `frontend` | `npm run build` | Production build |

`npm start`, `npm test` and `npm run db:migrate` also work from the repository root.

## Configuration

URLs and secrets come from environment variables, so switching between local and production never
needs a code change. The backend reads `NODE_ENV`, `PORT`, `FRONTEND_URL`, `BACKEND_URL`,
`CORS_ORIGINS`, `COOKIE_SAME_SITE`, `DATABASE_URL` and `JWT_SECRET`; the frontend reads
`VITE_API_URL` and `VITE_BACKEND_URL`. The backend refuses to start if a required value is
missing or invalid. Full details are in [backend/README.md](backend/README.md).

## Deployment (Vercel + Render)

- **Frontend on Vercel:** set `VITE_API_URL=https://<backend>.onrender.com/api` and
  `VITE_BACKEND_URL=https://<backend>.onrender.com`.
- **Backend on Render** (root directory `backend`, build `npm install`, start `npm start`): set
  `NODE_ENV=production`, `FRONTEND_URL`, `BACKEND_URL`, `CORS_ORIGINS`, `COOKIE_SAME_SITE=none`,
  `DATABASE_URL` and `JWT_SECRET`. Render provides `PORT`.

`vercel.app` and `onrender.com` are different sites, so the session cookie is sent cross-site and
some browsers that block third-party cookies will not keep the session. Putting both apps under
one domain (for example `app.example.com` and `api.example.com`) with `COOKIE_SAME_SITE=strict`
is the reliable setup.

## Known limitations

- Arrangements, payments, evidence uploads, reviews and reports are not yet backed by the API.
  Evidence uploads will need external object storage because Render's disk is not permanent.
- No email or SMS notifications; link requests are shown inside the app.
- Logging out clears the cookie but does not revoke a token that was copied earlier (tokens expire
  after 8 hours).
- The child-ID rate limit is in memory, so it resets on restart and is per server process.
- There is no admin screen; social worker accounts and assignments are created directly in the
  database.

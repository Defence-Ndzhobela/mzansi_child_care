# Backend authentication

Requires Node.js 19 or later. Run `npm install` in the repository root.
Copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL` to the Neon
connection string, and set `JWT_SECRET` to a unique random secret of at least
32 bytes. Keep both secret. The `.env` file is Git-ignored. Existing environment
variables take precedence.

Run `npm start` in the root and `npm run dev` in `frontend`. Vite proxies `/api`
to the backend at `127.0.0.1:3001`. For production, serve the frontend and API
on the same HTTPS origin and set `NODE_ENV=production` so session cookies are
marked Secure. Do not expose the database connection string or JWT secret to
the frontend.

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

The five fictional accounts listed in `database/schema.sql` use `Demo@12345`.
These are public demo credentials and must not be used in production. The schema
is intended for a new database; do not rerun it against an existing one.

Run `npm test` for backend tests. Authentication uses Neon, but dashboard data
and profile edits remain fictional browser-local demo data, not protected Neon
records. Registration is disabled until a backend registration flow exists.

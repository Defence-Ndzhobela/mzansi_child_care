const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createApp } = require("./server");

const secret = "test-secret-with-at-least-thirty-two-bytes";
const user = {
  id: "11111111-1111-4111-8111-111111111101",
  full_name: "Demo Parent",
  email: "parent@demo.co.za",
  role: "PARENT_CAREGIVER",
  account_status: "ACTIVE",
  password_hash: bcrypt.hashSync("Demo@12345", 4),
};
let server;
let base;
const registered = new Map();
let failInsert = false;

before(async () => {
  const sql = async (strings, ...values) => {
    const query = strings.join("?");
    if (query.includes("SELECT version()")) return [{ version: "PostgreSQL" }];
    if (query.includes("WHERE lower(email)")) {
      const found = values[0] === user.email ? user : registered.get(values[0]);
      return found ? [found] : [];
    }
    if (query.includes("INSERT INTO users")) {
      if (failInsert) throw new Error("database unavailable");
      const [fullName, email, phone, passwordHash] = values;
      if (registered.has(email)) {
        const error = new Error("duplicate");
        error.code = "23505";
        error.constraint = "users_email_key";
        throw error;
      }
      const created = {
        id: "22222222-2222-4222-8222-222222222201",
        full_name: fullName,
        email,
        phone,
        password_hash: passwordHash,
        role: "PARENT_CAREGIVER",
        account_status: "ACTIVE",
      };
      registered.set(email, created);
      return [created];
    }
    if (query.includes("WHERE id")) {
      return [user, ...registered.values()].filter((item) => item.id === values[0]);
    }
    throw new Error("Unexpected query");
  };
  server = createApp(sql, secret).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function login(email, password) {
  return fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

test("database check returns the PostgreSQL version", async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "PostgreSQL");
});

test("login issues a JWT and an HttpOnly cookie without exposing the hash", async () => {
  const response = await login(" PARENT@DEMO.CO.ZA ", "Demo@12345");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.user, {
    id: user.id, fullName: user.full_name, email: user.email, role: user.role,
  });
  assert.equal(jwt.verify(body.token, secret, { algorithms: ["HS256"] }).sub, user.id);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal(JSON.stringify(body).includes(user.password_hash), false);

  const parent = await fetch(`${base}/api/parent/me`, {
    headers: { Authorization: `Bearer ${body.token}` },
  });
  const worker = await fetch(`${base}/api/social-worker/me`, {
    headers: { Authorization: `Bearer ${body.token}` },
  });
  assert.equal(parent.status, 200);
  assert.equal(worker.status, 403);
});

test("rejects incorrect credentials and inactive accounts", async () => {
  const badPassword = await login(user.email, "wrong");
  const unknown = await login("unknown@demo.co.za", "wrong");
  assert.equal(badPassword.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await badPassword.json(), await unknown.json());
  user.account_status = "INACTIVE";
  try {
    assert.equal((await login(user.email, "Demo@12345")).status, 401);
  } finally {
    user.account_status = "ACTIVE";
  }
});

test("protected routes reject missing, forged, and inactive sessions", async () => {
  assert.equal((await fetch(`${base}/api/auth/me`)).status, 401);
  assert.equal((await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: "Bearer invalid" },
  })).status, 401);
  const token = jwt.sign({}, secret, { subject: user.id, expiresIn: "1h" });
  user.account_status = "INACTIVE";
  try {
    assert.equal((await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })).status, 401);
  } finally {
    user.account_status = "ACTIVE";
  }
});

test("logout clears the session cookie", async () => {
  const response = await fetch(`${base}/api/auth/logout`, { method: "POST" });
  assert.equal(response.status, 204);
  assert.match(response.headers.get("set-cookie"), /mzansi_session=;/);
});

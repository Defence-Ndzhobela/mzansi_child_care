const assert = require("node:assert/strict");
const { test } = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { parent, secret, state, useTestServer } = require("./helpers/testApp");

const server = useTestServer();

const registration = {
  fullName: "  Fictional Parent  ",
  email: "  New@Example.test ",
  phone: "+27 82 555 0100",
  password: "StrongPass123",
  confirmPassword: "StrongPass123",
  accountType: "PAYING_PARENT",
};

function post(path, body) {
  return fetch(`${server.base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const register = (input) => post("/api/auth/register", input);
const login = (email, password) => post("/api/auth/login", { email, password });

test("registration creates a bcrypt-protected parent and supports login", async () => {
  const response = await register({ ...registration, role: "SOCIAL_WORKER" });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.deepEqual(body.user, {
    id: "22222222-2222-4222-8222-222222222201",
    fullName: "Fictional Parent",
    email: "new@example.test",
    role: "PARENT_CAREGIVER",
  });
  const stored = state.registered.get("new@example.test");
  assert.notEqual(stored.password_hash, registration.password);
  assert.equal(await bcrypt.compare(registration.password, stored.password_hash), true);
  assert.equal(JSON.stringify(body).includes(stored.password_hash), false);
  assert.equal((await login("new@example.test", registration.password)).status, 200);
  assert.equal((await register(registration)).status, 409);
});

test("registration validates input and cannot create social workers", async () => {
  for (const invalid of [
    { fullName: "  " },
    { email: "not-an-email" },
    { phone: "invalid" },
    { password: "short", confirmPassword: "short" },
    { password: "A1" + "é".repeat(36), confirmPassword: "A1" + "é".repeat(36) },
    { confirmPassword: "Different123" },
    { accountType: "SOCIAL_WORKER" },
  ]) {
    assert.equal((await register({ ...registration, ...invalid })).status, 400);
  }
});

test("registration reports database failures and concurrent duplicate inserts", async () => {
  state.failInsert = true;
  try {
    assert.equal((await register({ ...registration, email: "failure@example.test" })).status, 500);
  } finally {
    state.failInsert = false;
  }
  const input = { ...registration, email: "race@example.test" };
  const responses = await Promise.all([register(input), register(input)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
});

test("database check returns the PostgreSQL version", async () => {
  const response = await fetch(server.base);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "PostgreSQL");
});

test("login issues a JWT and an HttpOnly cookie without exposing the hash", async () => {
  const response = await login(" PARENT@DEMO.CO.ZA ", "Demo@12345");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.user, {
    id: parent.id, fullName: parent.full_name, email: parent.email, role: parent.role,
  });
  assert.equal(jwt.verify(body.token, secret, { algorithms: ["HS256"] }).sub, parent.id);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal(JSON.stringify(body).includes(parent.password_hash), false);

  const asParent = await fetch(`${server.base}/api/parent/me`, {
    headers: { Authorization: `Bearer ${body.token}` },
  });
  const asWorker = await fetch(`${server.base}/api/social-worker/me`, {
    headers: { Authorization: `Bearer ${body.token}` },
  });
  assert.equal(asParent.status, 200);
  assert.equal(asWorker.status, 403);
});

test("the session cookie authenticates requests", async () => {
  const body = await (await login(parent.email, "Demo@12345")).json();
  const response = await fetch(`${server.base}/api/auth/me`, {
    headers: { Cookie: `mzansi_session=${body.token}` },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.id, parent.id);
});

test("login rejects malformed input", async () => {
  assert.equal((await login("", "Demo@12345")).status, 400);
  assert.equal((await login(parent.email, "")).status, 400);
  assert.equal((await post("/api/auth/login", { email: ["a"], password: {} })).status, 400);
});

test("rejects incorrect credentials and inactive accounts", async () => {
  const badPassword = await login(parent.email, "wrong");
  const unknown = await login("unknown@demo.co.za", "wrong");
  assert.equal(badPassword.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await badPassword.json(), await unknown.json());
  parent.account_status = "INACTIVE";
  try {
    assert.equal((await login(parent.email, "Demo@12345")).status, 401);
  } finally {
    parent.account_status = "ACTIVE";
  }
});

test("protected routes reject missing, forged, and inactive sessions", async () => {
  assert.equal((await fetch(`${server.base}/api/auth/me`)).status, 401);
  assert.equal((await fetch(`${server.base}/api/auth/me`, {
    headers: { Authorization: "Bearer invalid" },
  })).status, 401);
  const token = jwt.sign({}, secret, { subject: parent.id, expiresIn: "1h" });
  parent.account_status = "INACTIVE";
  try {
    assert.equal((await fetch(`${server.base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })).status, 401);
  } finally {
    parent.account_status = "ACTIVE";
  }
});

test("malformed JSON bodies are rejected without a server error", async () => {
  const response = await fetch(`${server.base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid request body." });
});

test("logout clears the session cookie", async () => {
  const response = await fetch(`${server.base}/api/auth/logout`, { method: "POST" });
  assert.equal(response.status, 204);
  assert.match(response.headers.get("set-cookie"), /mzansi_session=;/);
});

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createApp } = require("../src/app");
const { secret } = require("./helpers/testApp");

const allowedOrigin = "https://app.example.com";
const otherAllowedOrigin = "http://localhost:5173";
let listener;
let base;

before(async () => {
  const app = createApp({
    sql: async () => [],
    jwtSecret: secret,
    secureCookies: true,
    cookieSameSite: "none",
    allowedOrigins: [allowedOrigin, otherAllowedOrigin],
  });
  listener = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => listener.once("listening", resolve));
  base = `http://127.0.0.1:${listener.address().port}`;
});
after(() => new Promise((resolve) => listener.close(resolve)));

test("answers preflight for each allowed origin with credentials and no wildcard", async () => {
  for (const origin of [allowedOrigin, otherAllowedOrigin]) {
    const response = await fetch(`${base}/api/auth/login`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.match(response.headers.get("access-control-allow-headers"), /Content-Type/);
    assert.match(response.headers.get("vary"), /Origin/);
  }
});

test("adds CORS headers to normal responses from allowed origins", async () => {
  const response = await fetch(`${base}/api/auth/me`, { headers: { Origin: allowedOrigin } });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
});

test("rejects unlisted origins, including lookalikes and null", async () => {
  for (const origin of [
    "https://evil.example.com",
    "https://app.example.com.evil.com",
    "http://app.example.com",
    "https://app.example.com:8443",
    "null",
  ]) {
    for (const method of ["GET", "POST", "OPTIONS"]) {
      const response = await fetch(`${base}/api/auth/logout`, { method, headers: { Origin: origin } });
      assert.equal(response.status, 403, `${method} from ${origin}`);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      assert.deepEqual(await response.json(), { error: "Origin not allowed." });
    }
  }
});

test("requests without an Origin header are not blocked by CORS", async () => {
  const response = await fetch(`${base}/api/auth/logout`, { method: "POST" });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("session cookies use the configured SameSite and Secure settings", async () => {
  const response = await fetch(`${base}/api/auth/logout`, { method: "POST" });
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /HttpOnly/);
});

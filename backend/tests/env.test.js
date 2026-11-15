const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseEnv } = require("../src/config/env");

const base = {
  DATABASE_URL: "postgresql://user:password@host/db",
  JWT_SECRET: "test-secret-with-at-least-thirty-two-bytes",
  FRONTEND_URL: "http://localhost:3000",
  BACKEND_URL: "http://localhost:5000",
};
const production = {
  ...base,
  NODE_ENV: "production",
  FRONTEND_URL: "https://app.example.com",
  BACKEND_URL: "https://api.example.com",
};

test("applies local defaults and normalizes origins", () => {
  const env = parseEnv({ ...base, CORS_ORIGINS: " http://localhost:5173/ , http://localhost:3000 " });
  assert.equal(env.port, 5000);
  assert.equal(env.host, undefined);
  assert.equal(env.cookieSameSite, "strict");
  assert.equal(env.secureCookies, false);
  assert.deepEqual([...env.allowedOrigins].sort(), [
    "http://localhost:3000", "http://localhost:5000", "http://localhost:5173",
  ]);
});

test("uses the PORT provided by the host", () => {
  assert.equal(parseEnv({ ...base, PORT: "10000" }).port, 10000);
  assert.throws(() => parseEnv({ ...base, PORT: "99999" }), /PORT/);
});

test("reports each missing or invalid variable without echoing values", () => {
  assert.throws(() => parseEnv({ ...base, DATABASE_URL: "" }), /DATABASE_URL/);
  assert.throws(() => parseEnv({ ...base, JWT_SECRET: "short" }), /JWT_SECRET/);
  assert.throws(() => parseEnv({ ...base, FRONTEND_URL: "" }), /FRONTEND_URL must be set/);
  assert.throws(() => parseEnv({ ...base, BACKEND_URL: "" }), /BACKEND_URL must be set/);
  assert.throws(() => parseEnv({ ...base, NODE_ENV: "staging" }), /NODE_ENV/);
  const secretUrl = "https://user:hunter2@example.com";
  assert.throws(() => parseEnv({ ...base, FRONTEND_URL: secretUrl }), (error) =>
    /FRONTEND_URL/.test(error.message) && !error.message.includes("hunter2"));
});

test("only requires the database URL for migrations", () => {
  assert.deepEqual({ ...parseEnv({ DATABASE_URL: base.DATABASE_URL }, { databaseOnly: true }) },
    { databaseUrl: base.DATABASE_URL });
});

test("rejects wildcard, path and non-origin CORS entries", () => {
  assert.throws(() => parseEnv({ ...base, CORS_ORIGINS: "*" }), /exact origins/);
  assert.throws(() => parseEnv({ ...base, CORS_ORIGINS: "http://localhost:5173/app" }), /CORS_ORIGINS/);
  assert.throws(() => parseEnv({ ...base, CORS_ORIGINS: "not-a-url" }), /CORS_ORIGINS/);
});

test("production requires https and secure cookies", () => {
  const env = parseEnv({ ...production, CORS_ORIGINS: "https://preview.example.com" });
  assert.equal(env.isProduction, true);
  assert.equal(env.secureCookies, true);
  assert.ok(env.allowedOrigins.includes("https://preview.example.com"));
  assert.throws(() => parseEnv({ ...production, FRONTEND_URL: "http://app.example.com" }), /https/);
  assert.throws(() => parseEnv({ ...production, CORS_ORIGINS: "http://other.example.com" }), /https/);
});

test("SameSite=None needs an https backend and forces Secure cookies", () => {
  assert.throws(() => parseEnv({ ...base, COOKIE_SAME_SITE: "none" }), /https BACKEND_URL/);
  assert.throws(() => parseEnv({ ...base, COOKIE_SAME_SITE: "bogus" }), /COOKIE_SAME_SITE/);
  const env = parseEnv({ ...production, COOKIE_SAME_SITE: "None" });
  assert.equal(env.cookieSameSite, "none");
  assert.equal(env.secureCookies, true);
});

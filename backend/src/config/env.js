const path = require("node:path");
const dotenv = require("dotenv");

const MIN_JWT_SECRET_BYTES = 32;
const DEFAULT_PORT = 5000;
const NODE_ENVS = ["development", "production", "test"];
const COOKIE_SAME_SITE_VALUES = ["strict", "lax", "none"];

function assertValidJwtSecret(jwtSecret) {
  if (typeof jwtSecret !== "string" || Buffer.byteLength(jwtSecret) < MIN_JWT_SECRET_BYTES) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_BYTES} bytes.`);
  }
}

// Returns the exact origin (scheme + host + port) of a configured URL. Messages name
// the variable only; the value is never echoed because it may be sensitive.
function parseOrigin(name, value, { requireHttps }) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL such as https://example.com.`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be an http(s) origin without credentials, path, query or fragment.`);
  }
  if (requireHttps && url.protocol !== "https:") {
    throw new Error(`${name} must use https in production.`);
  }
  return url.origin;
}

function parseOriginList(name, value, options) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (item === "*") throw new Error(`${name} must list exact origins; "*" is not allowed.`);
      return parseOrigin(name, item, options);
    });
}

// Validates a plain environment object. Pure, so it can be tested without touching process.env.
function parseEnv(source, { databaseOnly = false } = {}) {
  if (!source.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in backend/.env or the environment.");
  }
  if (databaseOnly) return Object.freeze({ databaseUrl: source.DATABASE_URL });

  const nodeEnv = source.NODE_ENV || "development";
  if (!NODE_ENVS.includes(nodeEnv)) {
    throw new Error(`NODE_ENV must be one of: ${NODE_ENVS.join(", ")}.`);
  }
  const isProduction = nodeEnv === "production";
  assertValidJwtSecret(source.JWT_SECRET);

  const port = Number(source.PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number.");
  }

  for (const name of ["FRONTEND_URL", "BACKEND_URL"]) {
    if (!source[name]) throw new Error(`${name} must be set in backend/.env or the environment.`);
  }
  const options = { requireHttps: isProduction };
  const frontendOrigin = parseOrigin("FRONTEND_URL", source.FRONTEND_URL, options);
  const backendOrigin = parseOrigin("BACKEND_URL", source.BACKEND_URL, options);
  const corsOrigins = parseOriginList("CORS_ORIGINS", source.CORS_ORIGINS, options);

  const cookieSameSite = (source.COOKIE_SAME_SITE || "strict").toLowerCase();
  if (!COOKIE_SAME_SITE_VALUES.includes(cookieSameSite)) {
    throw new Error(`COOKIE_SAME_SITE must be one of: ${COOKIE_SAME_SITE_VALUES.join(", ")}.`);
  }
  if (cookieSameSite === "none" && !backendOrigin.startsWith("https://")) {
    throw new Error("COOKIE_SAME_SITE=none requires an https BACKEND_URL.");
  }

  return Object.freeze({
    nodeEnv,
    isProduction,
    port,
    // Unset means "all interfaces", which hosts such as Render require.
    host: source.HOST || undefined,
    databaseUrl: source.DATABASE_URL,
    jwtSecret: source.JWT_SECRET,
    frontendUrl: frontendOrigin,
    backendUrl: backendOrigin,
    // Exact-match allow-list: the frontend, the backend itself, and any extra origins.
    allowedOrigins: Object.freeze([...new Set([frontendOrigin, backendOrigin, ...corsOrigins])]),
    cookieSameSite,
    secureCookies: isProduction || cookieSameSite === "none",
  });
}

// Reads backend/.env (existing environment variables take precedence) and validates the settings.
// Called explicitly so importing the app has no side effects.
function loadEnv(options) {
  const result = dotenv.config({
    path: path.join(__dirname, "..", "..", ".env"),
    quiet: true,
  });
  if (result.error && result.error.code !== "ENOENT") {
    throw new Error("Unable to read backend/.env.");
  }
  return parseEnv(process.env, options);
}

module.exports = { assertValidJwtSecret, loadEnv, parseEnv };

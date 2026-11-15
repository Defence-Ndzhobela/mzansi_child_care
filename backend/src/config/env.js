const path = require("node:path");
const dotenv = require("dotenv");

const MIN_JWT_SECRET_BYTES = 32;
const DEFAULT_PORT = 3001;
const DEFAULT_HOST = "127.0.0.1";

function assertValidJwtSecret(jwtSecret) {
  if (typeof jwtSecret !== "string" || Buffer.byteLength(jwtSecret) < MIN_JWT_SECRET_BYTES) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_BYTES} bytes.`);
  }
}

// Reads backend/.env (existing environment variables take precedence) and
// validates the settings. Called explicitly so importing the app has no side effects.
function loadEnv({ requireJwtSecret = true } = {}) {
  const result = dotenv.config({
    path: path.join(__dirname, "..", "..", ".env"),
    quiet: true,
  });
  if (result.error && result.error.code !== "ENOENT") {
    throw new Error("Unable to read backend/.env.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set in backend/.env or the environment.");
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (requireJwtSecret) assertValidJwtSecret(jwtSecret);

  const port = Number(process.env.PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number.");
  }

  return Object.freeze({
    databaseUrl,
    jwtSecret,
    port,
    host: process.env.HOST || DEFAULT_HOST,
    isProduction: process.env.NODE_ENV === "production",
  });
}

module.exports = { assertValidJwtSecret, loadEnv };

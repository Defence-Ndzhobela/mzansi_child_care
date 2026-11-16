// Creates the administrator account, or updates it if it already exists. Run it by hand after
// `npm run db:migrate` (the ADMIN role only exists once migration 005 has been applied):
//
//   $env:ADMIN_EMAIL = "admin@example.com"; $env:ADMIN_PASSWORD = "<strong password>"; npm run admin:seed
//
// The password is read from the environment, hashed with bcrypt (same cost as normal sign-up) and never
// stored or logged in plain text. An existing account that is not already an ADMIN is never promoted.
const bcrypt = require("bcryptjs");
const { createDatabase } = require("../src/config/database");
const { loadEnv } = require("../src/config/env");

const BCRYPT_COST = 12;
const MAX_BCRYPT_BYTES = 72;

function validateCredentials(email, password) {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }
  if (typeof password !== "string" || password.length < 10 || Buffer.byteLength(password) > MAX_BCRYPT_BYTES ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("ADMIN_PASSWORD must be 10-72 bytes with uppercase, lowercase and a number.");
  }
}

async function seedAdmin(sql, { email, password, fullName = "System Administrator" }) {
  validateCredentials(email, password);
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const existing = await sql`SELECT id, role FROM users WHERE lower(email) = ${normalizedEmail}`;
  if (existing.length) {
    if (existing[0].role !== "ADMIN") {
      throw new Error("That email already belongs to a non-admin account. Use a different ADMIN_EMAIL.");
    }
    await sql`
      UPDATE users SET password_hash = ${passwordHash}, account_status = 'ACTIVE', updated_at = NOW()
      WHERE id = ${existing[0].id}
    `;
    return "updated";
  }
  await sql`
    INSERT INTO users (full_name, email, password_hash, role, account_status)
    VALUES (${fullName}, ${normalizedEmail}, ${passwordHash}, 'ADMIN', 'ACTIVE')
  `;
  return "created";
}

async function main() {
  const { databaseUrl } = loadEnv({ databaseOnly: true });
  const outcome = await seedAdmin(createDatabase(databaseUrl), {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    fullName: process.env.ADMIN_NAME || undefined,
  });
  console.log(`Administrator account ${outcome}.`);
}

if (require.main === module) {
  main().catch((error) => {
    // Messages here are validation text only; the password is never included.
    console.error(error.message.includes("ADMIN_") || error.message.includes("non-admin")
      ? error.message
      : "Seeding the administrator failed. Check that migration 005 has been applied.");
    process.exitCode = 1;
  });
}

module.exports = { seedAdmin, validateCredentials };

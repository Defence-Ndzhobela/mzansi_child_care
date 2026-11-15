const fs = require("node:fs");
const path = require("node:path");
const { createDatabase } = require("../src/config/database");
const { loadEnv } = require("../src/config/env");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const BASELINE_VERSION = "001_initial_schema";
// 002_child_linking was first applied under this name. Its row stays in
// schema_migrations as history, and the renamed migration counts as applied.
const LEGACY_VERSIONS = { "002_child_linking": "001_child_linking" };

function readStatements(version) {
  const sqlText = fs.readFileSync(path.join(MIGRATIONS_DIR, `${version}.sql`), "utf8");
  return sqlText
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const { databaseUrl } = loadEnv({ requireJwtSecret: false });
  const sql = createDatabase(databaseUrl);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const appliedRows = await sql.query("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.version));
  const record = (version) =>
    sql.query("INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING", [version]);

  const versions = fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => file.slice(0, -4))
    .sort();

  for (const version of versions) {
    if (applied.has(version)) continue;

    if (LEGACY_VERSIONS[version] && applied.has(LEGACY_VERSIONS[version])) {
      await record(version);
      console.log(`Recorded ${version} (already applied as ${LEGACY_VERSIONS[version]}).`);
      continue;
    }
    if (version === BASELINE_VERSION) {
      const existing = await sql.query("SELECT to_regclass('public.users') AS users_table");
      if (existing[0].users_table) {
        await record(version);
        console.log(`Recorded ${version} as the baseline of the existing database.`);
        continue;
      }
    }

    for (const statement of readStatements(version)) {
      await sql.query(statement);
    }
    await record(version);
    console.log(`Applied ${version}.`);
  }
  console.log("Database migrations are up to date.");
}

if (require.main === module) {
  main().catch(() => {
    console.error("Database migration failed; inspect Neon schema_migrations before retrying.");
    process.exitCode = 1;
  });
}

module.exports = { main };

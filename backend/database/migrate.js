const fs = require("node:fs");
const path = require("node:path");
const { createDatabase } = require("../src/config/database");
const { loadEnv } = require("../src/config/env");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const BASELINE_VERSION = "001_initial_schema";
// 002_child_linking was first applied under this name. Its row stays in
// schema_migrations as history, and the renamed migration counts as applied.
const LEGACY_VERSIONS = { "002_child_linking": "001_child_linking" };

// Splits a migration into statements on ";" while keeping dollar-quoted bodies
// (DO $$ ... $$) and single-quoted strings intact. Whole-line "--" comments are dropped.
function splitStatements(sqlText) {
  const text = sqlText.replace(/^\s*--.*$/gm, "");
  const statements = [];
  let current = "";
  let dollarTag = null;
  let inString = false;

  for (let index = 0; index < text.length;) {
    const character = text[index];
    if (dollarTag) {
      if (text.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
      } else {
        current += text[index++];
      }
      continue;
    }
    if (inString) {
      if (character === "'") inString = false;
      current += text[index++];
      continue;
    }
    const tag = character === "$" ? /^\$[A-Za-z_]*\$/.exec(text.slice(index, index + 64)) : null;
    if (tag) {
      dollarTag = tag[0];
      current += dollarTag;
      index += dollarTag.length;
    } else if (character === "'") {
      inString = true;
      current += text[index++];
    } else if (character === ";") {
      statements.push(current);
      current = "";
      index += 1;
    } else {
      current += text[index++];
    }
  }
  statements.push(current);
  return statements.map((statement) => statement.trim()).filter(Boolean);
}

function readStatements(version) {
  return splitStatements(fs.readFileSync(path.join(MIGRATIONS_DIR, `${version}.sql`), "utf8"));
}

async function main() {
  const { databaseUrl } = loadEnv({ databaseOnly: true });
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

module.exports = { main, splitStatements };

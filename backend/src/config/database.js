const { neon } = require("@neondatabase/serverless");

// Neon serverless client; queries use tagged templates, so all values are
// sent as bound parameters.
function createDatabase(databaseUrl) {
  return neon(databaseUrl);
}

async function getDatabaseVersion(sql) {
  const result = await sql`SELECT version()`;
  return result[0].version;
}

module.exports = { createDatabase, getDatabaseVersion };

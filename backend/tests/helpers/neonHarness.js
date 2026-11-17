// Helpers for the Neon integration suites. Test accounts are tagged with a per-run email prefix
// so they can be removed afterwards without touching real data.
const bcrypt = require("bcryptjs");
const { loadEnv } = require("../../src/config/env");

function getDatabaseUrl() {
  try {
    return loadEnv({ databaseOnly: true }).databaseUrl;
  } catch {
    return null;
  }
}

// Social workers cannot register publicly, so tests insert them directly.
async function insertSocialWorker(sql, { email, fullName, status = "ACTIVE" }) {
  const passwordHash = bcrypt.hashSync("Unused#Password1", 4);
  const rows = await sql`
    INSERT INTO users (full_name, email, phone, password_hash, role, account_status)
    VALUES (${fullName}, ${email}, '+27 82 000 0000', ${passwordHash}, 'SOCIAL_WORKER', ${status})
    RETURNING id
  `;
  return rows[0].id;
}

// Order matters: payments and arrangements restrict user deletion, and deleting the children
// cascades to their family links and social worker assignments.
async function deleteTestData(sql, emailPrefix) {
  const owners = "SELECT id FROM users WHERE email LIKE $1";
  const like = [`${emailPrefix}%`];
  // Conversations restrict deletion of their users and children, so they go first. The tables only
  // exist once migration 006 has been applied.
  if ((await sql.query("SELECT to_regclass('public.conversations') AS name"))[0].name) {
    const conversations = `SELECT id FROM conversations WHERE parent_user_id IN (${owners}) OR social_worker_id IN (${owners})`;
    await sql.query(`DELETE FROM messages WHERE conversation_id IN (${conversations})`, like);
    await sql.query(`DELETE FROM conversations WHERE id IN (${conversations})`, like);
  }
  await sql.query(`DELETE FROM payments WHERE paying_user_id IN (${owners}) OR receiving_user_id IN (${owners})`, like);
  await sql.query(`DELETE FROM maintenance_arrangements WHERE paying_user_id IN (${owners}) OR receiving_user_id IN (${owners})`, like);
  await sql.query(`DELETE FROM children WHERE created_by IN (${owners})`, like);
  await sql.query("DELETE FROM users WHERE email LIKE $1", like);
}

module.exports = { deleteTestData, getDatabaseUrl, insertSocialWorker };

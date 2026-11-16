const bcrypt = require("bcryptjs");
const { ApiError } = require("../utils/apiResponse");
const { pageResult } = require("../utils/pagination");

const BCRYPT_COST = 12;
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

function mapWorker(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || "",
    registrationNumber: row.registration_number || null,
    accountStatus: row.account_status,
    assignedChildren: Number(row.assigned_children ?? 0),
    createdAt: row.created_at,
  };
}

function duplicateError(error) {
  if (error.constraint === "uq_users_registration_number") {
    return new ApiError(409, "Another social worker already has that registration number.");
  }
  return new ApiError(409, "An account with this email address already exists.");
}

// Social workers are ordinary rows in `users` with the SOCIAL_WORKER role, so they sign in through the
// normal login. Every statement filters on that role, so these endpoints can never touch another account.
function createAdminSocialWorkerService({ sql }) {
  async function list({ search, status, pageSize, offset, page }) {
    const rows = await sql`
      SELECT u.id, u.full_name, u.email, u.phone, u.registration_number, u.account_status, u.created_at,
             (SELECT count(*)::int FROM social_worker_assignments a
              WHERE a.social_worker_id = u.id AND a.assignment_status = 'ACTIVE') AS assigned_children,
             count(*) OVER ()::int AS total
      FROM users u
      WHERE u.role = 'SOCIAL_WORKER'
        AND (${status}::text IS NULL OR u.account_status = ${status})
        AND (${search}::text IS NULL
             OR u.full_name ILIKE ${search} ESCAPE '!'
             OR u.email ILIKE ${search} ESCAPE '!'
             OR u.registration_number ILIKE ${search} ESCAPE '!')
      ORDER BY u.created_at DESC, u.id
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    return { items: rows.map(mapWorker), ...pageResult(rows, { page, pageSize }) };
  }

  async function get(id) {
    const rows = await sql`
      SELECT u.id, u.full_name, u.email, u.phone, u.registration_number, u.account_status, u.created_at,
             (SELECT count(*)::int FROM social_worker_assignments a
              WHERE a.social_worker_id = u.id AND a.assignment_status = 'ACTIVE') AS assigned_children,
             (SELECT count(*)::int FROM social_worker_assignments a WHERE a.social_worker_id = u.id) AS total_assignments,
             (SELECT count(*)::int FROM professional_notes n WHERE n.social_worker_id = u.id) AS notes,
             (SELECT count(*)::int FROM payment_reviews r WHERE r.reviewed_by = u.id) AS reviews,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'assignmentId', a.id, 'childId', c.id,
                 'childName', c.first_name || ' ' || c.last_name,
                 'arrangementId', a.maintenance_arrangement_id, 'assignedAt', a.assigned_at
               ) ORDER BY a.assigned_at DESC)
               FROM social_worker_assignments a JOIN children c ON c.id = a.child_id
               WHERE a.social_worker_id = u.id AND a.assignment_status = 'ACTIVE'
             ), '[]'::json) AS active_assignments
      FROM users u
      WHERE u.id = ${id}::uuid AND u.role = 'SOCIAL_WORKER'
    `;
    if (!rows.length) throw new ApiError(404, "Social worker not found.");
    const row = rows[0];
    return {
      ...mapWorker(row),
      totalAssignments: row.total_assignments,
      professionalNotes: row.notes,
      paymentReviews: row.reviews,
      activeAssignments: typeof row.active_assignments === "string"
        ? JSON.parse(row.active_assignments) : row.active_assignments,
    };
  }

  async function create(fields) {
    const existing = await sql`SELECT id FROM users WHERE lower(email) = ${fields.email} LIMIT 1`;
    if (existing.length) throw new ApiError(409, "An account with this email address already exists.");
    const passwordHash = await bcrypt.hash(fields.password, BCRYPT_COST);
    try {
      const rows = await sql`
        INSERT INTO users (full_name, email, phone, registration_number, password_hash, role, account_status)
        VALUES (${fields.fullName}, ${fields.email}, ${fields.phone}, ${fields.registrationNumber},
                ${passwordHash}, 'SOCIAL_WORKER', ${fields.accountStatus})
        RETURNING id
      `;
      return get(rows[0].id);
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) throw duplicateError(error);
      throw error;
    }
  }

  // A worker with active cases cannot be switched off, so no family is left with a worker who cannot
  // sign in. The check is inside the UPDATE, so it holds even if an assignment is added at the same time.
  async function update(fields) {
    let rows;
    try {
      rows = await sql`
        UPDATE users u
        SET full_name = ${fields.fullName}, email = ${fields.email}, phone = ${fields.phone},
            registration_number = ${fields.registrationNumber}, account_status = ${fields.accountStatus},
            updated_at = NOW()
        WHERE u.id = ${fields.id}::uuid AND u.role = 'SOCIAL_WORKER'
          AND (${fields.accountStatus} = 'ACTIVE' OR NOT EXISTS (
            SELECT 1 FROM social_worker_assignments a
            WHERE a.social_worker_id = u.id AND a.assignment_status = 'ACTIVE'))
        RETURNING u.id
      `;
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) throw duplicateError(error);
      throw error;
    }
    if (!rows.length) {
      await get(fields.id); // 404 when the worker does not exist
      throw new ApiError(409, "This social worker still has active cases. Reassign or end them before deactivating the account.");
    }
    return get(fields.id);
  }

  // "Delete" never destroys history. A worker with active cases is refused; one who has any case history,
  // notes or reviews is deactivated instead; only an account nothing refers to is removed outright.
  async function remove(id) {
    const worker = await get(id);
    if (worker.assignedChildren > 0) {
      throw new ApiError(409, `This social worker has ${worker.assignedChildren} active case(s). Reassign or end them first.`);
    }
    const hasHistory = worker.totalAssignments > 0 || worker.professionalNotes > 0 || worker.paymentReviews > 0;
    if (!hasHistory) {
      try {
        const deleted = await sql`
          DELETE FROM users u
          WHERE u.id = ${id}::uuid AND u.role = 'SOCIAL_WORKER'
            AND NOT EXISTS (SELECT 1 FROM social_worker_assignments a WHERE a.social_worker_id = u.id OR a.assigned_by = u.id)
            AND NOT EXISTS (SELECT 1 FROM professional_notes n WHERE n.social_worker_id = u.id)
            AND NOT EXISTS (SELECT 1 FROM payment_reviews r WHERE r.reviewed_by = u.id)
          RETURNING u.id
        `;
        if (deleted.length) return { outcome: "DELETED" };
      } catch (error) {
        if (error.code !== FOREIGN_KEY_VIOLATION) throw error;
      }
    }
    await sql`
      UPDATE users SET account_status = 'INACTIVE', updated_at = NOW()
      WHERE id = ${id}::uuid AND role = 'SOCIAL_WORKER'
    `;
    return { outcome: "DEACTIVATED" };
  }

  return { create, get, list, remove, update };
}

module.exports = { createAdminSocialWorkerService };

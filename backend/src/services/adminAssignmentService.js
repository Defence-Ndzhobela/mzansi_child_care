const { ApiError } = require("../utils/apiResponse");
const { ARRANGEMENT_STATUS_LABELS, FREQUENCY_LABELS } = require("../utils/maintenanceLabels");
const { pageResult } = require("../utils/pagination");

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const WORKER_UNAVAILABLE = "Choose an available (active) social worker.";

function mapAssignment(row) {
  return {
    id: row.id,
    status: row.assignment_status,
    assignedAt: row.assigned_at,
    endedAt: row.ended_at,
    socialWorker: { id: row.worker_id, fullName: row.worker_name },
    child: { id: row.child_id, fullName: row.child_name },
    arrangement: row.arrangement_id ? {
      id: row.arrangement_id,
      payingParent: row.payer_name,
      receivingParent: row.receiver_name,
      expectedAmount: Number(row.expected_amount),
      frequency: FREQUENCY_LABELS[row.frequency],
      status: ARRANGEMENT_STATUS_LABELS[row.arrangement_status],
    } : null,
    // Who made the assignment: an administrator, or the parent who registered the child.
    assignedBy: { id: row.assigned_by_id, fullName: row.assigned_by_name, role: row.assigned_by_role },
    endedBy: row.ended_by_name || null,
  };
}

// Social worker assignments made by administrators. Each change is a single SQL statement, so it is
// atomic: a child is never left without a worker because one half of a reassignment failed. Old rows are
// closed (CLOSED or TRANSFERRED) and kept, which is the assignment history.
function createAdminAssignmentService({ sql }) {
  async function query({ id = null, status = null, socialWorkerId = null, childId = null, search = null, pageSize = 100, offset = 0, page = 1 }) {
    const rows = await sql`
      SELECT a.id, a.assignment_status, a.assigned_at, a.ended_at,
             sw.id AS worker_id, sw.full_name AS worker_name,
             c.id AS child_id, c.first_name || ' ' || c.last_name AS child_name,
             m.id AS arrangement_id, m.expected_amount::text AS expected_amount, m.frequency,
             m.status AS arrangement_status,
             payer.full_name AS payer_name, receiver.full_name AS receiver_name,
             ab.id AS assigned_by_id, ab.full_name AS assigned_by_name, ab.role AS assigned_by_role,
             eb.full_name AS ended_by_name,
             count(*) OVER ()::int AS total
      FROM social_worker_assignments a
      JOIN users sw ON sw.id = a.social_worker_id
      JOIN children c ON c.id = a.child_id
      JOIN users ab ON ab.id = a.assigned_by
      LEFT JOIN users eb ON eb.id = a.ended_by
      LEFT JOIN maintenance_arrangements m ON m.id = a.maintenance_arrangement_id
      LEFT JOIN users payer ON payer.id = m.paying_user_id
      LEFT JOIN users receiver ON receiver.id = m.receiving_user_id
      WHERE (${id}::uuid IS NULL OR a.id = ${id}::uuid)
        AND (${status}::text IS NULL OR a.assignment_status = ${status})
        AND (${socialWorkerId}::uuid IS NULL OR a.social_worker_id = ${socialWorkerId}::uuid)
        AND (${childId}::uuid IS NULL OR a.child_id = ${childId}::uuid)
        AND (${search}::text IS NULL
             OR (c.first_name || ' ' || c.last_name) ILIKE ${search} ESCAPE '!'
             OR sw.full_name ILIKE ${search} ESCAPE '!')
      ORDER BY a.assigned_at DESC, a.id
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    return { rows, paging: pageResult(rows, { page, pageSize }) };
  }

  async function list(filters) {
    const { rows, paging } = await query(filters);
    return { items: rows.map(mapAssignment), ...paging };
  }

  async function getById(id) {
    const { rows } = await query({ id });
    if (!rows.length) throw new ApiError(404, "Assignment not found.");
    return mapAssignment(rows[0]);
  }

  async function assertActiveWorker(socialWorkerId) {
    const rows = await sql`
      SELECT id FROM users
      WHERE id = ${socialWorkerId}::uuid AND role = 'SOCIAL_WORKER' AND account_status = 'ACTIVE'
    `;
    if (!rows.length) throw new ApiError(400, WORKER_UNAVAILABLE);
  }

  // Assigns a worker to a child through one of that child's maintenance arrangements. A child has one
  // active worker, so an existing assignment is closed in the same statement (TRANSFERRED when the worker
  // changes, CLOSED when the same worker is only moved to another arrangement). Payments and arrangement
  // amounts are never touched.
  async function create(admin, { socialWorkerId, childId, arrangementId }) {
    await assertActiveWorker(socialWorkerId);
    const arrangements = await sql`
      SELECT status FROM maintenance_arrangements
      WHERE id = ${arrangementId}::uuid AND child_id = ${childId}::uuid
    `;
    if (!arrangements.length) {
      throw new ApiError(400, "That maintenance arrangement does not belong to the selected child.");
    }
    if (arrangements[0].status === "CANCELLED") {
      throw new ApiError(400, "A cancelled maintenance arrangement cannot be assigned.");
    }
    const current = await sql`
      SELECT social_worker_id, maintenance_arrangement_id FROM social_worker_assignments
      WHERE child_id = ${childId}::uuid AND assignment_status = 'ACTIVE'
    `;
    if (current.length && current[0].social_worker_id === socialWorkerId &&
        current[0].maintenance_arrangement_id === arrangementId) {
      throw new ApiError(409, "This social worker is already actively assigned to this child and arrangement.");
    }

    let rows;
    try {
      rows = await sql`
        WITH valid AS (
          SELECT 1 AS ok
          WHERE EXISTS (SELECT 1 FROM users w WHERE w.id = ${socialWorkerId}::uuid
                          AND w.role = 'SOCIAL_WORKER' AND w.account_status = 'ACTIVE')
            AND EXISTS (SELECT 1 FROM maintenance_arrangements m WHERE m.id = ${arrangementId}::uuid
                          AND m.child_id = ${childId}::uuid AND m.status <> 'CANCELLED')
        ), closed AS (
          UPDATE social_worker_assignments a
          SET assignment_status = CASE WHEN a.social_worker_id = ${socialWorkerId}::uuid
                                       THEN 'CLOSED' ELSE 'TRANSFERRED' END,
              ended_at = NOW(), ended_by = ${admin.id}::uuid
          WHERE a.child_id = ${childId}::uuid AND a.assignment_status = 'ACTIVE'
            AND EXISTS (SELECT 1 FROM valid)
          RETURNING a.id
        )
        INSERT INTO social_worker_assignments (social_worker_id, child_id, maintenance_arrangement_id, assigned_by)
        SELECT ${socialWorkerId}::uuid, ${childId}::uuid, ${arrangementId}::uuid, ${admin.id}::uuid
        WHERE EXISTS (SELECT 1 FROM valid) AND (SELECT count(*) FROM closed) >= 0
        RETURNING id
      `;
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ApiError(409, "This child's assignment was changed by someone else just now. Reload and try again.");
      }
      if (error.code === FOREIGN_KEY_VIOLATION) {
        throw new ApiError(400, "That maintenance arrangement does not belong to the selected child.");
      }
      throw error;
    }
    if (!rows.length) throw new ApiError(400, WORKER_UNAVAILABLE);
    return getById(rows[0].id);
  }

  // Hands an ACTIVE assignment to another worker, keeping the same child and arrangement.
  async function reassign(admin, { id, socialWorkerId }) {
    await assertActiveWorker(socialWorkerId);
    const rows = await sql`
      WITH closed AS (
        UPDATE social_worker_assignments a
        SET assignment_status = 'TRANSFERRED', ended_at = NOW(), ended_by = ${admin.id}::uuid
        WHERE a.id = ${id}::uuid AND a.assignment_status = 'ACTIVE'
          AND a.social_worker_id <> ${socialWorkerId}::uuid
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = ${socialWorkerId}::uuid
                        AND u.role = 'SOCIAL_WORKER' AND u.account_status = 'ACTIVE')
        RETURNING a.child_id, a.maintenance_arrangement_id
      )
      INSERT INTO social_worker_assignments (social_worker_id, child_id, maintenance_arrangement_id, assigned_by)
      SELECT ${socialWorkerId}::uuid, closed.child_id, closed.maintenance_arrangement_id, ${admin.id}::uuid
      FROM closed
      RETURNING id
    `;
    if (!rows.length) {
      const existing = await getById(id); // 404 when it does not exist
      if (existing.status !== "ACTIVE") throw new ApiError(409, "Only an active assignment can be reassigned.");
      throw new ApiError(409, "That social worker is already assigned to this child.");
    }
    return getById(rows[0].id);
  }

  async function end(admin, { id }) {
    const rows = await sql`
      UPDATE social_worker_assignments
      SET assignment_status = 'CLOSED', ended_at = NOW(), ended_by = ${admin.id}::uuid
      WHERE id = ${id}::uuid AND assignment_status = 'ACTIVE'
      RETURNING id
    `;
    if (!rows.length) {
      await getById(id);
      throw new ApiError(409, "This assignment has already ended.");
    }
    return getById(id);
  }

  return { create, end, getById, list, reassign };
}

module.exports = { createAdminAssignmentService };

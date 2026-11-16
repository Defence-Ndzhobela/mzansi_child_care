const { ApiError } = require("../utils/apiResponse");
const { ARRANGEMENT_STATUS_LABELS, FREQUENCY_LABELS } = require("../utils/maintenanceLabels");

const UNIQUE_VIOLATION = "23505";

// Both unique indexes can fire while creating an arrangement; each needs its own explanation.
function mapUniqueViolation(error) {
  if (error.constraint === "uq_active_child_assignment") {
    return new ApiError(409, "This child's social worker was just assigned by someone else. Reload and try again.");
  }
  return new ApiError(409, "An active arrangement between these two parents for this child already exists.");
}

function parseJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function mapArrangementRow(row, viewerId) {
  const socialWorker = parseJson(row.social_worker);
  return {
    id: row.id,
    childId: row.child_id,
    payingUserId: row.paying_user_id,
    receivingUserId: row.receiving_user_id,
    payerName: row.payer_name,
    receiverName: row.receiver_name,
    // Relative to the viewer, so the dashboard can adapt without re-deriving it.
    myRole: row.paying_user_id === viewerId ? "PAYING" : row.receiving_user_id === viewerId ? "RECEIVING" : null,
    expectedAmount: Number(row.expected_amount),
    currency: "ZAR",
    frequency: FREQUENCY_LABELS[row.frequency],
    startDate: row.start_date,
    endDate: row.end_date || undefined,
    status: ARRANGEMENT_STATUS_LABELS[row.status],
    notes: row.notes || undefined,
    socialWorker: socialWorker ? { id: socialWorker.id, fullName: socialWorker.fullName } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createArrangementService({ sql, assignmentService }) {
  // Parents see only arrangements they pay or receive. Social workers see only active assignments.
  async function listArrangements(user, { arrangementId = null } = {}) {
    const rows = await sql`
      SELECT a.id, a.child_id, a.paying_user_id, a.receiving_user_id,
             a.expected_amount::text AS expected_amount, a.frequency,
             to_char(a.start_date, 'YYYY-MM-DD') AS start_date,
             to_char(a.end_date, 'YYYY-MM-DD') AS end_date,
             a.status, a.notes, a.created_at, a.updated_at,
             payer.full_name AS payer_name, receiver.full_name AS receiver_name,
             (SELECT json_build_object('id', sw_user.id, 'fullName', sw_user.full_name)
              FROM social_worker_assignments asg
              JOIN users sw_user ON sw_user.id = asg.social_worker_id
              WHERE asg.child_id = a.child_id AND asg.assignment_status = 'ACTIVE'
              LIMIT 1) AS social_worker
      FROM maintenance_arrangements a
      JOIN users payer ON payer.id = a.paying_user_id
      JOIN users receiver ON receiver.id = a.receiving_user_id
      WHERE (
        (${user.role} = 'PARENT_CAREGIVER'
          AND (a.paying_user_id = ${user.id}::uuid OR a.receiving_user_id = ${user.id}::uuid))
        OR (${user.role} = 'SOCIAL_WORKER' AND EXISTS (
          SELECT 1 FROM social_worker_assignments sw
          WHERE sw.child_id = a.child_id AND sw.social_worker_id = ${user.id}::uuid
            AND sw.assignment_status = 'ACTIVE'
        ))
      ) AND (${arrangementId}::uuid IS NULL OR a.id = ${arrangementId}::uuid)
      ORDER BY a.created_at DESC
    `;
    return rows.map((row) => mapArrangementRow(row, user.id));
  }

  // Explains why nothing was created when the caller does belong to the child, so the form can say what
  // to fix. Callers who are not family members get the generic refusal and learn nothing about the child.
  async function explainRefusal(user, input) {
    const rows = await sql`
      SELECT (SELECT a.social_worker_id FROM social_worker_assignments a
              WHERE a.child_id = c.id AND a.assignment_status = 'ACTIVE') AS current_worker_id
      FROM children c
      WHERE c.id = ${input.childId}::uuid
        AND EXISTS (SELECT 1 FROM family_relationships fr WHERE fr.child_id = c.id AND fr.user_id = ${user.id}::uuid)
    `;
    if (rows.length) {
      const current = rows[0].current_worker_id;
      if (!current && !input.socialWorkerId) throw new ApiError(400, "Select an available social worker for this child.");
      if (current && input.socialWorkerId && current !== input.socialWorkerId) {
        throw new ApiError(409, "This child already has a social worker. Ask the person who created the child profile to change it.");
      }
    }
    throw new ApiError(403, "Arrangements can only be created between you and another approved family member of this child.");
  }

  // The paying and receiving users are decided here from the caller's role, never taken from
  // the request. Both must already be approved family members of the child.
  // The child's social worker is reused when it already has one. Otherwise the selected worker is
  // assigned in the same statement, so an arrangement never exists for a child without a worker.
  async function createArrangement(user, input) {
    if (input.socialWorkerId) await assignmentService.assertAvailableSocialWorker(input.socialWorkerId);
    const payerId = input.myRole === "PAYING" ? user.id : input.otherUserId;
    const receiverId = input.myRole === "RECEIVING" ? user.id : input.otherUserId;
    const workerId = input.socialWorkerId || null;
    let rows;
    try {
      rows = await sql`
        WITH child_worker AS (
          SELECT social_worker_id FROM social_worker_assignments
          WHERE child_id = ${input.childId}::uuid AND assignment_status = 'ACTIVE'
        ), valid_worker AS (
          SELECT id FROM users
          WHERE id = ${workerId}::uuid AND role = 'SOCIAL_WORKER' AND account_status = 'ACTIVE'
        ), new_arrangement AS (
          INSERT INTO maintenance_arrangements (
            child_id, paying_user_id, receiving_user_id, expected_amount,
            frequency, start_date, end_date, notes
          )
          SELECT c.id, payer.id, receiver.id, ${input.expectedAmount}::numeric,
                 ${input.frequency}, ${input.startDate}::date, ${input.endDate}::date, ${input.notes}
          FROM children c
          JOIN users payer ON payer.id = ${payerId}::uuid
            AND payer.role = 'PARENT_CAREGIVER' AND payer.account_status = 'ACTIVE'
          JOIN users receiver ON receiver.id = ${receiverId}::uuid
            AND receiver.role = 'PARENT_CAREGIVER' AND receiver.account_status = 'ACTIVE'
          WHERE c.id = ${input.childId}::uuid
            AND payer.id <> receiver.id
            AND EXISTS (SELECT 1 FROM family_relationships fr WHERE fr.child_id = c.id AND fr.user_id = payer.id)
            AND EXISTS (SELECT 1 FROM family_relationships fr WHERE fr.child_id = c.id AND fr.user_id = receiver.id)
            AND (
              EXISTS (SELECT 1 FROM child_worker
                      WHERE ${workerId}::uuid IS NULL OR social_worker_id = ${workerId}::uuid)
              OR (NOT EXISTS (SELECT 1 FROM child_worker) AND EXISTS (SELECT 1 FROM valid_worker))
            )
          RETURNING id, child_id
        ), new_assignment AS (
          INSERT INTO social_worker_assignments (social_worker_id, child_id, assigned_by)
          SELECT valid_worker.id, new_arrangement.child_id, ${user.id}::uuid
          FROM new_arrangement, valid_worker
          WHERE NOT EXISTS (SELECT 1 FROM child_worker)
          RETURNING id
        )
        SELECT id FROM new_arrangement
      `;
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) throw mapUniqueViolation(error);
      throw error;
    }
    if (!rows.length) await explainRefusal(user, input);
    return (await listArrangements(user, { arrangementId: rows[0].id }))[0];
  }

  // Terms can be edited by either party. The child, payer and receiver can never change.
  async function updateArrangement(user, input) {
    let rows;
    try {
      rows = await sql`
        UPDATE maintenance_arrangements
        SET expected_amount = ${input.expectedAmount}::numeric, frequency = ${input.frequency},
            start_date = ${input.startDate}::date, end_date = ${input.endDate}::date,
            status = ${input.status}, notes = ${input.notes}, updated_at = NOW()
        WHERE id = ${input.arrangementId}::uuid
          AND (paying_user_id = ${user.id}::uuid OR receiving_user_id = ${user.id}::uuid)
        RETURNING id
      `;
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ApiError(409, "An active arrangement between these two parents for this child already exists.");
      }
      throw error;
    }
    if (!rows.length) throw new ApiError(404, "Maintenance arrangement not found.");
    return (await listArrangements(user, { arrangementId: rows[0].id }))[0];
  }

  return { createArrangement, listArrangements, updateArrangement };
}

module.exports = { createArrangementService };

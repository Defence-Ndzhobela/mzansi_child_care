const { ApiError } = require("../utils/apiResponse");
const { ARRANGEMENT_STATUS_LABELS, FREQUENCY_LABELS } = require("../utils/maintenanceLabels");

const UNIQUE_VIOLATION = "23505";

function mapArrangementRow(row, viewerId) {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createArrangementService({ sql }) {
  // Parents see only arrangements they pay or receive. Social workers see only active assignments.
  async function listArrangements(user, { arrangementId = null } = {}) {
    const rows = await sql`
      SELECT a.id, a.child_id, a.paying_user_id, a.receiving_user_id,
             a.expected_amount::text AS expected_amount, a.frequency,
             to_char(a.start_date, 'YYYY-MM-DD') AS start_date,
             to_char(a.end_date, 'YYYY-MM-DD') AS end_date,
             a.status, a.notes, a.created_at, a.updated_at,
             payer.full_name AS payer_name, receiver.full_name AS receiver_name
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

  // The paying and receiving users are decided here from the caller's role, never taken from
  // the request. Both must already be approved family members of the child.
  async function createArrangement(user, input) {
    const payerId = input.myRole === "PAYING" ? user.id : input.otherUserId;
    const receiverId = input.myRole === "RECEIVING" ? user.id : input.otherUserId;
    let rows;
    try {
      rows = await sql`
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
        RETURNING id
      `;
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ApiError(409, "An active arrangement between these two parents for this child already exists.");
      }
      throw error;
    }
    if (!rows.length) {
      throw new ApiError(403, "Arrangements can only be created between you and another approved family member of this child.");
    }
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

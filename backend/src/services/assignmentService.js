const { ApiError } = require("../utils/apiResponse");

const UNIQUE_VIOLATION = "23505";
const WORKER_UNAVAILABLE = "Choose an available social worker.";

function createAssignmentService({ sql }) {
  // Only active social worker accounts can be chosen. Names only: no contact details are exposed to parents.
  async function listAvailableSocialWorkers() {
    const rows = await sql`
      SELECT id, full_name FROM users
      WHERE role = 'SOCIAL_WORKER' AND account_status = 'ACTIVE'
      ORDER BY full_name
    `;
    return rows.map((row) => ({ id: row.id, fullName: row.full_name }));
  }

  // The chosen worker must be an existing, active SOCIAL_WORKER account; the client's word is not enough.
  async function assertAvailableSocialWorker(socialWorkerId) {
    const rows = await sql`
      SELECT id FROM users
      WHERE id = ${socialWorkerId}::uuid AND role = 'SOCIAL_WORKER' AND account_status = 'ACTIVE'
    `;
    if (!rows.length) throw new ApiError(400, WORKER_UNAVAILABLE);
  }

  // Assigns a worker to a child or replaces the current one. Only the profile's creator may do this
  // (the same rule as approving link requests), so a linked parent cannot swap the worker on their own.
  // The old row is closed (TRANSFERRED) and the new one opened in a single transaction, which keeps the
  // history and never leaves the child with zero or two active workers.
  async function assignSocialWorker(user, { childId, socialWorkerId }) {
    const children = await sql`
      SELECT c.created_by,
             (SELECT a.social_worker_id FROM social_worker_assignments a
              WHERE a.child_id = c.id AND a.assignment_status = 'ACTIVE') AS current_worker_id
      FROM children c
      WHERE c.id = ${childId}::uuid
        AND EXISTS (SELECT 1 FROM family_relationships fr WHERE fr.child_id = c.id AND fr.user_id = ${user.id}::uuid)
    `;
    if (!children.length) throw new ApiError(404, "Child profile not found.");
    if (children[0].created_by !== user.id) {
      throw new ApiError(403, "Only the person who created this child profile can change the social worker.");
    }
    await assertAvailableSocialWorker(socialWorkerId);
    if (children[0].current_worker_id === socialWorkerId) return { changed: false };

    try {
      await sql.transaction([
        sql`
          UPDATE social_worker_assignments
          SET assignment_status = 'TRANSFERRED', ended_at = NOW()
          WHERE child_id = ${childId}::uuid AND assignment_status = 'ACTIVE'
        `,
        sql`
          INSERT INTO social_worker_assignments (social_worker_id, child_id, assigned_by)
          VALUES (${socialWorkerId}::uuid, ${childId}::uuid, ${user.id}::uuid)
        `,
      ]);
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ApiError(409, "The social worker for this child was changed at the same time. Reload and try again.");
      }
      throw error;
    }
    return { changed: true };
  }

  return { assertAvailableSocialWorker, assignSocialWorker, listAvailableSocialWorkers };
}

module.exports = { WORKER_UNAVAILABLE, createAssignmentService };

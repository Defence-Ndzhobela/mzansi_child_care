const { ApiError } = require("../utils/apiResponse");
const { childIdLookupHash } = require("../utils/encryptIdNumber");
const { relationshipLabel } = require("../utils/relationshipTypes");

function createFamilyService({ sql, jwtSecret }) {
  // Creates a pending request only when a matching child exists. Callers always get the
  // same outcome, so a request never reveals whether an ID number matched a profile.
  async function requestLinkToChild(userId, { idNumber, relationship }) {
    const idHash = childIdLookupHash(idNumber, jwtSecret);
    await sql`
      INSERT INTO child_link_requests (child_id, requester_user_id, relationship_type)
      SELECT c.id, ${userId}, ${relationship}
      FROM children c
      WHERE c.national_id_lookup_hash = ${idHash}
        AND c.created_by <> ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM family_relationships fr
          WHERE fr.child_id = c.id AND fr.user_id = ${userId}
        )
      ON CONFLICT DO NOTHING
    `;
  }

  // Only the child's creator can see the pending requests for that child.
  async function listPendingRequests(creatorId) {
    const rows = await sql`
      SELECT r.id, r.relationship_type, r.requested_at,
             c.id AS child_id, c.first_name, c.last_name,
             u.id AS requester_id, u.full_name AS requester_name, u.email AS requester_email
      FROM child_link_requests r
      JOIN children c ON c.id = r.child_id
      JOIN users u ON u.id = r.requester_user_id
      WHERE c.created_by = ${creatorId} AND r.status = 'PENDING'
      ORDER BY r.requested_at DESC
    `;
    return rows.map((row) => ({
      id: row.id,
      childId: row.child_id,
      childName: `${row.first_name} ${row.last_name}`,
      requesterId: row.requester_id,
      requesterName: row.requester_name,
      requesterEmail: row.requester_email,
      relationshipType: relationshipLabel(row.relationship_type),
      requestedAt: row.requested_at,
    }));
  }

  // Approval and the resulting family_relationships row happen in one statement.
  async function respondToRequest(creatorId, { requestId, decision }) {
    const rows = await sql`
      WITH responded AS (
        UPDATE child_link_requests r
        SET status = ${decision}, reviewed_by = ${creatorId}, responded_at = NOW()
        FROM children c
        WHERE r.id = ${requestId}
          AND r.child_id = c.id
          AND c.created_by = ${creatorId}
          AND r.status = 'PENDING'
        RETURNING r.child_id, r.requester_user_id, r.relationship_type, r.status
      ), linked AS (
        INSERT INTO family_relationships (child_id, user_id, relationship_type, is_primary_caregiver)
        SELECT child_id, requester_user_id, relationship_type, FALSE
        FROM responded
        WHERE status = 'APPROVED'
        ON CONFLICT (child_id, user_id, relationship_type) DO NOTHING
        RETURNING child_id
      )
      SELECT responded.child_id, responded.status FROM responded
    `;
    if (!rows.length) {
      throw new ApiError(404, "Linking request not found or already handled.");
    }
    return rows[0].status;
  }

  return { listPendingRequests, requestLinkToChild, respondToRequest };
}

module.exports = { createFamilyService };

const { ApiError } = require("../utils/apiResponse");

const UNIQUE_VIOLATION = "23505";
const CHILD_NOT_FOUND = "Family not found.";

// Administrator changes to a child's family. Every statement refuses archived children, so an archived
// family is frozen. Payments, evidence, confirmations, reviews and notes are never touched here.
function createAdminFamilyService({ sql }) {
  async function updateChild({ id, firstName, lastName, dateOfBirth }) {
    const rows = await sql`
      UPDATE children
      SET first_name = ${firstName}, last_name = ${lastName}, date_of_birth = ${dateOfBirth}::date, updated_at = NOW()
      WHERE id = ${id}::uuid AND archived_at IS NULL
      RETURNING id
    `;
    if (!rows.length) throw new ApiError(404, CHILD_NOT_FOUND);
  }

  // Links an existing, active parent account (found by email) to the child. Never creates accounts.
  async function addMember({ id, email, relationshipType, isPrimaryCaregiver }) {
    const [result] = await sql`
      WITH child AS (
        SELECT id FROM children WHERE id = ${id}::uuid AND archived_at IS NULL
      ), person AS (
        SELECT id FROM users
        WHERE lower(email) = ${email} AND role = 'PARENT_CAREGIVER' AND account_status = 'ACTIVE'
      ), inserted AS (
        INSERT INTO family_relationships (child_id, user_id, relationship_type, is_primary_caregiver)
        SELECT child.id, person.id, ${relationshipType}, ${isPrimaryCaregiver}::boolean FROM child, person
        ON CONFLICT ON CONSTRAINT uq_family_relationship DO NOTHING
        RETURNING id
      )
      SELECT (SELECT count(*)::int FROM child) AS child_found,
             (SELECT count(*)::int FROM person) AS person_found,
             (SELECT count(*)::int FROM inserted) AS inserted
    `;
    if (!result.child_found) throw new ApiError(404, CHILD_NOT_FOUND);
    if (!result.person_found) throw new ApiError(404, "No active parent account was found with that email address.");
    if (!result.inserted) throw new ApiError(409, "This person is already linked to the child with that relationship.");
  }

  async function updateMember({ id, relationshipId, relationshipType, isPrimaryCaregiver }) {
    try {
      const rows = await sql`
        UPDATE family_relationships fr
        SET relationship_type = ${relationshipType}, is_primary_caregiver = ${isPrimaryCaregiver}::boolean
        WHERE fr.id = ${relationshipId}::uuid AND fr.child_id = ${id}::uuid
          AND EXISTS (SELECT 1 FROM children c WHERE c.id = fr.child_id AND c.archived_at IS NULL)
        RETURNING fr.id
      `;
      if (!rows.length) throw new ApiError(404, "Family member not found.");
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ApiError(409, "This person is already linked to the child with that relationship.");
      }
      throw error;
    }
  }

  // The checks and the delete are one statement. A person who is paying or receiving in a live
  // arrangement, or the only remaining family member, cannot be removed.
  async function removeMember({ id, relationshipId }) {
    const [result] = await sql`
      WITH target AS (
        SELECT fr.id, fr.user_id FROM family_relationships fr
        JOIN children c ON c.id = fr.child_id AND c.archived_at IS NULL
        WHERE fr.id = ${relationshipId}::uuid AND fr.child_id = ${id}::uuid
      ), facts AS (
        SELECT (SELECT count(*)::int FROM family_relationships WHERE child_id = ${id}::uuid) AS members,
               (SELECT count(*)::int FROM family_relationships f, target t
                WHERE f.child_id = ${id}::uuid AND f.user_id = t.user_id) AS own_links,
               EXISTS (SELECT 1 FROM maintenance_arrangements m, target t
                       WHERE m.child_id = ${id}::uuid AND t.user_id IN (m.paying_user_id, m.receiving_user_id)
                         AND m.status IN ('ACTIVE', 'PAUSED')) AS in_live_arrangement
      ), removed AS (
        DELETE FROM family_relationships
        WHERE id IN (SELECT id FROM target)
          AND (SELECT members FROM facts) > 1
          AND NOT ((SELECT own_links FROM facts) = 1 AND (SELECT in_live_arrangement FROM facts))
        RETURNING id
      )
      SELECT (SELECT count(*)::int FROM target) AS found,
             (SELECT members FROM facts) AS members,
             (SELECT own_links FROM facts) AS own_links,
             (SELECT in_live_arrangement FROM facts) AS in_live_arrangement,
             (SELECT count(*)::int FROM removed) AS removed
    `;
    if (!result.found) throw new ApiError(404, "Family member not found.");
    if (result.removed) return;
    if (result.members <= 1) {
      throw new ApiError(409, "This is the only family member. Archive the family instead of removing them.");
    }
    throw new ApiError(409, "This person is paying or receiving in a live maintenance arrangement for the child. Complete or cancel that arrangement first.");
  }

  // Archives the whole family in one transaction: the links are saved on the child and removed, the
  // active social worker assignment is closed, live arrangements are cancelled and pending link requests
  // are rejected. Parent accounts, payments, evidence, confirmations, reviews, notes and messages remain.
  async function archiveFamily(admin, { id }) {
    const children = await sql`SELECT archived_at FROM children WHERE id = ${id}::uuid`;
    if (!children.length) throw new ApiError(404, CHILD_NOT_FOUND);
    if (children[0].archived_at) throw new ApiError(409, "This family is already archived.");

    await sql.transaction([
      sql`
        UPDATE children
        SET archived_at = NOW(), archived_by = ${admin.id}::uuid, updated_at = NOW(),
            archived_family = COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'userId', fr.user_id, 'relationshipType', fr.relationship_type,
                'isPrimaryCaregiver', fr.is_primary_caregiver, 'linkedAt', fr.created_at))
              FROM family_relationships fr WHERE fr.child_id = ${id}::uuid), '[]'::jsonb)
        WHERE id = ${id}::uuid AND archived_at IS NULL
      `,
      sql`DELETE FROM family_relationships WHERE child_id = ${id}::uuid`,
      sql`
        UPDATE social_worker_assignments
        SET assignment_status = 'CLOSED', ended_at = NOW(), ended_by = ${admin.id}::uuid
        WHERE child_id = ${id}::uuid AND assignment_status = 'ACTIVE'
      `,
      sql`
        UPDATE maintenance_arrangements SET status = 'CANCELLED', updated_at = NOW()
        WHERE child_id = ${id}::uuid AND status IN ('ACTIVE', 'PAUSED')
      `,
      sql`
        UPDATE child_link_requests SET status = 'REJECTED', responded_at = NOW()
        WHERE child_id = ${id}::uuid AND status = 'PENDING'
      `,
    ]);
    return { outcome: "ARCHIVED" };
  }

  return { addMember, archiveFamily, removeMember, updateChild, updateMember };
}

module.exports = { createAdminFamilyService };

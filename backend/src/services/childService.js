const { ApiError } = require("../utils/apiResponse");
const { childIdLookupHash } = require("../utils/encryptIdNumber");
const { relationshipLabel } = require("../utils/relationshipTypes");

// pg DATE values arrive as local-midnight Date objects, so read local calendar parts.
function formatDateOnly(value) {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function parseJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function mapChildRow(row) {
  const relationships = parseJson(row.relationships) || [];
  const socialWorker = parseJson(row.social_worker);
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: formatDateOnly(row.date_of_birth),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // The current ACTIVE assignment; the same worker is shown to every parent linked to the child.
    socialWorker: socialWorker ? { id: socialWorker.id, fullName: socialWorker.fullName } : null,
    relationships: relationships.map((relationship) => ({
      id: relationship.id,
      childId: row.id,
      userId: relationship.userId,
      fullName: relationship.fullName,
      email: relationship.email,
      relationshipType: relationshipLabel(relationship.relationshipType, "Caregiver"),
      isPrimaryCaregiver: relationship.isPrimaryCaregiver,
      createdAt: relationship.createdAt,
    })),
  };
}

function createChildService({ sql, jwtSecret, assignmentService }) {
  // Parents see children they created or are linked to; social workers see only active assignments.
  async function listChildrenForUser(userId, role) {
    const rows = await sql`
      SELECT c.id, c.first_name, c.last_name, c.date_of_birth, c.created_by,
             c.created_at, c.updated_at,
             (SELECT json_build_object('id', sw.id, 'fullName', sw.full_name)
              FROM social_worker_assignments a
              JOIN users sw ON sw.id = a.social_worker_id
              WHERE a.child_id = c.id AND a.assignment_status = 'ACTIVE'
              LIMIT 1) AS social_worker,
             COALESCE(
               json_agg(json_build_object(
                 'id', fr.id,
                 'userId', u.id,
                 'fullName', u.full_name,
                 'email', u.email,
                 'relationshipType', fr.relationship_type,
                 'isPrimaryCaregiver', fr.is_primary_caregiver,
                 'createdAt', fr.created_at
               ) ORDER BY fr.created_at) FILTER (WHERE fr.id IS NOT NULL),
               '[]'::json
             ) AS relationships
      FROM children c
      LEFT JOIN family_relationships fr ON fr.child_id = c.id
      LEFT JOIN users u ON u.id = fr.user_id
      WHERE (
        ${role} = 'PARENT_CAREGIVER' AND (
          c.created_by = ${userId}
          OR EXISTS (
            SELECT 1 FROM family_relationships own
            WHERE own.child_id = c.id AND own.user_id = ${userId}
          )
        )
      ) OR (
        ${role} = 'SOCIAL_WORKER'
        AND EXISTS (
          SELECT 1 FROM social_worker_assignments a
          WHERE a.child_id = c.id AND a.social_worker_id = ${userId}
            AND a.assignment_status = 'ACTIVE'
        )
      )
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    return rows.map(mapChildRow);
  }

  async function getChildForUser(user, childId) {
    const children = await listChildrenForUser(user.id, user.role);
    return children.find((child) => child.id === childId) || null;
  }

  // One statement either creates the child (with its creator relationship and its ACTIVE social worker
  // assignment) or, when the ID digest already exists, files a pending link request for the creator to
  // review. Being one statement, it is atomic: a child is never saved without its assignment.
  // The caller cannot tell which happened, so ID numbers cannot be probed. When the child already
  // exists it keeps its current worker, so the family never ends up with two.
  async function createChildOrRequestLink(userId, child) {
    await assignmentService.assertAvailableSocialWorker(child.socialWorkerId);
    const idHash = childIdLookupHash(child.idNumber, jwtSecret);
    await sql`
        WITH existing_child AS (
          SELECT id, created_by FROM children
          WHERE national_id_lookup_hash = ${idHash}
        ), valid_worker AS (
          SELECT id FROM users
          WHERE id = ${child.socialWorkerId}::uuid
            AND role = 'SOCIAL_WORKER' AND account_status = 'ACTIVE'
        ), new_child AS (
          INSERT INTO children (
            first_name, last_name, date_of_birth, created_by, national_id_lookup_hash
          )
          SELECT
            ${child.firstName}, ${child.lastName}, ${child.dateOfBirth},
            ${userId}, ${idHash}
          WHERE NOT EXISTS (SELECT 1 FROM existing_child)
            AND EXISTS (SELECT 1 FROM valid_worker)
          ON CONFLICT (national_id_lookup_hash)
            WHERE national_id_lookup_hash IS NOT NULL
            DO NOTHING
          RETURNING id, first_name, last_name, date_of_birth, created_by, created_at, updated_at
        ), new_relationship AS (
          INSERT INTO family_relationships (
            child_id, user_id, relationship_type, is_primary_caregiver
          )
          SELECT id, ${userId}, ${child.relationship}, ${child.isPrimaryCaregiver}
          FROM new_child
          RETURNING child_id
        ), new_assignment AS (
          INSERT INTO social_worker_assignments (social_worker_id, child_id, assigned_by)
          SELECT valid_worker.id, new_child.id, ${userId}
          FROM new_child, valid_worker
          RETURNING id
        ), link_request AS (
          INSERT INTO child_link_requests (child_id, requester_user_id, relationship_type)
          SELECT existing_child.id, ${userId}, ${child.relationship}
          FROM existing_child
          WHERE existing_child.created_by <> ${userId}
            AND NOT EXISTS (
              SELECT 1 FROM family_relationships fr
              WHERE fr.child_id = existing_child.id AND fr.user_id = ${userId}
            )
          ON CONFLICT DO NOTHING
          RETURNING id
        )
        SELECT TRUE AS accepted
      `;
  }

  async function updateChild(userId, { childId, firstName, lastName, dateOfBirth }) {
    const rows = await sql`
      UPDATE children
      SET first_name = ${firstName}, last_name = ${lastName},
          date_of_birth = ${dateOfBirth}, updated_at = NOW()
      WHERE id = ${childId} AND created_by = ${userId}
      RETURNING id, first_name, last_name, date_of_birth, created_by, created_at, updated_at
    `;
    if (!rows.length) {
      throw new ApiError(404, "Child profile not found or you cannot edit it.");
    }
    return mapChildRow({ ...rows[0], relationships: [] });
  }

  return { createChildOrRequestLink, getChildForUser, listChildrenForUser, updateChild };
}

module.exports = { createChildService };

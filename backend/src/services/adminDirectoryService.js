const { ApiError } = require("../utils/apiResponse");
const { ARRANGEMENT_STATUS_LABELS, FREQUENCY_LABELS, PAYMENT_STATUS_LABELS } = require("../utils/maintenanceLabels");
const { pageResult } = require("../utils/pagination");
const { relationshipLabel } = require("../utils/relationshipTypes");

const parseJson = (value) => (typeof value === "string" ? JSON.parse(value) : value) || [];

function mapArrangement(row) {
  return {
    id: row.id,
    childId: row.child_id,
    childName: row.child_name,
    payingParent: { id: row.paying_user_id, fullName: row.payer_name },
    receivingParent: { id: row.receiving_user_id, fullName: row.receiver_name },
    expectedAmount: Number(row.expected_amount),
    currency: row.currency,
    frequency: FREQUENCY_LABELS[row.frequency],
    startDate: row.start_date,
    endDate: row.end_date || null,
    status: ARRANGEMENT_STATUS_LABELS[row.status],
    notes: row.notes || null,
    socialWorker: row.worker_id ? { id: row.worker_id, fullName: row.worker_name } : null,
    // True when the child's active assignment was made through this very arrangement.
    assignedThisArrangement: Boolean(row.assignment_arrangement_id) && row.assignment_arrangement_id === row.id,
    createdAt: row.created_at,
  };
}

// Read-only views for administrators. Only the fields each admin screen needs are returned: for example
// a child's ID-number digest is never selected, and payments are only counted, never listed or edited.
function createAdminDirectoryService({ sql, assignmentService }) {
  async function stats() {
    const [row] = await sql`
      SELECT
        (SELECT count(*)::int FROM users WHERE role <> 'ADMIN') AS total_users,
        (SELECT count(*)::int FROM users WHERE role = 'SOCIAL_WORKER') AS social_workers,
        (SELECT count(*)::int FROM users WHERE role = 'SOCIAL_WORKER' AND account_status = 'ACTIVE') AS active_social_workers,
        (SELECT count(*)::int FROM users u WHERE u.role = 'PARENT_CAREGIVER' AND (
           EXISTS (SELECT 1 FROM maintenance_arrangements m WHERE m.paying_user_id = u.id)
           OR EXISTS (SELECT 1 FROM family_relationships fr
                      WHERE fr.user_id = u.id AND fr.relationship_type = 'PAYING_PARENT'))) AS child_supporters,
        (SELECT count(*)::int FROM children) AS children,
        (SELECT count(*)::int FROM social_worker_assignments WHERE assignment_status = 'ACTIVE') AS active_assignments,
        (SELECT count(*)::int FROM maintenance_arrangements WHERE status = 'ACTIVE') AS active_arrangements,
        (SELECT count(*)::int FROM payments WHERE status IN ('SUBMITTED', 'AWAITING_CONFIRMATION')) AS pending_payments,
        (SELECT count(*)::int FROM payments WHERE status IN ('CONFIRMED_BY_RECIPIENT', 'PARTIALLY_CONFIRMED')) AS completed_payments,
        (SELECT count(*)::int FROM payments WHERE status = 'DISPUTED') AS disputed_payments,
        (SELECT count(*)::int FROM children c WHERE NOT EXISTS (
           SELECT 1 FROM social_worker_assignments a
           WHERE a.child_id = c.id AND a.assignment_status = 'ACTIVE')) AS children_without_worker
    `;
    return {
      totalUsers: row.total_users,
      socialWorkers: row.social_workers,
      activeSocialWorkers: row.active_social_workers,
      childSupporters: row.child_supporters,
      children: row.children,
      activeAssignments: row.active_assignments,
      activeArrangements: row.active_arrangements,
      pendingPayments: row.pending_payments,
      completedPayments: row.completed_payments,
      disputedPayments: row.disputed_payments,
      childrenWithoutWorker: row.children_without_worker,
    };
  }

  // A child supporter is a parent account that pays in at least one arrangement or is linked to a child as
  // PAYING_PARENT. Both facts already exist in the database, so nothing here is invented.
  async function listChildSupporters({ search, pageSize, offset, page }) {
    const rows = await sql`
      SELECT u.id, u.full_name, u.email, u.phone, u.account_status, u.created_at,
             (SELECT count(DISTINCT x.child_id)::int FROM (
                SELECT fr.child_id FROM family_relationships fr WHERE fr.user_id = u.id
                UNION
                SELECT m.child_id FROM maintenance_arrangements m WHERE m.paying_user_id = u.id) x) AS children,
             (SELECT count(*)::int FROM maintenance_arrangements m WHERE m.paying_user_id = u.id) AS arrangements,
             COALESCE((SELECT sum(m.expected_amount * CASE m.frequency
                                WHEN 'WEEKLY' THEN 4 WHEN 'FORTNIGHTLY' THEN 2 ELSE 1 END)
                       FROM maintenance_arrangements m
                       WHERE m.paying_user_id = u.id AND m.status = 'ACTIVE'), 0)::text AS monthly_expected,
             count(*) OVER ()::int AS total
      FROM users u
      WHERE u.role = 'PARENT_CAREGIVER'
        AND (EXISTS (SELECT 1 FROM maintenance_arrangements m WHERE m.paying_user_id = u.id)
             OR EXISTS (SELECT 1 FROM family_relationships fr
                        WHERE fr.user_id = u.id AND fr.relationship_type = 'PAYING_PARENT'))
        AND (${search}::text IS NULL OR u.full_name ILIKE ${search} ESCAPE '!' OR u.email ILIKE ${search} ESCAPE '!')
      ORDER BY u.full_name, u.id
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    return {
      items: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone || "",
        accountStatus: row.account_status,
        children: row.children,
        arrangements: row.arrangements,
        // Active arrangements converted to a monthly figure (weekly x 4, fortnightly x 2).
        monthlyExpectedAmount: Number(row.monthly_expected),
        createdAt: row.created_at,
      })),
      ...pageResult(rows, { page, pageSize }),
    };
  }

  async function getChildSupporter(id) {
    const users = await sql`
      SELECT id, full_name, email, phone, account_status, created_at FROM users
      WHERE id = ${id}::uuid AND role = 'PARENT_CAREGIVER'
    `;
    if (!users.length) throw new ApiError(404, "Child supporter not found.");
    const user = users[0];

    const children = await sql`
      SELECT c.id, c.first_name || ' ' || c.last_name AS child_name, c.date_of_birth::text AS date_of_birth,
             (SELECT fr.relationship_type FROM family_relationships fr
              WHERE fr.child_id = c.id AND fr.user_id = ${id}::uuid LIMIT 1) AS relationship_type,
             (SELECT sw.full_name FROM social_worker_assignments a JOIN users sw ON sw.id = a.social_worker_id
              WHERE a.child_id = c.id AND a.assignment_status = 'ACTIVE' LIMIT 1) AS worker_name
      FROM children c
      WHERE c.id IN (SELECT fr.child_id FROM family_relationships fr WHERE fr.user_id = ${id}::uuid
                     UNION SELECT m.child_id FROM maintenance_arrangements m WHERE m.paying_user_id = ${id}::uuid)
      ORDER BY child_name
    `;
    const arrangements = await sql`
      SELECT m.id, m.child_id, c.first_name || ' ' || c.last_name AS child_name,
             m.paying_user_id, payer.full_name AS payer_name,
             m.receiving_user_id, receiver.full_name AS receiver_name,
             m.expected_amount::text AS expected_amount, m.currency, m.frequency,
             m.start_date::text AS start_date, m.end_date::text AS end_date, m.status, m.notes, m.created_at,
             a.social_worker_id AS worker_id, sw.full_name AS worker_name,
             a.maintenance_arrangement_id AS assignment_arrangement_id
      FROM maintenance_arrangements m
      JOIN children c ON c.id = m.child_id
      JOIN users payer ON payer.id = m.paying_user_id
      JOIN users receiver ON receiver.id = m.receiving_user_id
      LEFT JOIN social_worker_assignments a ON a.child_id = m.child_id AND a.assignment_status = 'ACTIVE'
      LEFT JOIN users sw ON sw.id = a.social_worker_id
      WHERE m.paying_user_id = ${id}::uuid
      ORDER BY m.created_at DESC
    `;
    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone || "",
      accountStatus: user.account_status,
      createdAt: user.created_at,
      children: children.map((row) => ({
        id: row.id,
        fullName: row.child_name,
        dateOfBirth: row.date_of_birth,
        relationship: relationshipLabel(row.relationship_type, "Paying in an arrangement"),
        socialWorker: row.worker_name || null,
      })),
      arrangements: arrangements.map(mapArrangement),
    };
  }

  async function listChildren({ search, pageSize, offset, page }) {
    const rows = await sql`
      SELECT c.id, c.first_name || ' ' || c.last_name AS child_name, c.date_of_birth::text AS date_of_birth, c.created_at,
             (SELECT count(*)::int FROM family_relationships fr WHERE fr.child_id = c.id) AS parents,
             (SELECT count(*)::int FROM maintenance_arrangements m WHERE m.child_id = c.id) AS arrangements,
             (SELECT json_build_object('id', sw.id, 'fullName', sw.full_name)
              FROM social_worker_assignments a JOIN users sw ON sw.id = a.social_worker_id
              WHERE a.child_id = c.id AND a.assignment_status = 'ACTIVE' LIMIT 1) AS social_worker,
             count(*) OVER ()::int AS total
      FROM children c
      WHERE (${search}::text IS NULL
             OR (c.first_name || ' ' || c.last_name) ILIKE ${search} ESCAPE '!'
             OR EXISTS (SELECT 1 FROM family_relationships fr JOIN users p ON p.id = fr.user_id
                        WHERE fr.child_id = c.id AND (p.full_name ILIKE ${search} ESCAPE '!'
                                                      OR p.email ILIKE ${search} ESCAPE '!')))
      ORDER BY c.created_at DESC, c.id
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    return {
      items: rows.map((row) => {
        const worker = parseJson(row.social_worker);
        return {
          id: row.id,
          fullName: row.child_name,
          dateOfBirth: row.date_of_birth,
          parents: row.parents,
          arrangements: row.arrangements,
          socialWorker: worker && worker.id ? { id: worker.id, fullName: worker.fullName } : null,
          createdAt: row.created_at,
        };
      }),
      ...pageResult(rows, { page, pageSize }),
    };
  }

  async function getChild(id) {
    const children = await sql`
      SELECT id, first_name, last_name, date_of_birth::text AS date_of_birth, created_at FROM children
      WHERE id = ${id}::uuid
    `;
    if (!children.length) throw new ApiError(404, "Child not found.");
    const child = children[0];

    const parents = await sql`
      SELECT p.id, p.full_name, p.email, p.phone, fr.relationship_type, fr.is_primary_caregiver
      FROM family_relationships fr JOIN users p ON p.id = fr.user_id
      WHERE fr.child_id = ${id}::uuid
      ORDER BY fr.created_at
    `;
    const arrangements = await sql`
      SELECT m.id, m.child_id, c.first_name || ' ' || c.last_name AS child_name,
             m.paying_user_id, payer.full_name AS payer_name,
             m.receiving_user_id, receiver.full_name AS receiver_name,
             m.expected_amount::text AS expected_amount, m.currency, m.frequency,
             m.start_date::text AS start_date, m.end_date::text AS end_date, m.status, m.notes, m.created_at,
             a.social_worker_id AS worker_id, sw.full_name AS worker_name,
             a.maintenance_arrangement_id AS assignment_arrangement_id
      FROM maintenance_arrangements m
      JOIN children c ON c.id = m.child_id
      JOIN users payer ON payer.id = m.paying_user_id
      JOIN users receiver ON receiver.id = m.receiving_user_id
      LEFT JOIN social_worker_assignments a ON a.child_id = m.child_id AND a.assignment_status = 'ACTIVE'
      LEFT JOIN users sw ON sw.id = a.social_worker_id
      WHERE m.child_id = ${id}::uuid
      ORDER BY m.created_at DESC
    `;
    const history = (await assignmentService.list({ childId: id })).items;
    return {
      id: child.id,
      fullName: `${child.first_name} ${child.last_name}`,
      dateOfBirth: child.date_of_birth,
      createdAt: child.created_at,
      parents: parents.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone || "",
        relationship: relationshipLabel(row.relationship_type, "Caregiver"),
        isPrimaryCaregiver: row.is_primary_caregiver,
      })),
      arrangements: arrangements.map(mapArrangement),
      currentAssignment: history.find((item) => item.status === "ACTIVE") || null,
      assignmentHistory: history,
    };
  }

  async function listArrangements({ search, status, pageSize, offset, page }) {
    const rows = await sql`
      SELECT m.id, m.child_id, c.first_name || ' ' || c.last_name AS child_name,
             m.paying_user_id, payer.full_name AS payer_name,
             m.receiving_user_id, receiver.full_name AS receiver_name,
             m.expected_amount::text AS expected_amount, m.currency, m.frequency,
             m.start_date::text AS start_date, m.end_date::text AS end_date, m.status, m.notes, m.created_at,
             a.social_worker_id AS worker_id, sw.full_name AS worker_name,
             a.maintenance_arrangement_id AS assignment_arrangement_id,
             count(*) OVER ()::int AS total
      FROM maintenance_arrangements m
      JOIN children c ON c.id = m.child_id
      JOIN users payer ON payer.id = m.paying_user_id
      JOIN users receiver ON receiver.id = m.receiving_user_id
      LEFT JOIN social_worker_assignments a ON a.child_id = m.child_id AND a.assignment_status = 'ACTIVE'
      LEFT JOIN users sw ON sw.id = a.social_worker_id
      WHERE (${status}::text IS NULL OR m.status = ${status})
        AND (${search}::text IS NULL
             OR (c.first_name || ' ' || c.last_name) ILIKE ${search} ESCAPE '!'
             OR payer.full_name ILIKE ${search} ESCAPE '!'
             OR receiver.full_name ILIKE ${search} ESCAPE '!')
      ORDER BY m.created_at DESC, m.id
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    return { items: rows.map(mapArrangement), ...pageResult(rows, { page, pageSize }) };
  }

  async function getArrangement(id) {
    const rows = await sql`
      SELECT m.id, m.child_id, c.first_name || ' ' || c.last_name AS child_name,
             m.paying_user_id, payer.full_name AS payer_name,
             m.receiving_user_id, receiver.full_name AS receiver_name,
             m.expected_amount::text AS expected_amount, m.currency, m.frequency,
             m.start_date::text AS start_date, m.end_date::text AS end_date, m.status, m.notes, m.created_at,
             a.id AS assignment_id, a.social_worker_id AS worker_id, sw.full_name AS worker_name,
             a.maintenance_arrangement_id AS assignment_arrangement_id
      FROM maintenance_arrangements m
      JOIN children c ON c.id = m.child_id
      JOIN users payer ON payer.id = m.paying_user_id
      JOIN users receiver ON receiver.id = m.receiving_user_id
      LEFT JOIN social_worker_assignments a ON a.child_id = m.child_id AND a.assignment_status = 'ACTIVE'
      LEFT JOIN users sw ON sw.id = a.social_worker_id
      WHERE m.id = ${id}::uuid
    `;
    if (!rows.length) throw new ApiError(404, "Maintenance arrangement not found.");
    // Payments are only summarised here: assigning a social worker never changes them.
    const payments = await sql`
      SELECT status, count(*)::int AS payments, COALESCE(sum(amount), 0)::text AS total_amount
      FROM payments WHERE arrangement_id = ${id}::uuid GROUP BY status ORDER BY status
    `;
    return {
      ...mapArrangement(rows[0]),
      assignmentId: rows[0].assignment_id || null,
      paymentSummary: payments.map((row) => ({
        status: PAYMENT_STATUS_LABELS[row.status],
        payments: row.payments,
        totalAmount: Number(row.total_amount),
      })),
    };
  }

  async function reports() {
    const caseload = await sql`
      SELECT u.id, u.full_name, u.account_status,
             count(a.id) FILTER (WHERE a.assignment_status = 'ACTIVE')::int AS active_cases,
             count(a.id)::int AS total_cases
      FROM users u
      LEFT JOIN social_worker_assignments a ON a.social_worker_id = u.id
      WHERE u.role = 'SOCIAL_WORKER'
      GROUP BY u.id ORDER BY active_cases DESC, u.full_name
    `;
    const arrangements = await sql`
      SELECT status, count(*)::int AS arrangements FROM maintenance_arrangements GROUP BY status ORDER BY status
    `;
    const payments = await sql`
      SELECT status, count(*)::int AS payments, COALESCE(sum(amount), 0)::text AS total_amount
      FROM payments GROUP BY status ORDER BY status
    `;
    const unassigned = await sql`
      SELECT c.id, c.first_name || ' ' || c.last_name AS child_name, c.created_at
      FROM children c
      WHERE NOT EXISTS (SELECT 1 FROM social_worker_assignments a
                        WHERE a.child_id = c.id AND a.assignment_status = 'ACTIVE')
      ORDER BY c.created_at DESC LIMIT 50
    `;
    return {
      caseload: caseload.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        accountStatus: row.account_status,
        activeCases: row.active_cases,
        totalCases: row.total_cases,
      })),
      arrangementsByStatus: arrangements.map((row) => ({
        status: ARRANGEMENT_STATUS_LABELS[row.status], arrangements: row.arrangements,
      })),
      paymentsByStatus: payments.map((row) => ({
        status: PAYMENT_STATUS_LABELS[row.status], payments: row.payments, totalAmount: Number(row.total_amount),
      })),
      unassignedChildren: unassigned.map((row) => ({ id: row.id, fullName: row.child_name, createdAt: row.created_at })),
    };
  }

  return {
    getArrangement, getChild, getChildSupporter, listArrangements, listChildSupporters,
    listChildren, reports, stats,
  };
}

module.exports = { createAdminDirectoryService };

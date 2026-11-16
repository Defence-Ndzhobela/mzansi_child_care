const crypto = require("node:crypto");
const { ApiError } = require("../utils/apiResponse");
const { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } = require("../utils/maintenanceLabels");
const { buildDashboardSummary } = require("../utils/paymentSummary");

const MONTH_TIME_ZONE = "Africa/Johannesburg";

function parseJsonList(value) {
  if (typeof value === "string") return JSON.parse(value);
  return value || [];
}

function mapPaymentRow(row) {
  const disputed = row.decision === "DISPUTED";
  return {
    id: row.id,
    arrangementId: row.arrangement_id,
    childId: row.child_id,
    payingUserId: row.paying_user_id,
    receivingUserId: row.receiving_user_id,
    payerName: row.payer_name,
    receiverName: row.receiver_name,
    amount: Number(row.amount),
    confirmedAmount: row.confirmed_amount === null ? undefined : Number(row.confirmed_amount),
    currency: "ZAR",
    paymentDate: row.payment_date,
    paymentMethod: PAYMENT_METHOD_LABELS[row.payment_method],
    paymentReference: row.payment_reference || "",
    status: PAYMENT_STATUS_LABELS[row.status],
    disputeReason: disputed ? row.decision_note : undefined,
    recipientNote: row.decision && !disputed ? row.decision_note || undefined : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidence: parseJsonList(row.evidence).map((item) => ({
      id: item.id,
      paymentId: row.id,
      uploadedBy: item.uploadedBy,
      fileName: item.fileName,
      fileType: item.fileType || "",
      fileSizeLabel: item.fileSizeLabel || "",
      description: item.description || "",
      uploadedAt: item.uploadedAt,
    })),
  };
}

function currentMonth() {
  return new Date().toLocaleDateString("en-CA", { timeZone: MONTH_TIME_ZONE }).slice(0, 7);
}

function createPaymentService({ sql, arrangementService }) {
  // Parents see only payments they made or received. Social workers see only active assignments.
  async function listPayments(user, { paymentId = null } = {}) {
    const rows = await sql`
      SELECT p.id, p.arrangement_id, p.child_id, p.paying_user_id, p.receiving_user_id,
             p.amount::text AS amount, p.confirmed_amount::text AS confirmed_amount,
             to_char(p.payment_date, 'YYYY-MM-DD') AS payment_date,
             p.payment_method, p.payment_reference, p.status, p.created_at, p.updated_at,
             payer.full_name AS payer_name, receiver.full_name AS receiver_name,
             pc.decision, pc.note AS decision_note,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', e.id, 'uploadedBy', e.uploaded_by, 'fileName', e.file_name,
                 'fileType', e.file_type, 'fileSizeLabel', e.file_size_label,
                 'description', e.description, 'uploadedAt', e.uploaded_at
               ) ORDER BY e.uploaded_at)
               FROM payment_evidence e WHERE e.payment_id = p.id
             ), '[]'::json) AS evidence
      FROM payments p
      JOIN users payer ON payer.id = p.paying_user_id
      JOIN users receiver ON receiver.id = p.receiving_user_id
      LEFT JOIN payment_confirmations pc ON pc.payment_id = p.id
      WHERE (
        (${user.role} = 'PARENT_CAREGIVER'
          AND (p.paying_user_id = ${user.id}::uuid OR p.receiving_user_id = ${user.id}::uuid))
        OR (${user.role} = 'SOCIAL_WORKER' AND EXISTS (
          SELECT 1 FROM social_worker_assignments sw
          WHERE sw.child_id = p.child_id AND sw.social_worker_id = ${user.id}::uuid
            AND sw.assignment_status = 'ACTIVE'
        ))
      ) AND (${paymentId}::uuid IS NULL OR p.id = ${paymentId}::uuid)
      ORDER BY p.payment_date DESC, p.created_at DESC
    `;
    return rows.map(mapPaymentRow);
  }

  // Describes why a payment action matched no row. Callers who are not a party to the
  // record get a plain "not found", so other families' records are never confirmed to exist.
  async function findPaymentParties(userId, paymentId) {
    const rows = await sql`
      SELECT paying_user_id, receiving_user_id, status, amount::text AS amount
      FROM payments WHERE id = ${paymentId}::uuid
    `;
    const payment = rows[0];
    if (!payment || (payment.paying_user_id !== userId && payment.receiving_user_id !== userId)) {
      throw new ApiError(404, "Payment not found.");
    }
    return payment;
  }

  // The paying and receiving users, child and status are copied from the arrangement row.
  // The WHERE clause only matches when the caller is that arrangement's paying parent.
  async function recordPayment(user, input) {
    const reference = input.paymentReference || `REF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const evidence = input.evidence;
    const rows = await sql`
      WITH new_payment AS (
        INSERT INTO payments (
          arrangement_id, child_id, paying_user_id, receiving_user_id, amount,
          payment_date, payment_method, payment_reference, status
        )
        SELECT a.id, a.child_id, a.paying_user_id, a.receiving_user_id, ${input.amount}::numeric,
               ${input.paymentDate}::date, ${input.paymentMethod}, ${reference}, 'AWAITING_CONFIRMATION'
        FROM maintenance_arrangements a
        WHERE a.id = ${input.arrangementId}::uuid
          AND a.paying_user_id = ${user.id}::uuid
          AND a.status = 'ACTIVE'
        RETURNING id
      ), new_evidence AS (
        INSERT INTO payment_evidence (
          payment_id, uploaded_by, file_name, storage_key, file_type, file_size_label, description
        )
        SELECT id, ${user.id}::uuid, ${evidence?.fileName ?? null},
               'metadata-only/' || id::text || '/' || ${evidence?.fileName ?? null},
               ${evidence?.fileType ?? null}, ${evidence?.fileSizeLabel ?? null}, ${evidence?.description ?? null}
        FROM new_payment
        WHERE ${Boolean(evidence)}::boolean
        RETURNING id
      )
      SELECT id FROM new_payment
    `;
    if (!rows.length) {
      const arrangement = (await sql`
        SELECT paying_user_id, receiving_user_id, status
        FROM maintenance_arrangements WHERE id = ${input.arrangementId}::uuid
      `)[0];
      const isParty = arrangement &&
        (arrangement.paying_user_id === user.id || arrangement.receiving_user_id === user.id);
      if (!isParty) throw new ApiError(404, "Maintenance arrangement not found.");
      if (arrangement.paying_user_id !== user.id) {
        throw new ApiError(403, "Only the paying parent can record a payment for this arrangement.");
      }
      throw new ApiError(409, "Payments can only be recorded against an active arrangement.");
    }
    return (await listPayments(user, { paymentId: rows[0].id }))[0];
  }

  // Only the paying parent of the payment can attach evidence to it.
  async function addEvidence(user, { paymentId, evidence }) {
    const rows = await sql`
      INSERT INTO payment_evidence (
        payment_id, uploaded_by, file_name, storage_key, file_type, file_size_label, description
      )
      SELECT p.id, ${user.id}::uuid, ${evidence.fileName},
             'metadata-only/' || p.id::text || '/' || ${evidence.fileName},
             ${evidence.fileType}, ${evidence.fileSizeLabel}, ${evidence.description}
      FROM payments p
      WHERE p.id = ${paymentId}::uuid AND p.paying_user_id = ${user.id}::uuid
      RETURNING id
    `;
    if (!rows.length) {
      await findPaymentParties(user.id, paymentId);
      throw new ApiError(403, "Only the paying parent can attach evidence to this payment.");
    }
    return (await listPayments(user, { paymentId }))[0];
  }

  // The decision, the new payment status and the stored confirmation are written by one
  // statement. It only matches when the caller is the payment's receiving parent and the
  // payment is still waiting, so a payment can be decided once and never by its payer.
  async function respondToPayment(user, { paymentId, action, confirmedAmount, note }) {
    const decision = { CONFIRM_FULL: "CONFIRMED_FULL", CONFIRM_PARTIAL: "CONFIRMED_PARTIAL", DISPUTE: "DISPUTED" }[action];
    const status = {
      CONFIRM_FULL: "CONFIRMED_BY_RECIPIENT",
      CONFIRM_PARTIAL: "PARTIALLY_CONFIRMED",
      DISPUTE: "DISPUTED",
    }[action];
    const rows = await sql`
      WITH target AS (
        SELECT p.id, p.amount FROM payments p
        WHERE p.id = ${paymentId}::uuid
          AND p.receiving_user_id = ${user.id}::uuid
          AND p.status IN ('AWAITING_CONFIRMATION', 'SUBMITTED')
          AND (${action} <> 'CONFIRM_PARTIAL'
               OR (${confirmedAmount}::numeric > 0 AND ${confirmedAmount}::numeric < p.amount))
        FOR UPDATE
      ), updated AS (
        UPDATE payments p
        SET status = ${status},
            confirmed_amount = CASE ${action}
              WHEN 'CONFIRM_FULL' THEN target.amount
              WHEN 'CONFIRM_PARTIAL' THEN ${confirmedAmount}::numeric
              ELSE 0 END,
            updated_at = NOW()
        FROM target
        WHERE p.id = target.id
        RETURNING p.id, p.confirmed_amount
      ), decided AS (
        INSERT INTO payment_confirmations (payment_id, decided_by, decision, confirmed_amount, note)
        SELECT id, ${user.id}::uuid, ${decision}, confirmed_amount, ${note}
        FROM updated
        RETURNING payment_id
      )
      SELECT payment_id FROM decided
    `;
    if (!rows.length) {
      const payment = await findPaymentParties(user.id, paymentId);
      if (payment.paying_user_id === user.id) {
        throw new ApiError(403, "Only the receiving parent can confirm or dispute this payment.");
      }
      if (!["AWAITING_CONFIRMATION", "SUBMITTED"].includes(payment.status)) {
        throw new ApiError(409, "This payment has already been confirmed or disputed.");
      }
      throw new ApiError(400, "The partial amount must be more than R 0.00 and less than the recorded amount.");
    }
    return (await listPayments(user, { paymentId }))[0];
  }

  async function getDashboardSummary(user, { month }) {
    const summaryMonth = month || currentMonth();
    const [arrangements, payments] = await Promise.all([
      arrangementService.listArrangements(user),
      listPayments(user),
    ]);
    return buildDashboardSummary({ userId: user.id, month: summaryMonth, arrangements, payments });
  }

  return { addEvidence, getDashboardSummary, listPayments, recordPayment, respondToPayment };
}

module.exports = { createPaymentService };

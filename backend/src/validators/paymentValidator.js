const { ApiError } = require("../utils/apiResponse");
const { PAYMENT_METHOD_LABELS } = require("../utils/maintenanceLabels");
const { parseAmount } = require("../utils/money");
const {
  hasControlCharacters, hasOnlyAllowedKeys, isIsoDate, isPlainText, isUuid,
} = require("../utils/validationHelpers");

const RECORD_KEYS = ["arrangementId", "amount", "paymentDate", "paymentMethod", "paymentReference", "evidence"];
const EVIDENCE_KEYS = ["fileName", "fileType", "fileSizeLabel", "description"];
const CONFIRMATION_KEYS = ["action", "confirmedAmount", "note"];
const ACTIONS = ["CONFIRM_FULL", "CONFIRM_PARTIAL", "DISPUTE"];
const EVIDENCE_TYPE = /^(image\/[a-z0-9.+-]{1,40}|application\/pdf)$/i;
const BAD_REQUEST = "Check the payment details and try again.";

function dayOffsetIso(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

// Returns the cleaned evidence metadata, or null when it is invalid. File contents are never accepted.
function parseEvidence(value) {
  if (!hasOnlyAllowedKeys(value, EVIDENCE_KEYS)) return null;
  const { fileName, fileType, fileSizeLabel } = value;
  const description = value.description ?? "";
  const safeName = typeof fileName === "string" ? fileName.replace(/[\\/]/g, "_").trim() : "";
  if (!safeName || safeName.length > 255 || hasControlCharacters(safeName)) return null;
  if (typeof fileType !== "string" || !EVIDENCE_TYPE.test(fileType)) return null;
  if (typeof fileSizeLabel !== "string" || fileSizeLabel.length > 30 || hasControlCharacters(fileSizeLabel)) return null;
  if (!isPlainText(description, 500)) return null;
  return { fileName: safeName, fileType: fileType.toLowerCase(), fileSizeLabel, description: description.trim() || null };
}

// The client chooses only the arrangement and payment details. Who pays and who receives is
// always read from the stored arrangement, so those fields are rejected if sent.
function validateRecordPayment(req, _res, next) {
  const body = req.body;
  if (!hasOnlyAllowedKeys(body, RECORD_KEYS)) return next(new ApiError(400, BAD_REQUEST));
  if (!isUuid(body.arrangementId)) return next(new ApiError(400, "Choose a valid maintenance arrangement."));
  const amount = parseAmount(body.amount);
  if (amount === null) return next(new ApiError(400, "Enter a valid payment amount greater than R 0.00."));
  if (!isIsoDate(body.paymentDate) || body.paymentDate > dayOffsetIso(1)) {
    return next(new ApiError(400, "Enter a valid payment date that is not in the future."));
  }
  if (typeof body.paymentMethod !== "string" || !Object.hasOwn(PAYMENT_METHOD_LABELS, body.paymentMethod)) {
    return next(new ApiError(400, "Choose a valid payment method."));
  }
  const reference = body.paymentReference ?? "";
  if (typeof reference !== "string" || reference.trim().length > 120 || hasControlCharacters(reference)) {
    return next(new ApiError(400, "The payment reference must be plain text of up to 120 characters."));
  }
  let evidence = null;
  if (body.evidence !== undefined && body.evidence !== null) {
    evidence = parseEvidence(body.evidence);
    if (!evidence) return next(new ApiError(400, "The evidence details are not valid."));
  }

  req.validated = {
    arrangementId: body.arrangementId,
    amount,
    paymentDate: body.paymentDate,
    paymentMethod: body.paymentMethod,
    paymentReference: reference.trim(),
    evidence,
  };
  return next();
}

function validateAddEvidence(req, _res, next) {
  if (!isUuid(req.params.paymentId)) return next(new ApiError(404, "Payment not found."));
  const evidence = parseEvidence(req.body);
  if (!evidence) return next(new ApiError(400, "The evidence details are not valid."));
  req.validated = { paymentId: req.params.paymentId, evidence };
  return next();
}

function validateConfirmation(req, _res, next) {
  if (!isUuid(req.params.paymentId)) return next(new ApiError(404, "Payment not found."));
  const body = req.body;
  if (!hasOnlyAllowedKeys(body, CONFIRMATION_KEYS) || !ACTIONS.includes(body.action)) {
    return next(new ApiError(400, "Choose to confirm, partially confirm or dispute this payment."));
  }
  const note = body.note ?? "";
  if (!isPlainText(note, 1000)) return next(new ApiError(400, "The note must be plain text of up to 1000 characters."));

  let confirmedAmount = null;
  if (body.action === "CONFIRM_PARTIAL") {
    confirmedAmount = parseAmount(body.confirmedAmount);
    if (confirmedAmount === null) {
      return next(new ApiError(400, "Enter the partial amount received, greater than R 0.00."));
    }
  } else if (body.confirmedAmount !== undefined) {
    return next(new ApiError(400, "A confirmed amount can only be given when partially confirming."));
  }
  if (body.action === "DISPUTE" && !note.trim()) {
    return next(new ApiError(400, "Please provide a clear reason for disputing this payment."));
  }

  req.validated = {
    paymentId: req.params.paymentId,
    action: body.action,
    confirmedAmount,
    note: note.trim() || null,
  };
  return next();
}

function validateDashboardMonth(req, _res, next) {
  const { month } = req.query;
  if (month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) {
    return next(new ApiError(400, "Choose a valid month such as 2026-11."));
  }
  req.validated = { month: month === undefined ? null : String(month) };
  return next();
}

module.exports = { validateAddEvidence, validateConfirmation, validateDashboardMonth, validateRecordPayment };

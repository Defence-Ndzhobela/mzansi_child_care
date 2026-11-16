const { ApiError } = require("../utils/apiResponse");
const { EDITABLE_ARRANGEMENT_STATUSES, FREQUENCY_LABELS } = require("../utils/maintenanceLabels");
const { parseAmount } = require("../utils/money");
const { hasOnlyAllowedKeys, isIsoDate, isPlainText, isUuid } = require("../utils/validationHelpers");

const ROLES = ["PAYING", "RECEIVING"];
const CREATE_KEYS = ["childId", "myRole", "otherUserId", "expectedAmount", "frequency", "startDate", "endDate", "notes"];
const UPDATE_KEYS = ["expectedAmount", "frequency", "startDate", "endDate", "status", "notes"];
const BAD_REQUEST = "Check the arrangement details and try again.";

function upperCode(value) {
  return typeof value === "string" ? value.trim().replace(/[\s-]+/g, "_").toUpperCase() : null;
}

// Validates the fields shared by create and update. Returns an error message or the parsed values.
function parseTerms(body) {
  const expectedAmount = parseAmount(body.expectedAmount);
  const frequency = upperCode(body.frequency);
  const endDate = body.endDate === undefined || body.endDate === null || body.endDate === ""
    ? null : body.endDate;
  const notes = body.notes === undefined || body.notes === null ? "" : body.notes;

  if (expectedAmount === null) return { error: "Expected amount must be a positive amount in rand (maximum R 1,000,000)." };
  if (!Object.hasOwn(FREQUENCY_LABELS, frequency)) return { error: "Choose a valid frequency." };
  if (!isIsoDate(body.startDate)) return { error: "Enter a valid start date." };
  if (endDate !== null && (!isIsoDate(endDate) || endDate < body.startDate)) {
    return { error: "The end date must be a valid date on or after the start date." };
  }
  if (!isPlainText(notes, 500)) return { error: "Notes must be plain text of up to 500 characters." };

  return {
    terms: { expectedAmount, frequency, startDate: body.startDate, endDate, notes: notes.trim() || null },
  };
}

function validateCreateArrangement(req, _res, next) {
  const body = req.body;
  if (!hasOnlyAllowedKeys(body, CREATE_KEYS)) return next(new ApiError(400, BAD_REQUEST));
  if (!isUuid(body.childId) || !isUuid(body.otherUserId) || !ROLES.includes(body.myRole)) {
    return next(new ApiError(400, "Choose a child, your role and the other parent or caregiver."));
  }
  const { error, terms } = parseTerms(body);
  if (error) return next(new ApiError(400, error));

  req.validated = {
    childId: body.childId,
    myRole: body.myRole,
    otherUserId: body.otherUserId,
    ...terms,
  };
  return next();
}

function validateUpdateArrangement(req, _res, next) {
  if (!isUuid(req.params.arrangementId)) return next(new ApiError(404, "Maintenance arrangement not found."));
  const body = req.body;
  if (!hasOnlyAllowedKeys(body, UPDATE_KEYS)) return next(new ApiError(400, BAD_REQUEST));
  const status = upperCode(body.status);
  if (!EDITABLE_ARRANGEMENT_STATUSES.includes(status)) return next(new ApiError(400, "Choose a valid status."));
  const { error, terms } = parseTerms(body);
  if (error) return next(new ApiError(400, error));

  req.validated = { arrangementId: req.params.arrangementId, status, ...terms };
  return next();
}

module.exports = { validateCreateArrangement, validateUpdateArrangement };

const { ApiError } = require("../utils/apiResponse");
const { normalizeSouthAfricanId } = require("../utils/encryptIdNumber");
const { normalizeRelationshipType } = require("../utils/relationshipTypes");
const { hasControlCharacters, isUuid } = require("../utils/validationHelpers");
const { SELECT_WORKER, isSocialWorkerId } = require("./assignmentValidator");

function isValidName(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 &&
    value.trim().length <= maxLength && !hasControlCharacters(value);
}

function isValidDateOfBirth(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10);
}

function validateCreateChild(req, _res, next) {
  const { firstName, lastName, dateOfBirth, southAfricanId, relationshipType, isPrimaryCaregiver, socialWorkerId } = req.body || {};
  if (!isValidName(firstName, 100) || !isValidName(lastName, 100)) {
    return next(new ApiError(400, "Enter a valid first and last name."));
  }
  if (!isValidDateOfBirth(dateOfBirth)) {
    return next(new ApiError(400, "Enter a valid date of birth that is not in the future."));
  }
  const idNumber = normalizeSouthAfricanId(southAfricanId);
  if (!idNumber) {
    return next(new ApiError(400, "Enter a valid 13-digit South African ID number."));
  }
  const relationship = normalizeRelationshipType(relationshipType);
  if (!relationship || typeof isPrimaryCaregiver !== "boolean") {
    return next(new ApiError(400, "Choose a valid relationship and caregiver status."));
  }
  if (!isSocialWorkerId(socialWorkerId)) {
    return next(new ApiError(400, SELECT_WORKER));
  }

  req.validated = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    dateOfBirth,
    idNumber,
    relationship,
    isPrimaryCaregiver,
    socialWorkerId,
  };
  return next();
}

function validateUpdateChild(req, _res, next) {
  if (!isUuid(req.params.childId)) {
    return next(new ApiError(404, "Child profile not found."));
  }
  const { firstName, lastName, dateOfBirth } = req.body || {};
  if (!isValidName(firstName, 100) || !isValidName(lastName, 100) ||
      !isValidDateOfBirth(dateOfBirth)) {
    return next(new ApiError(400, "Enter a valid name and date of birth."));
  }
  req.validated = {
    childId: req.params.childId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    dateOfBirth,
  };
  return next();
}

module.exports = { validateCreateChild, validateUpdateChild };

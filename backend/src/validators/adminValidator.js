const { ApiError } = require("../utils/apiResponse");
const { normalizeRelationshipType } = require("../utils/relationshipTypes");
const { hasControlCharacters, hasOnlyAllowedKeys, isUuid } = require("../utils/validationHelpers");
const { isValidDateOfBirth, isValidName } = require("./childValidator");

const MAX_BCRYPT_BYTES = 72;
const WORKER_STATUSES = ["ACTIVE", "INACTIVE"];
const ASSIGNMENT_STATUSES = ["ACTIVE", "CLOSED", "TRANSFERRED"];
const ARRANGEMENT_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];
const REGISTRATION_NUMBER = /^[A-Za-z0-9][A-Za-z0-9 /.-]{1,48}[A-Za-z0-9]$/;

function validateId(req, _res, next) {
  if (!isUuid(req.params.id)) return next(new ApiError(404, "Record not found."));
  req.validated = { ...req.validated, id: req.params.id };
  return next();
}

// Returns the cleaned social worker fields, or an error message. The role is never read from the
// request: administrators can only create SOCIAL_WORKER accounts through these endpoints.
function parseWorkerFields(body, { requirePassword }) {
  const allowed = ["fullName", "email", "phone", "registrationNumber", "accountStatus"];
  if (requirePassword) allowed.push("password");
  if (!hasOnlyAllowedKeys(body, allowed)) return { error: "The request contains fields that are not allowed." };

  const { fullName, email, phone, accountStatus } = body;
  const registrationNumber = body.registrationNumber === undefined || body.registrationNumber === null
    ? "" : body.registrationNumber;

  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 150 ||
      hasControlCharacters(fullName)) {
    return { error: "Enter a valid full name (up to 150 characters)." };
  }
  if (typeof email !== "string" || email.trim().length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { error: "Enter a valid email address." };
  }
  if (typeof phone !== "string" || phone.trim().length > 30 || !/^\+?[0-9 ()-]{7,30}$/.test(phone.trim()) ||
      (phone.match(/[0-9]/g) || []).length < 7) {
    return { error: "Enter a valid phone number." };
  }
  if (typeof registrationNumber !== "string" ||
      (registrationNumber.trim() && !REGISTRATION_NUMBER.test(registrationNumber.trim()))) {
    return { error: "The registration number may only contain letters, numbers, spaces, / . and - (3 to 50 characters)." };
  }
  if (!WORKER_STATUSES.includes(accountStatus)) return { error: "Choose Active or Inactive for the account status." };

  const fields = {
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    registrationNumber: registrationNumber.trim() || null,
    accountStatus,
  };
  if (requirePassword) {
    const { password } = body;
    if (typeof password !== "string" || password.length < 10 || Buffer.byteLength(password) > MAX_BCRYPT_BYTES ||
        !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { error: "Password must be at least 10 characters and include uppercase, lowercase and a number (maximum 72 bytes)." };
    }
    fields.password = password;
  }
  return { fields };
}

function validateCreateSocialWorker(req, _res, next) {
  const { error, fields } = parseWorkerFields(req.body, { requirePassword: true });
  if (error) return next(new ApiError(400, error));
  req.validated = fields;
  return next();
}

function validateUpdateSocialWorker(req, _res, next) {
  if (!isUuid(req.params.id)) return next(new ApiError(404, "Social worker not found."));
  const { error, fields } = parseWorkerFields(req.body, { requirePassword: false });
  if (error) return next(new ApiError(400, error));
  req.validated = { id: req.params.id, ...fields };
  return next();
}

function validateCreateAssignment(req, _res, next) {
  const { body } = req;
  if (!hasOnlyAllowedKeys(body, ["socialWorkerId", "childId", "arrangementId"]) ||
      !isUuid(body.socialWorkerId) || !isUuid(body.childId) || !isUuid(body.arrangementId)) {
    return next(new ApiError(400, "Select a social worker, a child and one of the child's maintenance arrangements."));
  }
  req.validated = { socialWorkerId: body.socialWorkerId, childId: body.childId, arrangementId: body.arrangementId };
  return next();
}

function validateReassignment(req, _res, next) {
  if (!isUuid(req.params.id)) return next(new ApiError(404, "Assignment not found."));
  if (!hasOnlyAllowedKeys(req.body, ["socialWorkerId"]) || !isUuid(req.body.socialWorkerId)) {
    return next(new ApiError(400, "Select the social worker to reassign to."));
  }
  req.validated = { id: req.params.id, socialWorkerId: req.body.socialWorkerId };
  return next();
}

// Optional ?status=... filter, limited to a known list so it can never carry other text into a query.
function statusFilter(allowed, message) {
  return (req, _res, next) => {
    const { status } = req.query;
    if (status === undefined || status === "") {
      req.validated = { ...req.validated, status: null };
      return next();
    }
    if (typeof status !== "string" || !allowed.includes(status.toUpperCase())) return next(new ApiError(400, message));
    req.validated = { ...req.validated, status: status.toUpperCase() };
    return next();
  };
}

const validateWorkerStatusFilter = statusFilter(["ACTIVE", "INACTIVE", "SUSPENDED"], "Choose a valid account status.");
const validateAssignmentStatusFilter = statusFilter(ASSIGNMENT_STATUSES, "Choose a valid assignment status.");
const validateArrangementStatusFilter = statusFilter(ARRANGEMENT_STATUSES, "Choose a valid arrangement status.");

// Optional ?socialWorkerId= / ?childId= filters on the assignment list.
function validateAssignmentIdFilters(req, _res, next) {
  const result = {};
  for (const key of ["socialWorkerId", "childId"]) {
    const value = req.query[key];
    if (value === undefined || value === "") {
      result[key] = null;
    } else if (typeof value === "string" && isUuid(value)) {
      result[key] = value;
    } else {
      return next(new ApiError(400, "Filter IDs must be valid."));
    }
  }
  req.validated = { ...req.validated, ...result };
  return next();
}

// Family management. The child comes from the URL; only the listed fields are accepted from the body.
function validateUpdateFamilyChild(req, _res, next) {
  if (!isUuid(req.params.id)) return next(new ApiError(404, "Family not found."));
  const { body } = req;
  if (!hasOnlyAllowedKeys(body, ["firstName", "lastName", "dateOfBirth"]) ||
      !isValidName(body.firstName, 100) || !isValidName(body.lastName, 100) || !isValidDateOfBirth(body.dateOfBirth)) {
    return next(new ApiError(400, "Enter a valid first and last name and a date of birth that is not in the future."));
  }
  req.validated = {
    id: req.params.id, firstName: body.firstName.trim(), lastName: body.lastName.trim(), dateOfBirth: body.dateOfBirth,
  };
  return next();
}

function validateAddFamilyMember(req, _res, next) {
  if (!isUuid(req.params.id)) return next(new ApiError(404, "Family not found."));
  const { body } = req;
  if (!hasOnlyAllowedKeys(body, ["email", "relationshipType", "isPrimaryCaregiver"])) {
    return next(new ApiError(400, "The request contains fields that are not allowed."));
  }
  const relationshipType = normalizeRelationshipType(body.relationshipType);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return next(new ApiError(400, "Enter the email address of the parent's account."));
  }
  if (!relationshipType || typeof body.isPrimaryCaregiver !== "boolean") {
    return next(new ApiError(400, "Choose a valid relationship and caregiver status."));
  }
  req.validated = { id: req.params.id, email, relationshipType, isPrimaryCaregiver: body.isPrimaryCaregiver };
  return next();
}

function validateFamilyMemberIds(req, _res, next) {
  if (!isUuid(req.params.id) || !isUuid(req.params.relationshipId)) {
    return next(new ApiError(404, "Family member not found."));
  }
  req.validated = { id: req.params.id, relationshipId: req.params.relationshipId };
  return next();
}

function validateUpdateFamilyMember(req, res, next) {
  validateFamilyMemberIds(req, res, (error) => {
    if (error) return next(error);
    const { body } = req;
    const relationshipType = hasOnlyAllowedKeys(body, ["relationshipType", "isPrimaryCaregiver"])
      ? normalizeRelationshipType(body.relationshipType) : null;
    if (!relationshipType || typeof body.isPrimaryCaregiver !== "boolean") {
      return next(new ApiError(400, "Choose a valid relationship and caregiver status."));
    }
    req.validated = { ...req.validated, relationshipType, isPrimaryCaregiver: body.isPrimaryCaregiver };
    return next();
  });
}

module.exports = {
  validateAddFamilyMember,
  validateArrangementStatusFilter,
  validateAssignmentIdFilters,
  validateAssignmentStatusFilter,
  validateCreateAssignment,
  validateCreateSocialWorker,
  validateFamilyMemberIds,
  validateId,
  validateReassignment,
  validateUpdateFamilyChild,
  validateUpdateFamilyMember,
  validateUpdateSocialWorker,
  validateWorkerStatusFilter,
};

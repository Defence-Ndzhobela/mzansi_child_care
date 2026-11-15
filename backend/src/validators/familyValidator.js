const { ApiError } = require("../utils/apiResponse");
const { normalizeSouthAfricanId } = require("../utils/encryptIdNumber");
const { normalizeRelationshipType } = require("../utils/relationshipTypes");
const { isUuid } = require("../utils/validationHelpers");

const LINK_DECISIONS = ["APPROVED", "REJECTED"];

function validateLinkRequest(req, _res, next) {
  const idNumber = normalizeSouthAfricanId(req.body?.southAfricanId);
  const relationship = normalizeRelationshipType(req.body?.relationshipType);
  if (!idNumber || !relationship) {
    return next(new ApiError(400, "Enter a valid South African ID and relationship."));
  }
  req.validated = { idNumber, relationship };
  return next();
}

function validateLinkDecision(req, _res, next) {
  if (!isUuid(req.params.requestId) || !LINK_DECISIONS.includes(req.body?.decision)) {
    return next(new ApiError(400, "Choose approve or reject for a valid linking request."));
  }
  req.validated = { requestId: req.params.requestId, decision: req.body.decision };
  return next();
}

module.exports = { validateLinkDecision, validateLinkRequest };

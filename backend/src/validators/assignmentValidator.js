const { ApiError } = require("../utils/apiResponse");
const { hasOnlyAllowedKeys, isUuid } = require("../utils/validationHelpers");

const SELECT_WORKER = "Select an available social worker.";

// Shared by child and arrangement validation: the worker must be a well-formed ID.
function isSocialWorkerId(value) {
  return isUuid(value);
}

function validateAssignSocialWorker(req, _res, next) {
  if (!isUuid(req.params.childId)) return next(new ApiError(404, "Child profile not found."));
  if (!hasOnlyAllowedKeys(req.body, ["socialWorkerId"]) || !isSocialWorkerId(req.body.socialWorkerId)) {
    return next(new ApiError(400, SELECT_WORKER));
  }
  req.validated = { childId: req.params.childId, socialWorkerId: req.body.socialWorkerId };
  return next();
}

module.exports = { SELECT_WORKER, isSocialWorkerId, validateAssignSocialWorker };

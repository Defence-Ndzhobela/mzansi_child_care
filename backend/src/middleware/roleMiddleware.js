const { ApiError } = require("../utils/apiResponse");

// Role checks run on the backend using the role loaded from the database, never a client-supplied one.
function requireRole(role) {
  return (req, _res, next) => {
    if (req.user?.role !== role) return next(new ApiError(403, "Access denied."));
    return next();
  };
}

function requireAnyRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) return next(new ApiError(403, "Access denied."));
    return next();
  };
}

module.exports = { requireAnyRole, requireRole };

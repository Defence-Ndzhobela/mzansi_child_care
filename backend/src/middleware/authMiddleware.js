const { SESSION_COOKIE_NAME } = require("../services/authService");
const { ApiError } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

function extractToken(req) {
  const authorization = req.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  const cookie = (req.get("cookie") || "").split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  return cookie?.slice(SESSION_COOKIE_NAME.length + 1);
}

// Accepts a Bearer token or the HttpOnly session cookie and sets req.user.
function createAuthenticate(authService) {
  return asyncHandler(async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) throw new ApiError(401, "Authentication required.");
    req.user = await authService.authenticateToken(token);
    next();
  });
}

module.exports = { createAuthenticate };

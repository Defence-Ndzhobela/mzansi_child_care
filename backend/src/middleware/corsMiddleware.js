const { sendError } = require("../utils/apiResponse");

const ALLOWED_METHODS = "GET,POST,PATCH,PUT,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Content-Type,Authorization";
const PREFLIGHT_MAX_AGE_SECONDS = "600";

// Exact-match origin allow-list. Requests with no Origin header (same-origin navigations,
// curl, server-to-server) pass through and still need valid authentication. A request
// from any other origin is rejected outright, which also blocks cross-site
// state-changing requests that would otherwise carry the session cookie.
function createCorsMiddleware(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get("origin");
    res.vary("Origin");
    if (!origin) return next();
    if (!allowed.has(origin)) return sendError(res, 403, "Origin not allowed.");

    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
      res.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      res.set("Access-Control-Max-Age", PREFLIGHT_MAX_AGE_SECONDS);
      return res.status(204).end();
    }
    return next();
  };
}

module.exports = { createCorsMiddleware };

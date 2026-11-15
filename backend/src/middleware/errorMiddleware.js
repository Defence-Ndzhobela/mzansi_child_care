const { ApiError, sendError } = require("../utils/apiResponse");

function errorMiddleware(error, _req, res, _next) {
  if (error instanceof ApiError) {
    return sendError(res, error.status, error.message);
  }
  if (error.type === "entity.parse.failed" || error.type === "entity.too.large") {
    return sendError(res, error.status, "Invalid request body.");
  }
  // Details are deliberately not logged or returned: they may contain personal data.
  console.error("Backend request failed.");
  return sendError(res, 500, "Server error. Please try again later.");
}

module.exports = { errorMiddleware };

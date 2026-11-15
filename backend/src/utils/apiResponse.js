// Error that can be safely shown to the client: the message is sent as-is.
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function sendSuccess(res, body, status = 200) {
  return res.status(status).json(body);
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function sendNoContent(res) {
  return res.status(204).end();
}

module.exports = { ApiError, sendError, sendNoContent, sendSuccess };

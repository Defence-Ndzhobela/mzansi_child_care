const { ApiError } = require("../utils/apiResponse");
const { hasOnlyAllowedKeys, isPlainText } = require("../utils/validationHelpers");

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 500;
// The assistant's own earlier replies are sent back for context, so they are allowed to be longer.
const MAX_ASSISTANT_LENGTH = 4000;
const BAD_REQUEST = "Enter a question of up to 500 characters.";

// The body is { messages: [{ role: "user" | "assistant", content }] } and must end with the visitor's
// question. System messages cannot be sent, and no other fields are accepted.
function validateChat(req, _res, next) {
  const { body } = req;
  if (!hasOnlyAllowedKeys(body, ["messages"]) || !Array.isArray(body.messages) ||
      body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
    return next(new ApiError(400, BAD_REQUEST));
  }
  const messages = [];
  for (const item of body.messages) {
    const limit = item?.role === "assistant" ? MAX_ASSISTANT_LENGTH : MAX_MESSAGE_LENGTH;
    if (!hasOnlyAllowedKeys(item, ["role", "content"]) || !["user", "assistant"].includes(item.role) ||
        typeof item.content !== "string" || !isPlainText(item.content, limit) ||
        !item.content.trim()) {
      return next(new ApiError(400, BAD_REQUEST));
    }
    messages.push({ role: item.role, content: item.content.trim() });
  }
  if (messages[messages.length - 1].role !== "user") return next(new ApiError(400, BAD_REQUEST));
  req.validated = { messages };
  return next();
}

module.exports = { MAX_MESSAGES, MAX_MESSAGE_LENGTH, validateChat };

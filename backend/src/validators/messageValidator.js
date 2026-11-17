const { ApiError } = require("../utils/apiResponse");
const { hasOnlyAllowedKeys, isPlainText, isUuid } = require("../utils/validationHelpers");

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SEARCH_LENGTH = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const NOT_FOUND = "Conversation not found.";

function validateConversationId(req, _res, next) {
  if (!isUuid(req.params.conversationId)) return next(new ApiError(404, NOT_FOUND));
  return next();
}

function validateMessageId(req, _res, next) {
  if (!isUuid(req.params.messageId)) return next(new ApiError(404, "Message not found."));
  return next();
}

// Only the child (and optionally an arrangement) is chosen by the client. Who the social worker is comes
// from the child's active assignment, and the sender is always the authenticated user.
function validateStartConversation(req, _res, next) {
  const body = req.body;
  if (!hasOnlyAllowedKeys(body, ["childId", "parentUserId", "arrangementId"])) {
    return next(new ApiError(400, "Choose a child to start a conversation about."));
  }
  const optionalUuid = (value) => value === undefined || value === null || value === "" || isUuid(value);
  if (!isUuid(body.childId) || !optionalUuid(body.parentUserId) || !optionalUuid(body.arrangementId)) {
    return next(new ApiError(400, "Choose a child to start a conversation about."));
  }
  const parentUserId = body.parentUserId || null;
  if (req.user.role === "SOCIAL_WORKER" && !parentUserId) {
    return next(new ApiError(400, "Choose the parent you want to message."));
  }
  if (req.user.role === "PARENT_CAREGIVER" && parentUserId && parentUserId !== req.user.id) {
    return next(new ApiError(400, "Choose a child to start a conversation about."));
  }
  req.validated = { childId: body.childId, parentUserId, arrangementId: body.arrangementId || null };
  return next();
}

function validateSendMessage(req, _res, next) {
  if (!isUuid(req.params.conversationId)) return next(new ApiError(404, NOT_FOUND));
  if (!hasOnlyAllowedKeys(req.body, ["message"]) || typeof req.body.message !== "string") {
    return next(new ApiError(400, "Enter a message to send."));
  }
  const message = req.body.message.trim();
  if (!message) return next(new ApiError(400, "A message cannot be empty."));
  if (!isPlainText(message, MAX_MESSAGE_LENGTH)) {
    return next(new ApiError(400, `Messages must be plain text of up to ${MAX_MESSAGE_LENGTH} characters.`));
  }
  req.validated = { conversationId: req.params.conversationId, message };
  return next();
}

function validateListConversations(req, _res, next) {
  const { search, childId, unread } = req.query;
  if (search !== undefined && (typeof search !== "string" || !isPlainText(search, MAX_SEARCH_LENGTH))) {
    return next(new ApiError(400, `Search text must be up to ${MAX_SEARCH_LENGTH} characters.`));
  }
  if (childId !== undefined && !isUuid(childId)) return next(new ApiError(400, "Choose a valid child."));
  if (unread !== undefined && unread !== "true" && unread !== "false") {
    return next(new ApiError(400, "Invalid unread filter."));
  }
  req.validated = {
    search: typeof search === "string" && search.trim() ? search.trim() : null,
    childId: childId || null,
    unreadOnly: unread === "true",
  };
  return next();
}

function validateListMessages(req, _res, next) {
  if (!isUuid(req.params.conversationId)) return next(new ApiError(404, NOT_FOUND));
  const { before, limit } = req.query;
  if (before !== undefined && !isUuid(before)) return next(new ApiError(400, "Invalid page marker."));
  let pageSize = DEFAULT_PAGE_SIZE;
  if (limit !== undefined) {
    pageSize = Number(limit);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      return next(new ApiError(400, `Page size must be between 1 and ${MAX_PAGE_SIZE}.`));
    }
  }
  req.validated = { conversationId: req.params.conversationId, before: before || null, limit: pageSize };
  return next();
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  validateConversationId,
  validateListConversations,
  validateListMessages,
  validateMessageId,
  validateSendMessage,
  validateStartConversation,
};

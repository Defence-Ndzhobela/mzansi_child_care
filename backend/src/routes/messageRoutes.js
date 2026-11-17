const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAnyRole } = require("../middleware/roleMiddleware");
const {
  validateConversationId,
  validateListConversations,
  validateListMessages,
  validateMessageId,
  validateSendMessage,
  validateStartConversation,
} = require("../validators/messageValidator");

// Mounted at /api/messages. Parents and social workers only: administrators have no route to message
// contents. The service then checks the user's own part in each conversation.
function createMessageRoutes({ messageController, authenticate, messageRateLimit }) {
  const router = express.Router();
  const participants = [authenticate, requireAnyRole("PARENT_CAREGIVER", "SOCIAL_WORKER")];

  router.get("/unread-count", participants, asyncHandler(messageController.unreadCount));
  router.get("/contacts", participants, asyncHandler(messageController.listContacts));
  router.get("/conversations", participants, validateListConversations, asyncHandler(messageController.listConversations));
  router.post("/conversations", participants, messageRateLimit, validateStartConversation, asyncHandler(messageController.startConversation));
  router.get("/conversations/:conversationId", participants, validateConversationId, asyncHandler(messageController.getConversation));
  router.get("/conversations/:conversationId/messages", participants, validateListMessages, asyncHandler(messageController.listMessages));
  router.post("/conversations/:conversationId/messages", participants, messageRateLimit, validateSendMessage, asyncHandler(messageController.sendMessage));
  router.patch("/conversations/:conversationId/read", participants, validateConversationId, asyncHandler(messageController.markConversationRead));
  router.patch("/:messageId/read", participants, validateMessageId, asyncHandler(messageController.markMessageRead));

  return router;
}

module.exports = { createMessageRoutes };

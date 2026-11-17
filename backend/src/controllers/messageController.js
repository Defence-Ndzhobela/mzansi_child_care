const { sendSuccess } = require("../utils/apiResponse");

function createMessageController({ messageService }) {
  return {
    async listContacts(req, res) {
      return sendSuccess(res, { contacts: await messageService.listContacts(req.user) });
    },

    async listConversations(req, res) {
      return sendSuccess(res, { conversations: await messageService.listConversations(req.user, req.validated) });
    },

    async startConversation(req, res) {
      const { created, conversation } = await messageService.startConversation(req.user, req.validated);
      return sendSuccess(res, { conversation }, created ? 201 : 200);
    },

    async getConversation(req, res) {
      return sendSuccess(res, { conversation: await messageService.getConversation(req.user, req.params.conversationId) });
    },

    async listMessages(req, res) {
      return sendSuccess(res, await messageService.listMessages(req.user, req.validated));
    },

    async sendMessage(req, res) {
      return sendSuccess(res, { message: await messageService.sendMessage(req.user, req.validated) }, 201);
    },

    async markMessageRead(req, res) {
      return sendSuccess(res, { message: await messageService.markMessageRead(req.user, req.params.messageId) });
    },

    async markConversationRead(req, res) {
      return sendSuccess(res, await messageService.markConversationRead(req.user, req.params.conversationId));
    },

    async unreadCount(req, res) {
      return sendSuccess(res, await messageService.getUnreadSummary(req.user));
    },
  };
}

module.exports = { createMessageController };

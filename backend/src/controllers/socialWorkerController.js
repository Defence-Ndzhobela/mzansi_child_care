const { sendSuccess } = require("../utils/apiResponse");

function createSocialWorkerController({ childService, arrangementService, paymentService }) {
  return {
    async listAssignedChildren(req, res) {
      const children = await childService.listChildrenForUser(req.user.id, "SOCIAL_WORKER");
      return sendSuccess(res, { children });
    },

    async listAssignedArrangements(req, res) {
      const arrangements = await arrangementService.listArrangements(req.user);
      return sendSuccess(res, { arrangements });
    },

    async listAssignedPayments(req, res) {
      const payments = await paymentService.listPayments(req.user);
      return sendSuccess(res, { payments });
    },
  };
}

module.exports = { createSocialWorkerController };

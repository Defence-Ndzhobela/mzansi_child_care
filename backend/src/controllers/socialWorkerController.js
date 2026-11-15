const { sendSuccess } = require("../utils/apiResponse");

function createSocialWorkerController({ childService }) {
  return {
    async listAssignedChildren(req, res) {
      const children = await childService.listChildrenForUser(req.user.id, "SOCIAL_WORKER");
      return sendSuccess(res, { children });
    },
  };
}

module.exports = { createSocialWorkerController };

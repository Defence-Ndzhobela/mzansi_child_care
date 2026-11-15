const { sendSuccess } = require("../utils/apiResponse");

function createFamilyController({ familyService }) {
  return {
    async requestLink(req, res) {
      await familyService.requestLinkToChild(req.user.id, req.validated);
      return sendSuccess(res, {
        message: "If a matching profile can be identified, its creator will receive a linking request for review.",
      }, 202);
    },

    async listRequests(req, res) {
      const requests = await familyService.listPendingRequests(req.user.id);
      return sendSuccess(res, { requests });
    },

    async respond(req, res) {
      const status = await familyService.respondToRequest(req.user.id, req.validated);
      return sendSuccess(res, { status });
    },
  };
}

module.exports = { createFamilyController };

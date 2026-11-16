const { sendSuccess } = require("../utils/apiResponse");

function createAssignmentController({ assignmentService, childService }) {
  return {
    async listSocialWorkers(_req, res) {
      const socialWorkers = await assignmentService.listAvailableSocialWorkers();
      return sendSuccess(res, { socialWorkers });
    },

    async assign(req, res) {
      const result = await assignmentService.assignSocialWorker(req.user, req.validated);
      const child = await childService.getChildForUser(req.user, req.validated.childId);
      return sendSuccess(res, { changed: result.changed, child });
    },
  };
}

module.exports = { createAssignmentController };

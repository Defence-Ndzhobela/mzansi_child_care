const { sendSuccess } = require("../utils/apiResponse");

const CHILD_SUBMITTED_MESSAGE =
  "Profile submitted. If an existing child profile matches, its creator must approve access.";

function createChildController({ childService }) {
  return {
    async list(req, res) {
      const children = await childService.listChildrenForUser(req.user.id, "PARENT_CAREGIVER");
      return sendSuccess(res, { children });
    },

    async create(req, res) {
      await childService.createChildOrRequestLink(req.user.id, req.validated);
      return sendSuccess(res, { message: CHILD_SUBMITTED_MESSAGE }, 201);
    },

    async update(req, res) {
      const child = await childService.updateChild(req.user.id, req.validated);
      return sendSuccess(res, { child });
    },
  };
}

module.exports = { createChildController };

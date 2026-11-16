const { sendSuccess } = require("../utils/apiResponse");

function createArrangementController({ arrangementService }) {
  return {
    async list(req, res) {
      const arrangements = await arrangementService.listArrangements(req.user);
      return sendSuccess(res, { arrangements });
    },

    async create(req, res) {
      const arrangement = await arrangementService.createArrangement(req.user, req.validated);
      return sendSuccess(res, { arrangement }, 201);
    },

    async update(req, res) {
      const arrangement = await arrangementService.updateArrangement(req.user, req.validated);
      return sendSuccess(res, { arrangement });
    },
  };
}

module.exports = { createArrangementController };

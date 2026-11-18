const { sendSuccess } = require("../utils/apiResponse");

function createAiController({ aiService }) {
  return {
    async chat(req, res) {
      return sendSuccess(res, { reply: await aiService.chat(req.validated.messages) });
    },
  };
}

module.exports = { createAiController };

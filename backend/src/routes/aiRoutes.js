const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { validateChat } = require("../validators/aiValidator");

// Mounted at /api/ai. Public on purpose: the assistant is for visitors on the public pages and is given
// no account data. Abuse is limited by the rate limit, not by login.
function createAiRoutes({ aiController, aiRateLimit }) {
  const router = express.Router();
  router.post("/chat", aiRateLimit, validateChat, asyncHandler(aiController.chat));
  return router;
}

module.exports = { createAiRoutes };

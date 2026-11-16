const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/roleMiddleware");

// Mounted at /api/social-worker. Social workers only.
function createSocialWorkerRoutes({ socialWorkerController, authenticate }) {
  const router = express.Router();
  const socialWorkerOnly = [authenticate, requireRole("SOCIAL_WORKER")];

  router.get("/children", socialWorkerOnly, asyncHandler(socialWorkerController.listAssignedChildren));
  router.get("/arrangements", socialWorkerOnly, asyncHandler(socialWorkerController.listAssignedArrangements));
  router.get("/payments", socialWorkerOnly, asyncHandler(socialWorkerController.listAssignedPayments));

  return router;
}

module.exports = { createSocialWorkerRoutes };

const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/roleMiddleware");
const { validateAssignSocialWorker } = require("../validators/assignmentValidator");

// Mounted at /api/parent. Parents only.
function createAssignmentRoutes({ assignmentController, authenticate }) {
  const router = express.Router();
  const parentOnly = [authenticate, requireRole("PARENT_CAREGIVER")];

  router.get("/social-workers", parentOnly, asyncHandler(assignmentController.listSocialWorkers));
  router.put("/children/:childId/social-worker", parentOnly, validateAssignSocialWorker, asyncHandler(assignmentController.assign));

  return router;
}

module.exports = { createAssignmentRoutes };

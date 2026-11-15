const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/roleMiddleware");
const { validateLinkDecision, validateLinkRequest } = require("../validators/familyValidator");

// Mounted at /api/parent. Parents only.
function createFamilyRoutes({ familyController, authenticate, childIdRateLimit }) {
  const router = express.Router();
  const parentOnly = [authenticate, requireRole("PARENT_CAREGIVER")];

  router.post("/children/link-requests", parentOnly, validateLinkRequest, childIdRateLimit, asyncHandler(familyController.requestLink));
  router.get("/child-link-requests", parentOnly, asyncHandler(familyController.listRequests));
  router.post("/child-link-requests/:requestId/respond", parentOnly, validateLinkDecision, asyncHandler(familyController.respond));

  return router;
}

module.exports = { createFamilyRoutes };

const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/roleMiddleware");
const { validateCreateChild, validateUpdateChild } = require("../validators/childValidator");

// Mounted at /api/parent/children. Parents only.
function createChildRoutes({ childController, authenticate, childIdRateLimit }) {
  const router = express.Router();
  const parentOnly = [authenticate, requireRole("PARENT_CAREGIVER")];

  router.get("/", parentOnly, asyncHandler(childController.list));
  router.post("/", parentOnly, validateCreateChild, childIdRateLimit, asyncHandler(childController.create));
  router.patch("/:childId", parentOnly, validateUpdateChild, asyncHandler(childController.update));

  return router;
}

module.exports = { createChildRoutes };

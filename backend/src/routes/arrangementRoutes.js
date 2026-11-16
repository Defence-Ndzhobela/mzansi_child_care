const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/roleMiddleware");
const { validateCreateArrangement, validateUpdateArrangement } = require("../validators/arrangementValidator");

// Mounted at /api/parent. Parents only. Who pays and who receives is stored on the arrangement.
function createArrangementRoutes({ arrangementController, authenticate }) {
  const router = express.Router();
  const parentOnly = [authenticate, requireRole("PARENT_CAREGIVER")];

  router.get("/arrangements", parentOnly, asyncHandler(arrangementController.list));
  router.post("/arrangements", parentOnly, validateCreateArrangement, asyncHandler(arrangementController.create));
  router.patch("/arrangements/:arrangementId", parentOnly, validateUpdateArrangement, asyncHandler(arrangementController.update));

  return router;
}

module.exports = { createArrangementRoutes };

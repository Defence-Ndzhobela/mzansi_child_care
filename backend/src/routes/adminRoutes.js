const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  validateArrangementStatusFilter, validateAssignmentIdFilters, validateAssignmentStatusFilter,
  validateCreateAssignment, validateCreateSocialWorker, validateId, validateReassignment,
  validateUpdateSocialWorker, validateWorkerStatusFilter,
} = require("../validators/adminValidator");

// Mounted at /api/admin. The single `router.use` below puts authentication and the ADMIN role check in
// front of every route in this file, so a route added later cannot be left open by accident.
function createAdminRoutes({ adminController, authenticate }) {
  const router = express.Router();
  router.use(authenticate, requireRole("ADMIN"));

  router.get("/me", adminController.me);
  router.get("/dashboard/stats", asyncHandler(adminController.dashboardStats));

  router.get("/social-workers", validateWorkerStatusFilter, asyncHandler(adminController.listSocialWorkers));
  router.post("/social-workers", validateCreateSocialWorker, asyncHandler(adminController.createSocialWorker));
  router.get("/social-workers/:id", validateId, asyncHandler(adminController.getSocialWorker));
  router.put("/social-workers/:id", validateUpdateSocialWorker, asyncHandler(adminController.updateSocialWorker));
  router.delete("/social-workers/:id", validateId, asyncHandler(adminController.deleteSocialWorker));

  router.get("/social-worker-assignments", validateAssignmentStatusFilter, validateAssignmentIdFilters, asyncHandler(adminController.listAssignments));
  router.post("/social-worker-assignments", validateCreateAssignment, asyncHandler(adminController.createAssignment));
  router.put("/social-worker-assignments/:id", validateReassignment, asyncHandler(adminController.reassignAssignment));
  router.patch("/social-worker-assignments/:id/end", validateId, asyncHandler(adminController.endAssignment));

  router.get("/child-supporters", asyncHandler(adminController.listChildSupporters));
  router.get("/child-supporters/:id", validateId, asyncHandler(adminController.getChildSupporter));

  router.get("/children", asyncHandler(adminController.listChildren));
  router.get("/children/:id", validateId, asyncHandler(adminController.getChild));

  router.get("/maintenance-arrangements", validateArrangementStatusFilter, asyncHandler(adminController.listArrangements));
  router.get("/maintenance-arrangements/:id", validateId, asyncHandler(adminController.getArrangement));

  router.get("/reports/summary", asyncHandler(adminController.reports));

  return router;
}

module.exports = { createAdminRoutes };

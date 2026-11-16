const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  validateAddEvidence, validateConfirmation, validateDashboardMonth, validateRecordPayment,
} = require("../validators/paymentValidator");

// Mounted at /api/parent. Parents only. Recording is limited to an arrangement's paying parent,
// and confirming or disputing to the payment's receiving parent; the service enforces both.
function createPaymentRoutes({ paymentController, authenticate }) {
  const router = express.Router();
  const parentOnly = [authenticate, requireRole("PARENT_CAREGIVER")];

  router.get("/payments", parentOnly, asyncHandler(paymentController.list));
  router.post("/payments", parentOnly, validateRecordPayment, asyncHandler(paymentController.record));
  router.post("/payments/:paymentId/evidence", parentOnly, validateAddEvidence, asyncHandler(paymentController.addEvidence));
  router.post("/payments/:paymentId/confirmation", parentOnly, validateConfirmation, asyncHandler(paymentController.respond));
  router.get("/dashboard-summary", parentOnly, validateDashboardMonth, asyncHandler(paymentController.dashboardSummary));

  return router;
}

module.exports = { createPaymentRoutes };

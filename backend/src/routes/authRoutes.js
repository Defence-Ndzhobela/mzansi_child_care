const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/roleMiddleware");
const { validateLogin, validateRegistration } = require("../validators/authValidator");

// Mounted at /api.
function createAuthRoutes({ authController, authenticate }) {
  const router = express.Router();

  router.post("/auth/register", validateRegistration, asyncHandler(authController.register));
  router.post("/auth/login", validateLogin, asyncHandler(authController.login));
  router.post("/auth/logout", authController.logout);
  router.get("/auth/me", authenticate, authController.currentUser);
  router.get("/parent/me", authenticate, requireRole("PARENT_CAREGIVER"), authController.currentUser);
  router.get("/social-worker/me", authenticate, requireRole("SOCIAL_WORKER"), authController.currentUser);

  return router;
}

module.exports = { createAuthRoutes };

const express = require("express");
const { getDatabaseVersion } = require("./config/database");
const { assertValidJwtSecret } = require("./config/env");
const { createAuthController } = require("./controllers/authController");
const { createAdminController } = require("./controllers/adminController");
const { createArrangementController } = require("./controllers/arrangementController");
const { createAssignmentController } = require("./controllers/assignmentController");
const { createChildController } = require("./controllers/childController");
const { createFamilyController } = require("./controllers/familyController");
const { createPaymentController } = require("./controllers/paymentController");
const { createSocialWorkerController } = require("./controllers/socialWorkerController");
const { createAuthenticate } = require("./middleware/authMiddleware");
const { createCorsMiddleware } = require("./middleware/corsMiddleware");
const { errorMiddleware } = require("./middleware/errorMiddleware");
const { createChildIdRateLimit } = require("./middleware/rateLimitMiddleware");
const { createAdminRoutes } = require("./routes/adminRoutes");
const { createArrangementRoutes } = require("./routes/arrangementRoutes");
const { createAssignmentRoutes } = require("./routes/assignmentRoutes");
const { createAuthRoutes } = require("./routes/authRoutes");
const { createChildRoutes } = require("./routes/childRoutes");
const { createFamilyRoutes } = require("./routes/familyRoutes");
const { createPaymentRoutes } = require("./routes/paymentRoutes");
const { createSocialWorkerRoutes } = require("./routes/socialWorkerRoutes");
const { createAdminAssignmentService } = require("./services/adminAssignmentService");
const { createAdminDirectoryService } = require("./services/adminDirectoryService");
const { createAdminSocialWorkerService } = require("./services/adminSocialWorkerService");
const { createArrangementService } = require("./services/arrangementService");
const { createAssignmentService } = require("./services/assignmentService");
const { createAuthService } = require("./services/authService");
const { createChildService } = require("./services/childService");
const { createFamilyService } = require("./services/familyService");
const { createPaymentService } = require("./services/paymentService");
const asyncHandler = require("./utils/asyncHandler");

// `sql` is injected so tests can supply a fake database. `allowedOrigins` are the exact
// browser origins permitted to call the API; with none, any request carrying an Origin is rejected.
function createApp({
  sql, jwtSecret, secureCookies = false, cookieSameSite = "strict", allowedOrigins = [],
}) {
  assertValidJwtSecret(jwtSecret);

  const authService = createAuthService({ sql, jwtSecret });
  const assignmentService = createAssignmentService({ sql });
  const childService = createChildService({ sql, jwtSecret, assignmentService });
  const familyService = createFamilyService({ sql, jwtSecret });
  const arrangementService = createArrangementService({ sql, assignmentService });
  const paymentService = createPaymentService({ sql, arrangementService });
  const adminAssignmentService = createAdminAssignmentService({ sql });
  const adminController = createAdminController({
    socialWorkerService: createAdminSocialWorkerService({ sql }),
    assignmentService: adminAssignmentService,
    directoryService: createAdminDirectoryService({ sql, assignmentService: adminAssignmentService }),
  });

  const authenticate = createAuthenticate(authService);
  const childIdRateLimit = createChildIdRateLimit();

  const app = express();
  app.disable("x-powered-by");
  app.use(createCorsMiddleware(allowedOrigins));
  app.use(express.json({ limit: "8kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/", asyncHandler(async (_req, res) => {
    res.type("text/plain").send(await getDatabaseVersion(sql));
  }));

  app.use("/api", createAuthRoutes({
    authController: createAuthController({ authService, secureCookies, cookieSameSite }),
    authenticate,
  }));
  app.use("/api/parent/children", createChildRoutes({
    childController: createChildController({ childService }),
    authenticate,
    childIdRateLimit,
  }));
  app.use("/api/parent", createFamilyRoutes({
    familyController: createFamilyController({ familyService }),
    authenticate,
    childIdRateLimit,
  }));
  app.use("/api/parent", createArrangementRoutes({
    arrangementController: createArrangementController({ arrangementService }),
    authenticate,
  }));
  app.use("/api/parent", createAssignmentRoutes({
    assignmentController: createAssignmentController({ assignmentService, childService }),
    authenticate,
  }));
  app.use("/api/parent", createPaymentRoutes({
    paymentController: createPaymentController({ paymentService }),
    authenticate,
  }));
  app.use("/api/admin", createAdminRoutes({ adminController, authenticate }));
  app.use("/api/social-worker", createSocialWorkerRoutes({
    socialWorkerController: createSocialWorkerController({ childService, arrangementService, paymentService }),
    authenticate,
  }));

  app.use(errorMiddleware);
  return app;
}

module.exports = { createApp };

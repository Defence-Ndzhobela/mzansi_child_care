const express = require("express");
const { getDatabaseVersion } = require("./config/database");
const { assertValidJwtSecret } = require("./config/env");
const { createAuthController } = require("./controllers/authController");
const { createChildController } = require("./controllers/childController");
const { createFamilyController } = require("./controllers/familyController");
const { createSocialWorkerController } = require("./controllers/socialWorkerController");
const { createAuthenticate } = require("./middleware/authMiddleware");
const { errorMiddleware } = require("./middleware/errorMiddleware");
const { createChildIdRateLimit } = require("./middleware/rateLimitMiddleware");
const { createAuthRoutes } = require("./routes/authRoutes");
const { createChildRoutes } = require("./routes/childRoutes");
const { createFamilyRoutes } = require("./routes/familyRoutes");
const { createSocialWorkerRoutes } = require("./routes/socialWorkerRoutes");
const { createAuthService } = require("./services/authService");
const { createChildService } = require("./services/childService");
const { createFamilyService } = require("./services/familyService");
const asyncHandler = require("./utils/asyncHandler");

// `sql` is injected so tests can supply a fake database.
function createApp({ sql, jwtSecret, secureCookies = false }) {
  assertValidJwtSecret(jwtSecret);

  const authService = createAuthService({ sql, jwtSecret });
  const childService = createChildService({ sql, jwtSecret });
  const familyService = createFamilyService({ sql, jwtSecret });

  const authenticate = createAuthenticate(authService);
  const childIdRateLimit = createChildIdRateLimit();

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/", asyncHandler(async (_req, res) => {
    res.type("text/plain").send(await getDatabaseVersion(sql));
  }));

  app.use("/api", createAuthRoutes({
    authController: createAuthController({ authService, secureCookies }),
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
  app.use("/api/social-worker", createSocialWorkerRoutes({
    socialWorkerController: createSocialWorkerController({ childService }),
    authenticate,
  }));

  app.use(errorMiddleware);
  return app;
}

module.exports = { createApp };

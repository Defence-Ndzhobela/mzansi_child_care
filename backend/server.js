const path = require("node:path");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { neon } = require("@neondatabase/serverless");

const COOKIE_NAME = "mzansi_session";
const TOKEN_AGE_SECONDS = 8 * 60 * 60;
const DUMMY_HASH = bcrypt.hashSync("invalid-password", 12);

function createApp(sql, jwtSecret, secureCookies = false) {
  if (typeof jwtSecret !== "string" || Buffer.byteLength(jwtSecret) < 32) {
    throw new Error("JWT_SECRET must be at least 32 bytes.");
  }

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  const asyncRoute = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
  const publicUser = (user) => ({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
  });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookies,
    path: "/",
  };

  app.get("/", asyncRoute(async (_req, res) => {
    const result = await sql`SELECT version()`;
    res.type("text/plain").send(result[0].version);
  }));

  app.post("/api/auth/login", asyncRoute(async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" ||
        !email.trim() || email.length > 255 || !password ||
        Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: "Enter a valid email and password." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = await sql`
      SELECT id, full_name, email, password_hash, role, account_status
      FROM users WHERE lower(email) = ${normalizedEmail} LIMIT 2
    `;
    const user = users.length === 1 ? users[0] : null;
    const validPassword = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
    if (!user || !validPassword || user.account_status !== "ACTIVE") {
      return res.status(401).json({ error: "Invalid email or password, or account unavailable." });
    }
    if (!["PARENT_CAREGIVER", "SOCIAL_WORKER"].includes(user.role)) {
      return res.status(403).json({ error: "Account role is not supported." });
    }

    const token = jwt.sign({}, jwtSecret, {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: TOKEN_AGE_SECONDS,
    });
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: TOKEN_AGE_SECONDS * 1000 });
    return res.json({ token, user: publicUser(user) });
  }));

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.status(204).end();
  });

  const authenticate = asyncRoute(async (req, res, next) => {
    const authorization = req.get("authorization");
    const cookie = (req.get("cookie") || "").split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : cookie?.slice(COOKIE_NAME.length + 1);
    if (!token) return res.status(401).json({ error: "Authentication required." });

    let payload;
    try {
      payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "Session expired or invalid." });
      }
      throw error;
    }
    if (typeof payload !== "object" || typeof payload.sub !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)) {
      return res.status(401).json({ error: "Session expired or invalid." });
    }
    const users = await sql`
      SELECT id, full_name, email, role, account_status
      FROM users WHERE id = ${payload.sub}
    `;
    const user = users[0];
    if (!user || user.account_status !== "ACTIVE" ||
        !["PARENT_CAREGIVER", "SOCIAL_WORKER"].includes(user.role)) {
      return res.status(401).json({ error: "Session expired or invalid." });
    }
    req.user = publicUser(user);
    next();
  });

  app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: req.user }));
  const roleRoute = (role) => (req, res) => {
    if (req.user.role !== role) return res.status(403).json({ error: "Access denied." });
    return res.json({ user: req.user });
  };
  app.get("/api/parent/me", authenticate, roleRoute("PARENT_CAREGIVER"));
  app.get("/api/social-worker/me", authenticate, roleRoute("SOCIAL_WORKER"));

  app.use((error, _req, res, _next) => {
    if (error.type === "entity.parse.failed" || error.type === "entity.too.large") {
      return res.status(error.status).json({ error: "Invalid request body." });
    }
    console.error("Backend request failed.");
    return res.status(500).json({ error: "Server error. Please try again later." });
  });
  return app;
}

if (require.main === module) {
  const config = require("dotenv").config({
    path: path.join(__dirname, ".env"),
    quiet: true,
  });
  if (config.error && config.error.code !== "ENOENT") {
    console.error("Unable to read backend/.env.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL must be set in backend/.env or the environment.");
    process.exit(1);
  }
  if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
    console.error("JWT_SECRET must be set to at least 32 bytes.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  createApp(sql, process.env.JWT_SECRET, process.env.NODE_ENV === "production")
    .listen(3001, "127.0.0.1", () => {
      console.log("Server running at http://localhost:3001");
    });
}

module.exports = { createApp };

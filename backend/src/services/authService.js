const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ApiError } = require("../utils/apiResponse");
const { isUuid } = require("../utils/validationHelpers");

const SESSION_COOKIE_NAME = "mzansi_session";
const TOKEN_AGE_SECONDS = 8 * 60 * 60;
const BCRYPT_COST = 12;
const SUPPORTED_ROLES = ["PARENT_CAREGIVER", "SOCIAL_WORKER", "ADMIN"];
// Compared against when the email is unknown so response time does not reveal valid accounts.
const DUMMY_HASH = bcrypt.hashSync("invalid-password", BCRYPT_COST);

function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
  };
}

function createAuthService({ sql, jwtSecret }) {
  async function register({ fullName, email, phone, password }) {
    const existing = await sql`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`;
    if (existing.length) {
      throw new ApiError(409, "An account with this email address already exists.");
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    try {
      // The role is fixed here; public registration can never create a social worker.
      const users = await sql`
        INSERT INTO users (full_name, email, phone, password_hash, role, account_status)
        VALUES (${fullName}, ${email}, ${phone}, ${passwordHash}, 'PARENT_CAREGIVER', 'ACTIVE')
        RETURNING id, full_name, email, role
      `;
      return toPublicUser(users[0]);
    } catch (error) {
      if (error.code === "23505" && error.constraint === "users_email_key") {
        throw new ApiError(409, "An account with this email address already exists.");
      }
      throw error;
    }
  }

  async function login({ email, password }) {
    const users = await sql`
      SELECT id, full_name, email, password_hash, role, account_status
      FROM users WHERE lower(email) = ${email} LIMIT 2
    `;
    const user = users.length === 1 ? users[0] : null;
    const validPassword = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
    if (!user || !validPassword || user.account_status !== "ACTIVE") {
      throw new ApiError(401, "Invalid email or password, or account unavailable.");
    }
    if (!SUPPORTED_ROLES.includes(user.role)) {
      throw new ApiError(403, "Account role is not supported.");
    }

    const token = jwt.sign({}, jwtSecret, {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: TOKEN_AGE_SECONDS,
    });
    return { token, user: toPublicUser(user) };
  }

  // Verifies the JWT and re-reads the account so role or status changes apply immediately.
  async function authenticateToken(token) {
    let payload;
    try {
      payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, "Session expired or invalid.");
      }
      throw error;
    }
    if (typeof payload !== "object" || !isUuid(payload.sub)) {
      throw new ApiError(401, "Session expired or invalid.");
    }
    const users = await sql`
      SELECT id, full_name, email, role, account_status
      FROM users WHERE id = ${payload.sub}
    `;
    const user = users[0];
    if (!user || user.account_status !== "ACTIVE" || !SUPPORTED_ROLES.includes(user.role)) {
      throw new ApiError(401, "Session expired or invalid.");
    }
    return toPublicUser(user);
  }

  return { authenticateToken, login, register };
}

module.exports = { SESSION_COOKIE_NAME, TOKEN_AGE_SECONDS, createAuthService };

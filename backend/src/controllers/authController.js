const { sendNoContent, sendSuccess } = require("../utils/apiResponse");
const { SESSION_COOKIE_NAME, TOKEN_AGE_SECONDS } = require("../services/authService");

function createAuthController({ authService, secureCookies = false, cookieSameSite = "strict" }) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: cookieSameSite,
    secure: secureCookies,
    path: "/",
  };

  return {
    async register(req, res) {
      const user = await authService.register(req.validated);
      return sendSuccess(res, { user }, 201);
    },

    async login(req, res) {
      const { token, user } = await authService.login(req.validated);
      res.cookie(SESSION_COOKIE_NAME, token, { ...cookieOptions, maxAge: TOKEN_AGE_SECONDS * 1000 });
      return sendSuccess(res, { token, user });
    },

    logout(_req, res) {
      res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
      return sendNoContent(res);
    },

    currentUser(req, res) {
      return sendSuccess(res, { user: req.user });
    },
  };
}

module.exports = { createAuthController };

const { ApiError } = require("../utils/apiResponse");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Limits how often one user can submit child ID numbers (create or link), to stop ID guessing.
// State is in memory, so it is per backend process and resets on restart.
function createChildIdRateLimit() {
  const attempts = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const attempt = attempts.get(req.user.id);
    const inWindow = attempt && now - attempt.startedAt < WINDOW_MS;
    if (inWindow && attempt.count >= MAX_ATTEMPTS) {
      return next(new ApiError(429, "Too many child ID requests. Try again later."));
    }
    attempts.set(req.user.id, inWindow
      ? { ...attempt, count: attempt.count + 1 }
      : { startedAt: now, count: 1 });
    return next();
  };
}

const MESSAGE_WINDOW_MS = 60 * 1000;
const MAX_MESSAGES_PER_WINDOW = 30;

// Limits how many messages (or new conversations) one user can send per minute. Also in memory.
function createMessageRateLimit() {
  const sent = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const recent = (sent.get(req.user.id) || []).filter((time) => now - time < MESSAGE_WINDOW_MS);
    if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
      return next(new ApiError(429, "You are sending messages too quickly. Please wait a moment."));
    }
    recent.push(now);
    sent.set(req.user.id, recent);
    return next();
  };
}

module.exports = { createChildIdRateLimit, createMessageRateLimit };

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

const AI_WINDOW_MS = 5 * 60 * 1000;
const AI_MAX_PER_VISITOR = 20;
const AI_GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const AI_MAX_GLOBAL = 300;

// The assistant is public and every request costs money, so it has two limits: a per-visitor limit
// (by IP address) and a global hourly ceiling that caps the total spend. In memory, like the others.
function createAiRateLimit() {
  const byVisitor = new Map();
  let globalHits = [];
  return (req, _res, next) => {
    const now = Date.now();
    globalHits = globalHits.filter((time) => now - time < AI_GLOBAL_WINDOW_MS);
    if (globalHits.length >= AI_MAX_GLOBAL) {
      return next(new ApiError(429, "The assistant is very busy right now. Please try again later."));
    }
    const key = req.ip || "unknown";
    const recent = (byVisitor.get(key) || []).filter((time) => now - time < AI_WINDOW_MS);
    if (recent.length >= AI_MAX_PER_VISITOR) {
      return next(new ApiError(429, "You have asked a lot of questions in a short time. Please wait a few minutes."));
    }
    recent.push(now);
    byVisitor.set(key, recent);
    globalHits.push(now);
    // Forget visitors whose window has passed so the map cannot grow without bound.
    if (byVisitor.size > 5000) {
      for (const [visitor, times] of byVisitor) {
        if (times.every((time) => now - time >= AI_WINDOW_MS)) byVisitor.delete(visitor);
      }
    }
    return next();
  };
}

module.exports = { createAiRateLimit, createChildIdRateLimit, createMessageRateLimit };

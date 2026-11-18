const OpenAI = require("openai");
const { ApiError } = require("../utils/apiResponse");
const { SYSTEM_PROMPT } = require("../config/assistantKnowledge");

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_REPLY_TOKENS = 500;
const REQUEST_TIMEOUT_MS = 20000;
const HISTORY_LIMIT = 10;

const UNAVAILABLE = "The assistant is not available right now. Please try again later or use the Contact page.";

// Visitors are asked not to share private details, but if they do, the obvious identifiers are removed
// before anything leaves our server: 13-digit ID numbers, email addresses and long digit strings.
function redact(text) {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email removed]")
    .replace(/\b\d{13}\b/g, "[ID number removed]")
    .replace(/(?:\+?\d[\s-]?){9,}/g, "[number removed]");
}

// The assistant answers from the knowledge base only. It is given no database access, no account data
// and no authentication details: only the visitor's own chat messages, redacted.
// `client` is injectable so tests never call the real API; with no key the service reports "unavailable".
function createAiService({ apiKey, model, client } = {}) {
  const openai = client || (apiKey ? new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 }) : null);
  const modelName = model || DEFAULT_MODEL;

  async function chat(messages) {
    if (!openai) throw new ApiError(503, UNAVAILABLE);

    const history = messages.slice(-HISTORY_LIMIT).map((message) => ({
      role: message.role,
      content: message.role === "user" ? redact(message.content) : message.content,
    }));

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: modelName,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
        max_completion_tokens: MAX_REPLY_TOKENS,
        store: false,
      });
    } catch (error) {
      // Neither the prompt, the visitor's text nor the provider's message is logged or returned.
      if (error?.status === 429) {
        throw new ApiError(503, "The assistant is very busy right now. Please try again in a few minutes.");
      }
      throw new ApiError(503, UNAVAILABLE);
    }

    const reply = completion?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) throw new ApiError(503, UNAVAILABLE);
    return reply.trim();
  }

  return { chat, isConfigured: Boolean(openai) };
}

module.exports = { UNAVAILABLE, createAiService, redact };

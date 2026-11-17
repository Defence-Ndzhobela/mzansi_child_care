const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const {
  validateListMessages,
  validateSendMessage,
  validateStartConversation,
} = require("../src/validators/messageValidator");

const uuid = (digit) => `${String(digit).repeat(8)}-${String(digit).repeat(4)}-4${String(digit).repeat(3)}-8${String(digit).repeat(3)}-${String(digit).repeat(12)}`;

// Runs a validator and returns the error it passed on (or null) plus the parsed values.
function run(validator, req) {
  let error = null;
  validator(req, {}, (next) => { error = next || null; });
  return { error, validated: req.validated };
}

describe("message validation", () => {
  const send = (message, extra = {}) => run(validateSendMessage, {
    params: { conversationId: uuid(1) }, body: { message, ...extra },
  });

  test("messages are trimmed and must be non-empty plain text within the limit", () => {
    assert.equal(send("  Hello  ").validated.message, "Hello");
    assert.equal(send("line one\nline two").error, null);
    assert.equal(send("").error.status, 400);
    assert.equal(send(" \n\t ").error.status, 400);
    assert.equal(send("x".repeat(2000)).error, null);
    assert.equal(send("x".repeat(2001)).error.status, 400);
    assert.equal(send("bad\u0000text").error.status, 400);
    assert.equal(run(validateSendMessage, { params: { conversationId: uuid(1) }, body: { message: 42 } }).error.status, 400);
  });

  test("a sender, conversation or read state cannot be smuggled into a message", () => {
    assert.equal(send("Hi", { senderId: uuid(2) }).error.status, 400);
    assert.equal(send("Hi", { isRead: true }).error.status, 400);
    assert.equal(run(validateSendMessage, { params: { conversationId: "nope" }, body: { message: "Hi" } }).error.status, 404);
  });

  test("a parent chooses only the child; a social worker must also name the parent", () => {
    const start = (role, body, id = uuid(9)) => run(validateStartConversation, { user: { id, role }, body });
    assert.equal(start("PARENT_CAREGIVER", { childId: uuid(1) }).error, null);
    assert.equal(start("PARENT_CAREGIVER", { childId: uuid(1), parentUserId: uuid(9) }).error, null);
    assert.equal(start("PARENT_CAREGIVER", { childId: uuid(1), parentUserId: uuid(2) }).error.status, 400);
    assert.equal(start("PARENT_CAREGIVER", { childId: uuid(1), socialWorkerId: uuid(3) }).error.status, 400);
    assert.equal(start("PARENT_CAREGIVER", { childId: "nope" }).error.status, 400);
    assert.equal(start("SOCIAL_WORKER", { childId: uuid(1) }).error.status, 400);
    assert.equal(start("SOCIAL_WORKER", { childId: uuid(1), parentUserId: uuid(2), arrangementId: uuid(4) }).error, null);
    assert.equal(start("SOCIAL_WORKER", { childId: uuid(1), parentUserId: uuid(2), arrangementId: "x" }).error.status, 400);
  });

  test("history pages are bounded", () => {
    const page = (query) => run(validateListMessages, { params: { conversationId: uuid(1) }, query });
    assert.equal(page({}).validated.limit, 50);
    assert.equal(page({ limit: "100" }).validated.limit, 100);
    assert.equal(page({ limit: "101" }).error.status, 400);
    assert.equal(page({ limit: "0" }).error.status, 400);
    assert.equal(page({ limit: "2.5" }).error.status, 400);
    assert.equal(page({ before: "nope" }).error.status, 400);
    assert.equal(page({ before: uuid(5) }).validated.before, uuid(5));
  });
});

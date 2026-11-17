// Runs against the real Neon PostgreSQL database named by DATABASE_URL in backend/.env, once migration
// 006_messaging has been applied (the tests skip with a reminder until then). It creates throw-away
// parents, social workers and an administrator (emails tagged with a per-run id), exercises the HTTP
// API and deletes everything afterwards. It is skipped when DATABASE_URL is not set.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { after, before, describe, test } = require("node:test");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/app");
const { createDatabase } = require("../src/config/database");
const { deleteTestData, getDatabaseUrl, insertSocialWorker } = require("./helpers/neonHarness");
const { secret, syntheticId, tokenFor } = require("./helpers/testApp");

const databaseUrl = getDatabaseUrl();

const PASSWORD = "Messaging#2026";
const runId = crypto.randomBytes(4).toString("hex");
const emailPrefix = `message-test-${runId}-`;
const month = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }).slice(0, 7);

const randomChildId = () => syntheticId(`200101${5000 + crypto.randomInt(0, 5000)}08`);

describe("parent and social worker messaging on Neon PostgreSQL", { skip: !databaseUrl && "DATABASE_URL is not set" }, () => {
  let sql;
  let listener;
  let base;
  let ready = false;
  const people = {};
  const workers = {};
  const ids = {};

  // Skips with a reminder instead of failing when migration 006 has not been applied to this database.
  const scenario = (name, run) => test(name, async (t) => {
    if (!ready) return t.skip("Apply migration 006_messaging first (npm run db:migrate).");
    return run(t);
  });

  async function call(person, method, path, body) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(person ? { Authorization: `Bearer ${person.token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function signUp(key) {
    const email = `${emailPrefix}${key}@example.test`;
    const registered = await call(null, "POST", "/api/auth/register", {
      fullName: `Parent ${key} ${runId}`, email, phone: "+27 82 000 0000", password: PASSWORD, confirmPassword: PASSWORD,
      accountType: "PARENT_CAREGIVER",
    });
    assert.equal(registered.status, 201, `register ${key}`);
    const login = await call(null, "POST", "/api/auth/login", { email, password: PASSWORD });
    assert.equal(login.status, 200, `login ${key}`);
    people[key] = { id: login.body.user.id, token: login.body.token };
  }

  async function addWorker(key) {
    const id = await insertSocialWorker(sql, { email: `${emailPrefix}${key}@example.test`, fullName: `Worker ${key} ${runId}` });
    workers[key] = { id, token: tokenFor(id) };
  }

  const childBody = (idNumber, socialWorkerId) => ({
    firstName: "Child", lastName: "Test", dateOfBirth: "2020-01-01", southAfricanId: idNumber,
    relationshipType: "PRIMARY_CAREGIVER", isPrimaryCaregiver: true, socialWorkerId,
  });

  async function createChild(parentKey, workerKey) {
    const idNumber = randomChildId();
    const created = await call(people[parentKey], "POST", "/api/parent/children", childBody(idNumber, workers[workerKey].id));
    assert.equal(created.status, 201);
    const children = (await call(people[parentKey], "GET", "/api/parent/children")).body.children;
    return { idNumber, id: children[children.length - 1].id };
  }

  async function linkParent(creatorKey, linkerKey, idNumber, relationshipType) {
    const requested = await call(people[linkerKey], "POST", "/api/parent/children/link-requests", {
      southAfricanId: idNumber, relationshipType,
    });
    assert.equal(requested.status, 202);
    const inbox = await call(people[creatorKey], "GET", "/api/parent/child-link-requests");
    const request = inbox.body.requests.find((item) => item.requesterId === people[linkerKey].id);
    assert.ok(request, "link request is waiting for the creator");
    const approved = await call(people[creatorKey], "POST", `/api/parent/child-link-requests/${request.id}/respond`, {
      decision: "APPROVED",
    });
    assert.equal(approved.status, 200);
  }

  const startAs = (person, body) => call(person, "POST", "/api/messages/conversations", body);
  const sendAs = (person, conversationId, message) => call(person, "POST", `/api/messages/conversations/${conversationId}/messages`, { message });
  const messagesAs = (person, conversationId, query = "") => call(person, "GET", `/api/messages/conversations/${conversationId}/messages${query}`);
  const listAs = (person, query = "") => call(person, "GET", `/api/messages/conversations${query}`);
  const unreadFor = async (person) => (await call(person, "GET", "/api/messages/unread-count")).body;

  before(async () => {
    sql = createDatabase(databaseUrl);
    const table = await sql.query("SELECT to_regclass('public.conversations') AS name");
    ready = Boolean(table[0].name);
    listener = createApp({ sql, jwtSecret: secret }).listen(0, "127.0.0.1");
    await new Promise((resolve) => listener.once("listening", resolve));
    base = `http://127.0.0.1:${listener.address().port}`;
    if (!ready) return;

    // Sequential on purpose: simultaneous registrations occasionally hit transient Neon errors.
    for (const key of ["p1", "p2", "p3", "p4"]) await signUp(key);
    await addWorker("workerA");
    await addWorker("workerB");

    const adminId = (await sql`
      INSERT INTO users (full_name, email, phone, password_hash, role, account_status)
      VALUES (${`Admin ${runId}`}, ${`${emailPrefix}admin@example.test`}, '+27 82 000 0000',
              ${bcrypt.hashSync("Unused#Password1", 4)}, 'ADMIN', 'ACTIVE')
      RETURNING id
    `)[0].id;
    people.admin = { id: adminId, token: tokenFor(adminId) };

    // Family A: p1 and p2 share child1 (worker A). Family B: p3 alone with child2 (worker B). p4 is unrelated.
    const child1 = await createChild("p1", "workerA");
    await linkParent("p1", "p2", child1.idNumber, "FATHER");
    ids.child1 = child1.id;
    ids.child2 = (await createChild("p3", "workerB")).id;
  });

  after(async () => {
    if (listener) await new Promise((resolve) => listener.close(resolve));
    if (sql) await deleteTestData(sql, emailPrefix);
  });

  scenario("a parent sees their assigned social worker, and each person sees only their own contacts", async () => {
    const parentContacts = (await call(people.p1, "GET", "/api/messages/contacts")).body.contacts;
    assert.equal(parentContacts.length, 1);
    assert.equal(parentContacts[0].childId, ids.child1);
    assert.equal(parentContacts[0].socialWorker.id, workers.workerA.id);
    assert.equal(parentContacts[0].socialWorker.fullName, `Worker workerA ${runId}`);
    assert.equal(parentContacts[0].conversationId, null);

    const workerContacts = (await call(workers.workerA, "GET", "/api/messages/contacts")).body.contacts;
    assert.deepEqual(workerContacts.map((contact) => contact.parent.id).sort(), [people.p1.id, people.p2.id].sort());
    assert.ok(workerContacts.every((contact) => contact.childId === ids.child1));

    assert.deepEqual((await call(people.p4, "GET", "/api/messages/contacts")).body.contacts, []);
    assert.deepEqual((await call(workers.workerB, "GET", "/api/messages/contacts")).body.contacts.map((c) => c.childId), [ids.child2]);
  });

  scenario("only parents and social workers can use messaging, never administrators", async () => {
    assert.equal((await call(null, "GET", "/api/messages/conversations")).status, 401);
    for (const [method, path, body] of [
      ["GET", "/api/messages/conversations"],
      ["GET", "/api/messages/contacts"],
      ["GET", "/api/messages/unread-count"],
      ["POST", "/api/messages/conversations", { childId: ids.child1 }],
    ]) {
      assert.equal((await call(people.admin, method, path, body)).status, 403, `${method} ${path}`);
    }
  });

  scenario("a parent starts one conversation with the child's assigned worker; repeating it reuses it", async () => {
    const started = await startAs(people.p1, { childId: ids.child1 });
    assert.equal(started.status, 201);
    assert.equal(started.body.conversation.socialWorker.id, workers.workerA.id);
    assert.equal(started.body.conversation.parent.id, people.p1.id);
    assert.equal(started.body.conversation.canSend, true);
    assert.equal(started.body.conversation.childName, "Child Test");
    ids.conversation1 = started.body.conversation.id;

    const again = await startAs(people.p1, { childId: ids.child1 });
    assert.equal(again.status, 200);
    assert.equal(again.body.conversation.id, ids.conversation1);
    const rows = await sql.query("SELECT count(*)::int AS n FROM conversations WHERE parent_user_id = $1", [people.p1.id]);
    assert.equal(rows[0].n, 1);
  });

  scenario("conversations cannot be started with a manipulated worker, parent, child or arrangement", async () => {
    // The worker is never taken from the request.
    assert.equal((await startAs(people.p1, { childId: ids.child1, socialWorkerId: workers.workerB.id })).status, 400);
    assert.equal((await startAs(people.p1, { childId: ids.child1, parentUserId: people.p2.id })).status, 400);
    assert.equal((await startAs(people.p1, { childId: "not-a-uuid" })).status, 400);
    // A parent who is not linked to the child, in either family.
    assert.equal((await startAs(people.p4, { childId: ids.child1 })).status, 403);
    assert.equal((await startAs(people.p3, { childId: ids.child1 })).status, 403);
    assert.equal((await startAs(people.p1, { childId: ids.child2 })).status, 403);
    // A worker who is not assigned to the child, or naming a parent who is not linked to it.
    assert.equal((await startAs(workers.workerB, { childId: ids.child1, parentUserId: people.p1.id })).status, 403);
    assert.equal((await startAs(workers.workerA, { childId: ids.child1, parentUserId: people.p3.id })).status, 403);
    assert.equal((await startAs(workers.workerA, { childId: ids.child1 })).status, 400);
    // An arrangement that does not exist, or that belongs to another child.
    assert.equal((await startAs(people.p2, { childId: ids.child1, arrangementId: crypto.randomUUID() })).status, 400);
    const total = await sql.query(
      "SELECT count(*)::int AS n FROM conversations WHERE parent_user_id = ANY($1::uuid[])",
      [[people.p1.id, people.p3.id, people.p4.id]],
    );
    assert.equal(total[0].n, 1);
  });

  scenario("messages are validated, and the sender is always the signed-in user", async () => {
    for (const message of ["", "   \n ", "x".repeat(2001), "bad\u0000text"]) {
      assert.equal((await sendAs(people.p1, ids.conversation1, message)).status, 400, JSON.stringify(message).slice(0, 20));
    }
    const forged = await call(people.p1, "POST", `/api/messages/conversations/${ids.conversation1}/messages`, {
      message: "Hello", senderId: workers.workerA.id,
    });
    assert.equal(forged.status, 400);
    assert.equal((await call(people.p1, "POST", `/api/messages/conversations/${ids.conversation1}/messages`, {})).status, 400);

    const sent = await sendAs(people.p1, ids.conversation1, "  Hello, I need help with <b>maintenance</b>.  ");
    assert.equal(sent.status, 201);
    assert.equal(sent.body.message.senderId, people.p1.id);
    assert.equal(sent.body.message.message, "Hello, I need help with <b>maintenance</b>.");
    assert.equal(sent.body.message.isRead, false);
    ids.message1 = sent.body.message.id;
  });

  scenario("the social worker sees the unread message, replies, and the parent is notified", async () => {
    const workerUnread = await unreadFor(workers.workerA);
    assert.equal(workerUnread.unreadCount, 1);
    assert.equal(workerUnread.conversations[0].conversationId, ids.conversation1);
    assert.equal(workerUnread.conversations[0].senderName, `Parent p1 ${runId}`);
    assert.equal(JSON.stringify(workerUnread).includes("maintenance"), false, "notifications never carry message text");
    assert.equal((await unreadFor(people.p1)).unreadCount, 0, "the sender has nothing unread");

    const list = (await listAs(workers.workerA)).body.conversations;
    assert.equal(list.length, 1);
    assert.equal(list[0].unreadCount, 1);
    assert.equal(list[0].parent.fullName, `Parent p1 ${runId}`);
    assert.equal(list[0].childName, "Child Test");
    assert.equal(list[0].lastMessage.preview, "Hello, I need help with <b>maintenance</b>.");

    const reply = await sendAs(workers.workerA, ids.conversation1, "Hello, I can help.");
    assert.equal(reply.status, 201);
    assert.equal(reply.body.message.senderId, workers.workerA.id);
    ids.reply1 = reply.body.message.id;

    assert.equal((await unreadFor(people.p1)).unreadCount, 1);
    const history = (await messagesAs(people.p1, ids.conversation1)).body;
    assert.deepEqual(history.messages.map((m) => m.senderId), [people.p1.id, workers.workerA.id]);
    assert.equal(history.hasMore, false);
  });

  scenario("read receipts: only the recipient can mark a message read, and the sender sees it", async () => {
    assert.equal((await call(people.p1, "PATCH", `/api/messages/${ids.message1}/read`)).status, 403);
    assert.equal((await call(people.p2, "PATCH", `/api/messages/${ids.message1}/read`)).status, 404);

    const read = await call(workers.workerA, "PATCH", `/api/messages/${ids.message1}/read`);
    assert.equal(read.status, 200);
    assert.equal(read.body.message.isRead, true);
    assert.ok(read.body.message.readAt);
    assert.equal((await call(workers.workerA, "PATCH", `/api/messages/${ids.message1}/read`)).status, 200, "idempotent");

    const seen = (await messagesAs(people.p1, ids.conversation1)).body.messages;
    assert.equal(seen[0].isRead, true);
    assert.equal(seen[1].isRead, false, "the parent has not read the reply yet");
    assert.equal((await unreadFor(workers.workerA)).unreadCount, 0);

    const bulk = await call(people.p1, "PATCH", `/api/messages/conversations/${ids.conversation1}/read`);
    assert.equal(bulk.body.updated, 1);
    assert.equal((await unreadFor(people.p1)).unreadCount, 0);
    assert.equal((await call(people.p1, "PATCH", `/api/messages/conversations/${ids.conversation1}/read`)).body.updated, 0);
  });

  scenario("nobody outside the conversation can read, send, mark or discover it", async () => {
    const outsiders = [people.p2, people.p3, people.p4, workers.workerB];
    for (const outsider of outsiders) {
      assert.equal((await call(outsider, "GET", `/api/messages/conversations/${ids.conversation1}`)).status, 404);
      assert.equal((await messagesAs(outsider, ids.conversation1)).status, 404);
      assert.equal((await sendAs(outsider, ids.conversation1, "Let me in")).status, 404);
      assert.equal((await call(outsider, "PATCH", `/api/messages/conversations/${ids.conversation1}/read`)).status, 404);
      assert.equal((await call(outsider, "PATCH", `/api/messages/${ids.reply1}/read`)).status, 404);
      assert.equal((await listAs(outsider)).body.conversations.length, 0);
      assert.equal((await unreadFor(outsider)).unreadCount, 0);
    }
    assert.equal((await call(people.p1, "GET", "/api/messages/conversations/not-a-uuid")).status, 404);
    assert.equal((await call(people.p1, "GET", `/api/messages/conversations/${crypto.randomUUID()}`)).status, 404);
    const stillTwo = await sql.query("SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1", [ids.conversation1]);
    assert.equal(stillTwo[0].n, 2);
  });

  scenario("a social worker starts a conversation with another parent of the child, with an arrangement", async () => {
    const arrangement = await call(people.p1, "POST", "/api/parent/arrangements", {
      childId: ids.child1, myRole: "RECEIVING", otherUserId: people.p2.id, expectedAmount: 1500,
      frequency: "MONTHLY", startDate: `${month}-01`,
    });
    assert.equal(arrangement.status, 201);
    ids.arrangement1 = arrangement.body.arrangement.id;

    const contacts = (await call(workers.workerA, "GET", "/api/messages/contacts")).body.contacts;
    const forP2 = contacts.find((contact) => contact.parent.id === people.p2.id);
    assert.deepEqual(forP2.arrangements.map((item) => item.id), [ids.arrangement1]);
    assert.equal(forP2.arrangements[0].expectedAmount, 1500);

    const started = await startAs(workers.workerA, { childId: ids.child1, parentUserId: people.p2.id, arrangementId: ids.arrangement1 });
    assert.equal(started.status, 201);
    assert.equal(started.body.conversation.maintenanceArrangementId, ids.arrangement1);
    assert.equal(started.body.conversation.parent.id, people.p2.id);
    ids.conversation2 = started.body.conversation.id;

    // p3 is in another family: this arrangement is not theirs, whatever child they name.
    assert.equal((await startAs(people.p3, { childId: ids.child2, arrangementId: ids.arrangement1 })).status, 400);
    // p1 cannot read p2's conversation even though they share the child.
    assert.equal((await call(people.p1, "GET", `/api/messages/conversations/${ids.conversation2}`)).status, 404);
    assert.equal((await sendAs(people.p2, ids.conversation2, "Thank you for contacting me.")).status, 201);
    assert.equal((await listAs(workers.workerA)).body.conversations.length, 2);
  });

  scenario("workers can search and filter their conversations by name, child, message text and unread", async () => {
    const names = async (query) => (await listAs(workers.workerA, query)).body.conversations.map((c) => c.parent.id);
    assert.deepEqual(await names(`?search=${encodeURIComponent(`Parent p2 ${runId}`)}`), [people.p2.id]);
    assert.deepEqual(await names("?search=thank%20you"), [people.p2.id]);
    assert.deepEqual(await names("?search=%25"), [], "wildcards are literal");
    assert.deepEqual(await names("?search=nothing-matches-this"), []);
    assert.deepEqual(await names("?unread=true"), [people.p2.id]);
    assert.equal((await names(`?childId=${ids.child1}`)).length, 2);
    assert.deepEqual(await names(`?childId=${ids.child2}`), []);
    assert.equal((await listAs(workers.workerA, "?childId=nope")).status, 400);
    assert.equal((await listAs(workers.workerA, "?unread=maybe")).status, 400);
  });

  scenario("history is paged and keeps its order", async () => {
    for (let index = 1; index <= 4; index += 1) {
      assert.equal((await sendAs(workers.workerA, ids.conversation2, `Follow-up ${index}`)).status, 201);
    }
    const latest = (await messagesAs(people.p2, ids.conversation2, "?limit=3")).body;
    assert.deepEqual(latest.messages.map((m) => m.message), ["Follow-up 2", "Follow-up 3", "Follow-up 4"]);
    assert.equal(latest.hasMore, true);
    const older = (await messagesAs(people.p2, ids.conversation2, `?limit=3&before=${latest.messages[0].id}`)).body;
    assert.deepEqual(older.messages.map((m) => m.message), ["Thank you for contacting me.", "Follow-up 1"]);
    assert.equal(older.hasMore, false);
    assert.equal((await messagesAs(people.p2, ids.conversation2, "?limit=0")).status, 400);
    assert.equal((await messagesAs(people.p2, ids.conversation2, "?before=nope")).status, 400);
  });

  scenario("reassigning the worker keeps the old conversation as read-only history", async () => {
    const changed = await call(people.p1, "PUT", `/api/parent/children/${ids.child1}/social-worker`, { socialWorkerId: workers.workerB.id });
    assert.equal(changed.status, 200);

    const old = (await call(people.p1, "GET", `/api/messages/conversations/${ids.conversation1}`)).body.conversation;
    assert.equal(old.canSend, false);
    assert.equal((await messagesAs(people.p1, ids.conversation1)).body.messages.length, 2, "history is preserved");
    assert.equal((await sendAs(people.p1, ids.conversation1, "Still there?")).status, 403);
    assert.equal((await sendAs(workers.workerA, ids.conversation1, "I was reassigned")).status, 403);
    assert.equal((await messagesAs(workers.workerA, ids.conversation1)).status, 200, "the former worker keeps their own history");

    // The former worker no longer has the child as a contact, and cannot open new conversations.
    assert.deepEqual((await call(workers.workerA, "GET", "/api/messages/contacts")).body.contacts, []);
    assert.equal((await startAs(workers.workerA, { childId: ids.child1, parentUserId: people.p1.id })).status, 403);

    // The new worker never sees the old worker's conversations, and gets a separate one.
    assert.equal((await listAs(workers.workerB)).body.conversations.length, 0);
    assert.equal((await call(workers.workerB, "GET", `/api/messages/conversations/${ids.conversation1}`)).status, 404);
    const fresh = await startAs(people.p1, { childId: ids.child1 });
    assert.equal(fresh.status, 201);
    assert.notEqual(fresh.body.conversation.id, ids.conversation1);
    assert.equal(fresh.body.conversation.socialWorker.id, workers.workerB.id);
    assert.equal((await sendAs(people.p1, fresh.body.conversation.id, "Hello new worker")).status, 201);
    assert.equal((await messagesAs(workers.workerB, fresh.body.conversation.id)).body.messages.length, 1);
    assert.equal((await messagesAs(workers.workerB, ids.conversation1)).status, 404);

    // Assigning the first worker again makes the original conversation usable again.
    const back = await call(people.p1, "PUT", `/api/parent/children/${ids.child1}/social-worker`, { socialWorkerId: workers.workerA.id });
    assert.equal(back.status, 200);
    assert.equal((await sendAs(people.p1, ids.conversation1, "Welcome back")).status, 201);
  });

  scenario("an ended assignment stops new messages but keeps the conversation", async () => {
    await sql.query(
      "UPDATE social_worker_assignments SET assignment_status = 'CLOSED', ended_at = NOW() WHERE child_id = $1 AND assignment_status = 'ACTIVE'",
      [ids.child1],
    );
    assert.equal((await sendAs(people.p1, ids.conversation1, "Anyone?")).status, 403);
    assert.equal((await sendAs(workers.workerA, ids.conversation1, "Closed")).status, 403);
    assert.equal((await startAs(people.p2, { childId: ids.child1 })).status, 403, "no active worker to message");
    assert.deepEqual((await call(people.p1, "GET", "/api/messages/contacts")).body.contacts, []);
    const history = (await messagesAs(people.p1, ids.conversation1)).body.messages;
    assert.ok(history.length >= 3);
    assert.equal((await call(people.p1, "GET", `/api/messages/conversations/${ids.conversation1}`)).body.conversation.canSend, false);
  });

  scenario("the database itself rejects duplicates, outsiders as senders, edits and un-reading", async () => {
    await assert.rejects(
      sql.query(
        "INSERT INTO conversations (parent_user_id, social_worker_id, child_id) VALUES ($1, $2, $3)",
        [people.p1.id, workers.workerA.id, ids.child1],
      ),
      (error) => error.code === "23505",
    );
    await assert.rejects(
      sql.query(
        "INSERT INTO conversations (parent_user_id, social_worker_id, child_id, maintenance_arrangement_id) VALUES ($1, $2, $3, $4)",
        [people.p3.id, workers.workerB.id, ids.child2, ids.arrangement1],
      ),
      (error) => error.code === "23503",
      "an arrangement of another child is refused",
    );
    await assert.rejects(
      sql.query("INSERT INTO messages (conversation_id, sender_id, message) VALUES ($1, $2, 'hi')", [ids.conversation1, people.p3.id]),
      (error) => error.code === "23514",
    );
    await assert.rejects(
      sql.query("INSERT INTO messages (conversation_id, sender_id, message) VALUES ($1, $2, '   ')", [ids.conversation1, people.p1.id]),
      (error) => error.code === "23514",
    );
    await assert.rejects(
      sql.query("UPDATE messages SET message = 'edited' WHERE id = $1", [ids.message1]),
      (error) => error.code === "23514",
    );
    await assert.rejects(
      sql.query("UPDATE messages SET is_read = FALSE, read_at = NULL WHERE id = $1", [ids.message1]),
      (error) => error.code === "23514",
    );
    await assert.rejects(
      sql.query("UPDATE messages SET is_read = TRUE, read_at = NULL WHERE id = $1", [ids.reply1]),
      (error) => error.code === "23514",
    );
    await assert.rejects(
      sql.query("DELETE FROM conversations WHERE id = $1", [ids.conversation1]),
      (error) => error.code === "23001",
      "a conversation with messages cannot be deleted",
    );
  });
});

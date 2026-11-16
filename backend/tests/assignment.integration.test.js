// Runs against the real Neon PostgreSQL database named by DATABASE_URL in backend/.env.
// It creates throw-away parents and social workers (emails tagged with a per-run id), exercises the
// HTTP API and deletes everything afterwards. It is skipped when DATABASE_URL is not set.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { after, before, describe, test } = require("node:test");
const { createApp } = require("../src/app");
const { createDatabase } = require("../src/config/database");
const { deleteTestData, getDatabaseUrl, insertSocialWorker } = require("./helpers/neonHarness");
const { secret, syntheticId, tokenFor } = require("./helpers/testApp");

const databaseUrl = getDatabaseUrl();

const PASSWORD = "Assignment#2026";
const runId = crypto.randomBytes(4).toString("hex");
const emailPrefix = `assign-test-${runId}-`;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
const month = today.slice(0, 7);

const randomChildId = () => syntheticId(`200101${5000 + crypto.randomInt(0, 5000)}08`);

describe("social worker assignment on Neon PostgreSQL", { skip: !databaseUrl && "DATABASE_URL is not set" }, () => {
  let sql;
  let listener;
  let base;
  const people = {};
  const workers = {};
  const ids = {};

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
      fullName: `${key} Test`, email, phone: "+27 82 000 0000", password: PASSWORD, confirmPassword: PASSWORD,
      accountType: "PARENT_CAREGIVER",
    });
    assert.equal(registered.status, 201, `register ${key}`);
    const login = await call(null, "POST", "/api/auth/login", { email, password: PASSWORD });
    assert.equal(login.status, 200, `login ${key}`);
    people[key] = { id: login.body.user.id, token: login.body.token };
  }

  async function addWorker(key, status = "ACTIVE") {
    const id = await insertSocialWorker(sql, {
      email: `${emailPrefix}${key}@example.test`, fullName: `Worker ${key} ${runId}`, status,
    });
    workers[key] = { id, token: tokenFor(id) };
  }

  const childBody = (idNumber, extra = {}) => ({
    firstName: "Child", lastName: "Test", dateOfBirth: "2020-01-01", southAfricanId: idNumber,
    relationshipType: "PRIMARY_CAREGIVER", isPrimaryCaregiver: true, ...extra,
  });
  const arrangementBody = (childId, myRole, otherUserId, extra = {}) => ({
    childId, myRole, otherUserId, expectedAmount: 1500, frequency: "MONTHLY", startDate: `${month}-01`, ...extra,
  });

  const assignmentRows = (childId) => sql.query(
    `SELECT social_worker_id, assignment_status, assigned_by, ended_at
     FROM social_worker_assignments WHERE child_id = $1 ORDER BY assigned_at, ended_at NULLS LAST`,
    [childId],
  );
  const activeRows = async (childId) => (await assignmentRows(childId))
    .filter((row) => row.assignment_status === "ACTIVE");

  // Links `linkerKey` to a child created by `creatorKey`, with the creator's approval.
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

  const findChild = async (person, childId) => (await call(person, "GET", "/api/parent/children"))
    .body.children.find((child) => child.id === childId);

  before(async () => {
    sql = createDatabase(databaseUrl);
    listener = createApp({ sql, jwtSecret: secret }).listen(0, "127.0.0.1");
    await new Promise((resolve) => listener.once("listening", resolve));
    base = `http://127.0.0.1:${listener.address().port}`;

    // Sequential on purpose: simultaneous registrations occasionally hit transient Neon errors.
    for (const key of ["p1", "p2", "p3", "p4"]) await signUp(key);
    await addWorker("workerA");
    await addWorker("workerB");
    await addWorker("workerInactive", "INACTIVE");
  });

  after(async () => {
    if (listener) await new Promise((resolve) => listener.close(resolve));
    if (sql) await deleteTestData(sql, emailPrefix);
  });

  test("a child cannot be registered without an available social worker", async () => {
    const idNumber = randomChildId();
    const missing = await call(people.p1, "POST", "/api/parent/children", childBody(idNumber));
    assert.equal(missing.status, 400);
    assert.match(missing.body.error, /social worker/i);

    for (const socialWorkerId of [
      "not-a-uuid",
      workers.workerInactive.id, // an existing worker whose account is inactive
      people.p2.id, // a real account that is not a social worker
      crypto.randomUUID(), // no such account
    ]) {
      const rejected = await call(people.p1, "POST", "/api/parent/children", childBody(idNumber, { socialWorkerId }));
      assert.equal(rejected.status, 400, String(socialWorkerId));
    }

    // Nothing was saved, so no child exists without its assignment.
    const created = await sql.query("SELECT count(*)::int AS n FROM children WHERE created_by = $1", [people.p1.id]);
    assert.equal(created[0].n, 0);
  });

  test("available social workers come from the database and exclude inactive accounts", async () => {
    const listed = await call(people.p1, "GET", "/api/parent/social-workers");
    assert.equal(listed.status, 200);
    const listedIds = listed.body.socialWorkers.map((worker) => worker.id);
    assert.ok(listedIds.includes(workers.workerA.id));
    assert.ok(listedIds.includes(workers.workerB.id));
    assert.equal(listedIds.includes(workers.workerInactive.id), false);
    assert.equal(listedIds.includes(people.p1.id), false);
    assert.equal(JSON.stringify(listed.body).includes("@"), false);
    assert.equal((await call(workers.workerA, "GET", "/api/parent/social-workers")).status, 403);
  });

  test("registering a child with a selected worker creates the child and one ACTIVE assignment together", async () => {
    ids.child1Number = randomChildId();
    const created = await call(people.p1, "POST", "/api/parent/children",
      childBody(ids.child1Number, { socialWorkerId: workers.workerA.id }));
    assert.equal(created.status, 201);

    const child = (await call(people.p1, "GET", "/api/parent/children")).body.children[0];
    ids.child1 = child.id;
    assert.equal(child.socialWorker.id, workers.workerA.id);
    assert.equal(child.socialWorker.fullName, `Worker workerA ${runId}`);

    const rows = await assignmentRows(ids.child1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].assignment_status, "ACTIVE");
    assert.equal(rows[0].social_worker_id, workers.workerA.id);
    assert.equal(rows[0].assigned_by, people.p1.id);
  });

  test("a second parent who registers separately joins the same child and sees the same worker", async () => {
    // p2 adds the same child and picks a different worker: no second child, no second assignment.
    const duplicate = await call(people.p2, "POST", "/api/parent/children",
      childBody(ids.child1Number, { socialWorkerId: workers.workerB.id, relationshipType: "FATHER", isPrimaryCaregiver: false }));
    assert.equal(duplicate.status, 201);
    assert.equal((await call(people.p2, "GET", "/api/parent/children")).body.children.length, 0);
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM children WHERE created_by = $1", [people.p2.id]))[0].n, 0);

    const inbox = await call(people.p1, "GET", "/api/parent/child-link-requests");
    assert.equal(inbox.body.requests.length, 1);
    const approved = await call(people.p1, "POST", `/api/parent/child-link-requests/${inbox.body.requests[0].id}/respond`, {
      decision: "APPROVED",
    });
    assert.equal(approved.status, 200);

    const first = await findChild(people.p1, ids.child1);
    const second = await findChild(people.p2, ids.child1);
    assert.equal(second.id, first.id);
    assert.equal(second.relationships.length, 2);
    assert.equal(second.socialWorker.id, workers.workerA.id);
    assert.deepEqual(second.socialWorker, first.socialWorker);
    assert.equal((await assignmentRows(ids.child1)).length, 1);
  });

  test("an arrangement reuses the child's existing assignment instead of creating another", async () => {
    // Choosing a different worker than the child's current one is refused.
    const conflicting = await call(people.p1, "POST", "/api/parent/arrangements",
      arrangementBody(ids.child1, "RECEIVING", people.p2.id, { socialWorkerId: workers.workerB.id }));
    assert.equal(conflicting.status, 409);
    assert.equal((await call(people.p1, "GET", "/api/parent/arrangements")).body.arrangements.length, 0);

    // Not choosing one, or choosing the current one, reuses the same assignment.
    const created = await call(people.p1, "POST", "/api/parent/arrangements",
      arrangementBody(ids.child1, "RECEIVING", people.p2.id, { socialWorkerId: workers.workerA.id }));
    assert.equal(created.status, 201);
    assert.equal(created.body.arrangement.socialWorker.id, workers.workerA.id);
    ids.arrangement1 = created.body.arrangement.id;

    const rows = await assignmentRows(ids.child1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].social_worker_id, workers.workerA.id);

    const second = await call(people.p2, "GET", "/api/parent/arrangements");
    assert.equal(second.body.arrangements[0].socialWorker.id, workers.workerA.id);
  });

  test("an arrangement for a child with no worker needs a valid one and then assigns it", async () => {
    // A second family, then simulate a profile registered before assignments existed.
    ids.child3Number = randomChildId();
    const created = await call(people.p3, "POST", "/api/parent/children",
      childBody(ids.child3Number, { socialWorkerId: workers.workerA.id }));
    assert.equal(created.status, 201);
    ids.child3 = (await call(people.p3, "GET", "/api/parent/children")).body.children[0].id;
    await linkParent("p3", "p4", ids.child3Number, "PAYING_PARENT");
    await sql.query("DELETE FROM social_worker_assignments WHERE child_id = $1", [ids.child3]);
    assert.equal((await findChild(people.p3, ids.child3)).socialWorker, null);

    const attempt = (extra) => call(people.p4, "POST", "/api/parent/arrangements",
      arrangementBody(ids.child3, "PAYING", people.p3.id, extra));
    assert.equal((await attempt({})).status, 400);
    assert.equal((await attempt({ socialWorkerId: workers.workerInactive.id })).status, 400);
    assert.equal((await attempt({ socialWorkerId: people.p3.id })).status, 400);
    assert.equal((await attempt({ socialWorkerId: "not-a-uuid" })).status, 400);
    assert.equal((await sql.query(
      "SELECT count(*)::int AS n FROM maintenance_arrangements WHERE child_id = $1", [ids.child3]))[0].n, 0);
    assert.equal((await assignmentRows(ids.child3)).length, 0);

    const ok = await attempt({ socialWorkerId: workers.workerB.id });
    assert.equal(ok.status, 201);
    ids.arrangement3 = ok.body.arrangement.id;
    assert.equal(ok.body.arrangement.socialWorker.id, workers.workerB.id);

    const rows = await assignmentRows(ids.child3);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].assignment_status, "ACTIVE");
    assert.equal(rows[0].assigned_by, people.p4.id);
    // Both parents of that family now see the same worker.
    assert.equal((await findChild(people.p3, ids.child3)).socialWorker.id, workers.workerB.id);
    assert.equal((await findChild(people.p4, ids.child3)).socialWorker.id, workers.workerB.id);
  });

  test("a social worker sees only the children, arrangements and payments assigned to them", async () => {
    const paid = await call(people.p2, "POST", "/api/parent/payments", {
      arrangementId: ids.arrangement1, amount: 1000, paymentDate: today, paymentMethod: "EFT_BANK_TRANSFER",
    });
    assert.equal(paid.status, 201);
    ids.payment1 = paid.body.payment.id;

    const viewOf = async (worker) => ({
      children: (await call(worker, "GET", "/api/social-worker/children")).body.children.map((child) => child.id),
      arrangements: (await call(worker, "GET", "/api/social-worker/arrangements")).body.arrangements.map((item) => item.id),
      payments: (await call(worker, "GET", "/api/social-worker/payments")).body.payments.map((item) => item.id),
    });

    const a = await viewOf(workers.workerA);
    assert.deepEqual(a, { children: [ids.child1], arrangements: [ids.arrangement1], payments: [ids.payment1] });
    const b = await viewOf(workers.workerB);
    assert.deepEqual(b, { children: [ids.child3], arrangements: [ids.arrangement3], payments: [] });
    // An inactive worker cannot sign in at all, so no case data is reachable through their old token.
    assert.equal((await call(workers.workerInactive, "GET", "/api/social-worker/children")).status, 401);
    assert.equal((await call(workers.workerInactive, "GET", "/api/social-worker/payments")).status, 401);

    // The assigned worker sees the family, including both linked parents.
    const family = (await call(workers.workerA, "GET", "/api/social-worker/children")).body.children[0];
    assert.equal(family.relationships.length, 2);

    // Roles stay separate in both directions.
    assert.equal((await call(workers.workerA, "GET", "/api/parent/payments")).status, 403);
    assert.equal((await call(people.p1, "GET", "/api/social-worker/children")).status, 403);
    assert.equal((await call(workers.workerA, "PUT", `/api/parent/children/${ids.child1}/social-worker`,
      { socialWorkerId: workers.workerA.id })).status, 403);
  });

  test("only the profile creator can reassign, and history is preserved", async () => {
    const reassign = (person, childId, socialWorkerId) => call(person, "PUT",
      `/api/parent/children/${childId}/social-worker`, { socialWorkerId });

    // Not allowed: a linked parent who did not create the profile, an unrelated family, bad workers.
    assert.equal((await reassign(people.p2, ids.child1, workers.workerB.id)).status, 403);
    assert.equal((await reassign(people.p3, ids.child1, workers.workerB.id)).status, 404);
    assert.equal((await reassign(people.p1, ids.child1, workers.workerInactive.id)).status, 400);
    assert.equal((await reassign(people.p1, ids.child1, people.p2.id)).status, 400);
    assert.equal((await reassign(people.p1, ids.child1, "not-a-uuid")).status, 400);
    assert.equal((await reassign(people.p1, "not-a-uuid", workers.workerB.id)).status, 404);
    assert.equal((await call(people.p1, "PUT", `/api/parent/children/${ids.child1}/social-worker`,
      { socialWorkerId: workers.workerB.id, assignedBy: people.p2.id })).status, 400);
    assert.equal((await activeRows(ids.child1))[0].social_worker_id, workers.workerA.id);

    // Choosing the current worker is a harmless no-op.
    const same = await reassign(people.p1, ids.child1, workers.workerA.id);
    assert.equal(same.status, 200);
    assert.equal(same.body.changed, false);
    assert.equal((await assignmentRows(ids.child1)).length, 1);

    // The creator moves the family to worker B.
    const moved = await reassign(people.p1, ids.child1, workers.workerB.id);
    assert.equal(moved.status, 200);
    assert.equal(moved.body.changed, true);
    assert.equal(moved.body.child.socialWorker.id, workers.workerB.id);

    const rows = await assignmentRows(ids.child1);
    assert.equal(rows.length, 2);
    const old = rows.find((row) => row.social_worker_id === workers.workerA.id);
    assert.equal(old.assignment_status, "TRANSFERRED");
    assert.ok(old.ended_at, "the replaced assignment is stamped with when it ended");
    const current = rows.filter((row) => row.assignment_status === "ACTIVE");
    assert.equal(current.length, 1);
    assert.equal(current[0].social_worker_id, workers.workerB.id);
    assert.equal(current[0].assigned_by, people.p1.id);

    // Both parents, the arrangement and the payment follow the child to the new worker.
    assert.equal((await findChild(people.p2, ids.child1)).socialWorker.id, workers.workerB.id);
    assert.equal((await call(people.p2, "GET", "/api/parent/arrangements")).body.arrangements[0].socialWorker.id, workers.workerB.id);
    const a = await call(workers.workerA, "GET", "/api/social-worker/children");
    assert.deepEqual(a.body.children, []);
    assert.deepEqual((await call(workers.workerA, "GET", "/api/social-worker/payments")).body.payments, []);
    assert.deepEqual((await call(workers.workerA, "GET", "/api/social-worker/arrangements")).body.arrangements, []);
    const b = await call(workers.workerB, "GET", "/api/social-worker/payments");
    assert.deepEqual(b.body.payments.map((item) => item.id), [ids.payment1]);
    assert.equal((await call(workers.workerB, "GET", "/api/social-worker/children")).body.children.length, 2);

    // Moving back keeps every earlier row: three rows, still exactly one active.
    const back = await reassign(people.p1, ids.child1, workers.workerA.id);
    assert.equal(back.body.changed, true);
    const history = await assignmentRows(ids.child1);
    assert.equal(history.length, 3);
    assert.equal(history.filter((row) => row.assignment_status === "ACTIVE").length, 1);
    assert.equal((await activeRows(ids.child1))[0].social_worker_id, workers.workerA.id);
  });

  test("the creator can assign a worker to a profile that has none", async () => {
    await sql.query("DELETE FROM social_worker_assignments WHERE child_id = $1", [ids.child3]);
    assert.equal((await call(people.p4, "PUT", `/api/parent/children/${ids.child3}/social-worker`,
      { socialWorkerId: workers.workerA.id })).status, 403);

    const assigned = await call(people.p3, "PUT", `/api/parent/children/${ids.child3}/social-worker`,
      { socialWorkerId: workers.workerA.id });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.changed, true);
    assert.equal((await activeRows(ids.child3)).length, 1);
  });

  test("the database refuses a second ACTIVE worker for one child", async () => {
    await assert.rejects(
      sql.query(
        `INSERT INTO social_worker_assignments (social_worker_id, child_id, assigned_by) VALUES ($1, $2, $3)`,
        [workers.workerB.id, ids.child1, people.p1.id],
      ),
      /uq_active_child_assignment/,
    );
    assert.equal((await activeRows(ids.child1)).length, 1);
  });

  test("assignment routes require a session", async () => {
    assert.equal((await call(null, "GET", "/api/parent/social-workers")).status, 401);
    assert.equal((await call(null, "PUT", `/api/parent/children/${ids.child1}/social-worker`,
      { socialWorkerId: workers.workerA.id })).status, 401);
    assert.equal((await call(null, "GET", "/api/social-worker/children")).status, 401);
  });
});

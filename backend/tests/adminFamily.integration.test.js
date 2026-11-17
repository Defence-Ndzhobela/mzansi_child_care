// Runs against the real Neon PostgreSQL database named by DATABASE_URL in backend/.env, once migration
// 007_family_archive has been applied (the tests skip with a reminder until then). It creates throw-away
// parents, social workers and an administrator (emails tagged with a per-run id), exercises the admin
// family API and deletes everything afterwards. It is skipped when DATABASE_URL is not set.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { after, before, describe, test } = require("node:test");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/app");
const { createDatabase } = require("../src/config/database");
const { deleteTestData, getDatabaseUrl, insertSocialWorker } = require("./helpers/neonHarness");
const { secret, syntheticId, tokenFor } = require("./helpers/testApp");

const databaseUrl = getDatabaseUrl();

const PASSWORD = "AdminFamily#2026";
const runId = crypto.randomBytes(4).toString("hex");
const emailPrefix = `family-test-${runId}-`;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

const randomChildId = () => syntheticId(`200101${5000 + crypto.randomInt(0, 5000)}08`);
const emailOf = (key) => `${emailPrefix}${key}@example.test`;

describe("admin family management on Neon PostgreSQL", { skip: !databaseUrl && "DATABASE_URL is not set" }, () => {
  let sql;
  let listener;
  let base;
  let ready = false;
  const people = {};
  const workers = {};
  const ids = {};

  const scenario = (name, run) => test(name, async (t) => {
    if (!ready) return t.skip("Apply migration 007_family_archive first (npm run db:migrate).");
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
    const registered = await call(null, "POST", "/api/auth/register", {
      fullName: `Parent ${key} ${runId}`, email: emailOf(key), phone: "+27 82 000 0000", password: PASSWORD,
      confirmPassword: PASSWORD, accountType: "PARENT_CAREGIVER",
    });
    assert.equal(registered.status, 201, `register ${key}`);
    const login = await call(null, "POST", "/api/auth/login", { email: emailOf(key), password: PASSWORD });
    assert.equal(login.status, 200, `login ${key}`);
    people[key] = { id: login.body.user.id, token: login.body.token };
  }

  async function createChild(parentKey, workerKey) {
    const idNumber = randomChildId();
    const created = await call(people[parentKey], "POST", "/api/parent/children", {
      firstName: "Child", lastName: "Test", dateOfBirth: "2020-01-01", southAfricanId: idNumber,
      relationshipType: "PRIMARY_CAREGIVER", isPrimaryCaregiver: true, socialWorkerId: workers[workerKey].id,
    });
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
    const approved = await call(people[creatorKey], "POST", `/api/parent/child-link-requests/${request.id}/respond`, {
      decision: "APPROVED",
    });
    assert.equal(approved.status, 200);
  }

  const detail = async (childId) => (await call(people.admin, "GET", `/api/admin/children/${childId}`)).body?.child;
  const memberOf = (child, key) => child.parents.find((parent) => parent.id === people[key].id);
  const count = async (text, params) => (await sql.query(text, params))[0].n;
  const visibleChildren = async (key) => (await call(people[key], "GET", "/api/parent/children")).body.children.map((c) => c.id);

  before(async () => {
    sql = createDatabase(databaseUrl);
    const column = await sql.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'archived_at'");
    ready = column.length > 0;
    listener = createApp({ sql, jwtSecret: secret }).listen(0, "127.0.0.1");
    await new Promise((resolve) => listener.once("listening", resolve));
    base = `http://127.0.0.1:${listener.address().port}`;
    if (!ready) return;

    for (const key of ["p1", "p2", "p3", "p4"]) await signUp(key);
    for (const key of ["workerA", "workerB"]) {
      const id = await insertSocialWorker(sql, { email: emailOf(key), fullName: `Worker ${key} ${runId}` });
      workers[key] = { id, token: tokenFor(id) };
    }
    const adminId = (await sql`
      INSERT INTO users (full_name, email, phone, password_hash, role, account_status)
      VALUES (${`Admin ${runId}`}, ${emailOf("admin")}, '+27 82 000 0000', ${bcrypt.hashSync("Unused#Password1", 4)}, 'ADMIN', 'ACTIVE')
      RETURNING id
    `)[0].id;
    people.admin = { id: adminId, token: tokenFor(adminId) };

    // Family 1: p1 (mother) and p2 (father) with worker A, a payment history and a confirmation.
    // Family 2: p3 and p2 again (p2 belongs to two families), with worker B.
    const child1 = await createChild("p1", "workerA");
    await linkParent("p1", "p2", child1.idNumber, "FATHER");
    ids.child1 = child1.id;
    const child2 = await createChild("p3", "workerB");
    await linkParent("p3", "p2", child2.idNumber, "FATHER");
    ids.child2 = child2.id;

    const arrangement = await call(people.p1, "POST", "/api/parent/arrangements", {
      childId: ids.child1, myRole: "RECEIVING", otherUserId: people.p2.id, expectedAmount: 1500,
      frequency: "MONTHLY", startDate: `${today.slice(0, 7)}-01`,
    });
    assert.equal(arrangement.status, 201);
    ids.arrangement1 = arrangement.body.arrangement.id;
    const payment = await call(people.p2, "POST", "/api/parent/payments", {
      arrangementId: ids.arrangement1, amount: 1000, paymentDate: today, paymentMethod: "EFT_BANK_TRANSFER",
      evidence: { fileName: "slip.pdf", fileType: "application/pdf", fileSizeLabel: "120 KB", description: "slip" },
    });
    assert.equal(payment.status, 201);
    ids.payment1 = payment.body.payment.id;
    const confirmed = await call(people.p1, "POST", `/api/parent/payments/${ids.payment1}/confirmation`, { action: "CONFIRM_FULL" });
    assert.equal(confirmed.status, 200);
  });

  after(async () => {
    if (listener) await new Promise((resolve) => listener.close(resolve));
    if (sql) await deleteTestData(sql, emailPrefix);
  });

  scenario("only administrators can use the family endpoints", async () => {
    const member = "00000000-0000-4000-8000-000000000000";
    const requests = [
      ["PUT", `/api/admin/children/${ids.child1}`, { firstName: "A", lastName: "B", dateOfBirth: "2020-01-01" }],
      ["POST", `/api/admin/children/${ids.child1}/family`, { email: emailOf("p4"), relationshipType: "MOTHER", isPrimaryCaregiver: false }],
      ["PUT", `/api/admin/children/${ids.child1}/family/${member}`, { relationshipType: "MOTHER", isPrimaryCaregiver: false }],
      ["DELETE", `/api/admin/children/${ids.child1}/family/${member}`],
      ["DELETE", `/api/admin/children/${ids.child1}`],
    ];
    for (const [method, path, body] of requests) {
      assert.equal((await call(null, method, path, body)).status, 401, `${method} ${path}`);
      for (const who of [people.p1, workers.workerA]) assert.equal((await call(who, method, path, body)).status, 403, `${method} ${path}`);
    }
    assert.equal((await detail(ids.child1)).fullName, "Child Test", "nothing was changed by the refused calls");
  });

  scenario("viewing: the family lists the child, mother, father and caregivers", async () => {
    const list = (await call(people.admin, "GET", `/api/admin/children?search=${encodeURIComponent(`Parent p1 ${runId}`)}`)).body.items;
    assert.deepEqual(list.map((item) => item.id), [ids.child1]);
    const child = await detail(ids.child1);
    assert.equal(child.parents.length, 2);
    const p2 = memberOf(child, "p2");
    assert.equal(p2.relationshipType, "FATHER");
    assert.equal(p2.relationship, "Father");
    assert.ok(p2.relationshipId);
    assert.equal(memberOf(child, "p1").isPrimaryCaregiver, true);
    assert.equal(child.currentAssignment.socialWorker.id, workers.workerA.id);
  });

  scenario("editing child details is validated and saved", async () => {
    const url = `/api/admin/children/${ids.child1}`;
    const saved = await call(people.admin, "PUT", url, { firstName: " Lerato ", lastName: "Dlamini", dateOfBirth: "2019-05-17" });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.child.fullName, "Lerato Dlamini");
    assert.equal(saved.body.child.dateOfBirth, "2019-05-17");
    assert.equal((await sql.query("SELECT first_name FROM children WHERE id = $1", [ids.child1]))[0].first_name, "Lerato");
    assert.equal(await count("SELECT count(*)::int AS n FROM children WHERE id = $1 AND first_name = 'Child'", [ids.child2]), 1, "family 2 untouched");

    for (const bad of [
      { firstName: "", lastName: "X", dateOfBirth: "2019-05-17" },
      { firstName: "X", lastName: "Y", dateOfBirth: "2999-01-01" },
      { firstName: "X", lastName: "Y", dateOfBirth: "17/05/2019" },
      { firstName: "X", lastName: "Y", dateOfBirth: "2019-05-17", createdBy: people.p4.id },
      { firstName: "bad\u0000", lastName: "Y", dateOfBirth: "2019-05-17" },
    ]) assert.equal((await call(people.admin, "PUT", url, bad)).status, 400, JSON.stringify(bad).slice(0, 40));
    assert.equal((await call(people.admin, "PUT", "/api/admin/children/not-a-uuid", saved.body.child && { firstName: "X", lastName: "Y", dateOfBirth: "2019-05-17" })).status, 404);
  });

  scenario("editing a relationship changes type and primary flag, and refuses duplicates and forged fields", async () => {
    const child = await detail(ids.child1);
    const p2 = memberOf(child, "p2");
    const url = `/api/admin/children/${ids.child1}/family/${p2.relationshipId}`;
    const updated = await call(people.admin, "PUT", url, { relationshipType: "legal guardian", isPrimaryCaregiver: true });
    assert.equal(updated.status, 200);
    const after = memberOf(updated.body.child, "p2");
    assert.equal(after.relationshipType, "LEGAL_GUARDIAN");
    assert.equal(after.isPrimaryCaregiver, true);
    assert.equal(after.id, people.p2.id, "the same person");

    assert.equal((await call(people.admin, "PUT", url, { relationshipType: "COUSIN", isPrimaryCaregiver: false })).status, 400);
    assert.equal((await call(people.admin, "PUT", url, { relationshipType: "FATHER", isPrimaryCaregiver: "yes" })).status, 400);
    assert.equal((await call(people.admin, "PUT", url, { relationshipType: "FATHER", isPrimaryCaregiver: false, userId: people.p4.id })).status, 400);
    // A relationship id from another family cannot be edited through this child.
    const foreign = memberOf(await detail(ids.child2), "p3");
    assert.equal((await call(people.admin, "PUT", `/api/admin/children/${ids.child1}/family/${foreign.relationshipId}`,
      { relationshipType: "MOTHER", isPrimaryCaregiver: false })).status, 404);

    const restored = await call(people.admin, "PUT", url, { relationshipType: "FATHER", isPrimaryCaregiver: false });
    assert.equal(restored.status, 200);
  });

  scenario("adding a family member links an existing parent account only", async () => {
    const url = `/api/admin/children/${ids.child1}/family`;
    const body = { email: ` ${emailOf("p4").toUpperCase()} `, relationshipType: "EXTENDED_FAMILY_CAREGIVER", isPrimaryCaregiver: false };
    const added = await call(people.admin, "POST", url, body);
    assert.equal(added.status, 201);
    assert.equal(memberOf(added.body.child, "p4").relationship, "Extended Family Caregiver");
    assert.ok((await visibleChildren("p4")).includes(ids.child1), "the new member can now see the child");

    assert.equal((await call(people.admin, "POST", url, body)).status, 409, "same person and relationship twice");
    assert.equal((await call(people.admin, "POST", url, { ...body, email: "nobody@example.test" })).status, 404);
    assert.equal((await call(people.admin, "POST", url, { ...body, email: emailOf("workerA") })).status, 404, "a social worker is not a parent");
    assert.equal((await call(people.admin, "POST", url, { ...body, email: emailOf("admin") })).status, 404);
    assert.equal((await call(people.admin, "POST", url, { ...body, userId: people.p3.id })).status, 400);
    assert.equal((await call(people.admin, "POST", url, { ...body, relationshipType: "UNCLE" })).status, 400);
    assert.equal((await call(people.admin, "POST", url, { ...body, email: "not-an-email" })).status, 400);
    assert.equal(await count("SELECT count(*)::int AS n FROM users WHERE email LIKE $1", [`${emailPrefix}%`]), 7, "no account was created");
  });

  scenario("removing a family member keeps their account and is blocked while they are in a live arrangement", async () => {
    const child = await detail(ids.child1);
    const url = (member) => `/api/admin/children/${ids.child1}/family/${member.relationshipId}`;

    for (const key of ["p1", "p2"]) {
      const blocked = await call(people.admin, "DELETE", url(memberOf(child, key)));
      assert.equal(blocked.status, 409, key);
      assert.match(blocked.body.error, /arrangement/i);
    }
    assert.equal((await detail(ids.child1)).parents.length, 3);

    const removed = await call(people.admin, "DELETE", url(memberOf(child, "p4")));
    assert.equal(removed.status, 200);
    assert.equal(removed.body.child.parents.length, 2);
    assert.equal(memberOf(removed.body.child, "p4"), undefined);
    assert.equal((await visibleChildren("p4")).includes(ids.child1), false);
    assert.equal(await count("SELECT count(*)::int AS n FROM users WHERE id = $1", [people.p4.id]), 1, "the account is kept");

    assert.equal((await call(people.admin, "DELETE", url(memberOf(child, "p4")))).status, 404, "already removed");

    // The only remaining member of a family cannot be removed; the family is archived instead.
    const solo = await createChild("p4", "workerA");
    ids.solo = solo.id;
    const only = memberOf(await detail(ids.solo), "p4");
    const refused = await call(people.admin, "DELETE", `/api/admin/children/${ids.solo}/family/${only.relationshipId}`);
    assert.equal(refused.status, 409);
    assert.match(refused.body.error, /archive/i);
  });

  scenario("archiving a family removes its links but keeps accounts, payments, evidence and history", async () => {
    const before = {
      payments: await count("SELECT count(*)::int AS n FROM payments WHERE child_id = $1", [ids.child1]),
      evidence: await count("SELECT count(*)::int AS n FROM payment_evidence WHERE payment_id = $1", [ids.payment1]),
      confirmations: await count("SELECT count(*)::int AS n FROM payment_confirmations WHERE payment_id = $1", [ids.payment1]),
      family2Links: await count("SELECT count(*)::int AS n FROM family_relationships WHERE child_id = $1", [ids.child2]),
    };
    assert.deepEqual([before.payments, before.evidence, before.confirmations, before.family2Links], [1, 1, 1, 2]);
    await sql.query(
      "INSERT INTO professional_notes (social_worker_id, child_id, note) VALUES ($1, $2, 'case note')", [workers.workerA.id, ids.child1]);

    const archived = await call(people.admin, "DELETE", `/api/admin/children/${ids.child1}`);
    assert.equal(archived.status, 200);
    assert.equal(archived.body.outcome, "ARCHIVED");

    // Family 1 is gone from the parents' and the admin's views...
    for (const key of ["p1", "p2"]) assert.equal((await visibleChildren(key)).includes(ids.child1), false, key);
    assert.equal(await count("SELECT count(*)::int AS n FROM family_relationships WHERE child_id = $1", [ids.child1]), 0);
    assert.equal((await call(people.admin, "GET", `/api/admin/children/${ids.child1}`)).status, 404);
    const listed = (await call(people.admin, "GET", `/api/admin/children?search=${encodeURIComponent(`Parent p1 ${runId}`)}`)).body.items;
    assert.equal(listed.some((item) => item.id === ids.child1), false);

    // ...but nothing important was destroyed.
    const [child] = await sql.query("SELECT archived_at, archived_by, archived_family FROM children WHERE id = $1", [ids.child1]);
    assert.ok(child.archived_at);
    assert.equal(child.archived_by, people.admin.id);
    assert.deepEqual(child.archived_family.map((link) => link.userId).sort(), [people.p1.id, people.p2.id].sort());
    assert.equal(await count("SELECT count(*)::int AS n FROM users WHERE id = ANY($1::uuid[])", [[people.p1.id, people.p2.id]]), 2);
    assert.equal(await count("SELECT count(*)::int AS n FROM payments WHERE child_id = $1", [ids.child1]), before.payments);
    assert.equal(await count("SELECT count(*)::int AS n FROM payment_evidence WHERE payment_id = $1", [ids.payment1]), before.evidence);
    assert.equal(await count("SELECT count(*)::int AS n FROM payment_confirmations WHERE payment_id = $1", [ids.payment1]), before.confirmations);
    assert.equal(await count("SELECT count(*)::int AS n FROM professional_notes WHERE child_id = $1", [ids.child1]), 1);
    const [assignment] = await sql.query("SELECT assignment_status, ended_at, ended_by FROM social_worker_assignments WHERE child_id = $1", [ids.child1]);
    assert.equal(assignment.assignment_status, "CLOSED");
    assert.ok(assignment.ended_at);
    assert.equal(assignment.ended_by, people.admin.id);
    assert.equal((await sql.query("SELECT status FROM maintenance_arrangements WHERE id = $1", [ids.arrangement1]))[0].status, "CANCELLED");

    // Family 2, which shares the father p2, is untouched.
    assert.equal(await count("SELECT count(*)::int AS n FROM family_relationships WHERE child_id = $1", [ids.child2]), before.family2Links);
    assert.equal(await count("SELECT count(*)::int AS n FROM social_worker_assignments WHERE child_id = $1 AND assignment_status = 'ACTIVE'", [ids.child2]), 1);
    assert.ok((await visibleChildren("p2")).includes(ids.child2));
    assert.ok((await visibleChildren("p3")).includes(ids.child2));
    assert.equal((await detail(ids.child2)).parents.length, 2);

    // An archived family is frozen and cannot be archived twice.
    assert.equal((await call(people.admin, "DELETE", `/api/admin/children/${ids.child1}`)).status, 409);
    assert.equal((await call(people.admin, "PUT", `/api/admin/children/${ids.child1}`, { firstName: "X", lastName: "Y", dateOfBirth: "2019-05-17" })).status, 404);
    assert.equal((await call(people.admin, "POST", `/api/admin/children/${ids.child1}/family`, { email: emailOf("p4"), relationshipType: "MOTHER", isPrimaryCaregiver: false })).status, 404);
    assert.equal((await call(people.admin, "DELETE", `/api/admin/children/${crypto.randomUUID()}`)).status, 404);
    assert.equal((await call(people.admin, "DELETE", "/api/admin/children/not-a-uuid")).status, 404);
  });
});

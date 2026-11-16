// Runs against the real Neon PostgreSQL database named by DATABASE_URL in backend/.env.
// It registers throw-away accounts (emails tagged with a per-run id), exercises the HTTP API
// and deletes everything it created afterwards. It is skipped when DATABASE_URL is not set.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { after, before, describe, test } = require("node:test");
const { createApp } = require("../src/app");
const { createDatabase } = require("../src/config/database");
const { secret, syntheticId } = require("./helpers/testApp");
const { deleteTestData, getDatabaseUrl, insertSocialWorker } = require("./helpers/neonHarness");

const databaseUrl = getDatabaseUrl();

const PASSWORD = "Maintenance#2026";
const runId = crypto.randomBytes(4).toString("hex");
const emailPrefix = `maint-test-${runId}-`;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
const month = today.slice(0, 7);

function randomChildId() {
  const sequence = String(5000 + crypto.randomInt(0, 5000));
  return syntheticId(`200101${sequence}08`);
}

describe("maintenance arrangements and payments on Neon PostgreSQL", { skip: !databaseUrl && "DATABASE_URL is not set" }, () => {
  let sql;
  let listener;
  let base;
  const people = {};
  const state = {};

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

  async function signUp(key, fullName) {
    const email = `${emailPrefix}${key}@example.test`;
    const registered = await call(null, "POST", "/api/auth/register", {
      fullName, email, phone: "+27 82 000 0000", password: PASSWORD, confirmPassword: PASSWORD,
      accountType: key === "moses" ? "PAYING_PARENT" : "PARENT_CAREGIVER",
    });
    assert.equal(registered.status, 201, `register ${key}`);
    const login = await call(null, "POST", "/api/auth/login", { email, password: PASSWORD });
    assert.equal(login.status, 200, `login ${key}`);
    people[key] = { id: login.body.user.id, token: login.body.token, fullName };
  }

  // The first person creates the child profile, the others link to it with the creator's approval.
  // Every child is registered with a social worker, as the API now requires.
  async function createFamily(creatorKey, childName, links) {
    const idNumber = randomChildId();
    const created = await call(people[creatorKey], "POST", "/api/parent/children", {
      firstName: childName, lastName: "Test", dateOfBirth: "2020-01-01",
      southAfricanId: idNumber, relationshipType: "PRIMARY_CAREGIVER", isPrimaryCaregiver: true,
      socialWorkerId: state.socialWorkerId,
    });
    assert.equal(created.status, 201, `create child ${childName}`);
    for (const [key, relationshipType] of Object.entries(links)) {
      const requested = await call(people[key], "POST", "/api/parent/children/link-requests", {
        southAfricanId: idNumber, relationshipType,
      });
      assert.equal(requested.status, 202);
    }
    const inbox = await call(people[creatorKey], "GET", "/api/parent/child-link-requests");
    assert.equal(inbox.body.requests.length, Object.keys(links).length);
    for (const request of inbox.body.requests) {
      const approved = await call(people[creatorKey], "POST", `/api/parent/child-link-requests/${request.id}/respond`, {
        decision: "APPROVED",
      });
      assert.equal(approved.status, 200);
    }
    const children = await call(people[creatorKey], "GET", "/api/parent/children");
    return children.body.children.find((child) => child.firstName === childName).id;
  }

  const newArrangement = (childId, myRole, otherUserId, extra = {}) => ({
    childId, myRole, otherUserId, expectedAmount: 1500, frequency: "MONTHLY",
    startDate: `${month}-01`, ...extra,
  });
  const newPayment = (arrangementId, amount, extra = {}) => ({
    arrangementId, amount, paymentDate: today, paymentMethod: "EFT_BANK_TRANSFER",
    paymentReference: `TEST-${runId}`, ...extra,
  });

  before(async () => {
    sql = createDatabase(databaseUrl);
    listener = createApp({ sql, jwtSecret: secret }).listen(0, "127.0.0.1");
    await new Promise((resolve) => listener.once("listening", resolve));
    base = `http://127.0.0.1:${listener.address().port}`;

    state.socialWorkerId = await insertSocialWorker(sql, {
      email: `${emailPrefix}worker@example.test`, fullName: "Maintenance Test Worker",
    });
    // Sequential on purpose: six simultaneous registrations occasionally hit transient Neon errors.
    for (const [key, name] of [
      ["miluva", "Miluva Test"], ["moses", "Moses Test"], ["grandma", "Grandma Test"],
      ["naledi", "Naledi Test"], ["sibusiso", "Sibusiso Test"], ["lerato", "Lerato Test"],
    ]) {
      await signUp(key, name);
    }

    // Family 1: Miluva receives for the child, Moses pays, Grandma is linked but has no arrangement.
    state.defenceId = await createFamily("miluva", "Defence", {
      moses: "PAYING_PARENT", grandma: "EXTENDED_FAMILY_CAREGIVER",
    });
    // Family 2: Moses is the receiving caregiver here, so he holds both responsibilities.
    state.thandoId = await createFamily("moses", "Thando", { naledi: "PAYING_PARENT" });
    // Family 3: an unrelated family whose records Miluva and Moses must never reach.
    state.lwaziId = await createFamily("sibusiso", "Lwazi", { lerato: "PAYING_PARENT" });
  });

  after(async () => {
    if (listener) await new Promise((resolve) => listener.close(resolve));
    if (sql) await deleteTestData(sql, emailPrefix);
  });

  test("an arrangement can only be created between approved family members of the child", async () => {
    const { miluva, moses, grandma, sibusiso } = people;

    const unlinkedOther = await call(miluva, "POST", "/api/parent/arrangements",
      newArrangement(state.defenceId, "RECEIVING", sibusiso.id));
    assert.equal(unlinkedOther.status, 403);

    const foreignChild = await call(miluva, "POST", "/api/parent/arrangements",
      newArrangement(state.lwaziId, "RECEIVING", moses.id));
    assert.equal(foreignChild.status, 403);

    const withSelf = await call(miluva, "POST", "/api/parent/arrangements",
      newArrangement(state.defenceId, "RECEIVING", miluva.id));
    assert.equal(withSelf.status, 403);

    for (const forged of [{ payingUserId: grandma.id }, { receivingUserId: grandma.id }, { status: "COMPLETED" }]) {
      const result = await call(miluva, "POST", "/api/parent/arrangements",
        { ...newArrangement(state.defenceId, "RECEIVING", moses.id), ...forged });
      assert.equal(result.status, 400);
    }

    const created = await call(miluva, "POST", "/api/parent/arrangements",
      newArrangement(state.defenceId, "RECEIVING", moses.id, { notes: "Monthly maintenance" }));
    assert.equal(created.status, 201);
    const arrangement = created.body.arrangement;
    assert.equal(arrangement.payingUserId, moses.id);
    assert.equal(arrangement.receivingUserId, miluva.id);
    assert.equal(arrangement.expectedAmount, 1500);
    assert.equal(arrangement.frequency, "Monthly");
    assert.equal(arrangement.status, "Active");
    assert.equal(arrangement.myRole, "RECEIVING");
    state.arrangementId = arrangement.id;

    const duplicate = await call(moses, "POST", "/api/parent/arrangements",
      newArrangement(state.defenceId, "PAYING", miluva.id));
    assert.equal(duplicate.status, 409);

    const mosesView = await call(moses, "GET", "/api/parent/arrangements");
    assert.equal(mosesView.body.arrangements.find((item) => item.id === state.arrangementId).myRole, "PAYING");

    // Moses is the receiving caregiver for the second family, so he holds both responsibilities.
    const second = await call(moses, "POST", "/api/parent/arrangements",
      newArrangement(state.thandoId, "RECEIVING", people.naledi.id, { expectedAmount: 800 }));
    assert.equal(second.status, 201);
    state.secondArrangementId = second.body.arrangement.id;

    const third = await call(people.sibusiso, "POST", "/api/parent/arrangements",
      newArrangement(state.lwaziId, "RECEIVING", people.lerato.id, { expectedAmount: 900 }));
    assert.equal(third.status, 201);
    state.foreignArrangementId = third.body.arrangement.id;
  });

  test("Moses records R1,000 and Miluva sees it awaiting confirmation", async () => {
    const { miluva, moses } = people;

    const recorded = await call(moses, "POST", "/api/parent/payments",
      newPayment(state.arrangementId, 1000, {
        evidence: { fileName: "slip.pdf", fileType: "application/pdf", fileSizeLabel: "120 KB", description: "Bank slip" },
      }));
    assert.equal(recorded.status, 201);
    const payment = recorded.body.payment;
    assert.equal(payment.amount, 1000);
    assert.equal(payment.status, "Awaiting confirmation");
    assert.equal(payment.payingUserId, moses.id);
    assert.equal(payment.receivingUserId, miluva.id);
    assert.equal(payment.evidence.length, 1);
    assert.equal(payment.evidence[0].uploadedBy, moses.id);
    state.paymentId = payment.id;

    const miluvaPayments = await call(miluva, "GET", "/api/parent/payments");
    const seen = miluvaPayments.body.payments.find((item) => item.id === state.paymentId);
    assert.equal(seen.status, "Awaiting confirmation");
    assert.equal(seen.evidence.length, 1);

    const summary = (await call(miluva, "GET", `/api/parent/dashboard-summary?month=${month}`)).body.summary;
    assert.equal(summary.paying, null);
    assert.deepEqual(summary.receiving.awaitingConfirmation, { count: 1, amount: 1000 });
    assert.equal(summary.receiving.confirmedAmount, 0);

    const payerSummary = (await call(moses, "GET", `/api/parent/dashboard-summary?month=${month}`)).body.summary;
    assert.equal(payerSummary.paying.expectedAmount, 1500);
    assert.equal(payerSummary.paying.paidAmount, 1000);
    assert.equal(payerSummary.paying.confirmedAmount, 0);
    assert.equal(payerSummary.paying.outstandingAmount, 1500);
    assert.deepEqual(payerSummary.paying.awaitingConfirmation, { count: 1, amount: 1000 });
  });

  test("the receiving parent can record nothing, and the paying parent cannot confirm", async () => {
    const { miluva, moses, grandma } = people;

    const byReceiver = await call(miluva, "POST", "/api/parent/payments", newPayment(state.arrangementId, 500));
    assert.equal(byReceiver.status, 403);

    const forgedPayer = await call(miluva, "POST", "/api/parent/payments",
      { ...newPayment(state.arrangementId, 500), payingUserId: miluva.id, receivingUserId: moses.id });
    assert.equal(forgedPayer.status, 400);
    const forgedStatus = await call(moses, "POST", "/api/parent/payments",
      { ...newPayment(state.arrangementId, 500), status: "CONFIRMED_BY_RECIPIENT", confirmedAmount: 500 });
    assert.equal(forgedStatus.status, 400);

    const selfConfirm = await call(moses, "POST", `/api/parent/payments/${state.paymentId}/confirmation`,
      { action: "CONFIRM_FULL" });
    assert.equal(selfConfirm.status, 403);
    const selfDispute = await call(moses, "POST", `/api/parent/payments/${state.paymentId}/confirmation`,
      { action: "DISPUTE", note: "No" });
    assert.equal(selfDispute.status, 403);

    const evidenceByReceiver = await call(miluva, "POST", `/api/parent/payments/${state.paymentId}/evidence`,
      { fileName: "x.pdf", fileType: "application/pdf", fileSizeLabel: "1 KB" });
    assert.equal(evidenceByReceiver.status, 403);

    const bystanderRecord = await call(grandma, "POST", "/api/parent/payments", newPayment(state.arrangementId, 100));
    assert.equal(bystanderRecord.status, 404);
    const bystanderConfirm = await call(grandma, "POST", `/api/parent/payments/${state.paymentId}/confirmation`,
      { action: "CONFIRM_FULL" });
    assert.equal(bystanderConfirm.status, 404);

    const stillWaiting = (await call(miluva, "GET", "/api/parent/payments")).body.payments
      .find((item) => item.id === state.paymentId);
    assert.equal(stillWaiting.status, "Awaiting confirmation");
    assert.equal(stillWaiting.confirmedAmount, undefined);
  });

  test("Miluva confirms R1,000 and Moses sees R500 still outstanding", async () => {
    const { miluva, moses } = people;

    const confirmed = await call(miluva, "POST", `/api/parent/payments/${state.paymentId}/confirmation`,
      { action: "CONFIRM_FULL", note: "Received in full" });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.payment.status, "Confirmed by recipient");
    assert.equal(confirmed.body.payment.confirmedAmount, 1000);
    assert.equal(confirmed.body.payment.recipientNote, "Received in full");

    const again = await call(miluva, "POST", `/api/parent/payments/${state.paymentId}/confirmation`,
      { action: "DISPUTE", note: "Changed my mind" });
    assert.equal(again.status, 409);

    const mosesPayments = await call(moses, "GET", "/api/parent/payments");
    const seen = mosesPayments.body.payments.find((item) => item.id === state.paymentId);
    assert.equal(seen.status, "Confirmed by recipient");
    assert.equal(seen.confirmedAmount, 1000);

    const payer = (await call(moses, "GET", `/api/parent/dashboard-summary?month=${month}`)).body.summary;
    assert.equal(payer.paying.expectedAmount, 1500);
    assert.equal(payer.paying.paidAmount, 1000);
    assert.equal(payer.paying.confirmedAmount, 1000);
    assert.equal(payer.paying.outstandingAmount, 500);
    assert.deepEqual(payer.paying.awaitingConfirmation, { count: 0, amount: 0 });

    const receiver = (await call(miluva, "GET", `/api/parent/dashboard-summary?month=${month}`)).body.summary;
    assert.equal(receiver.receiving.expectedAmount, 1500);
    assert.equal(receiver.receiving.confirmedAmount, 1000);
    assert.equal(receiver.receiving.outstandingAmount, 500);
    assert.deepEqual(receiver.receiving.awaitingConfirmation, { count: 0, amount: 0 });
  });

  test("partial confirmation and disputes are validated and stored", async () => {
    const { miluva, moses } = people;
    const record = async (amount) => (await call(moses, "POST", "/api/parent/payments",
      newPayment(state.arrangementId, amount))).body.payment.id;
    const respond = (paymentId, body) => call(miluva, "POST", `/api/parent/payments/${paymentId}/confirmation`, body);

    const partialId = await record(300);
    for (const confirmedAmount of [0, 300, 450, -5]) {
      assert.equal((await respond(partialId, { action: "CONFIRM_PARTIAL", confirmedAmount })).status, 400);
    }
    assert.equal((await respond(partialId, { action: "CONFIRM_FULL", confirmedAmount: 1 })).status, 400);
    const partial = await respond(partialId, { action: "CONFIRM_PARTIAL", confirmedAmount: 120 });
    assert.equal(partial.status, 200);
    assert.equal(partial.body.payment.status, "Partially confirmed");
    assert.equal(partial.body.payment.confirmedAmount, 120);

    const disputedId = await record(200);
    assert.equal((await respond(disputedId, { action: "DISPUTE" })).status, 400);
    const disputed = await respond(disputedId, { action: "DISPUTE", note: "Nothing arrived in my account" });
    assert.equal(disputed.status, 200);
    assert.equal(disputed.body.payment.status, "Disputed");
    assert.equal(disputed.body.payment.disputeReason, "Nothing arrived in my account");
    assert.equal(disputed.body.payment.confirmedAmount, 0);

    const summary = (await call(moses, "GET", `/api/parent/dashboard-summary?month=${month}`)).body.summary;
    assert.equal(summary.paying.paidAmount, 1500);
    assert.equal(summary.paying.confirmedAmount, 1120);
    assert.equal(summary.paying.outstandingAmount, 380);
    assert.deepEqual(summary.paying.disputed, { count: 1, amount: 200 });
  });

  test("evidence can be added only by the paying parent", async () => {
    const { miluva, moses } = people;
    const evidence = { fileName: "proof.png", fileType: "image/png", fileSizeLabel: "80 KB", description: "Screenshot" };

    const added = await call(moses, "POST", `/api/parent/payments/${state.paymentId}/evidence`, evidence);
    assert.equal(added.status, 201);
    assert.equal(added.body.payment.evidence.length, 2);
    assert.equal(added.body.payment.evidence[1].fileName, "proof.png");

    assert.equal((await call(miluva, "POST", `/api/parent/payments/${state.paymentId}/evidence`, evidence)).status, 403);
    assert.equal((await call(moses, "POST", `/api/parent/payments/${state.paymentId}/evidence`,
      { ...evidence, fileType: "text/html" })).status, 400);
    assert.equal((await call(moses, "POST", `/api/parent/payments/${state.paymentId}/evidence`,
      { ...evidence, uploadedBy: miluva.id })).status, 400);
  });

  test("one account holds separate paying and receiving summaries", async () => {
    const { moses, naledi } = people;

    const paid = await call(naledi, "POST", "/api/parent/payments", newPayment(state.secondArrangementId, 800));
    assert.equal(paid.status, 201);
    assert.equal((await call(moses, "POST", "/api/parent/payments", newPayment(state.secondArrangementId, 800))).status, 403);

    const summary = (await call(moses, "GET", `/api/parent/dashboard-summary?month=${month}`)).body.summary;
    assert.equal(summary.paying.arrangementCount, 1);
    assert.equal(summary.paying.expectedAmount, 1500);
    assert.equal(summary.receiving.arrangementCount, 1);
    assert.equal(summary.receiving.expectedAmount, 800);
    assert.equal(summary.receiving.confirmedAmount, 0);
    assert.deepEqual(summary.receiving.awaitingConfirmation, { count: 1, amount: 800 });
    assert.deepEqual(summary.arrangements.map((item) => item.role).sort(), ["PAYING", "RECEIVING"]);

    const confirmed = await call(moses, "POST", `/api/parent/payments/${paid.body.payment.id}/confirmation`,
      { action: "CONFIRM_FULL" });
    assert.equal(confirmed.status, 200);
  });

  test("another family's private records stay out of reach", async () => {
    const { miluva, moses, grandma, lerato, sibusiso } = people;
    const foreignPayment = await call(lerato, "POST", "/api/parent/payments", newPayment(state.foreignArrangementId, 900));
    assert.equal(foreignPayment.status, 201);
    const foreignId = foreignPayment.body.payment.id;

    for (const person of [miluva, moses, grandma]) {
      const arrangements = (await call(person, "GET", "/api/parent/arrangements")).body.arrangements;
      const payments = (await call(person, "GET", "/api/parent/payments")).body.payments;
      assert.equal(arrangements.some((item) => item.id === state.foreignArrangementId), false);
      assert.equal(payments.some((item) => item.id === foreignId), false);
      const children = (await call(person, "GET", "/api/parent/children")).body.children;
      assert.equal(children.some((child) => child.id === state.lwaziId), false);
      assert.equal((await call(person, "POST", "/api/parent/payments", newPayment(state.foreignArrangementId, 10))).status, 404);
      assert.equal((await call(person, "POST", `/api/parent/payments/${foreignId}/confirmation`,
        { action: "CONFIRM_FULL" })).status, 404);
      assert.equal((await call(person, "POST", `/api/parent/payments/${foreignId}/evidence`,
        { fileName: "a.pdf", fileType: "application/pdf", fileSizeLabel: "1 KB" })).status, 404);
      assert.equal((await call(person, "PATCH", `/api/parent/arrangements/${state.foreignArrangementId}`,
        { expectedAmount: 1, frequency: "MONTHLY", startDate: `${month}-01`, status: "COMPLETED" })).status, 404);
    }

    const untouched = (await call(sibusiso, "GET", "/api/parent/payments")).body.payments
      .find((item) => item.id === foreignId);
    assert.equal(untouched.status, "Awaiting confirmation");

    const bystander = (await call(grandma, "GET", "/api/parent/payments")).body.payments;
    assert.deepEqual(bystander, []);
    const summary = (await call(grandma, "GET", `/api/parent/dashboard-summary?month=${month}`)).body.summary;
    assert.equal(summary.paying, null);
    assert.equal(summary.receiving, null);
  });

  test("arrangement terms can be edited by a party but its parties never change", async () => {
    const { miluva, grandma } = people;
    const terms = { expectedAmount: 1500, frequency: "MONTHLY", startDate: `${month}-01`, status: "ACTIVE", notes: "Updated" };

    const forged = await call(miluva, "PATCH", `/api/parent/arrangements/${state.arrangementId}`,
      { ...terms, payingUserId: miluva.id });
    assert.equal(forged.status, 400);
    assert.equal((await call(grandma, "PATCH", `/api/parent/arrangements/${state.arrangementId}`, terms)).status, 404);

    const updated = await call(miluva, "PATCH", `/api/parent/arrangements/${state.arrangementId}`, terms);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.arrangement.notes, "Updated");
    assert.equal(updated.body.arrangement.payingUserId, people.moses.id);
    assert.equal(updated.body.arrangement.receivingUserId, miluva.id);

    const paused = await call(miluva, "PATCH", `/api/parent/arrangements/${state.arrangementId}`,
      { ...terms, status: "PAUSED" });
    assert.equal(paused.status, 200);
    assert.equal((await call(people.moses, "POST", "/api/parent/payments", newPayment(state.arrangementId, 50))).status, 409);
    await call(miluva, "PATCH", `/api/parent/arrangements/${state.arrangementId}`, terms);
  });

  test("requests without a session or with invalid input are rejected", async () => {
    assert.equal((await call(null, "GET", "/api/parent/payments")).status, 401);
    assert.equal((await call(null, "POST", "/api/parent/payments", newPayment(state.arrangementId, 1))).status, 401);
    assert.equal((await call(null, "GET", "/api/parent/arrangements")).status, 401);

    const { moses } = people;
    for (const bad of [
      newPayment(state.arrangementId, 0),
      newPayment(state.arrangementId, -10),
      newPayment(state.arrangementId, 10.555),
      newPayment(state.arrangementId, "100"),
      newPayment(state.arrangementId, 10, { paymentDate: "2999-01-01" }),
      newPayment(state.arrangementId, 10, { paymentMethod: "BARTER" }),
      newPayment("not-a-uuid", 10),
    ]) {
      assert.equal((await call(moses, "POST", "/api/parent/payments", bad)).status, 400);
    }
    assert.equal((await call(moses, "GET", "/api/parent/dashboard-summary?month=2026-13")).status, 400);
  });

  test("the database itself rejects mismatched parties", async () => {
    const [arrangement] = await sql.query(
      "SELECT id, child_id, paying_user_id, receiving_user_id FROM maintenance_arrangements WHERE id = $1",
      [state.arrangementId],
    );

    await assert.rejects(
      sql.query(
        `INSERT INTO payments (arrangement_id, child_id, paying_user_id, receiving_user_id, amount, payment_date, payment_method, status)
         VALUES ($1, $2, $3, $4, 10, CURRENT_DATE, 'OTHER', 'AWAITING_CONFIRMATION')`,
        [arrangement.id, arrangement.child_id, arrangement.receiving_user_id, arrangement.paying_user_id],
      ),
      /fk_payment_arrangement_parties/,
    );

    const open = await call(people.moses, "POST", "/api/parent/payments", newPayment(state.arrangementId, 25));
    await assert.rejects(
      sql.query(
        `INSERT INTO payment_confirmations (payment_id, decided_by, decision, confirmed_amount)
         VALUES ($1, $2, 'CONFIRMED_FULL', 25)`,
        [open.body.payment.id, arrangement.paying_user_id],
      ),
      /fk_confirmation_payment_receiver/,
    );
  });
});

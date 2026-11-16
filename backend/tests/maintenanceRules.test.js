const assert = require("node:assert/strict");
const { test } = require("node:test");
const { splitStatements } = require("../database/migrate");
const { buildDashboardSummary } = require("../src/utils/paymentSummary");

const ME = "me";
const arrangement = (id, payingUserId, receivingUserId, extra = {}) => ({
  id, childId: `child-${id}`, payingUserId, receivingUserId, payerName: "Payer", receiverName: "Receiver",
  expectedAmount: 1500, frequency: "Monthly", startDate: "2026-01-01", status: "Active", ...extra,
});
const payment = (arrangementId, amount, status, extra = {}) => ({
  id: `${arrangementId}-${amount}-${status}`, arrangementId, amount, status, paymentDate: "2026-11-12", ...extra,
});

test("paying and receiving totals are kept apart for one account", () => {
  const summary = buildDashboardSummary({
    userId: ME,
    month: "2026-11",
    arrangements: [arrangement("pay", ME, "other"), arrangement("recv", "other", ME, { expectedAmount: 800 })],
    payments: [
      payment("pay", 1000, "Confirmed by recipient", { confirmedAmount: 1000 }),
      payment("recv", 800, "Awaiting confirmation"),
    ],
  });
  assert.equal(summary.paying.expectedAmount, 1500);
  assert.equal(summary.paying.confirmedAmount, 1000);
  assert.equal(summary.paying.outstandingAmount, 500);
  assert.equal(summary.receiving.expectedAmount, 800);
  assert.equal(summary.receiving.confirmedAmount, 0);
  assert.equal(summary.receiving.outstandingAmount, 800);
  assert.deepEqual(summary.receiving.awaitingConfirmation, { count: 1, amount: 800 });
});

test("only confirmed amounts reduce what is outstanding, and other months are ignored", () => {
  const summary = buildDashboardSummary({
    userId: ME,
    month: "2026-11",
    arrangements: [arrangement("a", ME, "other", { expectedAmount: 100.1 })],
    payments: [
      payment("a", 40.05, "Partially confirmed", { confirmedAmount: 20.02 }),
      payment("a", 30, "Disputed", { confirmedAmount: 0 }),
      payment("a", 99, "Confirmed by recipient", { paymentDate: "2026-10-30" }),
    ],
  });
  assert.equal(summary.paying.paidAmount, 70.05);
  assert.equal(summary.paying.confirmedAmount, 20.02);
  assert.equal(summary.paying.outstandingAmount, 80.08);
  assert.deepEqual(summary.paying.disputed, { count: 1, amount: 30 });
});

test("inactive or out-of-range arrangements expect nothing and weekly arrangements scale", () => {
  const summary = buildDashboardSummary({
    userId: ME,
    month: "2026-11",
    arrangements: [
      arrangement("paused", ME, "other", { status: "Paused" }),
      arrangement("ended", ME, "other", { endDate: "2026-10-31" }),
      arrangement("weekly", ME, "other", { expectedAmount: 100, frequency: "Weekly" }),
    ],
    payments: [],
  });
  assert.equal(summary.paying.expectedAmount, 400);
  assert.equal(summary.receiving, null);
});

test("migration statements keep dollar-quoted blocks together", () => {
  const statements = splitStatements(`
    -- a comment; with a semicolon
    ALTER TABLE a ADD COLUMN IF NOT EXISTS b TEXT;
    DO $$
    BEGIN
      IF TRUE THEN SELECT 1; END IF;
    END
    $$;
    INSERT INTO a VALUES ('x;y');
  `);
  assert.equal(statements.length, 3);
  assert.match(statements[1], /^DO \$\$[\s\S]*SELECT 1;[\s\S]*\$\$$/);
  assert.equal(statements[2], "INSERT INTO a VALUES ('x;y')");
});

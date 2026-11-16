const { fromCents, toCents } = require("./money");
const { ARRANGEMENT_STATUS_LABELS, FREQUENCY_LABELS, PAYMENT_STATUS_LABELS } = require("./maintenanceLabels");

const PAYING = "PAYING";
const RECEIVING = "RECEIVING";
const AWAITING = [PAYMENT_STATUS_LABELS.AWAITING_CONFIRMATION, PAYMENT_STATUS_LABELS.SUBMITTED];
const MONTHLY_FACTOR = {
  [FREQUENCY_LABELS.MONTHLY]: 1,
  [FREQUENCY_LABELS.FORTNIGHTLY]: 2,
  [FREQUENCY_LABELS.WEEKLY]: 4,
};

function monthBounds(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function expectedCentsForMonth(arrangement, month) {
  if (arrangement.status !== ARRANGEMENT_STATUS_LABELS.ACTIVE) return 0;
  const { first, last } = monthBounds(month);
  if (arrangement.startDate > last || (arrangement.endDate && arrangement.endDate < first)) return 0;
  return toCents(arrangement.expectedAmount) * (MONTHLY_FACTOR[arrangement.frequency] || 1);
}

// Only amounts the receiving parent has confirmed count as received or paid-and-accepted.
function confirmedCents(payment) {
  if (payment.status === PAYMENT_STATUS_LABELS.CONFIRMED_BY_RECIPIENT) {
    return toCents(payment.confirmedAmount ?? payment.amount);
  }
  if (payment.status === PAYMENT_STATUS_LABELS.PARTIALLY_CONFIRMED) {
    return toCents(payment.confirmedAmount ?? 0);
  }
  return 0;
}

function emptyTotals() {
  return {
    arrangementCount: 0, expected: 0, paid: 0, confirmed: 0,
    awaitingCount: 0, awaiting: 0, disputedCount: 0, disputed: 0,
  };
}

function finishTotals(totals) {
  return {
    arrangementCount: totals.arrangementCount,
    expectedAmount: fromCents(totals.expected),
    paidAmount: fromCents(totals.paid),
    confirmedAmount: fromCents(totals.confirmed),
    outstandingAmount: fromCents(Math.max(0, totals.expected - totals.confirmed)),
    awaitingConfirmation: { count: totals.awaitingCount, amount: fromCents(totals.awaiting) },
    disputed: { count: totals.disputedCount, amount: fromCents(totals.disputed) },
  };
}

// Builds the dashboard figures for one user. Arrangements where the user pays and those where
// the user receives are totalled separately, so the two kinds of money are never mixed.
// "paid" is what the paying parent recorded; "confirmed" is what the receiver accepted.
function buildDashboardSummary({ userId, month, arrangements, payments }) {
  const totals = { [PAYING]: null, [RECEIVING]: null };
  const perArrangement = [];

  for (const arrangement of arrangements) {
    const role = arrangement.payingUserId === userId ? PAYING
      : arrangement.receivingUserId === userId ? RECEIVING : null;
    if (!role) continue;

    const own = payments.filter((payment) => payment.arrangementId === arrangement.id);
    const inMonth = own.filter((payment) => payment.paymentDate.startsWith(month));
    const line = {
      expected: expectedCentsForMonth(arrangement, month),
      paid: inMonth.reduce((sum, payment) => sum + toCents(payment.amount), 0),
      confirmed: inMonth.reduce((sum, payment) => sum + confirmedCents(payment), 0),
    };
    const awaiting = own.filter((payment) => AWAITING.includes(payment.status));
    const disputed = own.filter((payment) => payment.status === PAYMENT_STATUS_LABELS.DISPUTED);
    line.awaitingCount = awaiting.length;
    line.awaiting = awaiting.reduce((sum, payment) => sum + toCents(payment.amount), 0);
    line.disputedCount = disputed.length;
    line.disputed = disputed.reduce((sum, payment) => sum + toCents(payment.amount), 0);

    totals[role] ||= emptyTotals();
    totals[role].arrangementCount += 1;
    for (const key of ["expected", "paid", "confirmed", "awaitingCount", "awaiting", "disputedCount", "disputed"]) {
      totals[role][key] += line[key];
    }

    perArrangement.push({
      arrangementId: arrangement.id,
      childId: arrangement.childId,
      role,
      counterpartyName: role === PAYING ? arrangement.receiverName : arrangement.payerName,
      expectedAmount: fromCents(line.expected),
      paidAmount: fromCents(line.paid),
      confirmedAmount: fromCents(line.confirmed),
      outstandingAmount: fromCents(Math.max(0, line.expected - line.confirmed)),
      awaitingConfirmationCount: line.awaitingCount,
    });
  }

  return {
    month,
    paying: totals[PAYING] ? finishTotals(totals[PAYING]) : null,
    receiving: totals[RECEIVING] ? finishTotals(totals[RECEIVING]) : null,
    arrangements: perArrangement,
  };
}

module.exports = { buildDashboardSummary };

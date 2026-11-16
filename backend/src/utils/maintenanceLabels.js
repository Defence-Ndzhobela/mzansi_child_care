const PAYMENT_METHOD_LABELS = Object.freeze({
  EFT_BANK_TRANSFER: "EFT Bank Transfer",
  E_WALLET_INSTANT_MONEY: "eWallet / Instant Money",
  CASH_WITH_RECEIPT: "Cash with Receipt",
  RETAIL_MONEY_TRANSFER: "Retail Money Transfer",
  OTHER: "Other",
});

const PAYMENT_STATUS_LABELS = Object.freeze({
  SUBMITTED: "Submitted",
  AWAITING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED_BY_RECIPIENT: "Confirmed by recipient",
  PARTIALLY_CONFIRMED: "Partially confirmed",
  DISPUTED: "Disputed",
});

const ARRANGEMENT_STATUS_LABELS = Object.freeze({
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

const FREQUENCY_LABELS = Object.freeze({
  MONTHLY: "Monthly",
  FORTNIGHTLY: "Fortnightly",
  WEEKLY: "Weekly",
});

// Arrangement statuses a parent may choose. Cancelling is not offered by the UI.
const EDITABLE_ARRANGEMENT_STATUSES = Object.freeze(["ACTIVE", "PAUSED", "COMPLETED"]);

module.exports = {
  ARRANGEMENT_STATUS_LABELS,
  EDITABLE_ARRANGEMENT_STATUSES,
  FREQUENCY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
};

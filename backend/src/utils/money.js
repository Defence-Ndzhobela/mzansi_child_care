const MAX_AMOUNT_ZAR = 1000000;

// DECIMAL columns arrive as strings; all arithmetic is done in whole cents.
function toCents(value) {
  return Math.round(Number(value) * 100);
}

function fromCents(cents) {
  return cents / 100;
}

// Returns the amount in rand when it is a positive number with at most two decimals, else null.
function parseAmount(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  if (cents <= 0 || Math.abs(value * 100 - cents) > 1e-6 || value > MAX_AMOUNT_ZAR) return null;
  return fromCents(cents);
}

module.exports = { fromCents, parseAmount, toCents };

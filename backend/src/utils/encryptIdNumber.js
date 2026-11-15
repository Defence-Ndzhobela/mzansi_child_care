const { createHmac } = require("node:crypto");

// South African ID numbers are never stored. Only a keyed HMAC-SHA-256 digest
// is persisted for lookups; it cannot be reversed to recover the ID number.

function normalizeSouthAfricanId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s/g, "");
  if (!/^\d{13}$/.test(normalized)) return null;

  const year = 2000 + Number(normalized.slice(0, 2));
  const month = Number(normalized.slice(2, 4));
  const day = Number(normalized.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day) return null;

  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    let digit = Number(normalized[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  if ((sum + Number(normalized[12])) % 10 !== 0) return null;
  return normalized;
}

// The lookup key is derived from JWT_SECRET with a fixed purpose label. Do not
// change the label, algorithm or derivation: stored digests would stop matching.
// Rotating JWT_SECRET requires re-keying every stored digest (see README).
function childIdLookupHash(normalizedId, jwtSecret) {
  const lookupKey = createHmac("sha256", jwtSecret)
    .update("mzansi-child-sa-id-lookup:v1")
    .digest();
  return createHmac("sha256", lookupKey).update(normalizedId).digest("hex");
}

module.exports = { childIdLookupHash, normalizeSouthAfricanId };

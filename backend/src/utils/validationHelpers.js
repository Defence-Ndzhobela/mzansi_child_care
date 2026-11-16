const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function hasControlCharacters(value) {
  return CONTROL_CHARACTERS.test(value);
}

// Multi-line free text: control characters are rejected except tab, carriage return and newline.
function isPlainText(value, maxLength) {
  return typeof value === "string" && value.length <= maxLength &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Rejects any request field that is not on the allow-list, so clients cannot smuggle in
// values such as paying or receiving user IDs.
function hasOnlyAllowedKeys(body, allowedKeys) {
  return Boolean(body) && typeof body === "object" && !Array.isArray(body) &&
    Object.keys(body).every((key) => allowedKeys.includes(key));
}

module.exports = { hasControlCharacters, hasOnlyAllowedKeys, isIsoDate, isPlainText, isUuid };

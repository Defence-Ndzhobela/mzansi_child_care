const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function hasControlCharacters(value) {
  return CONTROL_CHARACTERS.test(value);
}

module.exports = { hasControlCharacters, isUuid };

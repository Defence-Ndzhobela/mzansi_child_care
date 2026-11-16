const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// "!" is the LIKE escape character (queries say ESCAPE '!'), so a search for "50%" is matched literally.
function likePattern(search) {
  const text = typeof search === "string" ? search.trim().slice(0, 100) : "";
  if (!text) return null;
  return `%${text.replace(/[!%_]/g, (character) => `!${character}`)}%`;
}

function toPositiveInt(value, fallback, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

// Reads ?page, ?pageSize and ?search from a query string. Everything is clamped, never trusted.
function parsePaging(query) {
  const page = toPositiveInt(query.page, 1, 100000);
  const pageSize = toPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, pageSize, offset: (page - 1) * pageSize, search: likePattern(query.search) };
}

function pageResult(rows, { page, pageSize }) {
  const total = rows.length ? Number(rows[0].total) : 0;
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

module.exports = { pageResult, parsePaging };

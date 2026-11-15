const assert = require("node:assert/strict");
const { test } = require("node:test");
const { childIdLookupHash, normalizeSouthAfricanId } = require("../src/utils/encryptIdNumber");
const { syntheticId } = require("./helpers/testApp");

test("validates and normalizes a synthetic South African ID without retaining it", () => {
  const id = syntheticId("000101500908");
  assert.equal(normalizeSouthAfricanId(id), id);
  assert.equal(normalizeSouthAfricanId(`${id.slice(0, 6)} ${id.slice(6)}`), id);
  assert.equal(normalizeSouthAfricanId(`${id.slice(0, 12)}${(Number(id[12]) + 1) % 10}`), null);
  assert.equal(normalizeSouthAfricanId("0002315009080"), null);
  assert.equal(normalizeSouthAfricanId("not-an-id"), null);
});

test("uses a keyed digest for child ID lookup", () => {
  const id = syntheticId("000101500908");
  const normalized = normalizeSouthAfricanId(id);
  const digest = childIdLookupHash(normalized, "a-long-test-secret-for-hmac-derivation");
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, childIdLookupHash(normalized, "a-long-test-secret-for-hmac-derivation"));
  assert.notEqual(digest, id);
  assert.notEqual(digest, childIdLookupHash(normalized, "a-different-test-secret"));
});

test("the digest algorithm and key derivation match the stored digests", () => {
  // Known-answer value: changing it would orphan every existing child lookup digest.
  assert.equal(
    childIdLookupHash("0001015009085", "a-long-test-secret-for-hmac-derivation"),
    "bbeee1c256ea7d4e9ff1bd0b76518cfa10bd98141b2d9b20a3f8062a6c38c88a",
  );
});

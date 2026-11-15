const assert = require("node:assert/strict");
const { test } = require("node:test");
const { childIdLookupHash } = require("../src/utils/encryptIdNumber");
const {
  apiAs, otherParent, parent, secret, socialWorker, state, syntheticId, thirdParent, useTestServer,
} = require("./helpers/testApp");

const server = useTestServer();
const asParent = apiAs(server, parent.id);

function childPayload(overrides = {}) {
  return JSON.stringify({
    firstName: "Defence",
    lastName: "Example",
    dateOfBirth: "2020-01-01",
    southAfricanId: syntheticId(),
    relationshipType: "MOTHER",
    isPrimaryCaregiver: true,
    ...overrides,
  });
}

test("a created child is stored with a keyed digest and never echoes the ID number", async () => {
  const idNumber = syntheticId();
  const create = await asParent("/api/parent/children", { method: "POST", body: childPayload() });
  assert.equal(create.status, 201);
  const createdBody = await create.json();
  assert.equal(typeof createdBody.message, "string");
  assert.equal(JSON.stringify(createdBody).includes(idNumber), false);

  const list = await asParent("/api/parent/children");
  const { children } = await list.json();
  assert.equal(children.length, 1);
  assert.equal(children[0].firstName, "Defence");
  assert.equal(children[0].dateOfBirth, "2020-01-01");
  assert.equal(children[0].relationships.length, 1);
  assert.equal(children[0].relationships[0].relationshipType, "Mother");

  const storedHash = state.children.get(children[0].id).national_id_lookup_hash;
  assert.equal(storedHash, childIdLookupHash(idNumber, secret));
  assert.equal(JSON.stringify(children).includes(idNumber), false);
  assert.equal(JSON.stringify(children).includes(storedHash), false);
});

test("a parent who is not linked cannot see the child", async () => {
  const response = await apiAs(server, otherParent.id)("/api/parent/children");
  assert.deepEqual((await response.json()).children, []);
});

test("submitting an existing ID gives the same response and creates no second child", async () => {
  const first = await asParent("/api/parent/children", { method: "POST", body: childPayload() });
  const duplicate = await apiAs(server, otherParent.id)("/api/parent/children", {
    method: "POST",
    body: childPayload({ firstName: "Other", relationshipType: "FATHER", isPrimaryCaregiver: false }),
  });
  assert.equal(duplicate.status, 201);
  assert.deepEqual(await duplicate.json(), await first.json());
  assert.equal(state.children.size, 1);
});

test("only the creator can edit a child profile", async () => {
  const [childId] = [...state.children.keys()];
  const body = JSON.stringify({ firstName: "Renamed", lastName: "Example", dateOfBirth: "2020-01-01" });
  const denied = await apiAs(server, otherParent.id)(`/api/parent/children/${childId}`, { method: "PATCH", body });
  assert.equal(denied.status, 404);
  const updated = await asParent(`/api/parent/children/${childId}`, { method: "PATCH", body });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).child.firstName, "Renamed");
  assert.equal((await asParent("/api/parent/children/not-a-uuid", { method: "PATCH", body })).status, 404);
});

test("child creation rejects invalid input", async () => {
  for (const invalid of [
    { firstName: " " },
    { dateOfBirth: "2999-01-01" },
    { dateOfBirth: "2020-02-31" },
    { southAfricanId: "1234567890123" },
    { relationshipType: "UNCLE" },
    { isPrimaryCaregiver: "yes" },
  ]) {
    const response = await asParent("/api/parent/children", { method: "POST", body: childPayload(invalid) });
    assert.equal(response.status, 400);
  }
});

test("child routes enforce authentication and the parent role", async () => {
  assert.equal((await fetch(`${server.base}/api/parent/children`)).status, 401);
  const asWorker = apiAs(server, socialWorker.id);
  assert.equal((await asWorker("/api/parent/children")).status, 403);
  assert.equal((await asWorker("/api/parent/children", { method: "POST", body: childPayload() })).status, 403);
  assert.equal((await asParent("/api/social-worker/children")).status, 403);
  const assigned = await asWorker("/api/social-worker/children");
  assert.equal(assigned.status, 200);
  assert.deepEqual((await assigned.json()).children, []);
});

test("child ID submissions are rate limited per user", async () => {
  const asThird = apiAs(server, thirdParent.id);
  const statuses = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    statuses.push((await asThird("/api/parent/children", { method: "POST", body: childPayload() })).status);
  }
  assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
});

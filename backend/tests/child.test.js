const assert = require("node:assert/strict");
const { test } = require("node:test");
const { childIdLookupHash } = require("../src/utils/encryptIdNumber");
const {
  apiAs, inactiveSocialWorker, otherParent, otherSocialWorker, parent, secret, socialWorker, state,
  syntheticId, thirdParent, useTestServer,
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
    socialWorkerId: socialWorker.id,
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
  assert.deepEqual(children[0].socialWorker, { id: socialWorker.id, fullName: socialWorker.full_name });

  const storedHash = state.children.get(children[0].id).national_id_lookup_hash;
  assert.equal(storedHash, childIdLookupHash(idNumber, secret));
  assert.equal(JSON.stringify(children).includes(idNumber), false);
  assert.equal(JSON.stringify(children).includes(storedHash), false);
});

test("available social workers are listed from the backend, to parents only", async () => {
  const response = await asParent("/api/parent/social-workers");
  assert.equal(response.status, 200);
  const { socialWorkers } = await response.json();
  assert.deepEqual(socialWorkers.map((worker) => worker.id), [socialWorker.id, otherSocialWorker.id]);
  assert.equal(JSON.stringify(socialWorkers).includes("@"), false);
  assert.equal((await fetch(`${server.base}/api/parent/social-workers`)).status, 401);
  assert.equal((await apiAs(server, socialWorker.id)("/api/parent/social-workers")).status, 403);
});

test("a child cannot be created without choosing an available social worker", async () => {
  const before = state.children.size;
  const unavailable = [
    {}, // no worker at all
    { socialWorkerId: null },
    { socialWorkerId: "not-a-uuid" },
    { socialWorkerId: inactiveSocialWorker.id },
    { socialWorkerId: parent.id }, // a real account that is not a social worker
    { socialWorkerId: "99999999-9999-4999-8999-999999999999" },
  ];
  for (const overrides of unavailable) {
    const body = JSON.parse(childPayload({ southAfricanId: syntheticId("200303500908"), ...overrides }));
    if (!Object.hasOwn(overrides, "socialWorkerId")) delete body.socialWorkerId;
    const response = await asParent("/api/parent/children", { method: "POST", body: JSON.stringify(body) });
    assert.equal(response.status, 400, JSON.stringify(overrides));
  }
  assert.equal(state.children.size, before);
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
});

test("a social worker sees only the children assigned to them", async () => {
  const assigned = await apiAs(server, socialWorker.id)("/api/social-worker/children");
  assert.equal(assigned.status, 200);
  const { children } = await assigned.json();
  assert.equal(children.length, 1);
  assert.equal(children[0].socialWorker.id, socialWorker.id);

  const other = await apiAs(server, otherSocialWorker.id)("/api/social-worker/children");
  assert.deepEqual((await other.json()).children, []);
});

test("child ID submissions are rate limited per user", async () => {
  const asThird = apiAs(server, thirdParent.id);
  const statuses = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    statuses.push((await asThird("/api/parent/children", { method: "POST", body: childPayload() })).status);
  }
  assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
});

test("a second parent shares the same child and the same social worker", async () => {
  const asSecondParent = apiAs(server, otherParent.id);
  const [existingId] = [...state.children.keys()];
  const assignedBefore = state.assignments.get(existingId);

  // The second parent picks a different worker: the child keeps its one assignment.
  const duplicate = await asSecondParent("/api/parent/children", {
    method: "POST",
    body: childPayload({ socialWorkerId: otherSocialWorker.id, relationshipType: "FATHER", isPrimaryCaregiver: false }),
  });
  assert.equal(duplicate.status, 201);
  assert.equal(state.children.size, 1);
  assert.equal(state.assignments.size, 1);
  assert.equal(state.assignments.get(existingId), assignedBefore);

  const inbox = await (await asParent("/api/parent/child-link-requests")).json();
  const approved = await asParent(`/api/parent/child-link-requests/${inbox.requests[0].id}/respond`, {
    method: "POST",
    body: JSON.stringify({ decision: "APPROVED" }),
  });
  assert.equal(approved.status, 200);

  const first = (await (await asParent("/api/parent/children")).json()).children[0];
  const second = (await (await asSecondParent("/api/parent/children")).json()).children[0];
  assert.equal(second.id, first.id);
  assert.deepEqual(second.socialWorker, first.socialWorker);
  assert.equal(second.socialWorker.id, socialWorker.id);
});

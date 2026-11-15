const assert = require("node:assert/strict");
const { test } = require("node:test");
const { apiAs, otherParent, parent, syntheticId, useTestServer } = require("./helpers/testApp");

const server = useTestServer();
const asCreator = apiAs(server, parent.id);
const asRequester = apiAs(server, otherParent.id);
const idNumber = syntheticId();

const post = (body) => ({ method: "POST", body: JSON.stringify(body) });
const decision = (value) => post({ decision: value });

test("linking needs the creator's approval before a second parent gains access", async () => {
  await asCreator("/api/parent/children", post({
    firstName: "Defence", lastName: "Example", dateOfBirth: "2020-01-01",
    southAfricanId: idNumber, relationshipType: "MOTHER", isPrimaryCaregiver: true,
  }));

  const request = await asRequester("/api/parent/children/link-requests", post({
    southAfricanId: idNumber, relationshipType: "FATHER",
  }));
  assert.equal(request.status, 202);
  assert.equal(JSON.stringify(await request.json()).includes(idNumber), false);
  assert.deepEqual((await (await asRequester("/api/parent/children")).json()).children, []);

  const inbox = await (await asCreator("/api/parent/child-link-requests")).json();
  assert.equal(inbox.requests.length, 1);
  assert.equal(inbox.requests[0].requesterEmail, otherParent.email);
  assert.equal(inbox.requests[0].relationshipType, "Father");
  const requestId = inbox.requests[0].id;

  const byRequester = await asRequester(`/api/parent/child-link-requests/${requestId}/respond`, decision("APPROVED"));
  assert.equal(byRequester.status, 404);
  assert.deepEqual((await (await asRequester("/api/parent/children")).json()).children, []);
  assert.deepEqual((await (await asRequester("/api/parent/child-link-requests")).json()).requests, []);

  const approved = await asCreator(`/api/parent/child-link-requests/${requestId}/respond`, decision("APPROVED"));
  assert.equal(approved.status, 200);
  assert.deepEqual(await approved.json(), { status: "APPROVED" });

  const shared = (await (await asRequester("/api/parent/children")).json()).children;
  assert.equal(shared.length, 1);
  assert.equal(shared[0].firstName, "Defence");
  assert.equal(shared[0].relationships.length, 2);

  const again = await asCreator(`/api/parent/child-link-requests/${requestId}/respond`, decision("REJECTED"));
  assert.equal(again.status, 404);
});

test("an unknown ID number gets the same response and creates no request", async () => {
  const unknown = await asRequester("/api/parent/children/link-requests", post({
    southAfricanId: syntheticId("200202500908"), relationshipType: "FATHER",
  }));
  assert.equal(unknown.status, 202);
  assert.deepEqual((await (await asCreator("/api/parent/child-link-requests")).json()).requests, []);
});

test("link requests and decisions reject invalid input and non-parents", async () => {
  const invalidRequests = [
    { southAfricanId: "123", relationshipType: "FATHER" },
    { southAfricanId: idNumber, relationshipType: "NEIGHBOUR" },
  ];
  for (const body of invalidRequests) {
    assert.equal((await asRequester("/api/parent/children/link-requests", post(body))).status, 400);
  }
  const requestId = "66666666-6666-4666-8666-666666666601";
  assert.equal((await asCreator(`/api/parent/child-link-requests/${requestId}  /respond`, decision("MAYBE"))).status, 400);
    assert.equal((await asCreator("/api/parent/child-link-requests/not-a-uuid/respond", decision("APPROVED"))).status, 400);
  assert.equal((await fetch(`${server.base}/api/parent/child-link-requests`)).status, 401);
});

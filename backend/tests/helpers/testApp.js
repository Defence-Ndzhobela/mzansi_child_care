const { after, before } = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createApp } = require("../../src/app");

const secret = "test-secret-with-at-least-thirty-two-bytes";

const parent = {
  id: "11111111-1111-4111-8111-111111111101",
  full_name: "Demo Parent",
  email: "parent@demo.co.za",
  role: "PARENT_CAREGIVER",
  account_status: "ACTIVE",
  password_hash: bcrypt.hashSync("Demo@12345", 4),
};
const otherParent = {
  id: "33333333-3333-4333-8333-333333333301",
  full_name: "Other Parent",
  email: "other@example.test",
  role: "PARENT_CAREGIVER",
  account_status: "ACTIVE",
};
const thirdParent = {
  id: "33333333-3333-4333-8333-333333333302",
  full_name: "Third Parent",
  email: "third@example.test",
  role: "PARENT_CAREGIVER",
  account_status: "ACTIVE",
};
const socialWorker = {
  id: "88888888-8888-4888-8888-888888888801",
  full_name: "Demo Worker",
  email: "worker@demo.co.za",
  role: "SOCIAL_WORKER",
  account_status: "ACTIVE",
};
const otherSocialWorker = {
  id: "88888888-8888-4888-8888-888888888802",
  full_name: "Second Worker",
  email: "worker2@demo.co.za",
  role: "SOCIAL_WORKER",
  account_status: "ACTIVE",
};
const inactiveSocialWorker = {
  id: "88888888-8888-4888-8888-888888888803",
  full_name: "Inactive Worker",
  email: "inactive@demo.co.za",
  role: "SOCIAL_WORKER",
  account_status: "INACTIVE",
};

// In-memory stand-in for the Neon database, keyed on the SQL each service sends.
const state = {
  registered: new Map(),
  children: new Map(),
  childRelationships: new Map(),
  linkRequests: new Map(),
  // child id -> social worker id of the ACTIVE assignment
  assignments: new Map(),
  failInsert: false,
};

const isActiveWorker = (id) => [socialWorker, otherSocialWorker].some((worker) => worker.id === id);

async function fakeSql(strings, ...values) {
  const { registered, children, childRelationships, linkRequests, assignments } = state;
  const query = strings.join("?");
  if (query.includes("SELECT version()")) return [{ version: "PostgreSQL" }];
  if (query.includes("WHERE lower(email)")) {
    const found = values[0] === parent.email ? parent : registered.get(values[0]);
    return found ? [found] : [];
  }
  if (query.includes("INSERT INTO users")) {
    if (state.failInsert) throw new Error("database unavailable");
    const [fullName, email, phone, passwordHash] = values;
    if (registered.has(email)) {
      const error = new Error("duplicate");
      error.code = "23505";
      error.constraint = "users_email_key";
      throw error;
    }
    const created = {
      id: "22222222-2222-4222-8222-222222222201",
      full_name: fullName,
      email,
      phone,
      password_hash: passwordHash,
      role: "PARENT_CAREGIVER",
      account_status: "ACTIVE",
    };
    registered.set(email, created);
    return [created];
  }
  if (query.includes("WITH existing_child AS")) {
    const [idHash, socialWorkerId, firstName, lastName, dateOfBirth, createdBy, lookupHash, , relationshipType, isPrimary] = values;
    const existing = [...children.values()].find((child) => child.national_id_lookup_hash === idHash);
    if (existing) {
      const alreadyLinked = existing.created_by === createdBy ||
        (childRelationships.get(existing.id) || []).some((rel) => rel.userId === createdBy);
      if (!alreadyLinked) {
        linkRequests.set("66666666-6666-4666-8666-666666666602", {
          id: "66666666-6666-4666-8666-666666666602",
          childId: existing.id,
          requesterId: createdBy,
          relationshipType,
          status: "PENDING",
          requestedAt: "2026-11-15T00:01:00.000Z",
        });
      }
      return [{ accepted: true }];
    }
    // The real statement creates nothing at all when the worker is not an active social worker.
    if (!isActiveWorker(socialWorkerId)) return [{ accepted: true }];
    const child = {
      id: "44444444-4444-4444-8444-444444444401",
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      created_by: createdBy,
      created_at: "2026-11-15T00:00:00.000Z",
      updated_at: "2026-11-15T00:00:00.000Z",
      national_id_lookup_hash: lookupHash,
    };
    children.set(child.id, child);
    assignments.set(child.id, socialWorkerId);
    childRelationships.set(child.id, [{
      id: "55555555-5555-4555-8555-555555555501",
      userId: createdBy,
      fullName: parent.full_name,
      email: parent.email,
      relationshipType,
      isPrimaryCaregiver: isPrimary,
      createdAt: child.created_at,
    }]);
    return [{ accepted: true }];
  }
  if (query.includes("ORDER BY full_name")) {
    return [socialWorker, otherSocialWorker].map(({ id, full_name }) => ({ id, full_name }));
  }
  if (query.trim().startsWith("SELECT id FROM users") && query.includes("role = 'SOCIAL_WORKER'")) {
    return isActiveWorker(values[0]) ? [{ id: values[0] }] : [];
  }
  if (query.includes("SELECT c.id, c.first_name")) {
    const [role, userId] = values;
    const workers = [socialWorker, otherSocialWorker];
    return [...children.values()]
      .filter((child) => role === "PARENT_CAREGIVER"
        ? child.created_by === userId || (childRelationships.get(child.id) || []).some((rel) => rel.userId === userId)
        : assignments.get(child.id) === userId)
      .map((child) => {
        const worker = workers.find((item) => item.id === assignments.get(child.id));
        return {
          ...child,
          social_worker: worker ? { id: worker.id, fullName: worker.full_name } : null,
          relationships: childRelationships.get(child.id) || [],
        };
      });
  }
  if (query.includes("UPDATE children")) {
    const [firstName, lastName, dateOfBirth, childId, userId] = values;
    const child = children.get(childId);
    if (!child || child.created_by !== userId) return [];
    Object.assign(child, { first_name: firstName, last_name: lastName, date_of_birth: dateOfBirth });
    return [child];
  }
  if (query.includes("INSERT INTO child_link_requests")) {
    const [requesterId, relationshipType, idHash] = values;
    const child = [...children.values()].find((item) => item.national_id_lookup_hash === idHash);
    if (child && child.created_by !== requesterId &&
        !(childRelationships.get(child.id) || []).some((rel) => rel.userId === requesterId) &&
        ![...linkRequests.values()].some((item) => item.childId === child.id &&
          item.requesterId === requesterId && item.status === "PENDING")) {
      const request = {
        id: "66666666-6666-4666-8666-666666666601",
        childId: child.id,
        requesterId,
        relationshipType,
        status: "PENDING",
        requestedAt: "2026-11-15T00:01:00.000Z",
      };
      linkRequests.set(request.id, request);
    }
    return [];
  }
  if (query.includes("FROM child_link_requests r") && query.includes("WHERE c.created_by")) {
    const creatorId = values[0];
    return [...linkRequests.values()]
      .filter((request) => request.status === "PENDING" &&
        children.get(request.childId)?.created_by === creatorId)
      .map((request) => ({
        id: request.id,
        relationship_type: request.relationshipType,
        requested_at: request.requestedAt,
        child_id: request.childId,
        first_name: children.get(request.childId).first_name,
        last_name: children.get(request.childId).last_name,
        requester_id: request.requesterId,
        requester_name: otherParent.full_name,
        requester_email: otherParent.email,
      }));
  }
  if (query.includes("WITH responded AS")) {
    const [decision, reviewerId, requestId] = values;
    const request = linkRequests.get(requestId);
    const child = request && children.get(request.childId);
    if (!request || !child || child.created_by !== reviewerId || request.status !== "PENDING") return [];
    request.status = decision;
    if (decision === "APPROVED") {
      childRelationships.get(child.id).push({
        id: "77777777-7777-4777-8777-777777777701",
        userId: request.requesterId,
        fullName: otherParent.full_name,
        email: otherParent.email,
        relationshipType: request.relationshipType,
        isPrimaryCaregiver: false,
        createdAt: request.requestedAt,
      });
    }
    return [{ child_id: child.id, status: request.status }];
  }
  if (query.includes("WHERE id")) {
    return [parent, otherParent, thirdParent, socialWorker, otherSocialWorker, inactiveSocialWorker, ...registered.values()]
      .filter((item) => item.id === values[0]);
  }
  throw new Error("Unexpected query");
}

// Registers before/after hooks that start the app on an ephemeral port.
function useTestServer() {
  const server = { base: "" };
  let listener;
  before(async () => {
    listener = createApp({ sql: fakeSql, jwtSecret: secret }).listen(0, "127.0.0.1");
    await new Promise((resolve) => listener.once("listening", resolve));
    server.base = `http://127.0.0.1:${listener.address().port}`;
  });
  after(() => new Promise((resolve) => listener.close(resolve)));
  return server;
}

function tokenFor(userId) {
  return jwt.sign({}, secret, { subject: userId, expiresIn: "1h" });
}

function apiAs(server, userId) {
  return (path, options = {}) => fetch(`${server.base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokenFor(userId)}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
}

// Builds a Luhn-valid synthetic South African ID number for a 2000s date of birth.
function syntheticId(prefix = "200101500908") {
  const sum = [...prefix].reduce((total, character, index) => {
    let digit = Number(character);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    return total + digit;
  }, 0);
  return `${prefix}${(10 - (sum % 10)) % 10}`;
}

module.exports = {
  apiAs, inactiveSocialWorker, otherParent, otherSocialWorker, parent, secret, socialWorker, state,
  syntheticId, thirdParent, tokenFor, useTestServer,
};

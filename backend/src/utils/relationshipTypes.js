const RELATIONSHIP_LABELS = Object.freeze({
  MOTHER: "Mother",
  FATHER: "Father",
  PRIMARY_CAREGIVER: "Primary Caregiver",
  PAYING_PARENT: "Paying Parent",
  LEGAL_GUARDIAN: "Legal Guardian",
  EXTENDED_FAMILY_CAREGIVER: "Extended Family Caregiver",
});

function normalizeRelationshipType(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[\s-]+/g, "_").toUpperCase();
  return Object.hasOwn(RELATIONSHIP_LABELS, normalized) ? normalized : null;
}

function relationshipLabel(type, fallback) {
  return RELATIONSHIP_LABELS[type] || fallback;
}

module.exports = { normalizeRelationshipType, relationshipLabel };

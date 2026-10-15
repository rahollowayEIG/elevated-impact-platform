// Shared, deterministic scan intake/review contract.
// This module never fetches URLs, calls a provider, grants access or writes data.
// A trusted server must resolve session, scope, source ownership and target adapter.

export const SCAN_SOURCE_KINDS = Object.freeze([
  "website", "document", "image", "spreadsheet", "gis", "text", "recording",
]);

const schemas = {
  hangar_profile: {
    owner: "organizations",
    records: {
      organization: ["name", "website", "address", "phone", "description", "business_type"],
    },
  },
  restaurant_menu: {
    owner: "set_the_table",
    records: {
      menu: ["name", "currency"],
      section: ["name", "description", "sort_order"],
      menu_item: ["name", "section", "description", "price", "sku", "modifier_notes"],
    },
  },
  event_brief: {
    owner: "event_builder",
    records: {
      event: ["name", "date", "time", "venue", "address", "description"],
      activity: ["name", "date", "time", "location", "notes"],
    },
  },
  product_catalog: {
    owner: "eic",
    records: {
      product: ["name", "sku", "description", "variant", "price", "image_reference"],
    },
  },
  venue_map: {
    owner: "mapping_studio",
    records: {
      feature: ["name", "type", "hole_number", "latitude", "longitude", "notes"],
    },
  },
  // The Build Lab only drafts a reviewed blueprint. It never creates code,
  // tests, repositories, PRs, deployment access, or customer records.
  app_blueprint: {
    owner: "eig_build_lab",
    records: {
      observed_screen: ["name", "purpose", "visible_controls", "navigation", "layout_notes"],
      observed_interaction: ["name", "user_action", "observed_result", "test_context"],
      behavior_hypothesis: ["name", "possible_behavior", "how_to_verify"],
      workflow_gap: ["name", "problem", "user_impact"],
      proposed_feature: ["name", "description", "user_value", "reuse_candidate"],
      build_task: ["title", "requirement", "acceptance_criteria", "dependencies", "test_plan"],
      open_question: ["question", "why_it_matters"],
    },
  },
};

export const SCAN_TARGETS = Object.freeze(
  Object.fromEntries(Object.entries(schemas).map(([key, value]) => [
    key,
    Object.freeze({
      owner: value.owner,
      records: Object.freeze(Object.fromEntries(
        Object.entries(value.records).map(([type, fields]) => [type, Object.freeze([...fields])]),
      )),
    }),
  ])),
);

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const MAX_CANDIDATES = 150;

// A screenshot can demonstrate visible UI; it cannot prove hidden app logic.
// A proposed improvement or guessed behavior must never be presented as observed.
// The future trusted server must verify that a recording is an authorized
// interaction trace before accepting an observed_interaction candidate.
const BUILD_CLAIM_KINDS = Object.freeze({
  observed_screen: "observed",
  observed_interaction: "observed",
  behavior_hypothesis: "inferred",
  workflow_gap: "inferred",
  proposed_feature: "proposed",
  build_task: "proposed",
  open_question: "proposed",
});

function requiredText(value, label, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`Enter a valid ${label} (1-${max} characters).`);
  return value.trim();
}

function id(value, label) {
  if (typeof value !== "string" || !ID.test(value))
    throw new Error(`Invalid ${label}.`);
  return value;
}

function sourceReference(kind, value) {
  const ref = requiredText(value, "source reference", 500);
  if (kind === "website") {
    let url;
    try { url = new URL(ref); } catch { throw new Error("Use a public HTTPS website."); }
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      url.hash || !/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i.test(url.hostname))
      throw new Error("Use a public HTTPS website without credentials or fragments.");
    // DNS and redirects still require server-side SSRF checks before fetching.
    return url.toString();
  }
  // Source reference is an opaque, server-issued upload/import ID, not a file path.
  if (!ID.test(ref)) throw new Error("Use a server-issued source reference.");
  return ref;
}

export function createScanRequest({ requestId, target, sourceKind, sourceRef, sourceLabel }) {
  if (!Object.hasOwn(SCAN_TARGETS, target)) throw new Error("Unsupported scan destination.");
  if (!SCAN_SOURCE_KINDS.includes(sourceKind)) throw new Error("Unsupported scan source.");
  return {
    requestId: id(requestId, "scan request ID"),
    target,
    source: {
      kind: sourceKind,
      reference: sourceReference(sourceKind, sourceRef),
      label: requiredText(sourceLabel, "source label", 160),
    },
    stage: "needs_extraction",
  };
}

export function normalizeScanSuggestions(request, suggestions) {
  if (!request || request.stage !== "needs_extraction" ||
      !Object.hasOwn(SCAN_TARGETS, request.target))
    throw new Error("Start an authorized scan request first.");
  if (!Array.isArray(suggestions) || suggestions.length === 0 || suggestions.length > MAX_CANDIDATES)
    throw new Error("A scan must contain 1-150 field suggestions.");
  const seenIds = new Set();
  const seenFields = new Set();
  const records = SCAN_TARGETS[request.target].records;
  const candidates = suggestions.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid scan suggestion.");
    const suggestionId = id(item.id, "suggestion ID");
    const recordKey = id(item.recordKey, "record key");
    const recordType = requiredText(item.recordType, "record type", 50);
    const field = requiredText(item.field, "field", 50);
    if (!Object.hasOwn(records, recordType) || !records[recordType].includes(field))
      throw new Error("Suggestion is not allowed in this destination.");
    if (request.target === "app_blueprint" &&
        (item.claimKind !== BUILD_CLAIM_KINDS[recordType] ||
        (recordType === "observed_interaction" && request.source.kind !== "recording")))
      throw new Error("Build Lab evidence cannot claim unverified functionality as observed.");
    if (seenIds.has(suggestionId) || seenFields.has(`${recordKey}:${recordType}:${field}`))
      throw new Error("Duplicate scan suggestion.");
    seenIds.add(suggestionId);
    seenFields.add(`${recordKey}:${recordType}:${field}`);
    const value = requiredText(item.value, "suggested value", 3000);
    const locator = typeof item.evidence?.locator === "string" ? item.evidence.locator.trim() : "";
    const excerpt = typeof item.evidence?.excerpt === "string" ? item.evidence.excerpt.trim() : "";
    if ((!locator && !excerpt) || locator.length > 160 || excerpt.length > 700)
      throw new Error("Each suggestion needs bounded source evidence.");
    const confidence = item.confidence === undefined || item.confidence === null
      ? null : Number(item.confidence);
    if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1))
      throw new Error("Invalid extraction confidence.");
    return {
      id: suggestionId, recordKey, recordType, field, value,
      ...(request.target === "app_blueprint" ? { claimKind: item.claimKind } : {}),
      evidence: { locator, excerpt }, confidence,
    };
  });
  return {
    requestId: request.requestId,
    target: request.target,
    source: { ...request.source },
    stage: "needs_review",
    candidates,
  };
}

export function reviewScanSuggestions(batch, decisions) {
  if (!batch || batch.stage !== "needs_review" || !Array.isArray(batch.candidates))
    throw new Error("Only extracted suggestions can be reviewed.");
  if (!decisions || typeof decisions !== "object" || Array.isArray(decisions))
    throw new Error("Provide a decision for every suggestion.");
  const known = new Set(batch.candidates.map((candidate) => candidate.id));
  if (Object.keys(decisions).some((key) => !known.has(key)))
    throw new Error("Review includes an unknown suggestion.");
  const reviewed = batch.candidates.map((candidate) => {
    if (!Object.hasOwn(decisions, candidate.id))
      throw new Error("Every suggested field needs a decision.");
    const choice = decisions[candidate.id];
    if (!choice || !["accept", "edit", "reject"].includes(choice.action))
      throw new Error("Invalid review decision.");
    const value = choice.action === "edit"
      ? requiredText(choice.value, "reviewed value", 3000)
      : choice.action === "accept" ? candidate.value : null;
    return {
      ...candidate, action: choice.action,
      approvedValue: value,
      originalValue: candidate.value,
    };
  });
  return {
    requestId: batch.requestId,
    target: batch.target,
    source: { ...batch.source },
    stage: "reviewed",
    reviewed,
  };
}

// Preparing a handoff is NOT a write or publication. The target domain must
// independently check session, permissions, source provenance, field types,
// duplicates and business rules before any commit.
export function prepareScanHandoff(review) {
  if (!review || review.stage !== "reviewed" ||
      !Object.hasOwn(SCAN_TARGETS, review.target))
    throw new Error("Explicit review is required before preparing a handoff.");
  const grouped = new Map();
  for (const item of review.reviewed || []) {
    if (item.action === "reject") continue;
    if (!["accept", "edit"].includes(item.action) || !item.approvedValue)
      throw new Error("Only reviewed values can be handed off.");
    const groupKey = `${item.recordType}:${item.recordKey}`;
    if (!grouped.has(groupKey)) grouped.set(groupKey, {
      recordKey: item.recordKey,
      recordType: item.recordType,
      fields: {},
      provenance: {},
    });
    const record = grouped.get(groupKey);
    if (!SCAN_TARGETS[review.target].records[item.recordType]?.includes(item.field) ||
        Object.hasOwn(record.fields, item.field))
      throw new Error("Handoff contains an invalid field.");
    record.fields[item.field] = item.approvedValue;
    record.provenance[item.field] = {
      sourceRef: review.source.reference,
      evidence: { ...item.evidence },
      suggestedValue: item.originalValue,
      wasEdited: item.action === "edit",
      ...(review.target === "app_blueprint" ? { claimKind: item.claimKind } : {}),
    };
  }
  if (!grouped.size) throw new Error("Nothing approved for handoff.");
  return {
    requestId: review.requestId,
    target: review.target,
    ownerDomain: SCAN_TARGETS[review.target].owner,
    stage: "requires_domain_validation",
    source: { ...review.source },
    records: [...grouped.values()],
  };
}
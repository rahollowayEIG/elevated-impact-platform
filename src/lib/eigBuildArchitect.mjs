// EIG Build Lab, Phase 1 local-only project architect.
// A deterministic planning aid, NOT an AI scanner, repository analyzer,
// code executor, entitlement grant, or persistence service.
export const BUILD_LAB_MODES = Object.freeze([
  Object.freeze({ id: "new_feature", label: "Build a feature or app" }),
  Object.freeze({ id: "ui_review", label: "Improve UI and experience" }),
  Object.freeze({ id: "workflow", label: "Improve a workflow" }),
  Object.freeze({ id: "scan_idea", label: "Explore a scan or idea" }),
]);

export const BUILD_LAB_REUSE = Object.freeze([
  Object.freeze({ id: "single", label: "One specific use case" }),
  Object.freeze({ id: "several", label: "Several related workflows" }),
  Object.freeze({ id: "many", label: "Many apps or organizations" }),
]);

const registryHints = Object.freeze([
  { id: "identity", label: "Shared identity, memberships and permissions", words: /account|login|member|permission|role|staff|user|onboard|invite/i },
  { id: "events", label: "EIE / Event Builder", words: /event|outing|golf|tournament|scorecard|ticket|roster|volunteer/i },
  { id: "creative", label: "InceptionApex creative studio", words: /design|image|artwork|photo|flyer|advert|sign|template|logo|visual/i },
  { id: "commerce", label: "EIC commerce authority", words: /shop|store|product|price|payment|checkout|inventory|pos|catalog/i },
  { id: "messaging", label: "Squawk Box communications", words: /message|notification|chat|announce|email|broadcast/i },
  { id: "scan", label: "Universal Scan Engine", words: /scan|capture|upload|document|read|extract|import|business.card|qr|barcode/i },
]);

function required(value, name, limit) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit)
    throw new Error("Enter " + name + " (1-" + limit + " characters).");
  return value.trim();
}
function optional(value, name, limit) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.trim().length > limit)
    throw new Error("Keep " + name + " under " + limit + " characters.");
  return value.trim();
}
function validChoice(value, values, name) {
  if (!values.some((item) => item.id === value)) throw new Error("Choose a valid " + name + ".");
  return value;
}

export function validateBuildBrief(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Enter a project brief.");
  return {
    name: required(raw.name, "a project name", 100),
    goal: required(raw.goal, "a clear project goal", 2000),
    audience: required(raw.audience, "who this helps", 300),
    currentProcess: optional(raw.currentProcess, "the current process", 1500),
    referenceNotes: optional(raw.referenceNotes, "reference notes", 1500),
    mode: validChoice(raw.mode || "new_feature", BUILD_LAB_MODES, "project mode"),
    reuse: validChoice(raw.reuse || "several", BUILD_LAB_REUSE, "reuse scope"),
  };
}

function suggestion(id, phase, title, detail) {
  return { id, phase, title, detail, claimKind: "proposed", review: "pending", editedDetail: null };
}

export function createBuildBlueprint(raw, options = {}) {
  const brief = validateBuildBrief(raw);
  const revision = options.revision ?? 1;
  if (!Number.isSafeInteger(revision) || revision < 1 || revision > 9999)
    throw new Error("Invalid local blueprint revision.");
  const summary = [brief.name, brief.goal, brief.currentProcess, brief.referenceNotes].join(" ");
  const candidates = registryHints.filter((item) => item.words.test(summary))
    .map(({ id, label }) => ({ id, label, status: "candidate_to_verify" }));
  // Identity and permissions must always be checked before implementing a feature.
  if (!candidates.some((c) => c.id === "identity"))
    candidates.unshift({ id: "identity", label: "Shared identity, memberships and permissions", status: "candidate_to_verify" });
  const repeated = brief.reuse !== "single";
  const strategy = repeated ? {
    choice: "evaluate_reusable_tool_first",
    explanation: "This could serve multiple workflows. Check whether a shared tool saves more future work than it costs to build.",
  } : {
    choice: "start_with_scoped_feature",
    explanation: "Start with a focused implementation unless evidence reveals a reusable need.",
  };
  const proposals = [
    suggestion("observe", "Understand", "Verify what exists today",
      "Review an authorized walkthrough, code or source document. Separate demonstrated behavior from assumptions and ideas."),
    suggestion("reuse", "Architect", "Audit shared modules before building",
      "Check the registry, owning apps, reusable components, permissions and version boundaries. Confirm the candidate matches below."),
    suggestion("tool", "Architect", repeated ? "Evaluate a reusable engine or scanner" : "Check whether a direct feature is enough",
      repeated ? "Compare a common component, configurable extension, scanner or automation against a one-off implementation. Include maintenance costs." :
        "Define the smallest useful solution. Revisit a shared engine only if other real use cases justify it."),
    suggestion("prototype", "Prototype", "Build one end-to-end example",
      "Specify user inputs, the screen states, the owning data model, draft/approval rules and a clearly reversible test."),
    suggestion("verify", "Validate", "Test the workflow before rollout",
      "Confirm authorization, desktop/mobile UI, error/empty states, accessibility, regression tests and version-safe rollback."),
  ];
  if (brief.mode === "ui_review")
    proposals.splice(1, 0, suggestion("ui", "Inspect", "Run a cosmetic and interaction audit",
      "Check hierarchy, spacing, EIG colors, contrast, keyboard use, responsive layouts, clear status/action feedback and real click-through behavior."));
  if (brief.mode === "workflow")
    proposals.splice(1, 0, suggestion("workflow", "Inspect", "Map actions and state transitions",
      "Record actor, action, observed result, exceptions, approval points, data handoffs and unnecessary repeated steps."));
  if (brief.mode === "scan_idea")
    proposals.splice(1, 0, suggestion("scanner", "Inspect", "Design a source and evidence intake",
      "Identify permissioned sources, extraction limits, evidence review, safe destination adapters and explicit human authorization."));
  const questions = [
    "Which role(s) should use it, and in which Hangar or event scope?",
    "What specific action proves it works for the user?",
    "What existing EIG service is the source of truth for its data?",
    "Which inputs and behaviors can we verify, versus what is only an idea?",
    "Should this live in EIG Studio only, or eventually become a versioned customer entitlement?",
  ];
  return {
    schemaVersion: 1, kind: "eig_build_lab_blueprint", version: revision,
    status: "draft_requires_review", origin: "user_supplied_brief_not_scanned",
    brief, strategy, registryCandidates: candidates, suggestions: proposals, questions,
    safety: { liveChanges: false, codeChanges: false, autoApproval: false, independentVerificationRequired: true },
  };
}

export function reviewBuildSuggestion(blueprint, id, action, editedDetail = "") {
  if (!blueprint || blueprint.kind !== "eig_build_lab_blueprint" || !Array.isArray(blueprint.suggestions))
    throw new Error("Create a valid blueprint first.");
  if (!["pending", "accept", "reject", "edit"].includes(action))
    throw new Error("Choose pending, accept, reject or edit.");
  const match = blueprint.suggestions.find((item) => item.id === id);
  if (!match) throw new Error("Unknown proposal.");
  const nextText = action === "edit" ? required(editedDetail, "edited proposal details", 2000) : null;
  return {
    ...blueprint, suggestions: blueprint.suggestions.map((item) => item.id === id
      ? { ...item, review: action, editedDetail: nextText }
      : item),
  };
}

export function restoreBuildBlueprint(rawJson) {
  if (typeof rawJson !== "string" || rawJson.length > 60000)
    throw new Error("Choose a small Build Lab JSON export.");
  let exported;
  try { exported = JSON.parse(rawJson); } catch { throw new Error("Invalid Build Lab JSON file."); }
  if (exported?.kind !== "eig_build_lab_blueprint" || exported.schemaVersion !== 1)
    throw new Error("This is not a supported Build Lab blueprint export.");
  let clean = createBuildBlueprint(exported.brief, { revision: exported.version });
  for (const item of clean.suggestions) {
    const prior = exported.suggestions?.find((candidate) => candidate?.id === item.id);
    if (prior && prior.review && prior.review !== "pending")
      clean = reviewBuildSuggestion(clean, item.id, prior.review, prior.editedDetail);
  }
  return clean;
}

export function renderBuildBlueprintMarkdown(blueprint) {
  if (blueprint?.kind !== "eig_build_lab_blueprint") throw new Error("Create a blueprint first.");
  const b = blueprint.brief;
  const escape = (value) => String(value || "").replaceAll("\r", " ").replaceAll("\n", " ").trim();
  return [
    "# " + escape(b.name) + " | EIG Build Lab blueprint v" + blueprint.version,
    "", "**Status:** Draft, requires review. No code or production changes.",
    "**Input:** User-provided brief, not independently scanned or verified.",
    "", "## Goal", "", b.goal, "",
    "**Audience:** " + escape(b.audience),
    "**Mode:** " + escape(BUILD_LAB_MODES.find((m) => m.id === b.mode)?.label),
    "**Reuse scope:** " + escape(BUILD_LAB_REUSE.find((m) => m.id === b.reuse)?.label),
    "", "## Starting point", "",
    b.currentProcess || "Not provided.", "",
    "**Reference notes (unverified):** " + (b.referenceNotes || "None."), "",
    "## Build strategy", "", blueprint.strategy.explanation, "",
    "## Shared modules to verify", "",
    ...blueprint.registryCandidates.map((x) => "- " + x.label + " (candidate, not confirmed)"),
    "", "## Proposed build plan and review", "",
    ...blueprint.suggestions.map((x) =>
      "- [" + x.phase + "] " + x.title + " | " + x.review.toUpperCase() + ": " +
        (x.review === "edit" ? x.editedDetail : x.detail)),
    "", "## Questions to resolve", "",
    ...blueprint.questions.map((x) => "- " + x), "",
    "Review before opening development work. Verify permissions, source facts and dependencies in the owning application.", "",
  ].join("\n");
}

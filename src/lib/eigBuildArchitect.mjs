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

// Build Lab's Phase 1 suggestions are deterministic drafts, not an AI scan.
// Ground each suggested description in the user's mission without claiming
// we observed code, audited the app, or verified a customer workflow.
function shortText(value, max = 170) {
  const compact = String(value).replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  const clipped = compact.slice(0, max).replace(/\s+\S*$/, "");
  return (clipped || compact.slice(0, max)) + "…";
}

function buildDescription(brief, item) {
  const name = brief.name;
  const goal = shortText(brief.goal, 180);
  const audience = shortText(brief.audience, 90);
  switch (item.id) {
    case "observe":
      return "For " + name + ", map the existing workflow for " + audience +
        " against the stated goal: " + goal +
        ". Review authorized screenshots, walkthroughs or code and distinguish verified behavior from assumptions.";
    case "ui":
      return "For " + name + ", audit form-label contrast, button visibility, spacing, responsive/mobile readability, keyboard use, status feedback and real click-through behavior. " +
        "Propose reusable EIG UI improvements, with functional claims verified separately.";
    case "workflow":
      return "Map the steps needed to accomplish the goal in " + name + ": " + goal +
        ". Record users, visible actions, state changes, unnecessary clicks and handoffs. Mark untested behaviors as hypotheses.";
    case "scanner":
      return "For " + name + ", identify authorized screenshots, recordings, documents or ideas to inspect. " +
        "Specify evidence limits, human review, safe outputs and how the proposed scanner helps achieve: " + goal + ".";
    case "reuse":
      return "Compare the proposed " + name + " workflow to our shared identity, app registry and relevant EIG modules. " +
        "Verify ownership, permissions and reusable design patterns before proposing new code or a duplicate app.";
    case "tool":
      return brief.reuse === "single"
        ? "For " + name + ", compare a focused feature with a reusable engine or automation. Build the smallest safe solution unless other verified use cases justify a shared tool."
        : "For " + name + ", evaluate a reusable component, scanner or automation versus a one-off feature. " +
          "Consider the stated goal (" + goal + "), future apps, maintenance cost and approval boundaries.";
    case "prototype":
      return "Prepare a narrow " + name + " prototype that helps " + audience +
        " achieve: " + goal + ". Define user input, visible states, data owner, approval steps and reversible testing.";
    case "verify":
      return "Test " + name + " against its stated goal: " + goal +
        ". Verify role access, successful and failed actions, mobile layout, accessibility, saved/reopened state and regressions before any rollout.";
    default:
      return item.detail;
  }
}

// Clicking Revise should fill a practical first revision, not make the user
// paste a description from ChatGPT. The owner can freely edit before saving.
export function suggestBuildRevision(blueprint, id) {
  if (!blueprint || blueprint.kind !== "eig_build_lab_blueprint" || !Array.isArray(blueprint.suggestions))
    throw new Error("Create a valid blueprint first.");
  const item = blueprint.suggestions.find((candidate) => candidate.id === id);
  if (!item) throw new Error("Unknown proposal.");
  const brief = blueprint.brief;
  const name = shortText(brief.name, 100);
  const goal = shortText(brief.goal, 130);
  const audience = shortText(brief.audience, 75);
  const descriptions = {
    observe: "Document how " + audience + " currently use " + name + " with an authorized walkthrough and first-party code. List screens, actions and observed results. Separate tested functionality from assumptions and record unresolved gaps.",
    ui: "Audit form-label contrast, button visibility, spacing, mobile readability, keyboard navigation and clear status feedback across " + name + " and shared EIG UI patterns. Recommend reusable UI improvements, then verify the relevant interactions through authorized tests.",
    workflow: "Trace the current " + name + " process from first action through completion. Identify repeated steps, missing feedback and data handoffs; propose a shorter workflow with an acceptance test for each changed action.",
    scanner: "Define which permissioned source material can be scanned for " + name + ", which claims must be supported by evidence, and how proposed findings are reviewed before creating any records or tasks.",
    reuse: "Review existing EIG components and owners before implementing " + name + ". Document what can be reused safely, what must be adapted and which permissions and integrations need verification.",
    tool: "Compare a reusable scanner, generator or automation against a direct " + name + " fix. Estimate ongoing maintenance, cross-app benefit, complexity and the simplest verifiable first milestone.",
    prototype: "Create one testable " + name + " example for " + audience + ". Include primary actions, mobile and error states, approval/version controls and the result that would demonstrate success.",
    verify: "Validate " + name + " on desktop and mobile with authorized test data. Check primary actions, accessibility, permission boundaries, errors, save/reopen behavior and regression coverage before approval.",
  };
  return descriptions[item.id] || "For " + name + ", propose an action that supports the goal: " + goal + ". Include a measurable success check.";
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
  const personalizedProposals = proposals.map((item) => ({
    ...item, detail: buildDescription(brief, item),
  }));
  return {
    schemaVersion: 1, kind: "eig_build_lab_blueprint", version: revision,
    status: "draft_requires_review", origin: "user_supplied_brief_not_scanned",
    brief, strategy, registryCandidates: candidates, suggestions: personalizedProposals, questions,
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

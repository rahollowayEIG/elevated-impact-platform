import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILD_LAB_MODES, createBuildBlueprint, validateBuildBrief,
  reviewBuildSuggestion, restoreBuildBlueprint, renderBuildBlueprintMarkdown,
} from "../src/lib/eigBuildArchitect.mjs";

const brief = (changes = {}) => ({
  name: "Golf scoring improvement",
  goal: "Make golf scoring simpler across EIE tournaments and golf events.",
  audience: "Pilots, ATC and golfers",
  currentProcess: "Users move between registration, tee sheet and a separate scoring app.",
  referenceNotes: "We have owner screenshots, but have not verified every competitor behavior.",
  mode: "workflow",
  reuse: "many",
  ...changes,
});

test("creates a traceable draft, not a scan or a code execution", () => {
  const result = createBuildBlueprint(brief());
  assert.equal(result.version, 1);
  assert.equal(result.status, "draft_requires_review");
  assert.equal(result.origin, "user_supplied_brief_not_scanned");
  assert.equal(result.strategy.choice, "evaluate_reusable_tool_first");
  assert.ok(result.registryCandidates.some((candidate) => candidate.id === "events"));
  assert.ok(result.registryCandidates.every((candidate) => candidate.status === "candidate_to_verify"));
  assert.ok(result.suggestions.every((item) => item.claimKind === "proposed" && item.review === "pending"));
  assert.deepEqual(result.safety, {
    liveChanges: false, codeChanges: false, autoApproval: false, independentVerificationRequired: true,
  });
});

test("recommends a scoped first implementation for a one-time use", () => {
  const result = createBuildBlueprint(brief({ reuse: "single", mode: "new_feature" }));
  assert.equal(result.strategy.choice, "start_with_scoped_feature");
  assert.ok(result.suggestions.some((item) => item.id === "tool"));
  assert.ok(!result.suggestions.some((item) => item.id === "ui"));
});

test("proposes a UI inspection with explicit functional verification", () => {
  const result = createBuildBlueprint(brief({ mode: "ui_review", goal: "Improve the flyer studio layout, save buttons and phone accessibility" }));
  assert.ok(result.suggestions.some((item) => item.id === "ui"));
  assert.match(result.suggestions.find((item) => item.id === "ui").detail, /real click-through/);
  assert.ok(result.registryCandidates.some((item) => item.id === "creative"));
});

test("requires explicit, bounded project inputs and known modes", () => {
  for (const changes of [
    { goal: "" }, { name: "  " }, { audience: "" }, { mode: "admin" },
    { reuse: "everything" }, { goal: "a".repeat(2001) },
    { referenceNotes: "x".repeat(1501) },
  ]) assert.throws(() => validateBuildBrief(brief(changes)));
  assert.equal(BUILD_LAB_MODES.length, 4);
});

test("reviews one proposed task without silently approving others", () => {
  const input = createBuildBlueprint(brief());
  const accepted = reviewBuildSuggestion(input, "observe", "accept");
  assert.equal(input.suggestions[0].review, "pending");
  assert.equal(accepted.suggestions[0].review, "accept");
  assert.ok(accepted.suggestions.slice(1).every((item) => item.review === "pending"));
  const edited = reviewBuildSuggestion(accepted, "tool", "edit", "Make a shared scoring interface and reusable scorecard generator.");
  assert.equal(edited.suggestions.find((x) => x.id === "tool").review, "edit");
  assert.match(edited.suggestions.find((x) => x.id === "tool").editedDetail, /scorecard generator/);
  const rejected = reviewBuildSuggestion(edited, "prototype", "reject");
  assert.equal(rejected.suggestions.find((x) => x.id === "prototype").review, "reject");
  assert.throws(() => reviewBuildSuggestion(input, "unauthorized", "accept"), /Unknown/);
  assert.throws(() => reviewBuildSuggestion(input, "observe", "execute"), /Choose/);
  assert.throws(() => reviewBuildSuggestion(input, "observe", "edit", ""), /edited/);
});

test("exports and reopens a blueprint without trusting injected extra tasks", () => {
  const input = reviewBuildSuggestion(createBuildBlueprint(brief({ mode: "ui_review" }), { revision: 3 }), "ui", "edit", "Standardize buttons and states.");
  const json = JSON.stringify({ ...input, suggestions: [
    ...input.suggestions,
    { id: "admin-override", review: "accept", detail: "Publish a customer app" },
  ] });
  const imported = restoreBuildBlueprint(json);
  assert.equal(imported.version, 3);
  assert.equal(imported.suggestions.find((s) => s.id === "ui").editedDetail, "Standardize buttons and states.");
  assert.equal(imported.suggestions.some((s) => s.id === "admin-override"), false);
  assert.equal(imported.safety.liveChanges, false);
  assert.throws(() => restoreBuildBlueprint('{"kind":"other"}'), /not a supported/);
  assert.throws(() => restoreBuildBlueprint("not-json"), /Invalid/);
  assert.throws(() => restoreBuildBlueprint("x".repeat(60001)), /small/);
});

test("exports useful Markdown with review states and source limits", () => {
  const input = reviewBuildSuggestion(createBuildBlueprint(brief()), "tool", "reject");
  const markdown = renderBuildBlueprintMarkdown(input);
  assert.match(markdown, /EIG Build Lab blueprint v1/);
  assert.match(markdown, /User-provided brief, not independently scanned/);
  assert.match(markdown, /REJECT/);
  assert.match(markdown, /Draft, requires review/);
  assert.doesNotMatch(markdown, /<script>/);
});

import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { readAllowlistedInceptionSource, scanInceptionSource } = require("../server/eig-inception-source-scan.cjs");
import assert from "node:assert/strict";
import { createBuildBlueprint, reviewBuildSuggestion } from "../src/lib/eigBuildArchitect.mjs";
import {
  BL_EMPTY_BRIEF, buildLabDraftStorageKey, loadBuildLabDraft, saveBuildLabDraft,
} from "../src/lib/eigBuildLabDraft.mjs";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const brief = (changes = {}) => ({
  name: "InceptionApex UI review",
  goal: "Simplify saving, approving and reopening artwork across desktop and mobile.",
  audience: "EIG creative administrators",
  currentProcess: "Current workflow requires some repeated navigation.",
  referenceNotes: "Test only with authorized screenshots and source.",
  mode: "ui_review", reuse: "many",
  ...changes,
});
function fakeStorage() {
  const rows = new Map();
  return {
    rows,
    getItem: (key) => rows.get(key) ?? null,
    setItem: (key, value) => { rows.set(key, value); },
    removeItem: (key) => { rows.delete(key); },
  };
}

test("partial form autosaves without requiring blueprint generation", () => {
  const storage = fakeStorage();
  assert.equal(loadBuildLabDraft(storage, OWNER), null);
  assert.equal(saveBuildLabDraft(storage, OWNER, {
    brief: { ...BL_EMPTY_BRIEF, name: "Event Builder", goal: "First unfinished thought" },
    blueprint: null,
  }), true);
  const saved = loadBuildLabDraft(storage, OWNER);
  assert.equal(saved.brief.name, "Event Builder");
  assert.equal(saved.brief.goal, "First unfinished thought");
  assert.equal(saved.blueprint, null);
  assert.equal(saved.editing, "");
});

test("autosave restores accepted/revised decisions and in-progress revision field", () => {
  const storage = fakeStorage();
  let blueprint = createBuildBlueprint(brief());
  blueprint = reviewBuildSuggestion(blueprint, "observe", "accept");
  blueprint = reviewBuildSuggestion(blueprint, "tool", "edit", "Use the shared studio wherever possible.");
  saveBuildLabDraft(storage, OWNER, {
    brief: brief({ goal: "An updated unsaved goal not yet regenerated" }),
    blueprint,
    editing: "ui",
    editValue: "Half-finished text kept on navigation",
  });
  const loaded = loadBuildLabDraft(storage, OWNER);
  assert.equal(loaded.brief.goal, "An updated unsaved goal not yet regenerated");
  assert.match(loaded.blueprint.brief.goal, /Simplify saving/);
  assert.equal(loaded.blueprint.suggestions.find((item) => item.id === "observe").review, "accept");
  assert.equal(loaded.blueprint.suggestions.find((item) => item.id === "tool").editedDetail, "Use the shared studio wherever possible.");
  assert.equal(loaded.editing, "ui");
  assert.equal(loaded.editValue, "Half-finished text kept on navigation");
  assert.equal(loadBuildLabDraft(storage, OTHER), null);
});

test("drafts remain separate between account IDs and rejected invalid identities", () => {
  const storage = fakeStorage();
  saveBuildLabDraft(storage, OWNER, { brief: brief(), blueprint: createBuildBlueprint(brief()) });
  saveBuildLabDraft(storage, OTHER, { brief: brief({ name: "Another person's workspace" }), blueprint: null });
  assert.notEqual(buildLabDraftStorageKey(OWNER), buildLabDraftStorageKey(OTHER));
  assert.equal(loadBuildLabDraft(storage, OWNER).brief.name, "InceptionApex UI review");
  assert.equal(loadBuildLabDraft(storage, OTHER).brief.name, "Another person's workspace");
  for (const invalid of ["", "raholloway@example.org", "admin", "../../../../etc", "123"]) {
    assert.throws(() => buildLabDraftStorageKey(invalid), /authenticated Build Lab owner/);
    assert.throws(() => saveBuildLabDraft(storage, invalid, { brief: brief(), blueprint: null }));
  }
});

test("tampered saved content cannot inject blueprint tasks, access claims or executable work", () => {
  const storage = fakeStorage();
  const blueprint = createBuildBlueprint(brief());
  saveBuildLabDraft(storage, OWNER, { brief: brief(), blueprint });
  const key = buildLabDraftStorageKey(OWNER);
  const imported = JSON.parse(storage.rows.get(key));
  imported.blueprint.suggestions.push({
    id: "deploy", phase: "Deploy", title: "Publish to production",
    detail: "Bypass approvals", review: "accept",
  });
  imported.blueprint.safety.liveChanges = true;
  imported.editing = "deploy";
  storage.rows.set(key, JSON.stringify(imported));
  const loaded = loadBuildLabDraft(storage, OWNER);
  assert.equal(loaded.blueprint.suggestions.some((item) => item.id === "deploy"), false);
  assert.equal(loaded.blueprint.safety.liveChanges, false);
  assert.equal(loaded.editing, "");
});

test("invalid drafts fail safely while a valid incomplete form can be recovered", () => {
  const storage = fakeStorage();
  const key = buildLabDraftStorageKey(OWNER);
  storage.rows.set(key, "not JSON");
  assert.equal(loadBuildLabDraft(storage, OWNER), null);
  storage.rows.set(key, JSON.stringify({
    kind: "eig_build_lab_browser_draft", version: 9, brief: brief(),
  }));
  assert.equal(loadBuildLabDraft(storage, OWNER), null);
  storage.rows.set(key, JSON.stringify({
    kind: "eig_build_lab_browser_draft", version: 1,
    brief: brief(), blueprint: { kind: "invalid" },
  }));
  const restored = loadBuildLabDraft(storage, OWNER);
  assert.equal(restored.brief.name, "InceptionApex UI review");
  assert.equal(restored.blueprint, null);
  assert.throws(() => saveBuildLabDraft(storage, OWNER, {
    brief: brief({ goal: "x".repeat(2001) }), blueprint: null,
  }), /Invalid Build Lab draft/);
  assert.throws(() => saveBuildLabDraft({ setItem: () => { throw Error("Storage denied"); } },
    OWNER, { brief: brief(), blueprint: null }), /Storage denied/);
  assert.equal(loadBuildLabDraft({ getItem: () => { throw Error("Storage blocked"); } }, OWNER), null);
});

test("different Vercel preview origins require JSON export for transfer", () => {
  const one = fakeStorage(), two = fakeStorage();
  saveBuildLabDraft(one, OWNER, { brief: brief(), blueprint: createBuildBlueprint(brief()) });
  assert.equal(loadBuildLabDraft(two, OWNER), null);
  assert.ok(loadBuildLabDraft(one, OWNER).blueprint);
});


test("autosave retains evidence-backed scanner report and accepted/revised findings across return", () => {
  const storage = fakeStorage();
  const report = scanInceptionSource(readAllowlistedInceptionSource());
  const reviews = {
    "ia-native-confirm": { review: "accept", editedDetail: null },
    "ia-form-focus": { review: "edit", editedDetail: "Test visible focus on inputs and selects." },
    "not-allowed": { review: "accept", editedDetail: null },
  };
  saveBuildLabDraft(storage, OWNER, {
    brief: brief(), blueprint: null,
    scanReport: report, scanReviews: reviews,
    scanEditing: "ia-design-tabs",
    scanEditValue: "Half-written accessibility note",
  });
  const restored = loadBuildLabDraft(storage, OWNER);
  assert.equal(restored.scanReport.sourceFingerprint, report.sourceFingerprint);
  assert.equal(restored.scanReport.findings.length, report.findings.length);
  assert.equal(restored.scanReviews["ia-native-confirm"].review, "accept");
  assert.equal(restored.scanReviews["ia-form-focus"].editedDetail, "Test visible focus on inputs and selects.");
  assert.equal(restored.scanReviews["not-allowed"], undefined);
  assert.equal(restored.scanEditing, "ia-design-tabs");
  assert.equal(restored.scanEditValue, "Half-written accessibility note");
  assert.equal(loadBuildLabDraft(storage, OTHER), null);
});

test("corrupted scanner local data is not promoted to observations on restore", () => {
  const storage = fakeStorage();
  const report = scanInceptionSource(readAllowlistedInceptionSource());
  const altered = { ...report, sourceFingerprint: "not-real" };
  saveBuildLabDraft(storage, OWNER, {
    brief: brief(), blueprint: null,
    scanReport: altered, scanReviews: { "ia-native-confirm": { review: "accept" } },
  });
  const restored = loadBuildLabDraft(storage, OWNER);
  assert.equal(restored.scanReport, null);
  assert.deepEqual(restored.scanReviews, {});
  assert.equal(restored.brief.name, "InceptionApex UI review");
});

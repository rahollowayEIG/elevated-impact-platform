// EIG Build Lab Phase 1 autosave.
// Browser-local backup for non-sensitive planning briefs only. NOT a security
// boundary or multi-device/cloud persistence. Owner authorization stays on
// the server. Each preview origin has separate browser storage.
import { BUILD_LAB_MODES, BUILD_LAB_REUSE, restoreBuildBlueprint } from "./eigBuildArchitect.mjs";

const OWNER_UID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DRAFT_VERSION = 1;
const MAX_BYTES = 70000;
const LIMITS = Object.freeze({
  name: 100,
  goal: 2000,
  audience: 300,
  currentProcess: 1500,
  referenceNotes: 1500,
});
export const BL_EMPTY_BRIEF = Object.freeze({
  name: "", goal: "", audience: "", currentProcess: "",
  referenceNotes: "", mode: "new_feature", reuse: "several",
});

export function buildLabDraftStorageKey(ownerUserId) {
  if (typeof ownerUserId !== "string" || !OWNER_UID_PATTERN.test(ownerUserId))
    throw new Error("An authenticated Build Lab owner is required for local draft storage.");
  return "eig-build-lab:owner-draft:v1:" + ownerUserId.toLowerCase();
}

function cleanPartialBrief(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid Build Lab draft brief.");
  const brief = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    const value = input[key] ?? "";
    if (typeof value !== "string" || value.length > max)
      throw new Error("Invalid Build Lab draft field: " + key);
    brief[key] = value;
  }
  for (const [key, accepted, fallback] of [
    ["mode", BUILD_LAB_MODES, "new_feature"],
    ["reuse", BUILD_LAB_REUSE, "several"],
  ]) {
    const value = input[key] ?? fallback;
    if (typeof value !== "string" || !accepted.some((item) => item.id === value))
      throw new Error("Invalid Build Lab draft selection: " + key);
    brief[key] = value;
  }
  return brief;
}

function cleanEditor(blueprint, editing, editValue) {
  const validId = typeof editing === "string" && blueprint?.suggestions.some((item) => item.id === editing);
  return {
    editing: validId ? editing : "",
    editValue: validId && typeof editValue === "string" && editValue.length <= 2000 ? editValue : "",
  };
}

export function saveBuildLabDraft(storage, ownerUserId, { brief, blueprint, editing = "", editValue = "" }) {
  const key = buildLabDraftStorageKey(ownerUserId);
  if (!storage || typeof storage.setItem !== "function")
    throw new Error("Browser storage is unavailable.");
  const safeBrief = cleanPartialBrief(brief);
  // Prevent unvalidated imported data from being stored; the original project
  // brief in the blueprint may differ from work-in-progress form fields.
  const safeBlueprint = blueprint
    ? restoreBuildBlueprint(JSON.stringify(blueprint)) : null;
  const clean = cleanEditor(safeBlueprint, editing, editValue);
  const serialized = JSON.stringify({
    kind: "eig_build_lab_browser_draft", version: DRAFT_VERSION,
    brief: safeBrief, blueprint: safeBlueprint, ...clean,
  });
  if (serialized.length > MAX_BYTES)
    throw new Error("Draft is too large for browser autosave. Export the JSON instead.");
  storage.setItem(key, serialized);
  return true;
}

export function loadBuildLabDraft(storage, ownerUserId) {
  const key = buildLabDraftStorageKey(ownerUserId);
  if (!storage || typeof storage.getItem !== "function") return null;
  let raw;
  try { raw = storage.getItem(key); } catch { return null; }
  if (!raw || raw.length > MAX_BYTES) return null;
  try {
    const saved = JSON.parse(raw);
    if (saved?.kind !== "eig_build_lab_browser_draft" || saved.version !== DRAFT_VERSION)
      return null;
    const brief = cleanPartialBrief(saved.brief);
    let blueprint = null;
    if (saved.blueprint) {
      try { blueprint = restoreBuildBlueprint(JSON.stringify(saved.blueprint)); }
      catch { /* Recover the valid partial form even if the blueprint is stale. */ }
    }
    return { brief, blueprint, ...cleanEditor(blueprint, saved.editing, saved.editValue) };
  } catch {
    // Corrupt or incompatible drafts should never crash the owner-only app.
    return null;
  }
}

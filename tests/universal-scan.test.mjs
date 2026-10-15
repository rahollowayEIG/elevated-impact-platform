import test from "node:test";
import assert from "node:assert/strict";
import {
  SCAN_TARGETS,
  createScanRequest,
  normalizeScanSuggestions,
  reviewScanSuggestions,
  prepareScanHandoff,
} from "../src/lib/universalScan.mjs";

const req = (target = "restaurant_menu") => createScanRequest({
  requestId: "scan-001",
  target,
  sourceKind: "document",
  sourceRef: "upload-001",
  sourceLabel: "Sample menu PDF",
});
const item = (overrides = {}) => ({
  id: "dish-price",
  recordKey: "dish-1",
  recordType: "menu_item",
  field: "price",
  value: "$12.50",
  evidence: { locator: "Page 2", excerpt: "House burger $12.50" },
  confidence: 0.88,
  ...overrides,
});

test("the shared registry directs scans to the owning application", () => {
  assert.equal(SCAN_TARGETS.restaurant_menu.owner, "set_the_table");
  assert.equal(SCAN_TARGETS.hangar_profile.owner, "organizations");
  assert.equal(SCAN_TARGETS.venue_map.owner, "mapping_studio");
  assert.throws(() => req("admin_users"), /Unsupported scan destination/);
});

test("a document scan remains unapproved until every field is explicitly reviewed", () => {
  const batch = normalizeScanSuggestions(req(), [item()]);
  assert.equal(batch.stage, "needs_review");
  assert.throws(() => prepareScanHandoff(batch), /Explicit review/);
  assert.throws(() => reviewScanSuggestions(batch, {}), /Every suggested field/);
  const accepted = reviewScanSuggestions(batch, { "dish-price": { action: "accept" } });
  const handoff = prepareScanHandoff(accepted);
  assert.equal(handoff.stage, "requires_domain_validation");
  assert.equal(handoff.ownerDomain, "set_the_table");
  assert.equal(handoff.records[0].fields.price, "$12.50");
  assert.deepEqual(handoff.records[0].provenance.price.evidence, item().evidence);
  assert.equal(Object.hasOwn(handoff, "published"), false);
  assert.equal(Object.hasOwn(handoff, "organizationId"), false);
});

test("human correction preserves original extracted evidence and never silently approves", () => {
  const batch = normalizeScanSuggestions(req(), [
    item({ id: "dish-name", field: "name", value: "House Burqer" }),
    item(),
  ]);
  const reviewed = reviewScanSuggestions(batch, {
    "dish-name": { action: "edit", value: "House Burger" },
    "dish-price": { action: "reject" },
  });
  const out = prepareScanHandoff(reviewed);
  assert.deepEqual(out.records[0].fields, { name: "House Burger" });
  assert.equal(out.records[0].provenance.name.suggestedValue, "House Burqer");
  assert.equal(out.records[0].provenance.name.wasEdited, true);
  assert.throws(() => prepareScanHandoff(reviewScanSuggestions(batch, {
    "dish-name": { action: "reject" },
    "dish-price": { action: "reject" },
  })), /Nothing approved/);
});

test("rejects unauthorized destinations, invented identity fields, and duplicate extraction", () => {
  assert.throws(() => normalizeScanSuggestions(req(), [
    item({ recordType: "organization", field: "owner_user_id" }),
  ]), /not allowed/);
  assert.throws(() => normalizeScanSuggestions(req("hangar_profile"), [
    item({ recordType: "organization", field: "organization_id" }),
  ]), /not allowed/);
  assert.throws(() => normalizeScanSuggestions(req(), [item(), item()]), /Duplicate/);
  assert.throws(() => normalizeScanSuggestions(req(), [item({ value: "" })]), /suggested value/);
  assert.throws(() => normalizeScanSuggestions(req(), [item({ evidence: {} })]), /source evidence/);
});

test("a venue map coordinate remains a draft claim, not trusted operational geometry", () => {
  const batch = normalizeScanSuggestions(req("venue_map"), [item({
    recordType: "feature", field: "latitude", value: "40.0",
  })]);
  assert.equal(batch.stage, "needs_review");
  assert.throws(() => reviewScanSuggestions(batch, {
    "dish-price": { action: "publish" },
  }), /Invalid review decision/);
});

test("website references require an uncredentialed HTTPS source; other inputs require issued IDs", () => {
  const web = { requestId: "scan-002", target: "hangar_profile", sourceKind: "website", sourceLabel: "Official site" };
  assert.equal(createScanRequest({ ...web, sourceRef: "https://example.com/about" }).source.reference,
    "https://example.com/about");
  for (const value of ["http://example.com", "https://user:pass@example.com", "https://localhost/", "https://example.com/#x"])
    assert.throws(() => createScanRequest({ ...web, sourceRef: value }), /HTTPS website/);
  assert.throws(() => createScanRequest({ ...web, sourceKind: "image", sourceRef: "/private/path.jpg" }), /server-issued/);
});

test("review refuses unknown suggestions and bad confidence", () => {
  assert.throws(() => normalizeScanSuggestions(req(), [item({ confidence: 1.5 })]), /confidence/);
  const batch = normalizeScanSuggestions(req(), [item()]);
  assert.throws(() => reviewScanSuggestions(batch, {
    "dish-price": { action: "accept" },
    "hidden-admin-field": { action: "accept" },
  }), /unknown suggestion/);
});

const buildRequest = (sourceKind = "image") => createScanRequest({
  requestId: "build-001",
  target: "app_blueprint",
  sourceKind,
  sourceRef: "sample-001",
  sourceLabel: "Authorized example app walkthrough",
});
const buildSuggestion = (overrides = {}) => ({
  id: "screen-control-001",
  recordKey: "screen-dashboard",
  recordType: "observed_screen",
  field: "visible_controls",
  value: "Create Event button",
  claimKind: "observed",
  evidence: { locator: "Dashboard screenshot 1", excerpt: "Create Event" },
  ...overrides,
});

test("Scan & Build is an EIG-owned draft blueprint, not a deployment tool", () => {
  assert.equal(SCAN_TARGETS.app_blueprint.owner, "eig_build_lab");
  const batch = normalizeScanSuggestions(buildRequest(), [buildSuggestion()]);
  assert.equal(batch.candidates[0].claimKind, "observed");
  assert.throws(() => prepareScanHandoff(batch), /Explicit review/);
  const reviewed = reviewScanSuggestions(batch, {
    "screen-control-001": { action: "accept" },
  });
  const handoff = prepareScanHandoff(reviewed);
  assert.equal(handoff.stage, "requires_domain_validation");
  assert.equal(handoff.ownerDomain, "eig_build_lab");
  assert.equal(handoff.records[0].fields.visible_controls, "Create Event button");
  assert.equal(handoff.records[0].provenance.visible_controls.claimKind, "observed");
  assert.equal(Object.hasOwn(handoff, "executed"), false);
  assert.equal(Object.hasOwn(handoff, "pullRequest"), false);
});

test("screenshots and ideas cannot pretend an untested app function was observed", () => {
  const screenshot = buildRequest("image");
  assert.throws(() => normalizeScanSuggestions(screenshot, [
    buildSuggestion({recordType: "observed_interaction",field:"observed_result"}),
  ]), /unverified functionality/);
  assert.throws(() => normalizeScanSuggestions(screenshot, [
    buildSuggestion({recordType: "behavior_hypothesis",field:"possible_behavior",claimKind:"observed"}),
  ]), /unverified functionality/);
  assert.throws(() => normalizeScanSuggestions(screenshot, [
    buildSuggestion({recordType: "proposed_feature",field:"description",claimKind:"observed"}),
  ]), /unverified functionality/);
  assert.throws(() => normalizeScanSuggestions(screenshot, [
    buildSuggestion({recordType: "observed_screen",field:"secret_access_token"}),
  ]), /not allowed/);
});

test("recorded functionality, hypotheses and new ideas remain separate with evidence and review", () => {
  const observed = normalizeScanSuggestions(buildRequest("recording"), [
    buildSuggestion({recordType:"observed_interaction",field:"observed_result",value:"A new event form opened",evidence:{locator:"Recording 1 at 00:42",excerpt:"Click Create Event and form appears"}}),
  ]);
  const reviewed = reviewScanSuggestions(observed, {
    "screen-control-001": {action:"accept"},
  });
  assert.equal(prepareScanHandoff(reviewed).records[0].provenance.observed_result.claimKind,"observed");

  const ideas = normalizeScanSuggestions(buildRequest("text"), [
    buildSuggestion({recordType:"proposed_feature",field:"description",claimKind:"proposed",value:"Use one searchable Event Builder for every event type",evidence:{locator:"Owner design brief",excerpt:"Make the event workflow reusable"}}),
    buildSuggestion({id:"question-1",recordKey:"questions",recordType:"open_question",field:"question",claimKind:"proposed",value:"Which organization owns the created event?",evidence:{locator:"Owner design brief",excerpt:"Build a reusable event workflow"}}),
  ]);
  assert.throws(() => prepareScanHandoff(ideas), /Explicit review/);
  const output=prepareScanHandoff(reviewScanSuggestions(ideas,{
    "screen-control-001":{action:"edit",value:"One event builder reusable across event types"},
    "question-1":{action:"reject"},
  }));
  assert.equal(output.records.length,1);
  assert.equal(output.records[0].provenance.description.claimKind,"proposed");
  assert.equal(output.records[0].provenance.description.wasEdited,true);
  assert.equal(output.records[0].fields.description,"One event builder reusable across event types");
});

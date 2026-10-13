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
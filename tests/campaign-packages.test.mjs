import test from "node:test";
import assert from "node:assert/strict";
import {
  HOMETOWN_MAGAZINE_FORMATS, cleanCampaignPackage, packageProblem,
  packageTotals, cleanDiscoverySuggestion
} from "../src/lib/campaignPackages.mjs";

const advertiser = "10000000-0000-0000-0000-000000000001";
const owner = "10000000-0000-0000-0000-000000000002";
const base = {
  name: "Local business launch",
  advertiser_hanger_id: advertiser,
  owner_hanger_id: owner,
  placements: [
    { id: "print-1", channel: "hometown_magazine", format: "quarter_extended",
      price_cents: 30000, status: "draft" },
    { id: "digital-1", channel: "digital_signage", price_cents: 10000, status: "draft" }
  ],
  discount_cents: 5000
};
test("Hometown Magazine printed sizes are physical inch measurements", () => {
  assert.deepEqual(HOMETOWN_MAGAZINE_FORMATS.quarter_extended,
    { label: "Quarter extended", widthIn: 7.875, heightIn: 2.3125 });
  assert.deepEqual(HOMETOWN_MAGAZINE_FORMATS.quarter_box,
    { label: "Quarter box", widthIn: 3.3125, heightIn: 4.3125 });
  assert.equal(Object.keys(HOMETOWN_MAGAZINE_FORMATS).length, 7);
});
test("package prices and discounts preserve cents and refuse unpriced approval", () => {
  assert.equal(packageProblem(base, true), "");
  assert.deepEqual(packageTotals(base), {
    subtotal_cents: 40000, discount_cents: 5000,
    total_cents: 35000, has_unpriced_items: false
  });
  assert.match(packageProblem({ ...base, placements: [{ id: "x", channel: "social" }] }, true), /price/i);
  assert.match(packageProblem({ ...base, discount_cents: 50000 }), /Discount/i);
  assert.match(packageProblem({ ...base, placements: [...base.placements, base.placements[0]] }), /unique ID/i);
});
test("trial campaigns demand terms before review", () => {
  assert.match(packageProblem({ ...base, trial: true }, true), /trial/i);
  assert.equal(packageProblem({ ...base, trial: true, trial_terms: "7-day trial, no auto-renewal" }, true), "");
});
test("business discovery assets cannot be auto-approved without rights", () => {
  const d = cleanDiscoverySuggestion({
    name: "Sample business",
    assets: [
      { url: "https://site.example/logo.png", rights: "unverified", approved: true },
      { url: "https://site.example/owned.png", rights: "owner_provided", approved: true }
    ]
  });
  assert.equal(d.assets[0].approved, false);
  assert.equal(d.assets[1].approved, true);
});
test("campaign references a Hanger; never silently guesses ownership", () => {
  assert.match(packageProblem({ ...base, advertiser_hanger_id: "" }), /advertiser Hanger/i);
  assert.equal(cleanCampaignPackage(base).advertiser_hanger_id, advertiser);
});

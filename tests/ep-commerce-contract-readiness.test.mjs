import test from "node:test";
import assert from "node:assert/strict";
import {
 ITEM_KINDS,AVAILABILITY_MODES,EXAMPLE_CATEGORIES,COMMERCE_BLUEPRINT_SAFETY,
 validateCatalogHierarchy,taxReadiness,agreementRequirementsForSale
} from "../src/lib/epCommerceContractReadiness.mjs";
const org="demo-chapel-hill";
const lines=[
 {id:"line-venue",categoryId:"demo-venue-rental",offerId:"offer-clubhouse",organizationId:org,
  sellerOrgId:"demo-chapel-hill",payeeOrgId:"demo-eig",kind:"rental_asset",
  availabilityMode:"asset_calendar",quantity:1},
 {id:"line-catering",categoryId:"demo-food",offerId:"offer-dinner",organizationId:org,
  sellerOrgId:"demo-one-nine",payeeOrgId:"demo-one-nine",kind:"noninventory_service",
  availabilityMode:"unlimited_service",quantity:50},
 {id:"line-caps",categoryId:"demo-pro-shop",offerId:"offer-embroidered-caps",organizationId:org,
  sellerOrgId:"demo-chapel-hill",payeeOrgId:"demo-chapel-hill",kind:"physical_merchandise",
  availabilityMode:"physical_stock",quantity:20},
 {id:"line-sponsorship",categoryId:"demo-events",offerId:"offer-sponsor",organizationId:org,
  sellerOrgId:"demo-eig",payeeOrgId:"demo-eig",kind:"sponsorship",
  availabilityMode:"limited_slots",quantity:1}
];
const policies=[
 {id:"policy-rental",trigger:"venue_asset",organizationId:org,
  templateKey:"chgc-venue-rental",legalReviewStatus:"pending_counsel_review"},
 {id:"policy-vendors",trigger:"vendor",organizationId:org,
  templateKey:"vendor-service-agreement",legalReviewStatus:"approved_template_version"},
 {id:"policy-sale",trigger:"sale",organizationId:org,
  templateKey:"event-supplier-terms",legalReviewStatus:"approved_template_version"}
];
test("catalog has flexible parent categories and separate inventory, tax and contract concerns",()=>{
 assert.ok(ITEM_KINDS.includes("noninventory_service")&&ITEM_KINDS.includes("rental_asset"));
 assert.ok(AVAILABILITY_MODES.includes("asset_calendar")&&AVAILABILITY_MODES.includes("physical_stock"));
 assert.ok(EXAMPLE_CATEGORIES.some(x=>x.id==="demo-golf"&&x.parentId===null));
 assert.ok(EXAMPLE_CATEGORIES.some(x=>x.id==="demo-venue-rental"&&x.parentId==="demo-venues"));
 assert.deepEqual(validateCatalogHierarchy().length,EXAMPLE_CATEGORIES.length);
 assert.ok(Object.values(COMMERCE_BLUEPRINT_SAFETY).every(v=>v===false));
});
test("catalog cycles, duplicate ids and unknown parent categories fail closed",()=>{
 assert.throws(()=>validateCatalogHierarchy([
  {id:"one",parentId:"two",label:"A"},{id:"two",parentId:"one",label:"B"}
 ]),/cycle/);
 assert.throws(()=>validateCatalogHierarchy([
  {id:"one",parentId:null,label:"A"},{id:"one",parentId:null,label:"B"}
 ]),/Invalid catalog/);
 assert.throws(()=>validateCatalogHierarchy([{id:"one",parentId:"missing",label:"A"}]),/missing parent/);
});
test("tax hierarchy inheritance is scoped and never treats missing rules as 0% tax",()=>{
 const a=taxReadiness({categoryId:"demo-pro-shop",jurisdiction:"PA",locationId:"demo-chgc"});
 assert.equal(a.profileSource,"category:demo-pro-shop");
 assert.equal(a.profileId,"demo-tax-review-required");
 assert.equal(a.state,"unclassified");
 assert.equal(a.applyTax,null);assert.equal(a.taxCents,null);
 assert.equal(a.legalTaxDeterminationMade,false);
 const override=taxReadiness({categoryId:"demo-pro-shop",productTaxProfileId:"tax-custom-exemption-review",
  jurisdiction:"PA",locationId:"demo-chgc"});
 assert.equal(override.profileSource,"product_override");
 assert.equal(override.profileId,"tax-custom-exemption-review");
 assert.equal(override.applyTax,null);
 assert.equal(override.state,"needs_jurisdiction_review");
 assert.equal(override.reviewRequired,true);
});
test("verified customer exemption still needs certificate and never computes legal tax",()=>{
 assert.throws(()=>taxReadiness({categoryId:"demo-ads",customerExemptionVerified:true}),/requires evidence/);
 const a=taxReadiness({categoryId:"demo-ads",customerExemptionVerified:true,
  exemptionEvidenceId:"verified-cert-abc",jurisdiction:"PA",locationId:"demo-chgc"});
 assert.equal(a.state,"verified_exemption");assert.equal(a.applyTax,null);
 assert.equal(a.taxCents,null);assert.equal(a.reviewRequired,true);
});
test("venue rental, vendor and sale-level contract policies attach to exact sale lines",()=>{
 const r=agreementRequirementsForSale({organizationId:org,orderId:"order-001",lines,agreementPolicies:policies});
 assert.equal(r.kind,"ep_agreement_readiness_preview");
 assert.equal(r.lineSnapshots.length,4);
 assert.equal(r.obligations.length,3);
 assert.deepEqual(r.obligations.find(x=>x.policyId==="policy-rental").linkedLineIds,["line-venue"]);
 assert.deepEqual(r.obligations.find(x=>x.policyId==="policy-vendors").linkedLineIds,["line-catering","line-sponsorship"]);
 assert.deepEqual(r.obligations.find(x=>x.policyId==="policy-sale").linkedLineIds,
  ["line-venue","line-catering","line-caps","line-sponsorship"]);
 assert.equal(r.obligations.find(x=>x.policyId==="policy-rental").status,"blocked_pending_legal_review");
 assert.equal(r.requiresLegalReview,true);
 assert.equal(r.envelopesSent,false);
 assert.equal(r.lineSnapshots[0].payeeOrgId,"demo-eig");
 assert.equal(r.lineSnapshots[0].sellerOrgId,"demo-chapel-hill");
 assert.equal(r.financialPostingsMade,false);
 assert.equal(r.allRequirementsMet,false);
});
test("contracts remain draft requirements even when template version is approved",()=>{
 const r=agreementRequirementsForSale({organizationId:org,orderId:"order-001",
  lines,agreementPolicies:[policies[2]]});
 assert.equal(r.obligations[0].status,"draft_document_needed");
 assert.equal(r.obligations[0].envelopeId,null);
 assert.equal(r.obligations[0].documentsSent,false);
 assert.equal(r.obligations[0].resourceReserved,false);
 assert.equal(r.obligations[0].autoAttachSignedDocument,false);
 assert.equal(r.allRequirementsMet,false);
});
test("wrong-tenant contracts, duplicate sale lines, invalid sellers and unreviewed tax never write",()=>{
 assert.throws(()=>agreementRequirementsForSale({organizationId:"demo-other",orderId:"order-001",
  lines,agreementPolicies:policies}),/wrong organization/);
 assert.throws(()=>agreementRequirementsForSale({organizationId:org,orderId:"order-001",
  lines:[lines[0],lines[0]],agreementPolicies:policies}),/Invalid sale line/);
 assert.throws(()=>agreementRequirementsForSale({organizationId:org,orderId:"order-001",
  lines:[{...lines[0],payeeOrgId:""}],agreementPolicies:policies}),/Invalid sale line/);
 assert.throws(()=>agreementRequirementsForSale({organizationId:org,orderId:"order-001",
  lines,agreementPolicies:[{...policies[0],organizationId:"demo-other"}]}),/cross-organization/);
 assert.throws(()=>taxReadiness({categoryId:"unknown-category"}),/Unknown category/);
});

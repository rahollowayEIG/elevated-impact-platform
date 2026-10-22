import test from "node:test";
import assert from "node:assert/strict";
import {
 EP_STORE_TYPES,EP_STORE_MODES,EP_DEMO_ORGANIZATIONS,EP_DEMO_FUNDRAISER_EVENTS,
 EP_UNIFIED_DEMO_ITEMS,EP_UNIFIED_STORE_SAFETY,allowedStoreItems,
 makeUnifiedStoreDraft,addUnifiedStoreItem,removeUnifiedStoreItem,
 previewStoreDraft,approveUnifiedStoreDraft
} from "../src/lib/epUnifiedStore.mjs";

test("one shared store contract serves three types and three EIG management approaches",()=>{
 assert.deepEqual(EP_STORE_TYPES.map(x=>x.id),["hangar","nonprofit","fundraiser"]);
 assert.deepEqual(EP_STORE_MODES.map(x=>x.id),["self_service","eig_managed","hybrid"]);
 assert.equal(new Set(EP_UNIFIED_DEMO_ITEMS.map(x=>x.id)).size,EP_UNIFIED_DEMO_ITEMS.length);
 assert.ok(EP_UNIFIED_DEMO_ITEMS.some(x=>x.id==="demo-cap"));
 assert.ok(EP_UNIFIED_DEMO_ITEMS.some(x=>x.kind==="contribution"));
 assert.ok(EP_UNIFIED_DEMO_ITEMS.every(x=>x.source==="fictional_demo"&&x.realPriceVerified===false));
 assert.deepEqual(EP_UNIFIED_STORE_SAFETY,{
  fictionalOrganizations:true,fictionalProducts:true,productionDataRead:false,
  bankAccountsConnected:false,realPaymentsEnabled:false,realDonationsEnabled:false,
  payoutRoutingConfigured:false,taxReceiptsEnabled:false,nonprofitStatusVerified:false,
  promotionalNotificationsEnabled:false,storefrontPublished:false,ordersPlaced:false
 });
});
test("ordinary Hangar store has no charitable recipient or event and does not accept giving",()=>{
 const store=makeUnifiedStoreDraft({
  type:"hangar",ownerOrganizationId:"demo-fairway-hangar",
  title:"Local Pro Shop",operatingMode:"hybrid"
 });
 assert.equal(store.type,"hangar");
 assert.equal(store.eventId,null);
 assert.equal(store.beneficiaryOrganizationId,null);
 assert.equal(store.moneyRules.contributedFundsIntendedForOrganizationId,null);
 assert.equal(store.moneyRules.merchandiseSellerOrganizationId,"demo-fairway-hangar");
 assert.equal(store.moneyRules.settlementRecipientOrganizationId,null);
 assert.equal(store.authorityToOperateVerified,false);
 assert.equal(store.liveCheckoutEnabled,false);
 assert.equal(store.taxReceiptsEnabled,false);
 assert.equal(store.visibility,"creator_only");
 assert.ok(allowedStoreItems("hangar").some(x=>x.id==="demo-hangar-voucher"));
 assert.ok(!allowedStoreItems("hangar").some(x=>x.id==="demo-fund-donation"));
 assert.throws(()=>addUnifiedStoreItem(store,"demo-fund-donation"),/not allowed/);
 assert.throws(()=>makeUnifiedStoreDraft({
  type:"hangar",title:"Ordinary store",beneficiaryOrganizationId:"demo-community-cause"
 }),/no implicit fundraiser/);
 assert.throws(()=>makeUnifiedStoreDraft({
  type:"hangar",title:"Ordinary store",eventId:"demo-charity-golf"
 }),/no implicit fundraiser/);
});
test("Nonprofit Store can only be owned by an explicit nonprofit with itself as intended beneficiary",()=>{
 const store=makeUnifiedStoreDraft({
  type:"nonprofit",ownerOrganizationId:"demo-community-cause",title:"Community Hope Giving",
  beneficiaryOrganizationId:"demo-community-cause",goalCents:200000,
  operatingMode:"eig_managed"
 });
 assert.equal(store.ownerOrganizationId,"demo-community-cause");
 assert.equal(store.beneficiaryOrganizationId,"demo-community-cause");
 assert.equal(store.moneyRules.contributedFundsIntendedForOrganizationId,"demo-community-cause");
 assert.equal(store.moneyRules.taxDeductibility,"not_determined");
 assert.equal(store.nonprofitStatusVerified,false);
 assert.equal(store.merchantOfRecordConfigured,false);
 assert.equal(store.recurringChargeEnabled,false);
 assert.ok(allowedStoreItems("nonprofit").some(x=>x.kind==="recurring_giving"));
 assert.throws(()=>makeUnifiedStoreDraft({
  type:"nonprofit",ownerOrganizationId:"demo-fairway-hangar",title:"Fake Charity"
 }),/must belong to a nonprofit/);
 assert.throws(()=>makeUnifiedStoreDraft({
  type:"nonprofit",ownerOrganizationId:"demo-community-cause",title:"Wrong Charity",
  beneficiaryOrganizationId:"demo-education-fund"
 }),/beneficiary must be the owning/);
});
test("Fundraiser Store links to one owned event, separately approved organizer and nonprofit beneficiary",()=>{
 const store=makeUnifiedStoreDraft({
  type:"fundraiser",ownerOrganizationId:"demo-fairway-hangar",
  beneficiaryOrganizationId:"demo-education-fund",
  eventId:"demo-charity-golf",title:"Benefit Tournament",goalCents:500000,
  operatingMode:"self_service"
 });
 assert.equal(store.ownerOrganizationId,"demo-fairway-hangar");
 assert.equal(store.beneficiaryOrganizationId,"demo-education-fund");
 assert.equal(store.eventId,"demo-charity-golf");
 assert.equal(store.moneyRules.merchandiseSellerOrganizationId,"demo-fairway-hangar");
 assert.equal(store.moneyRules.contributedFundsIntendedForOrganizationId,"demo-education-fund");
 assert.equal(store.moneyRules.settlementRecipientOrganizationId,null);
 assert.equal(store.payoutAccountVerified,false);
 const summary=previewStoreDraft(store);
 assert.equal(summary.verifiedRaisedCents,0);
 assert.equal(summary.publicUrl,null);
 assert.equal(summary.checkoutUrl,null);
 assert.equal(summary.donationReceiptUrl,null);
 assert.equal(summary.storefrontLive,false);
 assert.ok(allowedStoreItems("fundraiser").some(x=>x.kind==="event_ticket"));
 assert.ok(allowedStoreItems("fundraiser").some(x=>x.kind==="sponsorship"));
 assert.throws(()=>makeUnifiedStoreDraft({
  type:"fundraiser",ownerOrganizationId:"demo-fairway-hangar",
  eventId:"demo-school-gala",beneficiaryOrganizationId:"demo-community-cause",title:"Wrong event"
 }),/event owned/);
 assert.throws(()=>makeUnifiedStoreDraft({
  type:"fundraiser",ownerOrganizationId:"demo-fairway-hangar",
  eventId:"demo-charity-golf",beneficiaryOrganizationId:"demo-fairway-hangar",title:"Wrong beneficiary"
 }),/nonprofit beneficiary/);
 assert.throws(()=>makeUnifiedStoreDraft({
  type:"fundraiser",ownerOrganizationId:"demo-fairway-hangar",
  eventId:"demo-charity-golf",title:"Missing beneficiary"
 }),/nonprofit beneficiary/);
});
test("nonprofit owner may fundraise for itself without inventing a second merchant",()=>{
 const draft=makeUnifiedStoreDraft({
  type:"fundraiser",ownerOrganizationId:"demo-community-cause",
  beneficiaryOrganizationId:"demo-community-cause",eventId:"demo-school-gala",
  title:"Community Gala",goalCents:400000
 });
 assert.equal(draft.eventId,"demo-school-gala");
 assert.equal(draft.ownerOrganizationId,draft.beneficiaryOrganizationId);
 assert.equal(draft.moneyRules.settlementRecipientOrganizationId,null);
 assert.equal(draft.customerFundsTransferred,false);
});
test("sample merchandise reuses shared Discovery vendor catalog IDs; contribution is a separate intent",()=>{
 const store=makeUnifiedStoreDraft({
  type:"fundraiser",ownerOrganizationId:"demo-fairway-hangar",
  beneficiaryOrganizationId:"demo-community-cause",eventId:"demo-charity-golf",
  title:"Charity Golf Store",goalCents:500000
 });
 const withCap=addUnifiedStoreItem(store,"demo-cap");
 const withGiving=addUnifiedStoreItem(withCap,"demo-fund-donation");
 const withTicket=addUnifiedStoreItem(withGiving,"demo-fund-ticket");
 assert.deepEqual(withTicket.items.map(x=>x.itemId),["demo-cap","demo-fund-donation","demo-fund-ticket"]);
 assert.equal(withTicket.items[0].kind,"merchandise");
 assert.equal(withTicket.items[1].kind,"contribution");
 assert.equal(withTicket.items[2].kind,"event_ticket");
 assert.ok(withTicket.items.every(x=>x.priceVerified===false&&x.payeeVerified===false&&x.notLive===true));
 assert.equal(addUnifiedStoreItem(withTicket,"demo-cap"),withTicket);
 const removed=removeUnifiedStoreItem(withTicket,"demo-cap");
 assert.deepEqual(removed.items.map(x=>x.itemId),["demo-fund-donation","demo-fund-ticket"]);
 const preview=previewStoreDraft(withTicket);
 assert.equal(preview.proposedItems,3);
 assert.equal(preview.kinds.contribution,1);
 assert.equal(preview.kinds.event_ticket,1);
 assert.equal(preview.verifiedRaisedCents,0);
 assert.equal(preview.donationProcessorEnabled,false);
});
test("demo approval never publishes, collects payments, sends receipts or changes payout recipient",()=>{
 const original=addUnifiedStoreItem(makeUnifiedStoreDraft({
  type:"nonprofit",ownerOrganizationId:"demo-community-cause",
  beneficiaryOrganizationId:"demo-community-cause",title:"Community Hope Donations",
  operatingMode:"hybrid",goalCents:300000
 }),"demo-fund-donation");
 const approved=approveUnifiedStoreDraft(original);
 assert.equal(approved.status,"approved_in_demo_not_published");
 assert.equal(approved.visibility,"creator_only");
 assert.equal(approved.liveCheckoutEnabled,false);
 assert.equal(approved.donationCheckoutEnabled,false);
 assert.equal(approved.payoutAccountVerified,false);
 assert.equal(approved.taxReceiptsEnabled,false);
 assert.equal(approved.customerFundsTransferred,false);
 assert.equal(approved.moneyRules.settlementRecipientOrganizationId,null);
 assert.throws(()=>approveUnifiedStoreDraft(approved),/Only pending/);
 assert.throws(()=>addUnifiedStoreItem(approved,"demo-cap"),/Revise this store/);
 assert.throws(()=>removeUnifiedStoreItem(approved,"demo-fund-donation"),/Approved demo store content/);
});
test("invalid seller, mode, goal, type or illicit payout claims fail closed",()=>{
 assert.throws(()=>makeUnifiedStoreDraft({type:"donation",title:"Invalid Store"}),/Choose Hangar Store/);
 assert.throws(()=>makeUnifiedStoreDraft({type:"hangar",ownerOrganizationId:"victim",title:"Wrong Owner"}),/fictional demo owner/);
 assert.throws(()=>makeUnifiedStoreDraft({type:"hangar",title:"Wrong Mode",operatingMode:"administrator"}),/operating model/);
 assert.throws(()=>makeUnifiedStoreDraft({type:"nonprofit",title:"Bad Goal",
  ownerOrganizationId:"demo-community-cause",goalCents:-50}),/valid fundraising goal/);
 assert.throws(()=>makeUnifiedStoreDraft({type:"nonprofit",title:"Bad Goal",
  ownerOrganizationId:"demo-community-cause",goalCents:5e20}),/valid fundraising goal/);
 const s=makeUnifiedStoreDraft({title:"Sample Hangar"});
 assert.throws(()=>previewStoreDraft({...s,liveCheckoutEnabled:true}),/safe, unverified/);
 assert.throws(()=>approveUnifiedStoreDraft({...s,nonprofitStatusVerified:true}),/safe, unverified/);
 assert.throws(()=>previewStoreDraft({...s,
  moneyRules:{...s.moneyRules,settlementRecipientOrganizationId:"demo-community-cause"}}),/safe, unverified/);
 assert.throws(()=>addUnifiedStoreItem(s,"vendor-real-sku"),/not allowed/);
});
test("relevant synthetic profiles are fixed and distinguish sellers, beneficiaries and event ownership",()=>{
 assert.ok(EP_DEMO_ORGANIZATIONS.every(x=>x.id.startsWith("demo-")));
 assert.ok(EP_DEMO_FUNDRAISER_EVENTS.every(x=>x.id.startsWith("demo-")));
 for(const event of EP_DEMO_FUNDRAISER_EVENTS)
  assert.ok(EP_DEMO_ORGANIZATIONS.some(x=>x.id===event.ownerOrganizationId));
});

import test from "node:test";
import assert from "node:assert/strict";
import {
 EP_INTERESTS,EP_DEMO_OFFERS,EP_PILOT_SAFETY,emptyLikes,cleanLikes,discoverOffers,
 monthlyPreview,addWishlistItem,removeWishlistItem,
 buildRegistryDraft,approveRegistryDraft,buildEventProposal,draftCustomizationRequest,
 validateDemoOffers
} from "../src/lib/epDiscoveryEngine.mjs";

test("shared interest IDs are stable and original catalog is fictional only",()=>{
 assert.equal(EP_INTERESTS.length,10);
 assert.equal(new Set(EP_INTERESTS.map(x=>x.id)).size,EP_INTERESTS.length);
 assert.equal(new Set(EP_DEMO_OFFERS.map(x=>x.id)).size,EP_DEMO_OFFERS.length);
 assert.equal(EP_DEMO_OFFERS.length,11);
 assert.ok(EP_DEMO_OFFERS.every(x=>x.source==="fictional_demo"&&x.verifiedForSale===false));
 assert.equal(validateDemoOffers(EP_DEMO_OFFERS),EP_DEMO_OFFERS);
 assert.deepEqual(EP_PILOT_SAFETY,{
  readOnlyExternal:true,realVendorsUsed:false,realOrdersPlaced:false,
  realPaymentsMade:false,realInvitationsSent:false,realNotificationsSent:false,
  customerDataRead:false,ownerReviewRequired:true
 });
});
test("zero consent by default, and personalization never silently enabled",()=>{
 const p=emptyLikes();
 assert.equal(p.personalizeInApp,false);
 assert.equal(p.monthlyRecommendationsOptIn,false);
 assert.equal(p.promotionalSquawksOptIn,false);
 assert.equal(p.locationOffersOptIn,false);
 assert.equal(p.visibility,"private");
 assert.equal(p.draftOnly,true);
 const cleaned=cleanLikes({interests:["golf","golf","unknown"],monthlyClubs:["apparel"],
  monthlyRecommendationsOptIn:true,locationOffersOptIn:true,visibility:"public",budgetCents:1000});
 assert.deepEqual(cleaned.interests,["golf"]);
 assert.equal(cleaned.monthlyRecommendationsOptIn,false);
 assert.equal(cleaned.locationOffersOptIn,false);
 assert.equal(cleaned.visibility,"private");
});
test("nearby offers consent requires explicit marketing opt-in; does not collect precise location",()=>{
 const p=cleanLikes({promotionalSquawksOptIn:false,locationOffersOptIn:true});
 assert.equal(p.locationOffersOptIn,false);
 const enabled=cleanLikes({promotionalSquawksOptIn:true,locationOffersOptIn:true});
 assert.equal(enabled.promotionalSquawksOptIn,true);
 assert.equal(enabled.locationOffersOptIn,true);
 assert.equal("latitude" in enabled,false);
 assert.equal("longitude" in enabled,false);
});
test("discovery does not rank by likes before consent",()=>{
 const a=discoverOffers({...emptyLikes(),interests:["golf"]});
 const b=discoverOffers({...emptyLikes(),interests:["travel"]});
 assert.deepEqual(a.items.map(x=>x.id),b.items.map(x=>x.id));
 assert.ok(a.items.every(x=>x.score===0));
 assert.equal(a.personalized,false);
});
test("opted-in Likes show relevant products, budget filter, sort and query",()=>{
 const p=cleanLikes({...emptyLikes(),personalizeInApp:true,
  interests:["golf","apparel"],monthlyClubs:["apparel"],budgetCents:10000});
 const a=discoverOffers(p);
 assert.equal(a.personalized,true);
 assert.ok(a.items[0].score>=a.items.at(-1).score);
 assert.ok(a.items.some(x=>x.why.includes("Golf")));
 assert.ok(!a.items.some(x=>x.priceCents>10000));
 const b=discoverOffers(p,EP_DEMO_OFFERS,{query:"cap",sort:"price"});
 assert.equal(b.items.length,1);
 assert.equal(b.items[0].id,"demo-cap");
 const c=discoverOffers(p,EP_DEMO_OFFERS,{category:"food",sort:"price"});
 assert.ok(c.items.every(x=>x.category==="food"));
 const d=discoverOffers(p,EP_DEMO_OFFERS,{sort:"name"});
 assert.deepEqual(d.items.map(x=>x.name),[...d.items.map(x=>x.name)].sort());
});
test("monthly clubs do not create a paid subscription, notification or message",()=>{
 const early=monthlyPreview({monthlyClubs:["golf"],monthlyRecommendationsOptIn:true});
 assert.equal(early.enabled,false);
 const selected=monthlyPreview({interests:["golf"],personalizeInApp:true,
  monthlyClubs:["golf"],monthlyRecommendationsOptIn:true,budgetCents:15000});
 assert.equal(selected.enabled,true);
 assert.ok(selected.items.length>0);
 assert.match(selected.note,/No subscription, email or payment/);
 assert.equal(selected.items.every(x=>x.verifiedForSale===false),true);
});
test("wish list adds valid fictional items once and can remove items",()=>{
 const a=addWishlistItem([],"demo-cap");
 const b=addWishlistItem(a,"demo-cap");
 assert.deepEqual(b,["demo-cap"]);
 assert.deepEqual(removeWishlistItem(b,"demo-cap"),[]);
 assert.throws(()=>addWishlistItem(b,"real-vendor-product"),/valid available demo/);
});
test("birthday registry is private, requires organizer review and cannot be distributed",()=>{
 const r=buildRegistryDraft({occasion:"birthday",title:"Party",budgetCents:7500,
  selectedProductIds:["demo-cake"]},{personalizeInApp:true,interests:["gifts"]});
 assert.equal(r.kind,"ep_registry_draft");
 assert.equal(r.status,"draft_pending_organizer_review");
 assert.equal(r.title,"Party");
 assert.equal(r.visibleTo,"creator_only");
 assert.equal(r.shareEnabled,false);
 assert.equal(r.notificationsSent,false);
 assert.equal(r.ordersPlaced,false);
 assert.equal(r.consentToShareProfile,false);
 assert.ok(r.items.some(x=>x.productId==="demo-cake"));
 assert.ok(r.items.every(x=>x.priceCents<=7500));
 assert.equal(r.items.every(x=>x.priceVerified===false),true);
 const approved=approveRegistryDraft(r);
 assert.equal(approved.status,"approved_in_demo_not_published");
 assert.equal(approved.shareEnabled,false);
 assert.equal(approved.notificationsSent,false);
 assert.throws(()=>approveRegistryDraft(approved),/Invalid registry draft/);
});
test("registry blocks invalid event and unsupported item references",()=>{
 assert.throws(()=>buildRegistryDraft({occasion:"unapproved"}),/Choose a supported/);
 assert.throws(()=>buildRegistryDraft({selectedProductIds:["unknown"]}),/valid available demo/);
 const r=buildRegistryDraft({occasion:"wedding",budgetCents:2500});
 assert.ok(r.items.every(x=>x.priceCents<=2500));
 assert.equal(r.source,"fictional_demo");
});
test("100-person golf outing carries transparent per-person quantities and never books",()=>{
 const r=buildEventProposal({eventType:"golf",attendees:100,budgetCents:300000});
 assert.equal(r.status,"draft_requires_vendor_quotes_and_organizer_approval");
 assert.equal(r.eventType,"golf");
 assert.equal(r.attendees,100);
 const catering=r.lines.find(x=>x.purpose==="catering");
 const gifts=r.lines.find(x=>x.purpose==="attendee gift");
 assert.equal(catering.quantity,100);
 assert.equal(gifts.quantity,100);
 assert.equal(catering.totalCents,100*1950);
 assert.equal(gifts.totalCents,100*1800);
 assert.equal(r.estimatedTotalCents,r.lines.reduce((n,x)=>n+x.totalCents,0));
 assert.equal(r.withinExampleBudget,false);
 assert.equal(r.booked,false);
 assert.equal(r.charged,false);
 assert.equal(r.notificationsSent,false);
 assert.ok(r.disclaimers.some(x=>x.includes("Fictional")));
});
test("birthday demo uses caterer, cake and invitations without external supplier calls",()=>{
 const r=buildEventProposal({eventType:"birthday",attendees:25,budgetCents:500000});
 assert.equal(r.lines.length,3);
 assert.equal(r.missing.length,0);
 assert.equal(r.withinExampleBudget,true);
 assert.equal(r.booked,false);
 assert.equal(r.source,"fictional_demo");
});
test("event proposal fails safely on oversized quantities, budgets and missing vendors",()=>{
 assert.throws(()=>buildEventProposal({eventType:"wedding"}),/Choose golf outing or birthday/);
 assert.throws(()=>buildEventProposal({eventType:"golf",attendees:0}),/between 2/);
 assert.throws(()=>buildEventProposal({eventType:"golf",attendees:1001}),/between 2/);
 assert.throws(()=>buildEventProposal({eventType:"golf",attendees:20,budgetCents:-1}),/valid example/);
 const r=buildEventProposal({eventType:"golf",attendees:20,budgetCents:0},EP_DEMO_OFFERS.filter(x=>x.category==="food"));
 assert.ok(r.missing.length>=1);
 assert.equal(r.withinExampleBudget,false);
});
test("creative customization produces drafts, not vendor actions",()=>{
 const d=draftCustomizationRequest("demo-cap","Make the cap navy with a white embroidered logo.");
 assert.equal(d.kind,"ep_custom_product_request");
 assert.equal(d.status,"draft_not_sent");
 assert.equal(d.vendorContacted,false);
 assert.equal(d.paymentCreated,false);
 assert.equal(d.recipient,"none");
 assert.throws(()=>draftCustomizationRequest("demo-cap","short"),/at least 8/);
 assert.throws(()=>draftCustomizationRequest("demo-club-fitting","Custom club fitting request details"),/not customizable/);
});
test("external unverified or malicious offers cannot be smuggled into the demo",()=>{
 assert.throws(()=>discoverOffers(emptyLikes(),[{...EP_DEMO_OFFERS[0],source:"external_live"}]),/Only safe fictional/);
 assert.throws(()=>buildRegistryDraft({},emptyLikes(),[{...EP_DEMO_OFFERS[0],verifiedForSale:true}]),/Only safe fictional/);
 assert.throws(()=>buildEventProposal({},[{...EP_DEMO_OFFERS[0],id:"../secrets"}]),/Only safe fictional/);
 assert.throws(()=>validateDemoOffers([EP_DEMO_OFFERS[0],EP_DEMO_OFFERS[0]]),/Only safe fictional/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
 STORE_PLATFORMS,normalizeMerchantUrl,createStorefrontDraft,
 addStorefrontDraft,removeStorefrontDraft,storefrontCapabilities
} from "../src/lib/epStorefrontSources.mjs";

test("storefront source configuration accepts multiple external providers without promising integrations",()=>{
 assert.deepEqual(STORE_PLATFORMS.map(x=>x.id),[
  "shopify","woocommerce","square","etsy","amazon","ebay","custom"]);
 for(const p of STORE_PLATFORMS){
  const capabilities=storefrontCapabilities(p.id);
  assert.equal(capabilities.linkOnlyPilot,true);
  assert.equal(capabilities.merchantApprovalRequired,true);
  assert.equal(capabilities.apiIntegrationReady,false);
  assert.equal(capabilities.productSyncLive,false);
  assert.equal(capabilities.automaticCommissionCollection,false);
  assert.equal(capabilities.sameCartAcrossStores,false);
  assert.equal(capabilities.vendorOwnedCheckout,true);
 }
});
test("public HTTPS vendor store URL normalization excludes secrets and bad schemes",()=>{
 assert.equal(normalizeMerchantUrl("https://SHop.Example.ORG/catalog?auth=SECRET#token"),
  "https://shop.example.org/catalog");
 assert.equal(normalizeMerchantUrl("https://sample-store.myshopify.com/"),
  "https://sample-store.myshopify.com");
 assert.equal(normalizeMerchantUrl("https://seller.etsy.com/shop/Item"),
  "https://seller.etsy.com/shop/Item");
 for(const url of [
  "http://vendor.com", "javascript:alert(1)", "file:///etc/passwd",
  "https://localhost:3000", "https://127.0.0.1", "https://10.0.0.1/products",
  "https://192.168.5.1", "https://user:password@vendor.com",
  "https://foo.internal/products","https://vendor.local","https://vendor.test",
  "https://[::1]/", "https://vendor.com:8443/api","https://some..vendor.com",
  "https://provider.onion/catalog", "https://domain.example/path"
 ]) assert.throws(()=>normalizeMerchantUrl(url),/HTTPS|valid|public/i,url);
});
test("Shopify source is a link-only unverified draft, not a live install",()=>{
 const d=createStorefrontDraft({
  platform:"shopify",displayName:"  Fairway   Outfitters  ",
  storefrontUrl:"https://fairway.myshopify.com/products/polo?token=notretained"
 });
 assert.match(d.id,/^draft-[0-9a-f-]{36}$/i);
 assert.equal(d.displayName,"Fairway Outfitters");
 assert.equal(d.storefrontUrl,"https://fairway.myshopify.com/products/polo");
 assert.equal(d.kind,"ep_vendor_storefront_draft");
 assert.equal(d.connectionState,"pending_verification");
 assert.equal(d.ownerVerified,false);
 assert.equal(d.credentialsStored,false);
 assert.equal(d.apiConnected,false);
 assert.equal(d.productsImported,0);
 assert.equal(d.automatedSyncEnabled,false);
 assert.equal(d.catalogApproved,false);
 assert.equal(d.checkoutMode,"merchant_website");
 assert.equal(d.platformFeesConfigured,false);
 assert.equal(d.salesAttributionVerified,false);
 assert.equal(d.visibility,"vendor_draft_only");
 assert.equal(d.draftOnly,true);
 assert.match(d.disclaimer,/No site was contacted or scanned/);
 assert.ok(!JSON.stringify(d).includes("notretained"));
});
test("vendor can draft multiple shops, sort and remove in the UI; duplicate URLs rejected",()=>{
 const shopify=createStorefrontDraft({
  storefrontUrl:"https://one.myshopify.com",platform:"shopify",displayName:"Shop A"
 });
 const etsy=createStorefrontDraft({
  storefrontUrl:"https://www.etsy.com/shop/ShopA",platform:"etsy",displayName:"Shop A Etsy"
 });
 const a=addStorefrontDraft([],shopify);
 const b=addStorefrontDraft(a,etsy);
 assert.equal(b.length,2);
 assert.deepEqual(b.map(x=>x.platform),["shopify","etsy"]);
 assert.throws(()=>addStorefrontDraft(b,shopify),/already/);
 assert.deepEqual(removeStorefrontDraft(b,shopify.id),[etsy]);
});
test("unknown provider, malformed source, fake verified sellers and oversized collections fail closed",()=>{
 assert.throws(()=>createStorefrontDraft({
  platform:"fake-ecommerce",storefrontUrl:"https://vendor.com",displayName:"Vendor"
 }),/recognized/);
 assert.throws(()=>createStorefrontDraft({
  platform:"custom",storefrontUrl:"https://vendor.com",displayName:"X"
 }),/2–100/);
 assert.throws(()=>createStorefrontDraft({
  platform:"custom",storefrontUrl:"https://vendor.com",displayName:"A".repeat(101)
 }),/2–100/);
 const d=createStorefrontDraft({
  platform:"square",storefrontUrl:"https://vendor.square.site",displayName:"Vendor"
 });
 assert.throws(()=>addStorefrontDraft([],{...d,ownerVerified:true}),/Only safe/);
 assert.throws(()=>addStorefrontDraft([],{...d,apiConnected:true}),/Only safe/);
 assert.throws(()=>addStorefrontDraft([],{...d,catalogApproved:true}),/Only safe/);
 assert.throws(()=>addStorefrontDraft([],{...d,platformFeesConfigured:true}),/Only safe/);
 assert.throws(()=>addStorefrontDraft([],{...d,storefrontUrl:"http://bad.com"}),/HTTPS/);
 assert.throws(()=>addStorefrontDraft(Array.from({length:10},(_,i)=>({...d,id:"draft-"+i})),d),/Invalid storefront draft collection/);
 assert.throws(()=>storefrontCapabilities("unknown"),/Unknown platform/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
 EP_CAPTURE_TYPES,EP_CAPTURE_SAMPLE_PRODUCTS,EP_CAPTURE_SAMPLE_SALES,EP_CAPTURE_SAMPLE_LEDGER,
 EP_CAPTURE_SAFETY,safePhotoFile,makeProductCaptureDraft,checkExistingProducts,
 linkCaptureToExistingDemoProduct,proposalForSale,previewDoubleSync,approveDemoStockMovement
} from "../src/lib/epProductCapture.mjs";

test("four capture routes support invoice lines, online links, phone photos and manual items without real catalog actions",()=>{
 assert.deepEqual(EP_CAPTURE_TYPES.map(x=>x.id),["invoice_line","online_link","phone_photo","manual"]);
 assert.ok(EP_CAPTURE_SAMPLE_PRODUCTS.some(x=>x.kind==="service"&&x.trackInventory===false));
 assert.ok(EP_CAPTURE_SAMPLE_PRODUCTS.some(x=>x.stockAuthority==="external_demo"));
 assert.ok(Object.values(EP_CAPTURE_SAFETY).every(x=>x===false));
 const c=makeProductCaptureDraft({captureType:"invoice_line",title:"Sponsor sign",sku:" sponsor-001 "});
 assert.equal(c.sku,"SPONSOR-001");
 assert.equal(c.catalogProductCreated,false);
 assert.equal(c.inventoryPosted,false);
 assert.equal(c.referenceOnly,true);
 assert.equal(c.linkedProductId,null);
 assert.equal(c.photoUploaded,false);
 assert.equal(c.externalUrl,null);
});
test("online products remain link-only: remove query tokens, never crawl or import vendor inventory",()=>{
 const c=makeProductCaptureDraft({captureType:"online_link",title:"Vendor Golf Cap",sku:"CAP-001",
  externalUrl:"https://shop.example.org/products/cap?ref=secret-token#personal"});
 assert.equal(c.externalUrl,"https://shop.example.org/products/cap");
 assert.equal(c.ownershipRightsConfirmed,false);
 assert.equal(c.priceVerified,false);
 assert.equal(c.candidateSource,"operator_supplied_unverified");
 assert.equal(c.catalogProductCreated,false);
 assert.throws(()=>makeProductCaptureDraft({captureType:"online_link",title:"Missing URL"}),/public HTTPS product link/);
 assert.throws(()=>makeProductCaptureDraft({captureType:"online_link",title:"Private",externalUrl:"http://localhost/private"}),/HTTPS/);
 assert.throws(()=>makeProductCaptureDraft({captureType:"online_link",title:"Leak",externalUrl:"https://name:password@shop.example.org/item"}),/public HTTPS/);
 assert.throws(()=>makeProductCaptureDraft({captureType:"online_link",title:"Too long",externalUrl:"https://shop.example.org/"+"x".repeat(3000)}),/Invalid public product URL/);
});
test("phone-photo path validates several local images without transferring binary data",()=>{
 const pic={name:"golf cap.jpeg",type:"image/jpeg",size:23000};
 const info=safePhotoFile(pic);
 assert.equal(info.localPreviewOnly,true);
 assert.equal(info.uploaded,false);
 assert.equal(info.pixelsRead,false);
 assert.equal(info.metadataStripped,false);
 const c=makeProductCaptureDraft({
  captureType:"phone_photo",title:"A golf cap",photoInfos:[
   {fileName:info.fileName,mimeType:info.mimeType,sizeBytes:info.sizeBytes},
   {fileName:"tag.png",mimeType:"image/png",sizeBytes:1024},
  ]
 });
 assert.equal(c.photoInfos.length,2);
 assert.equal(c.photoInfos[0].fileName,"golf cap.jpeg");
 assert.equal(c.photoInfos[0].uploaded,false);
 assert.equal(JSON.stringify(c).includes("data:image"),false);
 assert.throws(()=>makeProductCaptureDraft({captureType:"phone_photo",title:"No image"}),/Choose a photo/);
 assert.throws(()=>makeProductCaptureDraft({captureType:"phone_photo",title:"Too many images",
  photoInfos:Array.from({length:6},()=>({fileName:"x.jpg",mimeType:"image/jpeg",sizeBytes:10}))}),/at most five/);
 for(const file of [{name:"script.svg",type:"image/svg+xml",size:100},
   {name:"large.jpg",type:"image/jpeg",size:8*1024*1024},
   {name:"empty.png",type:"image/png",size:0}])
  assert.throws(()=>safePhotoFile(file),/JPG, PNG or WebP/);
});
test("exact SKU matches same-org existing product, never creates second catalog identity",()=>{
 const c=makeProductCaptureDraft({title:"Custom line: embroidered cap",sku:"cap-001",captureType:"invoice_line"});
 const m=checkExistingProducts(c);
 assert.equal(m.matchStatus,"exact_sku_candidate_requires_review");
 assert.deepEqual(m.exactSkuMatches.map(x=>x.id),["demo-product-golf-cap"]);
 assert.ok(!m.exactSkuMatches.some(x=>x.id==="demo-product-other-tenant"));
 assert.equal(m.autoMergePerformed,false);
 assert.equal(m.inventoryChanged,false);
 assert.equal(m.duplicatesRemoved,false);
 const approved=linkCaptureToExistingDemoProduct(c,"demo-product-golf-cap");
 assert.equal(approved.linkedProductId,"demo-product-golf-cap");
 assert.equal(approved.catalogProductCreated,false);
 assert.equal(approved.inventoryPosted,false);
 assert.throws(()=>linkCaptureToExistingDemoProduct(c,"demo-product-other-tenant"),/same-organization match/);
});
test("matching names alone are always manual review, never inferred inventory deductions",()=>{
 const c=makeProductCaptureDraft({title:"Embroidered Golf Cap",sku:"",captureType:"manual"});
 const m=checkExistingProducts(c);
 assert.equal(m.matchStatus,"name_candidate_requires_review");
 assert.equal(m.exactSkuMatches.length,0);
 assert.deepEqual(m.nameCandidates.map(x=>x.id),["demo-product-golf-cap"]);
 assert.equal(m.autoMergePerformed,false);
 const linked=linkCaptureToExistingDemoProduct(c,"demo-product-golf-cap");
 assert.equal(linked.status,"linked_existing_in_demo_only");
 const unknown=checkExistingProducts(makeProductCaptureDraft({title:"Unique custom line",sku:"UNKNOWN-001"}));
 assert.equal(unknown.matchStatus,"no_match_found");
});
test("previous completed invoice can propose retroactive stock deduction, never actually apply it",()=>{
 const p=previewDoubleSync("demo-product-golf-cap");
 assert.equal(p.product.onHand,24);
 assert.equal(p.pendingCount,1);
 const invoice=p.proposals.find(x=>x.saleId==="demo-sale-invoice-107");
 assert.equal(invoice.decision,"proposal_deduct_once_after_owner_approval");
 assert.equal(invoice.proposedDelta,-2);
 assert.equal(invoice.afterExampleOnHand,22);
 assert.equal(invoice.actualStockChange,0);
 assert.equal(invoice.realLedgerWritten,false);
 assert.equal(invoice.needsOwnerApproval,true);
});
test("one sale one deduction: existing Shopify source movement never subtracts again",()=>{
 const p=previewDoubleSync("demo-product-golf-cap");
 const shop=p.proposals.find(x=>x.saleId==="demo-sale-shopify-209");
 assert.equal(shop.decision,"already_accounted_no_double_deduction");
 assert.equal(shop.proposedDelta,0);
 assert.equal(shop.needsOwnerApproval,false);
 const r=approveDemoStockMovement({
  productId:"demo-product-golf-cap",saleId:"demo-sale-shopify-209",ledger:EP_CAPTURE_SAMPLE_LEDGER
 });
 assert.equal(r.postedNewMovement,false);
 assert.equal(r.alreadyAccounted,true);
 assert.equal(r.ledger.length,EP_CAPTURE_SAMPLE_LEDGER.length);
 assert.equal(r.actualStockChange,0);
});
test("approve fictional missing invoice sale exactly once, including repeated UI attempts",()=>{
 const initial=EP_CAPTURE_SAMPLE_LEDGER.map(x=>({...x}));
 const one=approveDemoStockMovement({
  productId:"demo-product-golf-cap",saleId:"demo-sale-invoice-107",ledger:initial
 });
 assert.equal(one.postedNewMovement,true);
 assert.equal(one.sampleOnHand,22);
 assert.equal(one.ledger.length,initial.length+1);
 assert.equal(one.ledger.at(-1).delta,-2);
 assert.equal(one.ledger.at(-1).sourceLineId,"invoice-107-line-2");
 assert.equal(one.actualStockChange,0);
 const twice=approveDemoStockMovement({
  productId:"demo-product-golf-cap",saleId:"demo-sale-invoice-107",ledger:one.ledger
 });
 assert.equal(twice.postedNewMovement,false);
 assert.equal(twice.alreadyAccounted,true);
 assert.equal(twice.sampleOnHand,22);
 assert.equal(twice.ledger.length,one.ledger.length);
 const updated=previewDoubleSync("demo-product-golf-cap",one.ledger);
 assert.equal(updated.pendingCount,0);
 assert.equal(updated.proposals.find(x=>x.saleId==="demo-sale-invoice-107").decision,
  "already_accounted_no_double_deduction");
 assert.equal(EP_CAPTURE_SAMPLE_LEDGER.length,1);
});
test("draft invoice lines must not remove inventory, and services never have stock movements",()=>{
 const cap=previewDoubleSync("demo-product-golf-cap");
 const draft=cap.proposals.find(x=>x.saleId==="demo-sale-draft-208");
 assert.equal(draft.decision,"not_fulfilled_no_stock_adjustment");
 assert.equal(draft.proposedDelta,0);
 assert.throws(()=>approveDemoStockMovement({
  productId:"demo-product-golf-cap",saleId:"demo-sale-draft-208"
 }),/not eligible/);
 const signage=previewDoubleSync("demo-product-signage");
 assert.equal(signage.pendingCount,0);
 assert.equal(signage.proposals[0].decision,"noninventory_no_stock_adjustment");
 assert.throws(()=>approveDemoStockMovement({
  productId:"demo-product-signage",saleId:"demo-sale-signage-301"
 }),/not eligible/);
});
test("external inventory authority requires sync, not a second local stock deduction",()=>{
 const polo=previewDoubleSync("demo-product-polo");
 assert.equal(polo.pendingCount,0);
 assert.equal(polo.proposals[0].decision,"external_authoritative_stock_check");
 assert.equal(polo.proposals[0].proposedDelta,0);
 assert.throws(()=>approveDemoStockMovement({
  productId:"demo-product-polo",saleId:"demo-sale-polo-222"
 }),/not eligible/);
});
test("cross-tenant, unknown, mismatched SKU and invalid transactions fail closed",()=>{
 const product=EP_CAPTURE_SAMPLE_PRODUCTS[0],other=EP_CAPTURE_SAMPLE_PRODUCTS.at(-1);
 const sale=EP_CAPTURE_SAMPLE_SALES[0];
 assert.throws(()=>proposalForSale({product:other,sale}),/same organization/);
 assert.throws(()=>proposalForSale({product,sale:{...sale,sku:"WRONG-001"}}),/SKU does not match/);
 assert.throws(()=>proposalForSale({product,sale:{...sale,quantity:0}}),/verified source sale/);
 assert.throws(()=>approveDemoStockMovement({productId:"real-stock-1",saleId:sale.id}),/Unknown fictional/);
 assert.throws(()=>makeProductCaptureDraft({title:"X"}),/at least two/);
 assert.throws(()=>makeProductCaptureDraft({title:"A Product",organizationId:"external-company"}),/allowed fictional/);
});

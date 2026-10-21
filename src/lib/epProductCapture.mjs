// ElevationPilot Smart Product Capture and Double-Sync domain PILOT.
// No APIs, product imports, media uploads, DB writes, AI, published products,
// POS calls, retroactive mutations or real inventory adjustments.
import {normalizeMerchantUrl} from "./epStorefrontSources.mjs";

export const EP_CAPTURE_TYPES=Object.freeze([
 {id:"invoice_line",label:"From an invoice"},
 {id:"online_link",label:"Find online / product link"},
 {id:"phone_photo",label:"Photo / phone camera"},
 {id:"manual",label:"Add manually"},
]);
export const EP_CAPTURE_SAMPLE_PRODUCTS=Object.freeze([
 {id:"demo-product-golf-cap",organizationId:"demo-fairway-hangar",name:"Embroidered Golf Cap",sku:"CAP-001",
  kind:"physical",trackInventory:true,onHand:24,stockAuthority:"ep_demo",unitCents:2500,externalUrl:null},
 {id:"demo-product-polo",organizationId:"demo-fairway-hangar",name:"Golf Polo Shirt",sku:"POLO-002",
  kind:"physical",trackInventory:true,onHand:12,stockAuthority:"external_demo",unitCents:4999,externalUrl:null},
 {id:"demo-product-signage",organizationId:"demo-fairway-hangar",name:"Hole Sponsor Signage",sku:"SPONSOR-001",
  kind:"service",trackInventory:false,onHand:null,stockAuthority:"none",unitCents:25000,externalUrl:null},
 {id:"demo-product-other-tenant",organizationId:"demo-other-hangar",name:"Embroidered Golf Cap",sku:"CAP-001",
  kind:"physical",trackInventory:true,onHand:99,stockAuthority:"ep_demo",unitCents:2000,externalUrl:null},
]);
export const EP_CAPTURE_SAMPLE_SALES=Object.freeze([
 {id:"demo-sale-invoice-107",organizationId:"demo-fairway-hangar",channel:"manual_invoice",sourceLineId:"invoice-107-line-2",
  description:"Cap with logo",sku:"CAP-001",quantity:2,state:"fulfilled",matchedProductId:null},
 {id:"demo-sale-shopify-209",organizationId:"demo-fairway-hangar",channel:"shopify",sourceLineId:"shopify-209-line-1",
  description:"Embroidered Golf Cap",sku:"CAP-001",quantity:1,state:"fulfilled",matchedProductId:"demo-product-golf-cap"},
 {id:"demo-sale-draft-208",organizationId:"demo-fairway-hangar",channel:"manual_invoice",sourceLineId:"invoice-208-line-1",
  description:"Cap proposed on an unissued invoice",sku:"CAP-001",quantity:3,state:"draft",matchedProductId:null},
 {id:"demo-sale-polo-222",organizationId:"demo-fairway-hangar",channel:"external_store",sourceLineId:"store-222-1",
  description:"Golf Polo Shirt",sku:"POLO-002",quantity:1,state:"fulfilled",matchedProductId:null},
 {id:"demo-sale-signage-301",organizationId:"demo-fairway-hangar",channel:"manual_invoice",sourceLineId:"invoice-301-line-1",
  description:"Sponsor Signage",sku:"SPONSOR-001",quantity:1,state:"fulfilled",matchedProductId:null},
]);
export const EP_CAPTURE_SAMPLE_LEDGER=Object.freeze([
 {id:"demo-stock-shopify-209",organizationId:"demo-fairway-hangar",productId:"demo-product-golf-cap",
  saleId:"demo-sale-shopify-209",sourceLineId:"shopify-209-line-1",delta:-1,source:"shopify_synced",demoOnly:true},
]);
export const EP_CAPTURE_SAFETY=Object.freeze({
 approvedProductsCreated:false,photosUploaded:false,aiPhotoRecognitionEnabled:false,
 merchantProductsImported:false,websitesCrawled:false,inventoryActuallyChanged:false,
 existingSalesModified:false,transactionsCreated:false,customerRecordsRead:false,
 photoContentsExported:false,productionDataRead:false,financialTransactionsPosted:false
});
const ORGS=new Set(["demo-fairway-hangar","demo-other-hangar"]);
const TYPES=new Set(EP_CAPTURE_TYPES.map(x=>x.id));
const MAX_IMG=6*1024*1024;
const IMAGE_TYPES=new Set(["image/jpeg","image/png","image/webp"]);
const name=v=>typeof v==="string"?v.replace(/\s+/g," ").trim().slice(0,160):"";
const compactSku=v=>typeof v==="string"?v.replace(/\s+/g,"").trim().toUpperCase().slice(0,48):"";
const normal=v=>name(v).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const uniqueId=prefix=>prefix+crypto.randomUUID();
export function safePhotoFile({name:fileName="",type="",size=0}={}){
 if(!IMAGE_TYPES.has(type)||!Number.isInteger(size)||size<1||size>MAX_IMG)
  throw Error("Choose a JPG, PNG or WebP photo smaller than 6 MB.");
 return {fileName:name(fileName||"phone-photo"),mimeType:type,sizeBytes:size,
  pixelsRead:false,uploaded:false,metadataStripped:false,localPreviewOnly:true};
}
export function makeProductCaptureDraft({
 organizationId="demo-fairway-hangar",captureType="manual",title,sku="",externalUrl="",
 photoInfo=null,note=""
}={}){
 if(!ORGS.has(organizationId))throw Error("Select an allowed fictional organization.");
 if(!TYPES.has(captureType))throw Error("Choose a supported source for the product.");
 const cleanTitle=name(title);
 if(cleanTitle.length<2)throw Error("Enter at least two characters of a product or service name.");
 if(typeof note!=="string"||note.length>500)throw Error("Product notes must be 500 characters or fewer.");
 const url=externalUrl.trim()?normalizeMerchantUrl(externalUrl):null;
 if(captureType==="online_link"&&!url)
  throw Error("Provide a valid public HTTPS product link.");
 if(captureType==="phone_photo"&&!photoInfo)
  throw Error("Choose a photo for the phone-photo draft.");
 if(photoInfo)photoInfo=safePhotoFile({name:photoInfo.fileName,type:photoInfo.mimeType,size:photoInfo.sizeBytes});
 return {
  kind:"ep_product_capture_demo",schemaVersion:1,id:uniqueId("demo-capture-"),
  organizationId,captureType,title:cleanTitle,sku:compactSku(sku),
  externalUrl:url,photoInfo,note:name(note),
  candidateSource:"operator_supplied_unverified",status:"pending_owner_review",
  linkedProductId:null,catalogProductCreated:false,inventoryPosted:false,
  referenceOnly:true,priceVerified:false,photoUploaded:false,ownershipRightsConfirmed:false,
  description:"Synthetic product capture. Any matched existing product requires verified authorization before a live catalog update."
 };
}
export function checkExistingProducts(draft,products=EP_CAPTURE_SAMPLE_PRODUCTS){
 if(draft?.kind!=="ep_product_capture_demo"||draft.catalogProductCreated!==false||
    draft.inventoryPosted!==false||!ORGS.has(draft.organizationId))
  throw Error("An unverified product-capture draft is required.");
 const owned=products.filter(p=>p.organizationId===draft.organizationId);
 const exactSku=draft.sku?owned.filter(p=>compactSku(p.sku)===draft.sku):[];
 // Never auto-merge name-only, price-only or website guesses.
 const possibleTitle=owned.filter(p=>normal(p.name)===normal(draft.title)&&!exactSku.some(x=>x.id===p.id));
 const state=exactSku.length===1?"exact_sku_candidate_requires_review":
  exactSku.length>1?"ambiguous_sku_requires_review":
  possibleTitle.length?"name_candidate_requires_review":"no_match_found";
 return {kind:"ep_capture_match_preview",draftId:draft.id,organizationId:draft.organizationId,
  matchStatus:state,exactSkuMatches:exactSku.map(p=>({...p})),
  nameCandidates:possibleTitle.map(p=>({...p})),
  autoMergePerformed:false,inventoryChanged:false,duplicatesRemoved:false};
}
export function proposalForSale({product,sale,ledger=EP_CAPTURE_SAMPLE_LEDGER}={}){
 if(!product||!sale||product.organizationId!==sale.organizationId)
  throw Error("Sales and inventory can only be reconciled within the same organization.");
 if(!Number.isInteger(sale.quantity)||sale.quantity<1||sale.quantity>1000||
   !sale.sourceLineId||!sale.id||!product.id)
  throw Error("A verified source sale and quantity are required.");
 if(sale.sku&&compactSku(sale.sku)!==compactSku(product.sku))
  throw Error("Sale SKU does not match this product.");
 const alreadyCounted=ledger.some(e=>e.productId===product.id&&
  e.organizationId===product.organizationId&&(e.saleId===sale.id||e.sourceLineId===sale.sourceLineId));
 let decision="pending_review",delta=0;
 if(!product.trackInventory||product.kind!=="physical")
  decision="noninventory_no_stock_adjustment";
 else if(sale.state!=="fulfilled")
  decision="not_fulfilled_no_stock_adjustment";
 else if(alreadyCounted)
  decision="already_accounted_no_double_deduction";
 else if(product.stockAuthority!=="ep_demo")
  decision="external_authoritative_stock_check";
 else {decision="proposal_deduct_once_after_owner_approval";delta=-sale.quantity;}
 return {
  kind:"ep_inventory_reconciliation_proposal",productId:product.id,
  organizationId:product.organizationId,sourceLineId:sale.sourceLineId,saleId:sale.id,
  channel:sale.channel,quantity:sale.quantity,saleState:sale.state,decision,
  proposedDelta:delta,actualStockChange:0,needsOwnerApproval:delta!==0,
  approvalId:delta!==0?"demo-approval-"+sale.id:null,realLedgerWritten:false,
  beforeExampleOnHand:product.onHand,afterExampleOnHand:product.onHand+delta,
  disclaimer:"Proposal only. No live inventory movement or invoice edit is authorized."
 };
}
export function previewDoubleSync(productId,ledger=EP_CAPTURE_SAMPLE_LEDGER){
 const product=EP_CAPTURE_SAMPLE_PRODUCTS.find(p=>p.id===productId);
 if(!product)throw Error("Unknown demo product.");
 const sales=EP_CAPTURE_SAMPLE_SALES.filter(s=>
  s.organizationId===product.organizationId&&compactSku(s.sku)===compactSku(product.sku));
 const proposals=sales.map(s=>proposalForSale({product,sale:s,ledger}));
 return {product:{...product},proposals,
  pendingCount:proposals.filter(p=>p.decision==="proposal_deduct_once_after_owner_approval").length,
  previewOnly:true,ledgerUnmodified:true};
}
export function approveDemoStockMovement({productId,saleId,ledger=EP_CAPTURE_SAMPLE_LEDGER}={}){
 const product=EP_CAPTURE_SAMPLE_PRODUCTS.find(p=>p.id===productId);
 const sale=EP_CAPTURE_SAMPLE_SALES.find(s=>s.id===saleId);
 if(!product||!sale)throw Error("Unknown fictional product or sale.");
 const proposal=proposalForSale({product,sale,ledger});
 if(proposal.decision==="already_accounted_no_double_deduction")
  return {ledger:[...ledger],postedNewMovement:false,alreadyAccounted:true,
   sampleOnHand:product.onHand+ledger.filter(x=>x.productId===productId&&x.source==="owner_approved_demo").reduce((n,x)=>n+x.delta,0),
   actualStockChange:0};
 if(proposal.decision!=="proposal_deduct_once_after_owner_approval")
  throw Error("This sale is not eligible for a local inventory deduction.");
 const existingDemoDelta=ledger.filter(x=>x.productId===productId&&x.source==="owner_approved_demo")
  .reduce((n,x)=>n+x.delta,0);
 const estimated=product.onHand+existingDemoDelta+proposal.proposedDelta;
 if(estimated<0)throw Error("This demo stock movement would create negative on-hand inventory. Review first.");
 const move={
  id:uniqueId("demo-stock-"),organizationId:product.organizationId,productId,saleId,
  sourceLineId:sale.sourceLineId,delta:proposal.proposedDelta,
  source:"owner_approved_demo",demoOnly:true
 };
 const next=[...ledger,move];
 return {ledger:next,postedNewMovement:true,alreadyAccounted:false,
  sampleOnHand:estimated,actualStockChange:0};
}

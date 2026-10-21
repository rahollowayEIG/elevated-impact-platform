// Universal Commerce + Contract/Tax hierarchy: immutable readiness BLUEPRINT only.
// No tax calculation, law interpretation, payment, signature, contract issuance, stock update,
// provider connection, pricing mutation or actual invoice creation.
export const ITEM_KINDS=Object.freeze([
 "physical_merchandise","noninventory_service","rental_asset","time_slot",
 "sponsorship","advertising","gift_card","membership","contribution_intent"
]);
export const AVAILABILITY_MODES=Object.freeze([
 "physical_stock","asset_calendar","limited_slots","unlimited_service","none"
]);
export const TAX_STATES=Object.freeze([
 "unclassified","needs_jurisdiction_review","verified_rule","verified_exemption"
]);
export const CONTRACT_TRIGGERS=Object.freeze([
 "sale","line","event","venue_asset","vendor","organization"
]);
export const EXAMPLE_CATEGORIES=Object.freeze([
 {id:"demo-golf",parentId:null,label:"Golf Operations",defaultTaxProfileId:null},
 {id:"demo-pro-shop",parentId:"demo-golf",label:"Pro Shop",defaultTaxProfileId:"demo-tax-review-required"},
 {id:"demo-golf-fees",parentId:"demo-golf",label:"Golf Fees and Services",defaultTaxProfileId:"demo-tax-review-required"},
 {id:"demo-rentals",parentId:"demo-golf",label:"Golf Cart and Equipment Rentals",defaultTaxProfileId:"demo-tax-review-required"},
 {id:"demo-venues",parentId:null,label:"Venues and Event Spaces",defaultTaxProfileId:null},
 {id:"demo-venue-rental",parentId:"demo-venues",label:"Venue Rental",defaultTaxProfileId:"demo-tax-review-required"},
 {id:"demo-food",parentId:null,label:"Food and Beverage",defaultTaxProfileId:"demo-tax-review-required"},
 {id:"demo-ads",parentId:null,label:"Advertising, Printing and Signage",defaultTaxProfileId:"demo-tax-review-required"},
 {id:"demo-events",parentId:null,label:"Events, Sponsorships and Registration",defaultTaxProfileId:"demo-tax-review-required"},
 {id:"demo-services",parentId:null,label:"EIG Management and Third Party Services",defaultTaxProfileId:"demo-tax-review-required"},
]);
export const COMMERCE_BLUEPRINT_SAFETY=Object.freeze({
 taxLegallyClassified:false,taxRateCalculated:false,taxExemptionGranted:false,
 contractsSigned:false,docsCreated:false,paymentsReceived:false,inventoryAdjusted:false,
 assetReserved:false,liveRecordsRead:false,thirdPartyRequests:false
});
const IDS=/^[a-z0-9][a-z0-9-_]{1,90}$/;
const KINDS=new Set(ITEM_KINDS);
const AVAIL=new Set(AVAILABILITY_MODES);
const LEGAL=new Set(["pending_counsel_review","approved_template_version"]);
const TRIGGERS=new Set(CONTRACT_TRIGGERS);
function id(value){return typeof value==="string"&&IDS.test(value);}
export function validateCatalogHierarchy(categories=EXAMPLE_CATEGORIES){
 if(!Array.isArray(categories)||categories.length>300)throw Error("Unsupported category catalog.");
 const byId=new Map();
 for(const c of categories){
  if(!id(c?.id)||byId.has(c.id)||typeof c.label!=="string"||!c.label.trim()||c.label.length>100||
    (c.parentId!==null&&!id(c.parentId))||
    (c.defaultTaxProfileId!==null&&c.defaultTaxProfileId!==undefined&&!id(c.defaultTaxProfileId)))
   throw Error("Invalid catalog category.");
  byId.set(c.id,c);
 }
 for(const c of categories){
  const visited=new Set([c.id]);let parent=c.parentId;
  while(parent!==null){
   if(visited.has(parent)||!byId.has(parent))throw Error("Category parent cycle or missing parent.");
   visited.add(parent);parent=byId.get(parent).parentId;
   if(visited.size>15)throw Error("Hierarchy depth exceeds safe sample.");
  }
 }
 return categories.map(x=>({...x}));
}
export function taxReadiness({categoryId,categoryTaxProfiles={},productTaxProfileId=null,
 jurisdiction="",customerExemptionVerified=false,exemptionEvidenceId=null,locationId=""}={}){
 if(!id(categoryId)||!id(locationId)&&locationId!==""||typeof jurisdiction!=="string"||
    typeof categoryTaxProfiles!=="object"||Array.isArray(categoryTaxProfiles))
  throw Error("Invalid example tax context.");
 const categories=validateCatalogHierarchy(),byId=new Map(categories.map(x=>[x.id,x]));
 if(!byId.has(categoryId))throw Error("Unknown category.");
 let current=byId.get(categoryId),profile=null,origin=null;
 if(productTaxProfileId!==null){if(!id(productTaxProfileId))throw Error("Invalid tax profile.");profile=productTaxProfileId;origin="product_override";}
 else{
  while(current){
   const p=Object.hasOwn(categoryTaxProfiles,current.id)?categoryTaxProfiles[current.id]:current.defaultTaxProfileId;
   if(p!==null&&p!==undefined){if(!id(p))throw Error("Invalid tax category profile.");profile=p;origin="category:"+current.id;break;}
   current=current.parentId?byId.get(current.parentId):null;
  }
 }
 if(customerExemptionVerified&&(!exemptionEvidenceId||!id(exemptionEvidenceId)))
  throw Error("A verified exemption requires evidence.");
 const taxStatus=customerExemptionVerified?"verified_exemption":jurisdiction.trim()&&
  profile&&profile!=="demo-tax-review-required"?"needs_jurisdiction_review":"unclassified";
 return {kind:"ep_tax_policy_readiness",categoryId,profileId:profile,profileSource:origin,
  jurisdiction:jurisdiction.trim().slice(0,100),locationId,
  customerExemptionVerified,exemptionEvidenceId:customerExemptionVerified?exemptionEvidenceId:null,
  state:taxStatus,applyTax:null,rate:null,taxCents:null,
  legalTaxDeterminationMade:false,reviewRequired:true,
  warning:"Tax must be validated for actual seller, item, buyer, jurisdiction and sale date. Category alone never proves taxable/non-taxable."};
}
export function agreementRequirementsForSale({
 organizationId,orderId,lines,agreementPolicies=[]
}={}){
 if(!id(organizationId)||!id(orderId)||!Array.isArray(lines)||!Array.isArray(agreementPolicies)||
   lines.length>80||agreementPolicies.length>80)
  throw Error("Invalid sales agreement planning input.");
 const byLine=new Map();
 for(const line of lines){
  if(!id(line?.id)||byLine.has(line.id)||!id(line.categoryId)||!id(line.offerId)||
    !KINDS.has(line.kind)||!AVAIL.has(line.availabilityMode)||
    line.organizationId!==organizationId||!id(line.sellerOrgId)||!id(line.payeeOrgId)||
    !Number.isSafeInteger(line.quantity)||line.quantity<=0)
   throw Error("Invalid sale line or wrong organization.");
  byLine.set(line.id,line);
 }
 const obligations=[];
 for(const p of agreementPolicies){
  if(!id(p?.id)||!TRIGGERS.has(p.trigger)||!id(p.templateKey)||
    !LEGAL.has(p.legalReviewStatus)||!id(p.organizationId)||
    p.organizationId!==organizationId)
   throw Error("Unverified or cross-organization agreement policy.");
  const applies=lines.filter(l=>
    (p.trigger==="sale"||p.trigger==="organization")||
    (p.trigger==="line"&&l.id===p.matchId)||
    (p.trigger==="venue_asset"&&l.availabilityMode==="asset_calendar")||
    (p.trigger==="event"&&l.kind==="sponsorship")||
    (p.trigger==="vendor"&&l.sellerOrgId!==organizationId)
  );
  if(!applies.length)continue;
  obligations.push({policyId:p.id,templateKey:p.templateKey,linkedLineIds:applies.map(l=>l.id),
   signerOrganizationId:organizationId,legalReviewStatus:p.legalReviewStatus,
   status:p.legalReviewStatus==="approved_template_version"?
     "draft_document_needed":"blocked_pending_legal_review",
   signatureRequired:true,envelopeId:null,documentsSent:false,depositPosted:false,
   resourceReserved:false,autoAttachSignedDocument:false,
   immutableSnapshotNeeded:true});
 }
 return {
  kind:"ep_agreement_readiness_preview",organizationId,orderId,
  lineSnapshots:lines.map(l=>({...l})),obligations,
  requiresLegalReview:obligations.some(o=>o.status==="blocked_pending_legal_review"),
  allRequirementsMet:obligations.length===0,
  contractsCreated:false,envelopesSent:false,resourcesReserved:false,
  financialPostingsMade:false,
  warning:"Planning only. Line-to-contract associations are not signed agreements; counsel review and authorized DocuSign workflow are required."
 };
}

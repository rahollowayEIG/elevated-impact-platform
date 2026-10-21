// ElevationPilot Universal Store Engine, safe domain pilot.
// The same store shell is configured for a Hangar, nonprofit or fundraising event.
// NO Supabase queries, user accounts, store publication, live prices, payment,
// nonprofit verification, donations, vendor contact, tax receipts or notifications.
import {EP_DEMO_OFFERS} from "./epDiscoveryEngine.mjs";

export const EP_STORE_TYPES=Object.freeze([
 {id:"hangar",name:"Hangar Store",description:"Organization-owned products, services, gift cards and bookings."},
 {id:"nonprofit",name:"Nonprofit Store",description:"Organization merchandise, wish-list needs, sponsorships and giving."},
 {id:"fundraiser",name:"Fundraiser Store",description:"Event tickets, merchandise, sponsor packages and contributions toward a named cause."},
]);
export const EP_STORE_MODES=Object.freeze([
 {id:"self_service",name:"Self-Service",description:"The organization manages its own store."},
 {id:"eig_managed",name:"EIG Managed",description:"An explicitly authorized EIG team operates on behalf of the organization."},
 {id:"hybrid",name:"Hybrid",description:"The organization and an authorized EIG delegate share approved tasks."},
]);
export const EP_DEMO_ORGANIZATIONS=Object.freeze([
 {id:"demo-fairway-hangar",kind:"business",name:"Fairway Local Business (fictional demo)"},
 {id:"demo-community-cause",kind:"nonprofit",name:"Community Hope Nonprofit (fictional demo)"},
 {id:"demo-education-fund",kind:"nonprofit",name:"Bright Futures Fund (fictional demo)"},
]);
export const EP_DEMO_FUNDRAISER_EVENTS=Object.freeze([
 {id:"demo-charity-golf",name:"Community Golf Benefit (fictional demo)",ownerOrganizationId:"demo-fairway-hangar"},
 {id:"demo-school-gala",name:"Community School Gala (fictional demo)",ownerOrganizationId:"demo-community-cause"},
 {id:"demo-fundraiser-walk",name:"Bright Futures Walk (fictional demo)",ownerOrganizationId:"demo-education-fund"},
]);
const TYPE_SET=new Set(EP_STORE_TYPES.map(x=>x.id));
const MODE_SET=new Set(EP_STORE_MODES.map(x=>x.id));
const org=id=>EP_DEMO_ORGANIZATIONS.find(x=>x.id===id)||null;
const event=id=>EP_DEMO_FUNDRAISER_EVENTS.find(x=>x.id===id)||null;
const maxCurrencyCents=100_000_000;
const safeMoney=v=>Number.isSafeInteger(v)&&v>=0&&v<=maxCurrencyCents;
const cleanTitle=v=>typeof v==="string"?v.replace(/\s+/g," ").trim().slice(0,100):"";
const EXAMPLES=Object.freeze([
 {id:"demo-fund-donation",name:"One-time Contribution Intent",kind:"contribution",priceCents:2500,source:"fictional_demo",
   availableIn:["nonprofit","fundraiser"],description:"Demo pledge only; not a donation transaction or tax receipt."},
 {id:"demo-fund-monthly",name:"Monthly Giving Interest",kind:"recurring_giving",priceCents:1000,source:"fictional_demo",
   availableIn:["nonprofit"],description:"Interest only; no recurring debit or subscription agreement."},
 {id:"demo-fund-ticket",name:"Fundraising Event Admission",kind:"event_ticket",priceCents:6000,source:"fictional_demo",
   availableIn:["fundraiser"],description:"An event ticket placeholder, not live ticketing inventory."},
 {id:"demo-fund-sponsor",name:"Fundraiser Sponsor Package",kind:"sponsorship",priceCents:25000,source:"fictional_demo",
   availableIn:["nonprofit","fundraiser"],description:"Sponsor inquiry draft, no purchased placement or fulfillment."},
 {id:"demo-fund-wishlist",name:"Wish List Supply Need",kind:"wishlist_need",priceCents:3500,source:"fictional_demo",
   availableIn:["nonprofit","fundraiser"],description:"A requested item, not a verified gift claim or delivery."},
 {id:"demo-hangar-voucher",name:"Local Experience Voucher",kind:"gift_card",priceCents:5000,source:"fictional_demo",
   availableIn:["hangar"],description:"Example gift-card idea, not an issued stored-value instrument."},
]);
const vendorKind=p=>p.productType==="service"?"service":"merchandise";
export const EP_UNIFIED_DEMO_ITEMS=Object.freeze([
 ...EP_DEMO_OFFERS.filter(x=>["apparel","gifts","food","printing","golf"].includes(x.category)).map(x=>({
   id:x.id,name:x.name,kind:vendorKind(x),priceCents:x.priceCents,
   source:"fictional_demo",originalVendorId:x.vendor_id,description:x.description,
   availableIn:["hangar","nonprofit","fundraiser"],
   externalMerchantCheckout:false,realPriceVerified:false
 })),
 ...EXAMPLES.map(x=>({...x,externalMerchantCheckout:false,realPriceVerified:false})),
]);
const catalog=new Map(EP_UNIFIED_DEMO_ITEMS.map(x=>[x.id,x]));
export const EP_UNIFIED_STORE_SAFETY=Object.freeze({
 fictionalOrganizations:true,fictionalProducts:true,productionDataRead:false,
 bankAccountsConnected:false,realPaymentsEnabled:false,realDonationsEnabled:false,
 payoutRoutingConfigured:false,taxReceiptsEnabled:false,nonprofitStatusVerified:false,
 promotionalNotificationsEnabled:false,storefrontPublished:false,ordersPlaced:false
});
export function allowedStoreItems(type){
 if(!TYPE_SET.has(type))throw Error("Select a supported store type.");
 return EP_UNIFIED_DEMO_ITEMS.filter(x=>x.availableIn.includes(type));
}
export function makeUnifiedStoreDraft({
 type="hangar",ownerOrganizationId="demo-fairway-hangar",beneficiaryOrganizationId=null,
 eventId=null,title="My EP Store",operatingMode="self_service",goalCents=0
}={}){
 if(!TYPE_SET.has(type))throw Error("Choose Hangar Store, Nonprofit Store, or Fundraiser Store.");
 const owner=org(ownerOrganizationId);
 if(!owner)throw Error("Select a fictional demo owner.");
 if(!MODE_SET.has(operatingMode))throw Error("Select an approved operating model.");
 const safeTitle=cleanTitle(title);
 if(safeTitle.length<3)throw Error("Enter a store title of at least 3 characters.");
 if(!safeMoney(goalCents))throw Error("Enter a valid fundraising goal.");
 const selectedBeneficiary=beneficiaryOrganizationId?org(beneficiaryOrganizationId):null;
 let beneficiary=null,linkedEvent=null;
 if(type==="hangar"){
   if(eventId||beneficiaryOrganizationId||goalCents!==0)
     throw Error("A Hangar Store has no implicit fundraiser or charitable beneficiary.");
 }else if(type==="nonprofit"){
   if(owner.kind!=="nonprofit")throw Error("A Nonprofit Store must belong to a nonprofit organization.");
   if(eventId)throw Error("An organization-level Nonprofit Store is not an event-specific fundraiser.");
   if(beneficiaryOrganizationId&&beneficiaryOrganizationId!==owner.id)
     throw Error("A Nonprofit Store's beneficiary must be the owning organization.");
   beneficiary=owner;
 }else{
   linkedEvent=event(eventId);
   if(!linkedEvent||linkedEvent.ownerOrganizationId!==owner.id)
     throw Error("Choose a fundraising event owned by the selected organization.");
   if(!selectedBeneficiary||selectedBeneficiary.kind!=="nonprofit")
     throw Error("Select a separate, explicitly named nonprofit beneficiary.");
   beneficiary=selectedBeneficiary;
 }
 return {
  kind:"ep_universal_store_draft",schemaVersion:1,
  id:"demo-store-"+crypto.randomUUID(),type,title:safeTitle,
  ownerOrganizationId:owner.id,ownerOrganizationName:owner.name,
  beneficiaryOrganizationId:beneficiary?.id||null,
  beneficiaryOrganizationName:beneficiary?.name||null,
  eventId:linkedEvent?.id||null,eventName:linkedEvent?.name||null,
  operatingMode,goalCents:type==="hangar"?0:goalCents,
  raisedVerifiedCents:0,items:[],
  status:"draft_pending_owner_review",visibility:"creator_only",source:"fictional_demo",
  sellerIdentityVerified:false,nonprofitStatusVerified:false,
  authorityToOperateVerified:false,payoutAccountVerified:false,
  merchantOfRecordConfigured:false,sponsorshipFulfillmentConfigured:false,
  realProductInventoryConfirmed:false,liveCheckoutEnabled:false,
  donationCheckoutEnabled:false,recurringChargeEnabled:false,
  customerFundsTransferred:false,taxReceiptsEnabled:false,
  createdWithoutExternalEffects:true,
  moneyRules:{
   merchandiseSellerOrganizationId:owner.id,
   contributedFundsIntendedForOrganizationId:beneficiary?.id||null,
   settlementRecipientOrganizationId:null,
   platformFeesConfigured:false,
   sellerVsBeneficiarySeparated:true,
   taxDeductibility:"not_determined"
  },
  disclosure:"Unpublished fictional proof of concept. A store owner, beneficiary and seller are distinct; no account is verified and no money moves."
 };
}
function assertDraft(draft){
 if(!draft||draft.kind!=="ep_universal_store_draft"||
    draft.source!=="fictional_demo"||
    !TYPE_SET.has(draft.type)||
    !org(draft.ownerOrganizationId)||
    !["draft_pending_owner_review","approved_in_demo_not_published"].includes(draft.status)||
    draft.visibility!=="creator_only"||
    !Array.isArray(draft.items)||draft.items.length>30||
    draft.liveCheckoutEnabled!==false||
    draft.donationCheckoutEnabled!==false||
    draft.customerFundsTransferred!==false||
    draft.taxReceiptsEnabled!==false||
    draft.payoutAccountVerified!==false||
    draft.nonprofitStatusVerified!==false||
    draft.moneyRules?.settlementRecipientOrganizationId!==null)
   throw Error("Only safe, unverified demonstration stores are allowed.");
 return draft;
}
export function addUnifiedStoreItem(draft,itemId){
 assertDraft(draft);
 if(draft.status!=="draft_pending_owner_review")
  throw Error("Revise this store in a new draft before changing approved demo content.");
 const item=catalog.get(itemId);
 if(!item||!item.availableIn.includes(draft.type))
  throw Error("This example item is not allowed in the selected store.");
 if(draft.items.some(x=>x.itemId===item.id))return draft;
 if(draft.items.length>=30)throw Error("Maximum of 30 fictional demo items reached.");
 const entry={
  itemId:item.id,name:item.name,kind:item.kind,examplePriceCents:item.priceCents,
  source:"fictional_demo",priceVerified:false,
  payeeVerified:false,notLive:true,
 };
 return {...draft,items:[...draft.items,entry]};
}
export function removeUnifiedStoreItem(draft,itemId){
 assertDraft(draft);
 if(draft.status!=="draft_pending_owner_review")
  throw Error("Approved demo store content is locked. Create a new draft to edit.");
 return {...draft,items:draft.items.filter(x=>x.itemId!==itemId)};
}
export function previewStoreDraft(draft){
 assertDraft(draft);
 const kinds=Object.fromEntries([...new Set(draft.items.map(x=>x.kind))].sort()
   .map(k=>[k,draft.items.filter(x=>x.kind===k).length]));
 return {
  id:draft.id,type:draft.type,title:draft.title,
  owner:draft.ownerOrganizationName,beneficiary:draft.beneficiaryOrganizationName,
  event:draft.eventName,
  proposedItems:draft.items.length,kinds,
  goalCents:draft.goalCents,verifiedRaisedCents:0,
  publicUrl:null,checkoutUrl:null,donationReceiptUrl:null,
  storefrontLive:false,merchantVerified:false,donationProcessorEnabled:false,
  statement:"Preview and inventory concepts only. Products are not for sale or donation."
 };
}
export function approveUnifiedStoreDraft(draft){
 assertDraft(draft);
 if(draft.status!=="draft_pending_owner_review")throw Error("Only pending store drafts may be approved in the demo.");
 return {...draft,status:"approved_in_demo_not_published",visibility:"creator_only",
  liveCheckoutEnabled:false,donationCheckoutEnabled:false,
  payoutAccountVerified:false,taxReceiptsEnabled:false,customerFundsTransferred:false};
}

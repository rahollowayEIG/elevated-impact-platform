// ElevationPilot shared commerce prototype. Domain logic only, no I/O.
// IMPORTANT: Fictional vendor offers, local-only drafts, no prices/stock verified.
// Never expose saved likes to vendor accounts or share without explicit consent.
export const EP_INTERESTS=Object.freeze([
 {id:"golf",label:"Golf",icon:"⛳",description:"Golf events, rounds and accessories"},
 {id:"apparel",label:"Apparel",icon:"👕",description:"Clothing, footwear and style"},
 {id:"food",label:"Food",icon:"🍽️",description:"Catering, dining and specialty food"},
 {id:"gifts",label:"Gifts",icon:"🎁",description:"Occasions, group gifts and registries"},
 {id:"home",label:"Home & Garden",icon:"🏡",description:"Home, garden and decor"},
 {id:"sports",label:"Sports",icon:"🏆",description:"Fitness and team sports"},
 {id:"music",label:"Music",icon:"🎵",description:"Shows, music and instruments"},
 {id:"travel",label:"Travel",icon:"✈️",description:"Trips, destinations and experiences"},
 {id:"pets",label:"Pets",icon:"🐾",description:"Pets and pet-related products"},
 {id:"celebrations",label:"Celebrations",icon:"🎈",description:"Parties, weddings and special occasions"},
]);
export const EP_MONTHLY_CLUBS=Object.freeze([
 {id:"apparel",name:"Style Club",details:"Monthly apparel recommendations; no automatic shipment"},
 {id:"golf",name:"Golf Club",details:"Golf finds and equipment previews; no automatic purchase"},
 {id:"food",name:"Food Discoveries",details:"Food and local vendor picks; no automatic purchase"},
 {id:"gifts",name:"Gift Ideas",details:"Thoughtful gift and registry recommendations"},
]);
const INTEREST_SET=new Set(EP_INTERESTS.map(x=>x.id));
const CLUB_SET=new Set(EP_MONTHLY_CLUBS.map(x=>x.id));
const text=(v,max=140)=>typeof v==="string"?v.trim().slice(0,max):"";
const distinct=(items,allow,max=12)=>Array.isArray(items)?
  [...new Set(items.filter(v=>typeof v==="string"&&allow.has(v)))].slice(0,max):[];
const money=(v,fallback=0,max=10000000)=>Number.isSafeInteger(v)&&v>=0&&v<=max?v:fallback;
const makeOffer=(id,name,vendor,category,interests,priceCents,detail,options={})=>Object.freeze({
 id,name,vendor_id:vendor,vendorName:{
  "fairway":"Fairway Supply (fictional demo)",
  "orchard":"Orchard Kitchen (fictional demo)",
  "willow":"Willow Printworks (fictional demo)",
  "celebrate":"Celebrate Studio (fictional demo)",
 }[vendor],
 category,interests,priceCents,description:detail,
 productType:options.productType||"product",personalizable:!!options.personalizable,
 eventTypes:options.eventTypes||["golf","birthday"],unit:options.unit||"each",
 available:options.available!==false,source:"fictional_demo",verifiedForSale:false
});
export const EP_DEMO_OFFERS=Object.freeze([
 makeOffer("demo-polo","Personalized Fairway Polo","fairway","apparel",["golf","apparel"],4200,
 "Create a color or embroidered-logo variation for your next event.",{personalizable:true}),
 makeOffer("demo-cap","Embroidered Golf Cap","fairway","apparel",["golf","apparel","gifts"],2500,
 "An event gift or a monthly style discovery.",{personalizable:true}),
 makeOffer("demo-golf-bundle","Golf Day Welcome Bundle","fairway","gifts",["golf","gifts","sports"],1800,
 "Ball marker, tees and welcome card. Demo price is per attendee.",{personalizable:true}),
 makeOffer("demo-club-fitting","Golf Club Fitting Session","fairway","golf",["golf","sports"],7500,
 "Equipment fitting appointment concept; availability not verified.",{productType:"service",eventTypes:["golf"]}),
 makeOffer("demo-cater-golf","Tournament Lunch Buffet","orchard","food",["food","golf"],1950,
 "Fictional per-person catered lunch; allergens and menu need supplier approval.",{unit:"person",productType:"service",eventTypes:["golf"]}),
 makeOffer("demo-cater-birthday","Birthday Party Bites","orchard","food",["food","celebrations"],1400,
 "Fictional per-person party food menu.",{unit:"person",productType:"service",eventTypes:["birthday"]}),
 makeOffer("demo-cake","Personalized Celebration Cake","orchard","food",["food","gifts","celebrations"],6800,
 "Fictional celebration cake, vendor quote required.",{personalizable:true,eventTypes:["birthday"]}),
 makeOffer("demo-banner","Event Welcome Sign","willow","printing",["golf","celebrations","gifts"],8500,
 "Custom event-day welcome sign; print proof required.",{personalizable:true}),
 makeOffer("demo-invites","Party Invitation Cards","willow","printing",["celebrations","gifts"],12000,
 "Example set of custom printed invitations.",{personalizable:true,eventTypes:["birthday"]}),
 makeOffer("demo-gift-box","Curated Gift Box","celebrate","gifts",["gifts","food","celebrations"],3900,
 "Selection of specialty items in an event-ready gift box.",{personalizable:true}),
 makeOffer("demo-sponsor-banner","Sponsor Sign Bundle","willow","printing",["golf","celebrations"],14900,
 "Fictional starter signage package for event partners.",{personalizable:true,eventTypes:["golf"]}),
]);
export const EP_PILOT_SAFETY=Object.freeze({
 readOnlyExternal:true,realVendorsUsed:false,realOrdersPlaced:false,
 realPaymentsMade:false,realInvitationsSent:false,realNotificationsSent:false,
 customerDataRead:false,ownerReviewRequired:true
});
export function emptyLikes(){
 return {
  schemaVersion:1,interests:[],monthlyClubs:[],budgetCents:7500,
  personalizeInApp:false,monthlyRecommendationsOptIn:false,
  promotionalSquawksOptIn:false,locationOffersOptIn:false,
  visibility:"private",draftOnly:true
 };
}
export function cleanLikes(input){
 const p=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
 const selected=distinct(p.interests,INTEREST_SET,EP_INTERESTS.length);
 const monthly=distinct(p.monthlyClubs,CLUB_SET,EP_MONTHLY_CLUBS.length);
 const personalize=p.personalizeInApp===true;
 return {
  schemaVersion:1,interests:selected,monthlyClubs:monthly,
  budgetCents:money(p.budgetCents,7500,1000000),
  personalizeInApp:personalize,monthlyRecommendationsOptIn:personalize&&p.monthlyRecommendationsOptIn===true&&monthly.length>0,
  promotionalSquawksOptIn:p.promotionalSquawksOptIn===true,
  locationOffersOptIn:p.locationOffersOptIn===true&&p.promotionalSquawksOptIn===true,
  visibility:"private",draftOnly:true
 };
}
export function validateDemoOffers(offers=EP_DEMO_OFFERS){
 if(!Array.isArray(offers)||offers.length>100)throw Error("Invalid pilot catalog.");
 const seen=new Set();
 for(const offer of offers){
  if(!offer||offer.source!=="fictional_demo"||offer.verifiedForSale!==false||
     typeof offer.id!=="string"||!/^demo-[a-z0-9-]{3,48}$/.test(offer.id)||
     seen.has(offer.id)||!text(offer.name)||!text(offer.vendorName)||
     !Number.isSafeInteger(offer.priceCents)||offer.priceCents<0||
     !Array.isArray(offer.interests)||!offer.interests.every(v=>INTEREST_SET.has(v))||
     !Array.isArray(offer.eventTypes)||!offer.eventTypes.every(v=>["golf","birthday"].includes(v)))
   throw Error("Only safe fictional test vendor offers are supported in this pilot.");
  seen.add(offer.id);
 }
 return offers;
}
const score=(offer,likes)=>{
 if(!likes.personalizeInApp)return 0;
 return offer.interests.reduce((n,x)=>n+(likes.interests.includes(x)?3:0),0)
   +(likes.monthlyClubs.includes(offer.category)?2:0);
};
export function discoverOffers(preferences,offers=EP_DEMO_OFFERS,{query="",sort="match",category="all"}={}){
 const likes=cleanLikes(preferences);const catalog=validateDemoOffers(offers);
 const needle=text(query,100).toLowerCase();
 const results=catalog.filter(p=>p.available&&p.priceCents<=likes.budgetCents&&
  (category==="all"||p.category===category)&&
  (!needle||[p.name,p.category,p.description,p.vendorName].some(x=>String(x).toLowerCase().includes(needle))))
   .map(p=>({...p,score:score(p,likes),why:likes.personalizeInApp?
    p.interests.filter(x=>likes.interests.includes(x)).map(x=>EP_INTERESTS.find(t=>t.id===x)?.label).filter(Boolean).join(" · ")||"Recommended demo discovery":"Example product, not personalized"}));
 if(sort==="price")results.sort((a,b)=>a.priceCents-b.priceCents||a.name.localeCompare(b.name));
 else if(sort==="name")results.sort((a,b)=>a.name.localeCompare(b.name));
 else results.sort((a,b)=>b.score-a.score||a.priceCents-b.priceCents||a.name.localeCompare(b.name));
 return {items:results,personalized:likes.personalizeInApp,safety:EP_PILOT_SAFETY};
}
export function monthlyPreview(preferences,offers=EP_DEMO_OFFERS){
 const p=cleanLikes(preferences);
 if(!p.monthlyRecommendationsOptIn)return {enabled:false,items:[],note:"Monthly recommendations require explicit opt-in. Nothing will be sent in this pilot."};
 const items=discoverOffers(p,offers,{sort:"match"}).items.filter(x=>
  p.monthlyClubs.includes(x.category)||x.interests.some(i=>p.monthlyClubs.includes(i))).slice(0,4);
 return {enabled:true,items,note:"Local-only monthly preview. No subscription, email or payment was created."};
}
function offerFor(catalog,id){
 const p=catalog.find(x=>x.id===id);
 if(!p||!p.available)throw Error("Select a valid available demo product.");
 return p;
}
export function addWishlistItem(ids,id,offers=EP_DEMO_OFFERS){
 const catalog=validateDemoOffers(offers);offerFor(catalog,id);
 return [...new Set([...(Array.isArray(ids)?ids.filter(x=>catalog.some(p=>p.id===x)):[]),id])].slice(0,50);
}
export function removeWishlistItem(ids,id){return (Array.isArray(ids)?ids:[]).filter(x=>x!==id);}
export function buildRegistryDraft({occasion="birthday",title="",budgetCents=15000,selectedProductIds=[]}={},likes={},offers=EP_DEMO_OFFERS){
 const catalog=validateDemoOffers(offers),p=cleanLikes(likes);
 if(!["birthday","wedding","charity","golf","other"].includes(occasion))
   throw Error("Choose a supported event occasion.");
 const limit=money(budgetCents,15000,1000000);
 const pickedIds=distinct(selectedProductIds,new Set(catalog.map(x=>x.id)),30);
 const requested=pickedIds.map(id=>offerFor(catalog,id));
 const sorted=discoverOffers({...p,budgetCents:limit},catalog,{sort:"match"}).items;
 const items=[...requested,...sorted.filter(x=>!pickedIds.includes(x.id))].filter(x=>x.priceCents<=limit)
   .slice(0,8).map(x=>({productId:x.id,name:x.name,priceCents:x.priceCents,vendorName:x.vendorName,
     source:"fictional_demo",priceVerified:false}));
 return {
  kind:"ep_registry_draft",schemaVersion:1,status:"draft_pending_organizer_review",
  occasion,title:text(title,100)||occasion+" gift ideas",items,
  visibleTo:"creator_only",shareEnabled:false,ordersPlaced:false,notificationsSent:false,
  verifiedVendorProducts:false,consentToShareProfile:false,source:"fictional_demo"
 };
}
export function approveRegistryDraft(draft){
 if(draft?.kind!=="ep_registry_draft"||
   draft.status!=="draft_pending_organizer_review"||
   draft.shareEnabled!==false||draft.source!=="fictional_demo"||
   !Array.isArray(draft.items))throw Error("Invalid registry draft.");
 return {...draft,status:"approved_in_demo_not_published",
  shareEnabled:false,visibleTo:"creator_only",notificationsSent:false,ordersPlaced:false};
}
const REQUIRED={golf:[
 ["catering",x=>x.category==="food"&&x.eventTypes.includes("golf"),true],
 ["attendee gift",x=>x.id==="demo-golf-bundle",true],
 ["event signage",x=>x.category==="printing"&&x.eventTypes.includes("golf"),false],
 ],birthday:[
 ["catering",x=>x.id==="demo-cater-birthday",true],
 ["cake",x=>x.id==="demo-cake",false],
 ["invitations",x=>x.id==="demo-invites",false],
 ]};
export function buildEventProposal({eventType="golf",attendees=100,budgetCents=250000}={},offers=EP_DEMO_OFFERS){
 const catalog=validateDemoOffers(offers);
 if(!REQUIRED[eventType])throw Error("Choose golf outing or birthday party.");
 if(!Number.isInteger(attendees)||attendees<2||attendees>1000)throw Error("Attendee count must be between 2 and 1,000.");
 if(!Number.isSafeInteger(budgetCents)||budgetCents<0||budgetCents>100000000)
  throw Error("Enter a valid example event budget.");
 const missing=[],lines=[];
 for(const [purpose,match,perAttendee] of REQUIRED[eventType]){
  const eligible=catalog.filter(x=>x.available&&match(x)).sort((a,b)=>a.priceCents-b.priceCents);
  if(!eligible.length){missing.push(purpose);continue;}
  const offer=eligible[0],quantity=perAttendee?attendees:1;
  lines.push({purpose,productId:offer.id,name:offer.name,vendorName:offer.vendorName,
   unitCents:offer.priceCents,quantity,totalCents:offer.priceCents*quantity,
   priceVerified:false,source:"fictional_demo"});
 }
 const estimatedTotalCents=lines.reduce((sum,x)=>sum+x.totalCents,0);
 return {
  kind:"ep_event_vendor_proposal",eventType,attendees,budgetCents,
  status:"draft_requires_vendor_quotes_and_organizer_approval",
  lines,missing,estimatedTotalCents,withinExampleBudget:estimatedTotalCents<=budgetCents,
  booked:false,charged:false,notificationsSent:false,source:"fictional_demo",
  disclaimers:[
   "Fictional test vendors and prices. Availability, delivery, taxes and service fees are not confirmed.",
   "No vendor booking, payment, email or Squawk message occurs in this demo.",
  ]
 };
}
export function draftCustomizationRequest(offerId,note,offers=EP_DEMO_OFFERS){
 const catalog=validateDemoOffers(offers),offer=offerFor(catalog,offerId);
 if(!offer.personalizable)throw Error("This example is not customizable.");
 const description=text(note,500);
 if(description.length<8)throw Error("Describe your customization in at least 8 characters.");
 return {
  kind:"ep_custom_product_request",productId:offer.id,productName:offer.name,
  description,status:"draft_not_sent",recipient:"none",vendorContacted:false,
  paymentCreated:false,source:"fictional_demo"
 };
}

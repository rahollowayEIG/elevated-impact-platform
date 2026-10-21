// ElevationPilot Vendor Marketplace: store connection contracts and link-only pilot.
// All drafts are local-only. No URL fetches, merchant installs, OAuth, crawling,
// product import, commission collection or cross-vendor checkout happen here.
export const STORE_PLATFORMS=Object.freeze([
 {id:"shopify",name:"Shopify",potentialIntegration:"Merchant-approved API integration"},
 {id:"woocommerce",name:"WooCommerce",potentialIntegration:"Merchant-approved store API integration"},
 {id:"square",name:"Square Online",potentialIntegration:"Merchant-approved platform integration"},
 {id:"etsy",name:"Etsy",potentialIntegration:"Source link; partner API subject to permissions"},
 {id:"amazon",name:"Amazon",potentialIntegration:"Source link; external marketplace rules apply"},
 {id:"ebay",name:"eBay",potentialIntegration:"Source link; marketplace rules apply"},
 {id:"custom",name:"Other e-commerce website",potentialIntegration:"Source link; API only if seller grants permission"},
]);
const PROVIDERS=new Set(STORE_PLATFORMS.map(x=>x.id));
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function cleanDisplayName(value){
 if(typeof value!=="string")throw Error("Enter a store display name.");
 const out=value.replace(/\s+/g," ").trim();
 if(out.length<2||out.length>100)throw Error("Store display name must be 2–100 characters.");
 return out;
}
function publicHost(host){
 if(!host||host.length>253||host.includes("..")||!host.includes("."))return false;
 if(!/^[a-z0-9.-]+$/i.test(host))return false;
 if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||
    host.endsWith(".internal")||host.endsWith(".onion")||host.endsWith(".test")||
    host.endsWith(".invalid")||host.endsWith(".example"))return false;
 if(/^[0-9.]+$/.test(host)||host.startsWith("127.")||
   host.startsWith("10.")||host.startsWith("192.168.")||host.startsWith("169.254."))return false;
 const labels=host.split(".");
 return labels.every(x=>x.length>=1&&x.length<=63&&!x.startsWith("-")&&!x.endsWith("-"))&&
   labels.at(-1).length>=2;
}
export function normalizeMerchantUrl(input){
 if(typeof input!=="string"||input.length>750)throw Error("Enter a public HTTPS storefront URL.");
 const raw=input.trim();
 if(!/^https:\/\//i.test(raw))throw Error("Use a public HTTPS storefront link.");
 let url;
 try{url=new URL(raw);}catch{throw Error("Enter a valid HTTPS storefront link.");}
 if(url.protocol!=="https:"||url.username||url.password||url.port||
    !publicHost(url.hostname))throw Error("Enter a public HTTPS storefront without credentials or custom ports.");
 // Never persist query tokens, referral IDs or fragment data from pasted links.
 url.search="";url.hash="";
 const clean=url.toString();
 if(clean.length>620)throw Error("The storefront URL is too long.");
 return clean.endsWith("/")&&url.pathname==="/"?clean.slice(0,-1):clean;
}
export function createStorefrontDraft({storefrontUrl,platform="custom",displayName}={}){
 if(!PROVIDERS.has(platform))throw Error("Select a recognized e-commerce platform.");
 const url=normalizeMerchantUrl(storefrontUrl);
 const name=cleanDisplayName(displayName);
 return {
  kind:"ep_vendor_storefront_draft",schemaVersion:1,
  id:"draft-"+crypto.randomUUID(),
  displayName:name,platform,storefrontUrl:url,
  source:"vendor_supplied_link_only",connectionState:"pending_verification",
  ownerVerified:false,credentialsStored:false,apiConnected:false,
  automatedSyncEnabled:false,productsImported:0,
  catalogApproved:false,checkoutMode:"merchant_website",
  salesAttributionVerified:false,platformFeesConfigured:false,
  visibility:"vendor_draft_only",draftOnly:true,
  disclaimer:"Unverified link-only draft. No site was contacted or scanned. Products, rights, checkout and commissions are not connected."
 };
}
export function addStorefrontDraft(current,draft){
 if(!Array.isArray(current)||current.length>9||
   !current.every(x=>x?.kind==="ep_vendor_storefront_draft"&&x.draftOnly===true&&
     x.apiConnected===false&&x.ownerVerified===false))throw Error("Invalid storefront draft collection.");
 if(!draft||draft.kind!=="ep_vendor_storefront_draft"||draft.draftOnly!==true||
    draft.connectionState!=="pending_verification"||
    draft.ownerVerified!==false||draft.apiConnected!==false||
    draft.automatedSyncEnabled!==false||draft.catalogApproved!==false||
    draft.platformFeesConfigured!==false||draft.salesAttributionVerified!==false||
    !PROVIDERS.has(draft.platform)||
    !own(draft,"storefrontUrl")||normalizeMerchantUrl(draft.storefrontUrl)!==draft.storefrontUrl||
    cleanDisplayName(draft.displayName)!==draft.displayName)
   throw Error("Only safe unverified vendor store drafts can be added.");
 if(current.some(x=>x.storefrontUrl.toLowerCase()===draft.storefrontUrl.toLowerCase()))
   throw Error("That storefront link is already on this vendor draft list.");
 return [...current,draft];
}
export function removeStorefrontDraft(current,id){
 if(!Array.isArray(current)||typeof id!=="string")throw Error("Invalid storefront draft list.");
 return current.filter(x=>x.id!==id);
}
export function storefrontCapabilities(platform){
 if(!PROVIDERS.has(platform))throw Error("Unknown platform.");
 const p=STORE_PLATFORMS.find(x=>x.id===platform);
 return {
  platform,description:p.potentialIntegration,
  linkOnlyPilot:true,merchantApprovalRequired:true,
  apiIntegrationReady:false,webhooksConfigured:false,productSyncLive:false,
  sameCartAcrossStores:false,automaticCommissionCollection:false,
  vendorOwnedCheckout:true
 };
}

import React,{useMemo,useState} from "react";
import {
 STORE_PLATFORMS,createStorefrontDraft,addStorefrontDraft,
 removeStorefrontDraft,storefrontCapabilities
} from "../lib/epStorefrontSources.mjs";
import "./vendor-store-connections-pilot.css";
function downloadDrafts(stores){
 const payload={
  kind:"ep_storefront_sources_demo_export",schemaVersion:1,
  status:"unverified_link_only",vendorIdentityVerified:false,
  productImportAttempted:false,realConnections:false,
  paymentCollection:false,
  stores
 };
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="ep-storefront-link-drafts.json";
 document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),700);
}
export default function VendorStoreConnectionsPilot(){
 const [provider,setProvider]=useState("shopify");
 const [storeName,setStoreName]=useState("");
 const [storeUrl,setStoreUrl]=useState("");
 const [entries,setEntries]=useState([]);
 const [query,setQuery]=useState("");
 const [sort,setSort]=useState("name");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const sorted=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  const rows=entries.filter(x=>
   !needle||[x.displayName,x.platform,x.storefrontUrl]
   .some(v=>v.toLowerCase().includes(needle)));
  rows.sort((a,b)=>sort==="platform"?
    a.platform.localeCompare(b.platform)||a.displayName.localeCompare(b.displayName):
    a.displayName.localeCompare(b.displayName));
  return rows;
 },[entries,query,sort]);
 const capabilities=storefrontCapabilities(provider);
 function add(e){
  e.preventDefault();
  setError("");setNotice("");
  try{
   const draft=createStorefrontDraft({storefrontUrl:storeUrl,displayName:storeName,platform:provider});
   setEntries(old=>addStorefrontDraft(old,draft));
   setStoreName("");setStoreUrl("");
   setNotice("Storefront link added to this demo only. No verification, inventory scan, or Shopify connection occurred.");
  }catch(err){setError(err?.message||"Unable to add store draft.");}
 }
 function remove(id){
  setEntries(old=>removeStorefrontDraft(old,id));
  setNotice("Store link removed from this demo.");
  setError("");
 }
 return <section className="ep-store-root" aria-labelledby="eps-heading">
  <div className="epd-subhead">
   <div><h3 id="eps-heading">Connect My Store · Vendor Hub</h3>
    <p>One vendor can link multiple sales channels instead of creating a second catalog. This demo only prepares unverified links.</p>
   </div>
   <span className="epd-counter">{entries.length} linked drafts</span>
  </div>
  <div className="ep-store-steps">
   <div><strong>1. Add existing storefront</strong><small>Shopify, WooCommerce, Square, Etsy, Amazon or a custom URL</small></div>
   <div><strong>2. Verify seller and permissions</strong><small>Separate future vendor onboarding and merchant authorization</small></div>
   <div><strong>3. Sync approved listings</strong><small>API when supported, otherwise merchant-maintained links</small></div>
   <div><strong>4. Send orders to merchant</strong><small>Original checkout remains with each vendor until a real EP commerce integration is approved</small></div>
  </div>
  <form className="ep-store-form" onSubmit={add}>
   <div className="ep-store-fields">
    <label>E-commerce platform
     <select value={provider} onChange={e=>setProvider(e.target.value)}>
      {STORE_PLATFORMS.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
     </select>
    </label>
    <label>Store display name
     <input value={storeName} maxLength={100}
      onChange={e=>setStoreName(e.target.value)}
      placeholder="Example: North Valley Pro Shop" required/>
    </label>
    <label className="ep-store-link-label">Public HTTPS store or product URL
     <input value={storeUrl} type="url" maxLength={750} required
      onChange={e=>setStoreUrl(e.target.value)}
      placeholder="https://shopname.myshopify.com"/>
    </label>
   </div>
   <p className="ep-store-mode"><strong>{capabilities.description}.</strong> Actual connection status:
    <strong> link-only demo</strong>. Shopify store authorization and automatic updates are not yet connected.</p>
   <div className="epd-action-row">
    <button type="submit" className="platform-primary-button">Add storefront link draft</button>
    {entries.length>0&&<button type="button" className="platform-secondary-button"
      onClick={()=>downloadDrafts(entries)}>Export store link drafts</button>}
   </div>
  </form>
  {error&&<p className="platform-error" role="alert">{error}</p>}
  {notice&&<p className="epd-notice" role="status">{notice}</p>}
  <div className="ep-store-list">
   <div className="ep-store-head">
    <h4>Vendor store connection drafts</h4>
    <div className="ep-store-tools">
     <label>Search linked stores<input type="search" value={query}
       onChange={e=>setQuery(e.target.value)} placeholder="Store or platform"/></label>
     <label>Sort stores<select value={sort} onChange={e=>setSort(e.target.value)}>
      <option value="name">Store name</option><option value="platform">Platform</option>
     </select></label>
    </div>
   </div>
   {sorted.length===0?<p className="ep-store-empty">
     {entries.length?"No store links match your search.":"No storefronts added yet. Add one above to test the vendor onboarding flow."}
    </p>:sorted.map(x=><article className="ep-store-card" key={x.id}>
      <div><strong>{x.displayName}</strong>
       <small>{STORE_PLATFORMS.find(p=>p.id===x.platform)?.name||"Other ecommerce"} · Unverified link only</small>
       <code>{x.storefrontUrl}</code>
       <span>Merchant not verified · 0 products imported · Original merchant checkout</span>
      </div>
      <button type="button" onClick={()=>remove(x.id)}>Remove</button>
     </article>)}
  </div>
  <p className="epd-bottom-note"><strong>Important:</strong> Adding a link does not prove the store belongs to the vendor,
   grant permission to copy its photos or prices, enable checkout, or give EIG a percentage of external transactions.
   Real imports require vendor authorization, supported APIs or approved feeds, inventory freshness checks and a commercial agreement.
   No site is crawled or contacted here. Store links exist only in this browser tab.</p>
 </section>;
}

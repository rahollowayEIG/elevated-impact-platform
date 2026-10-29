import React,{useMemo,useState} from "react";
import {
 EP_INTERESTS,EP_MONTHLY_CLUBS,EP_DEMO_OFFERS,EP_PILOT_SAFETY,
 emptyLikes,cleanLikes,discoverOffers,monthlyPreview,
 addWishlistItem,removeWishlistItem,buildRegistryDraft,approveRegistryDraft,
 buildEventProposal,draftCustomizationRequest
} from "../lib/epDiscoveryEngine.mjs";
import "./ep-discovery-pilot.css";
import VendorStoreConnectionsPilot from "./VendorStoreConnectionsPilot.jsx";
import EpUnifiedStorePilot from "./EpUnifiedStorePilot.jsx";
import EpProductCapturePilot from "./EpProductCapturePilot.jsx";

const TABS=[
 {id:"likes",title:"My Likes",emoji:"❤️"},
 {id:"discover",title:"Discoveries",emoji:"✨"},
 {id:"registry",title:"Gift Registry",emoji:"🎁"},
 {id:"events",title:"Event Concierge",emoji:"⛳"},
 {id:"stores",title:"Connect My Store",emoji:"🏪"},
 {id:"store-engine",title:"Store Structures",emoji:"🏬"},
 {id:"capture",title:"Product Capture",emoji:"📸"},
];
const cents=v=>(v/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
const detail=EP_INTERESTS.reduce((m,x)=>({...m,[x.id]:x.label}),{});
function Download({value,name,label="Export draft JSON"}){
 return <button type="button" className="platform-secondary-button"
  onClick={()=>{
   const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));
   const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }}>{label}</button>;
}
export default function EpDiscoveryPilot(){
 const [tab,setTab]=useState("likes");
 const [likes,setLikes]=useState(()=>({...emptyLikes(),interests:["golf","food","apparel"]}));
 const [query,setQuery]=useState("");
 const [sort,setSort]=useState("match");
 const [category,setCategory]=useState("all");
 const [saved,setSaved]=useState([]);
 const [registrySelection,setRegistrySelection]=useState([]);
 const [registryTitle,setRegistryTitle]=useState("Birthday gift ideas");
 const [occasion,setOccasion]=useState("birthday");
 const [registryBudget,setRegistryBudget]=useState(150);
 const [registry,setRegistry]=useState(null);
 const [eventType,setEventType]=useState("golf");
 const [attendees,setAttendees]=useState(100);
 const [eventBudget,setEventBudget]=useState(3000);
 const [proposal,setProposal]=useState(null);
 const [customProduct,setCustomProduct]=useState(null);
 const [customNotes,setCustomNotes]=useState("");
 const [customDrafts,setCustomDrafts]=useState([]);
 const [showMonthly,setShowMonthly]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const pref=useMemo(()=>cleanLikes(likes),[likes]);
 const result=useMemo(()=>discoverOffers(pref,EP_DEMO_OFFERS,{query,sort,category}),[pref,query,sort,category]);
 const monthly=useMemo(()=>monthlyPreview(pref),[pref]);
 function change(field,value){
  setLikes(old=>({...old,[field]:value}));
  setShowMonthly(false);
  setRegistry(null);
 }
 function toggleInterest(id){
  const next=likes.interests.includes(id)?likes.interests.filter(x=>x!==id):[...likes.interests,id];
  change("interests",next);
 }
 function toggleClub(id){
  const next=likes.monthlyClubs.includes(id)?likes.monthlyClubs.filter(x=>x!==id):[...likes.monthlyClubs,id];
  change("monthlyClubs",next);
 }
 function message(text,problem=false){setNotice(problem?"":text);setError(problem?text:"");}
 function chooseProduct(id){
  setRegistrySelection(old=>addWishlistItem(old,id));
  setRegistry(null);setTab("registry");message("Added to your private registry draft selection. Nothing has been shared.");
 }
 function addSaved(id){
  setSaved(old=>addWishlistItem(old,id));message("Saved to the demo wish list. No purchase was created.");
 }
 function generateRegistry(){
  try{
   const draft=buildRegistryDraft({occasion,title:registryTitle,budgetCents:Math.round(registryBudget*100),
    selectedProductIds:registrySelection},pref);
   setRegistry(draft);message("Gift registry draft created for your review. Nobody has received it.");
  }catch(err){message(err?.message||"Unable to prepare registry",true);}
 }
 function approveRegistry(){
  try{setRegistry(old=>approveRegistryDraft(old));message("Registry approved inside this demo only. No public registry, email or Squawk was created.");}
  catch(err){message(err?.message||"Unable to approve registry",true);}
 }
 function generateEvent(){
  try{
   setProposal(buildEventProposal({eventType,attendees:Number(attendees),budgetCents:Math.round(eventBudget*100)}));
   message("Demo event proposal prepared. Supplier pricing and availability still require real quotes.");
  }catch(err){message(err?.message||"Unable to build proposal",true);}
 }
 function saveCustom(){
  try{
   const draft=draftCustomizationRequest(customProduct,customNotes);
   setCustomDrafts(old=>[...old,draft].slice(-12));
   setCustomProduct(null);setCustomNotes("");
   message("Customization request saved locally as an unsent draft. No vendor was contacted.");
  }catch(err){message(err?.message||"Unable to create custom product",true);}
 }
 return <section className="platform-section-card epd-root" aria-labelledby="epd-title">
  <header className="epd-head">
   <div><p className="platform-eyebrow">BUILD LAB / SHARED COMMERCE FOUNDATION</p>
    <h2 id="epd-title">My Likes + Marketplace Pilot</h2>
    <p>Test one connected experience: preferences, personalized monthly picks, a wish list, a gift registry, and an event vendor proposal.</p>
   </div>
   <span className="epd-demo-tag">FICTIONAL DEMO · NO TRANSACTIONS</span>
  </header>
  <p className="epd-safety"><strong>Safe test environment:</strong> All vendors, products and prices are invented. This browser demo does not use customer records, AI, real catalogs, payment providers, email, or Squawk. Approval is local only. Settings reset on refresh and do not modify a Passenger profile.</p>
  <div className="epd-tabs" role="tablist" aria-label="Discovery pilot sections">
   {TABS.map(x=><button key={x.id} id={"epd-tab-"+x.id} role="tab" type="button"
    aria-selected={tab===x.id} aria-controls={"epd-panel-"+x.id} tabIndex={tab===x.id?0:-1}
    onClick={()=>{setTab(x.id);setError("");setNotice("");}}>{x.emoji} {x.title}</button>)}
  </div>
  {notice&&<p className="epd-notice" role="status">{notice}</p>}
  {error&&<p className="platform-error" role="alert">{error}</p>}
  {tab==="likes"&&<div role="tabpanel" id="epd-panel-likes" aria-labelledby="epd-tab-likes" className="epd-panel">
   <div className="epd-subhead"><div><h3>What do you enjoy?</h3>
    <p>Choose only what interests you. Real account onboarding will be optional and editable at any time.</p></div>
    <span className="epd-counter">{pref.interests.length} selected</span></div>
   <div className="epd-category-grid">
    {EP_INTERESTS.map(x=><button type="button" key={x.id}
     className={"epd-category"+(pref.interests.includes(x.id)?" epd-category-active":"")}
     aria-pressed={pref.interests.includes(x.id)} onClick={()=>toggleInterest(x.id)}>
     <span aria-hidden="true">{x.icon}</span><strong>{x.label}</strong><small>{x.description}</small>
     </button>)}
   </div>
   <div className="epd-settings">
    <div><h3>Personalization & privacy</h3><p>In a real profile, these would be saved securely per account. Vendors would not see an individual's private preferences.</p></div>
    <label><input type="checkbox" checked={pref.personalizeInApp}
      onChange={e=>change("personalizeInApp",e.target.checked)}/>
      Use My Likes to personalize what I see inside ElevationPilot</label>
    <label><input type="checkbox" checked={pref.promotionalSquawksOptIn}
      onChange={e=>{change("promotionalSquawksOptIn",e.target.checked);if(!e.target.checked)change("locationOffersOptIn",false);}}/>
      I'd like optional promotional Squawk messages (demo preference only)</label>
    <label><input type="checkbox" disabled={!pref.promotionalSquawksOptIn}
      checked={pref.locationOffersOptIn}
      onChange={e=>change("locationOffersOptIn",e.target.checked)}/>
      I'd like eligible nearby offers, with separately granted location permission in a future app</label>
    <p className="epd-privacy-line">Default visibility: <strong>Private</strong>. These toggles do not subscribe anyone to messages or location tracking.</p>
   </div>
   <div className="epd-settings">
    <h3>Monthly Discoveries</h3>
    <p>Choose free recommendation categories. These are not paid subscription clubs or automatic shipments.</p>
    <div className="epd-monthly-grid">
     {EP_MONTHLY_CLUBS.map(x=><label key={x.id} className="epd-monthly-card">
      <input type="checkbox" checked={pref.monthlyClubs.includes(x.id)}
       onChange={()=>toggleClub(x.id)}/><span><strong>{x.name}</strong><small>{x.details}</small></span></label>)}
    </div>
    <label><input type="checkbox" checked={pref.monthlyRecommendationsOptIn}
       disabled={!pref.personalizeInApp||!pref.monthlyClubs.length}
       onChange={e=>change("monthlyRecommendationsOptIn",e.target.checked)}/>
       I'd like a monthly personalized recommendations digest when that service launches</label>
    <div className="epd-action-row">
      <button type="button" className="platform-primary-button" onClick={()=>{setShowMonthly(true);message("Monthly picks preview generated. No messages or orders were sent.");}}>Preview monthly picks</button>
      <button type="button" className="platform-secondary-button" onClick={()=>{setTab("discover");message("");}}>Browse example products →</button>
    </div>
    {showMonthly&&<div className="epd-preview">
      <strong>{monthly.enabled?"Your monthly picks (preview only)":"Monthly recommendations not enabled"}</strong>
      <p>{monthly.note}</p>
      {monthly.items.length>0&&<div>{monthly.items.map(p=><span className="epd-small-pill" key={p.id}>{p.name}</span>)}</div>}
    </div>}
   </div>
  </div>}
  {tab==="discover"&&<div role="tabpanel" id="epd-panel-discover" aria-labelledby="epd-tab-discover" className="epd-panel">
   <div className="epd-subhead"><div><h3>Your Discoveries</h3>
    <p>{result.personalized?"These fictional offers are ranked using your selected interests.":"Generic fictional products. Enable personalization under My Likes to use your interests."}</p>
   </div><span className="epd-counter">{result.items.length} matches</span></div>
   <div className="epd-filter-row">
    <label>Search products<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Golf, catering, gifts, signs…"/></label>
    <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>
      <option value="all">All categories</option>
      {[...new Set(EP_DEMO_OFFERS.map(x=>x.category))].map(x=><option key={x} value={x}>{x}</option>)}
     </select></label>
    <label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}>
      <option value="match">Relevance</option><option value="price">Lowest example price</option><option value="name">Name A–Z</option>
     </select></label>
    <label>Maximum example price
     <select value={String(pref.budgetCents)} onChange={e=>change("budgetCents",Number(e.target.value))}>
      {[2500,5000,7500,15000,30000,100000].map(n=><option key={n} value={n}>{cents(n)}</option>)}
     </select></label>
   </div>
   <div className="epd-offer-grid">
    {result.items.map(p=><article key={p.id} className="epd-offer">
     <div className="epd-offer-icon" aria-hidden="true">{({"golf":"⛳","apparel":"👕","food":"🍽️","gifts":"🎁","printing":"🪧"})[p.category]||"🛍️"}</div>
     <div className="epd-offer-body">
      <small className="epd-demo-supplier">{p.vendorName}</small>
      <h4>{p.name}</h4><p>{p.description}</p>
      <div className="epd-offer-info"><strong>{cents(p.priceCents)}</strong><span>Illustrative / {p.unit}</span></div>
      <small className="epd-why">{p.why||"Demo product"}</small>
     </div>
     <div className="epd-offer-actions">
      <button type="button" onClick={()=>addSaved(p.id)}>{saved.includes(p.id)?"✓ Saved":"♡ Save"}</button>
      <button type="button" onClick={()=>chooseProduct(p.id)}>Add to Registry</button>
      {p.personalizable&&<button type="button" onClick={()=>{setCustomProduct(p.id);setCustomNotes("");message("");}}>Create My Own</button>}
     </div>
    </article>)}
   </div>
   {!result.items.length&&<p className="epd-empty">No demo products match. Try a larger budget or different search.</p>}
   <p className="epd-bottom-note">All visible prices and availability are fictional. Buying is disabled until real vendor onboarding, quotes, checkout controls and fulfillment verification exist.</p>
   {saved.length>0&&<section className="epd-list-section"><h3>Saved demo wish list ({saved.length})</h3>
     <div className="epd-tag-row">{saved.map(id=>{const p=EP_DEMO_OFFERS.find(p=>p.id===id);
       return p?<span className="epd-small-pill" key={id}>{p.name}
        <button type="button" aria-label={"Remove "+p.name+" from wish list"} onClick={()=>setSaved(old=>removeWishlistItem(old,id))}>×</button>
       </span>:null;})}</div>
    </section>}
   {customProduct&&<section className="epd-custom">
     <h3>Customize: {EP_DEMO_OFFERS.find(x=>x.id===customProduct)?.name}</h3>
     <p>Draft your idea. No designer, vendor, or agent is contacted.</p>
     <label>What would you change?<textarea rows={3} value={customNotes} maxLength={500}
       onChange={e=>setCustomNotes(e.target.value)} placeholder="Colors, text, logo, packaging, special message…"/></label>
     <div className="epd-action-row"><button type="button" className="platform-primary-button" onClick={saveCustom}>Save custom request draft</button>
     <button type="button" className="platform-secondary-button" onClick={()=>setCustomProduct(null)}>Cancel</button></div>
    </section>}
   {customDrafts.length>0&&<section className="epd-list-section"><h3>Custom drafts ({customDrafts.length})</h3>
     {customDrafts.map((x,i)=><p key={i}><strong>{x.productName}:</strong> {x.description} · {x.status}</p>)}
    </section>}
  </div>}
  {tab==="registry"&&<div role="tabpanel" id="epd-panel-registry" aria-labelledby="epd-tab-registry" className="epd-panel">
    <div className="epd-subhead"><div><h3>AI Registry Concierge, Phase 1</h3>
      <p>Our first prototype uses a deterministic recommendation engine. Future AI can add creative suggestions after approved vendor data is connected.</p></div>
      <span className="epd-counter">{registrySelection.length} chosen</span>
    </div>
    <div className="epd-filter-row">
      <label>Occasion<select value={occasion} onChange={e=>{setOccasion(e.target.value);setRegistry(null);}}>
        {["birthday","wedding","charity","golf","other"].map(x=><option value={x} key={x}>{x}</option>)}
       </select></label>
      <label>Registry name<input value={registryTitle} onChange={e=>{setRegistryTitle(e.target.value);setRegistry(null);}} maxLength={100}/></label>
      <label>Maximum gift price<select value={registryBudget} onChange={e=>{setRegistryBudget(Number(e.target.value));setRegistry(null);}}>
        {[25,50,75,150,300,1000].map(n=><option key={n} value={n}>{cents(n*100)}</option>)}
       </select></label>
    </div>
    <div className="epd-action-row">
     <button type="button" className="platform-primary-button" onClick={generateRegistry}>Generate registry draft</button>
     <button type="button" className="platform-secondary-button" onClick={()=>setTab("discover")}>Choose products →</button>
    </div>
    {registrySelection.length>0&&<p className="epd-tag-row">Preselected: {registrySelection.map(id=>
      <span key={id} className="epd-small-pill">{EP_DEMO_OFFERS.find(x=>x.id===id)?.name}
       <button type="button" aria-label={"Remove "+id+" from registry selection"}
         onClick={()=>{setRegistrySelection(old=>old.filter(x=>x!==id));setRegistry(null);}}>×</button>
      </span>)}</p>}
    {registry&&<div className="epd-preview">
      <div className="epd-preview-head"><h4>{registry.title}</h4><span>{registry.status.replaceAll("_"," ")}</span></div>
      {registry.items.length?<div className="epd-list">
       {registry.items.map(item=><div key={item.productId} className="epd-list-row">
         <div><strong>{item.name}</strong><small>{item.vendorName} · pricing unverified</small></div>
         <strong>{cents(item.priceCents)}</strong></div>)}
      </div>:<p>No products under this example price limit. Raise the budget and try again.</p>}
      <p><strong>Privacy:</strong> Visible to creator only. No likes shared with guests or vendors. No invitations, payments or messages sent.</p>
      {registry.status==="draft_pending_organizer_review"&&<button type="button" className="platform-primary-button" onClick={approveRegistry}>Approve draft in demo</button>}
      <Download value={registry} name="ep-demo-registry-draft.json" label="Download registry concept"/>
    </div>}
  </div>}
  {tab==="events"&&<div role="tabpanel" id="epd-panel-events" aria-labelledby="epd-tab-events" className="epd-panel">
   <div className="epd-subhead"><div><h3>Build an event from vendor offers</h3>
    <p>Test how the same catalog powers golf outings, birthdays and future event types. These are fictional estimates, never vendor bookings.</p></div></div>
   <div className="epd-filter-row">
    <label>Event type<select value={eventType} onChange={e=>{setEventType(e.target.value);setProposal(null);}}>
     <option value="golf">Golf outing</option><option value="birthday">Birthday party</option>
    </select></label>
    <label>Attendees<input type="number" value={attendees} min={2} max={1000}
     onChange={e=>{setAttendees(e.target.value);setProposal(null);}}/></label>
    <label>Example total budget ($)<input type="number" min={0} max={1000000} step={50}
     value={eventBudget} onChange={e=>{setEventBudget(e.target.value);setProposal(null);}}/></label>
   </div>
   <div className="epd-action-row">
    <button type="button" className="platform-primary-button" onClick={generateEvent}>Build vendor proposal</button>
   </div>
   {proposal&&<div className="epd-preview">
    <div className="epd-preview-head"><h4>{proposal.eventType==="golf"?"Golf Outing":"Birthday Party"} · {proposal.attendees} guests</h4>
      <span>{proposal.withinExampleBudget?"Within example budget":"Over example budget"}</span></div>
    <div className="epd-list">
      {proposal.lines.map(l=><div key={l.purpose} className="epd-list-row">
        <div><strong>{l.purpose}: {l.name}</strong><small>{l.vendorName} · {l.quantity} × {cents(l.unitCents)}</small></div>
        <strong>{cents(l.totalCents)}</strong>
       </div>)}
    </div>
    <div className="epd-total"><span>Illustrative subtotal</span><strong>{cents(proposal.estimatedTotalCents)}</strong></div>
    <p><strong>Missing categories:</strong> {proposal.missing.length?proposal.missing.join(", "):"None in this fictional catalog"}.
      This does not include real delivery fees, supplier quotes, taxes or service charges.</p>
    <Download value={proposal} name="ep-demo-event-vendor-proposal.json" label="Download event proposal concept"/>
    <p className="epd-bottom-note">Approval/order buttons will remain disabled until real vendor verification, organizer account ownership and contract/payment controls are ready.</p>
   </div>}
  </div>}
  {tab==="stores"&&<div role="tabpanel" id="epd-panel-stores" aria-labelledby="epd-tab-stores" className="epd-panel"><VendorStoreConnectionsPilot/></div>}
  {tab==="store-engine"&&<div role="tabpanel" id="epd-panel-store-engine" aria-labelledby="epd-tab-store-engine" className="epd-panel"><EpUnifiedStorePilot/></div>}
 {tab==="capture"&&<div role="tabpanel" id="epd-panel-capture" aria-labelledby="epd-tab-capture" className="epd-panel"><EpProductCapturePilot/></div>}
  <footer className="epd-footer">Fictional sample catalog ({EP_DEMO_OFFERS.length} offers). Demo state exists only in this browser tab and clears on refresh.
    Production publishing, vendor messaging, registry sharing, paid subscriptions and automatic ordering remain disabled. Safety: {EP_PILOT_SAFETY.realPaymentsMade?"UNSAFE":"No payments"}.</footer>
 </section>;
}

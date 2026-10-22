import React,{useMemo,useState} from "react";
import {
 EP_STORE_TYPES,EP_STORE_MODES,EP_DEMO_ORGANIZATIONS,
 EP_DEMO_FUNDRAISER_EVENTS,EP_UNIFIED_STORE_SAFETY,
 allowedStoreItems,makeUnifiedStoreDraft,addUnifiedStoreItem,
 removeUnifiedStoreItem,previewStoreDraft,approveUnifiedStoreDraft
} from "../lib/epUnifiedStore.mjs";
import "./ep-unified-store-pilot.css";

function money(cents){return (cents/100).toLocaleString("en-US",{style:"currency",currency:"USD"});}
function downloadDraft(draft){
 const payload={
  kind:"ep_universal_store_demo_export",version:1,
  demo:previewStoreDraft(draft),
  draft,
  disclaimer:"All identities, source products, fulfillment and funds are fictional. No store was published and no transaction occurred."
 };
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="ep-"+draft.type+"-store-concept.json";
 document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),800);
}
const typeName=x=>EP_STORE_TYPES.find(k=>k.id===x)?.name||x;
const demoOwners=type=>EP_DEMO_ORGANIZATIONS.filter(x=>type!=="nonprofit"||x.kind==="nonprofit");
export default function EpUnifiedStorePilot(){
 const [type,setType]=useState("hangar");
 const [owner,setOwner]=useState("demo-fairway-hangar");
 const [beneficiary,setBeneficiary]=useState("demo-community-cause");
 const [eventId,setEventId]=useState("demo-charity-golf");
 const [mode,setMode]=useState("self_service");
 const [title,setTitle]=useState("My New EP Store");
 const [goal,setGoal]=useState("5000");
 const [draft,setDraft]=useState(null);
 const [query,setQuery]=useState("");
 const [sort,setSort]=useState("name");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const owners=demoOwners(type);
 const events=EP_DEMO_FUNDRAISER_EVENTS.filter(e=>e.ownerOrganizationId===owner);
 const catalog=useMemo(()=>{
  const q=query.trim().toLowerCase();
  const items=allowedStoreItems(type).filter(x=>!q||[x.name,x.kind,x.description]
   .some(y=>String(y).toLowerCase().includes(q)));
  if(sort==="price")items.sort((a,b)=>a.priceCents-b.priceCents||a.name.localeCompare(b.name));
  else if(sort==="kind")items.sort((a,b)=>a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name));
  else items.sort((a,b)=>a.name.localeCompare(b.name));
  return items;
 },[type,query,sort]);
 const view=draft?previewStoreDraft(draft):null;
 function changeType(value){
  const firstOwner=demoOwners(value)[0]?.id||"demo-fairway-hangar";
  setType(value);setOwner(firstOwner);
  const matching=EP_DEMO_FUNDRAISER_EVENTS.find(e=>e.ownerOrganizationId===firstOwner);
  setEventId(matching?.id||"");
  setBeneficiary("demo-community-cause");setDraft(null);
  setError("");setNotice("");setQuery("");
 }
 function changeOwner(value){
  setOwner(value);setEventId(EP_DEMO_FUNDRAISER_EVENTS.find(x=>x.ownerOrganizationId===value)?.id||"");
  setDraft(null);setNotice("");
 }
 function create(e){
  e.preventDefault();setError("");setNotice("");
  try{
   if(!/^\d+(?:\.\d{1,2})?$/.test(goal)&&type!=="hangar")throw Error("Enter a valid fundraising goal in dollars.");
   const amount=type==="hangar"?0:Math.round(Number(goal)*100);
   const next=makeUnifiedStoreDraft({
    type,ownerOrganizationId:owner,
    beneficiaryOrganizationId:type==="fundraiser"?beneficiary:type==="nonprofit"?owner:null,
    eventId:type==="fundraiser"?eventId:null,title,operatingMode:mode,goalCents:amount,
   });
   setDraft(next);setNotice(typeName(type)+" draft created. Add fictional products below and review the seller versus beneficiary.");
  }catch(err){setError(err?.message||"Unable to create store draft.");}
 }
 function add(id){
  try{setDraft(old=>addUnifiedStoreItem(old,id));setError("");setNotice("Added to this private demo store only. No product was published.");}
  catch(e){setError(e?.message||"Could not add product.");}
 }
 function remove(id){
  try{setDraft(old=>removeUnifiedStoreItem(old,id));setError("");setNotice("Removed from this demo store draft.");}
  catch(e){setError(e?.message||"Could not remove product.");}
 }
 function approve(){
  try{setDraft(old=>approveUnifiedStoreDraft(old));setError("");setNotice("Approved this demo draft only. No checkout, fundraising, tax receipt, or public store is activated.");}
  catch(e){setError(e?.message||"Could not approve demo store.");}
 }
 function newDraft(){setDraft(null);setNotice("Edit the setup fields, then create a new private demo draft.");setError("");}
 return <section className="epu-root" aria-labelledby="epu-title">
   <header className="epd-subhead">
    <div><h3 id="epu-title">Universal Stores · Hangars, Nonprofits & Fundraisers</h3>
     <p>One store structure with different commerce modules, permission requirements, fundraising beneficiaries and event contexts.</p>
    </div>
    <span className="epd-counter">FICTIONAL STOREFRONTS</span>
   </header>
   <div className="epu-types" role="group" aria-label="Choose a storefront structure">
    {EP_STORE_TYPES.map(x=><button key={x.id} type="button" aria-pressed={type===x.id}
      className={"epu-type"+(type===x.id?" epu-selected":"")} onClick={()=>changeType(x.id)}>
      <strong>{x.name}</strong><small>{x.description}</small>
     </button>)}
   </div>
   <form className="epu-form" onSubmit={create}>
    <div className="epu-inputs">
     <label>Store name
      <input value={title} maxLength={100} required onChange={e=>{setTitle(e.target.value);setDraft(null);}}/>
     </label>
     <label>Organization / Hangar owner
      <select value={owner} onChange={e=>changeOwner(e.target.value)}>
       {owners.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
     </label>
     <label>Operating model
      <select value={mode} onChange={e=>{setMode(e.target.value);setDraft(null);}}>
       {EP_STORE_MODES.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
     </label>
     {type==="fundraiser"&&<>
      <label>Fundraising event
       <select value={eventId} onChange={e=>{setEventId(e.target.value);setDraft(null);}}>
        {events.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
       </select>
      </label>
      <label>Nonprofit beneficiary
       <select value={beneficiary} onChange={e=>{setBeneficiary(e.target.value);setDraft(null);}}>
        {EP_DEMO_ORGANIZATIONS.filter(x=>x.kind==="nonprofit").map(x=>
         <option key={x.id} value={x.id}>{x.name}</option>)}
       </select>
      </label>
     </>}
     {type!=="hangar"&&<label>Example fundraising goal ($)
      <input type="number" min={0} max={1000000} step={25} value={goal}
       onChange={e=>{setGoal(e.target.value);setDraft(null);}}/>
     </label>}
    </div>
    <div className="epd-action-row">
     <button type="submit" className="platform-primary-button">Create store demo draft</button>
     {draft&&<button type="button" className="platform-secondary-button"
       onClick={newDraft}>Start a revised draft</button>}
    </div>
   </form>
   <p className="epu-disclosure">Store ownership is not proof of nonprofit status or authority to collect contributions.
    Choosing EIG Managed or Hybrid does not grant EIG permissions. Funds, settlements,
    gift-card liability, tax receipts and third-party checkout remain disabled.</p>
   {error&&<p className="platform-error" role="alert">{error}</p>}
   {notice&&<p className="epd-notice" role="status">{notice}</p>}
   {draft&&<>
    <div className="epu-preview" aria-label="Private demo storefront preview">
     <div className="epu-preview-heading">
      <div><p className="platform-eyebrow">STORE CONCEPT / NOT PUBLISHED</p><h4>{draft.title}</h4>
       <span>{typeName(draft.type)} · {EP_STORE_MODES.find(x=>x.id===draft.operatingMode)?.name}</span>
      </div>
      <span className="epu-state">{draft.status.replaceAll("_"," ")}</span>
     </div>
     <div className="epu-identity-grid">
      <div><small>Owning organization / proposed merchandise seller</small><strong>{draft.ownerOrganizationName}</strong></div>
      <div><small>Intended charitable beneficiary</small><strong>{draft.beneficiaryOrganizationName||"None · ordinary Hangar commerce"}</strong></div>
      <div><small>Associated event</small><strong>{draft.eventName||"Organization-wide store"}</strong></div>
      <div><small>Verified payout recipient</small><strong>Not established</strong></div>
     </div>
     {draft.type!=="hangar"&&<div className="epu-progress">
      <div><span>Fundraising goal (illustrative)</span><strong>{money(draft.goalCents)}</strong></div>
      <div><span>Verified funds received</span><strong>$0.00</strong></div>
      <div className="epu-track" aria-label="Zero verified fundraising progress"><span/></div>
     </div>}
     <div className="epu-preview-heading"><h4>Store inventory concepts</h4><span>{draft.items.length} demo items</span></div>
     {draft.items.length?<div className="epu-draft-list">{draft.items.map(x=>
      <div className="epu-draft-item" key={x.itemId}>
       <div><strong>{x.name}</strong><small>{x.kind.replaceAll("_"," ")} · Fictional sample amount</small></div>
       <strong>{money(x.examplePriceCents)}</strong>
       {draft.status==="draft_pending_owner_review"&&<button type="button" onClick={()=>remove(x.itemId)}
         aria-label={"Remove "+x.name+" from store draft"}>Remove</button>}
      </div>)}</div>:
      <p className="ep-store-empty">Choose sample merchandise, services, sponsorships, or fundraising options below.</p>}
     <div className="epd-action-row">
      {draft.status==="draft_pending_owner_review"&&
       <button type="button" className="platform-primary-button" onClick={approve}>Approve draft in demo</button>}
      <button type="button" className="platform-secondary-button"
       onClick={()=>downloadDraft(draft)}>Download store concept JSON</button>
     </div>
     <p className="epd-bottom-note">No public URL or real checkout exists. Approval only locks the fictional preview.
      Merchandise payments and charitable contributions require separate verified payout and legal treatment.</p>
    </div>
    {draft.status==="draft_pending_owner_review"&&<div className="epu-catalog">
      <div className="epu-catalog-head">
       <div><h4>Add example store items</h4><p>Existing fictional marketplace products are reused by catalog ID; contribution and ticket concepts are separate flows.</p></div>
       <div className="epu-filters">
        <label>Find store items<input type="search" value={query} onChange={e=>setQuery(e.target.value)}
         placeholder="Merchandise, tickets, sponsorship…"/></label>
        <label>Sort store items<select value={sort} onChange={e=>setSort(e.target.value)}>
         <option value="name">Name A–Z</option><option value="kind">Item type</option><option value="price">Lowest fictional amount</option>
        </select></label>
       </div>
      </div>
      <div className="epu-catalog-list">
       {catalog.map(x=><div className="epu-catalog-row" key={x.id}>
        <div><strong>{x.name}</strong><small>{x.kind.replaceAll("_"," ")} · {x.description}</small></div>
        <span>{money(x.priceCents)}<small>example only</small></span>
        <button type="button" disabled={draft.items.some(i=>i.itemId===x.id)}
         onClick={()=>add(x.id)}>{draft.items.some(i=>i.itemId===x.id)?"Added":"Add to store"}</button>
       </div>)}
      </div>
      {!catalog.length&&<p className="ep-store-empty">No example items match your search.</p>}
     </div>}
     {view&&<p className="epu-foot">Private proof: {view.proposedItems} catalog ideas · 0 verified transactions ·
       {EP_UNIFIED_STORE_SAFETY.storefrontPublished?"LIVE":" No publication"} ·
       seller and beneficiary deliberately separated.</p>}
    </>}
   </section>;
}

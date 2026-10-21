import React,{useEffect,useMemo,useRef,useState} from "react";
import {
 EP_CAPTURE_TYPES,EP_CAPTURE_SAMPLE_PRODUCTS,EP_CAPTURE_SAMPLE_LEDGER,
 EP_CAPTURE_SAFETY,safePhotoFile,makeProductCaptureDraft,
 checkExistingProducts,linkCaptureToExistingDemoProduct,
 previewDoubleSync,approveDemoStockMovement
} from "../lib/epProductCapture.mjs";
import "./ep-product-capture-pilot.css";
const searchUrl=term=>"https://www.google.com/search?tbm=shop&q="+encodeURIComponent(term.trim());
const statusMessage=status=>({
 exact_sku_candidate_requires_review:"Matching SKU found in this Hangar. Link the existing product instead of creating a duplicate.",
 name_candidate_requires_review:"Similar name found. Confirm manually before linking.",
 ambiguous_sku_requires_review:"Multiple exact SKU records need manual duplicate review.",
 no_match_found:"No match in this fictional sample catalog. New catalog creation remains a future, approval-based workflow."
}[status]||"Manual verification required.");
function exportDemo(value,file){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download=file;document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function EpProductCapturePilot(){
 const [mode,setMode]=useState("invoice_line");
 const [title,setTitle]=useState("Embroidered Golf Cap");
 const [sku,setSku]=useState("CAP-001");
 const [url,setUrl]=useState("");
 const [search,setSearch]=useState("embroidered golf cap");
 const [note,setNote]=useState("");
 const [photos,setPhotos]=useState([]);
 const [draft,setDraft]=useState(null);
 const [matched,setMatched]=useState(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [ledger,setLedger]=useState(()=>EP_CAPTURE_SAMPLE_LEDGER.map(x=>({...x})));
 const [productId,setProductId]=useState("demo-product-golf-cap");
 const [saleSearch,setSaleSearch]=useState("");
 const [saleSort,setSaleSort]=useState("channel");
 const photoUrls=useRef(new Set());
 useEffect(()=>()=>{for(const url of photoUrls.current)URL.revokeObjectURL(url);photoUrls.current.clear();},[]);
 function resetReview(){setDraft(null);setMatched(null);setError("");setNotice("");}
 function switchMode(m){setMode(m);resetReview();}
 function choosePhotos(files){
  try{
   if(!files?.length)return;
   if(photos.length+files.length>5)throw Error("Maximum five product photos per capture.");
   const chosen=Array.from(files).map(file=>({file,info:safePhotoFile({
     name:file.name,type:file.type,size:file.size
   })}));
   const cards=chosen.map(({file,info})=>{
    const localUrl=URL.createObjectURL(file);photoUrls.current.add(localUrl);
    return {key:crypto.randomUUID(),localUrl,...info};
   });
   setPhotos(old=>[...old,...cards]);resetReview();
   setNotice("Photos selected locally. No files were uploaded, scanned by AI or shared.");
  }catch(e){setError(e.message||"Please select valid product photos.");}
 }
 function removePhoto(key){
  setPhotos(old=>old.filter(x=>{if(x.key===key){URL.revokeObjectURL(x.localUrl);photoUrls.current.delete(x.localUrl);return false;}return true;}));
  resetReview();
 }
 function lookup(){
  const term=search.trim();
  if(term.length<2){setError("Enter an online product search phrase.");return;}
  setError("");window.open(searchUrl(term),"_blank","noopener,noreferrer");
 }
 function make(e){
  e.preventDefault();setError("");setNotice("");
  try{
   const next=makeProductCaptureDraft({
    organizationId:"demo-fairway-hangar",captureType:mode,title,sku,
    externalUrl:mode==="online_link"?url:"",note,
    photoInfos:photos.map(p=>p)
   });
   setDraft(next);setMatched(checkExistingProducts(next));
   setNotice("Unverified product capture created in this browser only. Confirm any SKU match before linking.");
  }catch(e){setDraft(null);setMatched(null);setError(e.message||"Could not create this draft.");}
 }
 function link(product){
  try{
   const next=linkCaptureToExistingDemoProduct(draft,product.id);
   setDraft(next);setError("");
   setNotice("Linked to existing demo catalog identity. Original invoices and real inventory are unchanged.");
  }catch(e){setError(e.message||"Could not link product.");}
 }
 function move(saleId){
  try{
   const next=approveDemoStockMovement({productId,saleId,ledger});
   setLedger(next.ledger);setError("");
   setNotice(next.postedNewMovement?
    "Approved in DEMO only: one missing stock deduction added to the simulated ledger. No real stock changed.":
    "Already accounted. No second inventory deduction.");
  }catch(e){setError(e.message||"Demo reconciliation could not complete.");}
 }
 const eligible=useMemo(()=>previewDoubleSync(productId,ledger),[productId,ledger]);
 const sampleOnHand=eligible.product.onHand+ledger.filter(x=>x.productId===productId&&x.source==="owner_approved_demo")
   .reduce((sum,item)=>sum+item.delta,0);
 const proposals=useMemo(()=>{
  const phrase=saleSearch.trim().toLowerCase();
  const list=eligible.proposals.filter(x=>!phrase||[x.channel,x.saleId,x.decision,x.sourceLineId].some(y=>String(y).toLowerCase().includes(phrase)));
  return list.sort((a,b)=>saleSort==="quantity"?b.quantity-a.quantity||a.saleId.localeCompare(b.saleId):
    saleSort==="status"?a.decision.localeCompare(b.decision):a.channel.localeCompare(b.channel));
 },[eligible,saleSearch,saleSort]);
 return <section className="epc-root" aria-labelledby="epc-heading">
  <header className="epd-subhead">
   <div>
    <h3 id="epc-heading">Smart Product Capture · Online, Phone & Double Sync</h3>
    <p>Create reviewable product drafts from typed invoice items, external product links or phone photos. Keep one catalog identity and reconcile old sales only once.</p>
   </div>
   <span className="epd-counter">PRIVATE DEMO · NO INVENTORY WRITES</span>
  </header>
  <p className="epc-safe"><strong>Safety:</strong> The search button opens a separate public shopping search. This prototype never imports a merchant's product or photo. Phone images stay on this device, and no AI image recognition, stock correction, database save or real invoice edit occurs.</p>
  <div className="epc-modes" role="group" aria-label="How to add a product">
   {EP_CAPTURE_TYPES.map(t=><button key={t.id} type="button" onClick={()=>switchMode(t.id)}
    aria-pressed={mode===t.id} className={mode===t.id?"epc-active":""}>{t.label}</button>)}
  </div>
  <form className="epc-form" onSubmit={make}>
   {mode==="online_link"&&<div className="epc-online">
    <label>Find products online
     <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Product, model, manufacturer or SKU"/>
    </label>
    <button type="button" onClick={lookup} className="platform-secondary-button">Search web in new tab ↗</button>
    <p>Review the seller's listing yourself, then paste its public product link below. Availability, price, photos and reuse rights are not automatically verified.</p>
   </div>}
   <div className="epc-fields">
    <label>Product or service name
     <input value={title} onChange={e=>{setTitle(e.target.value);resetReview();}} maxLength={160} required/>
    </label>
    <label>SKU / manufacturer item number (optional)
     <input value={sku} onChange={e=>{setSku(e.target.value);resetReview();}} maxLength={48}
      placeholder="e.g. CAP-001"/>
    </label>
    {mode==="online_link"&&<label className="epc-span">Verified by you: public HTTPS product listing link
     <input type="url" placeholder="https://example-store.com/products/item" value={url}
      onChange={e=>{setUrl(e.target.value);resetReview();}} required/>
    </label>}
   </div>
   <div className="epc-photo-block">
    <h4>Phone or product photos (up to 5)</h4>
    <p>Take pictures of packaging, shelf tags, labels, barcodes or the item itself. Adding a photo does not automatically identify a product or give rights to copy online photography.</p>
    <div className="epc-photo-actions">
     <label className="epc-upload">
      <span>Take a photo on phone</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
       aria-label="Take a product photo" onChange={e=>{choosePhotos(e.target.files);e.target.value="";}}/>
     </label>
     <label className="epc-upload">
      <span>Choose photos from device</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple
       aria-label="Choose product photos" onChange={e=>{choosePhotos(e.target.files);e.target.value="";}}/>
     </label>
    </div>
    {photos.length>0&&<div className="epc-photo-grid">
     {photos.map(p=><div key={p.key} className="epc-photo">
      <img src={p.localUrl} alt={"Local product draft photo: "+p.fileName}/>
      <small>{p.fileName}</small>
      <button type="button" onClick={()=>removePhoto(p.key)} aria-label={"Remove photo "+p.fileName}>Remove</button>
     </div>)}
    </div>}
    <small className="epc-caveat">Photos are not uploaded. Preview URLs and photos disappear when you leave or refresh this browser tab.</small>
   </div>
   <label className="epc-notes">Notes for later catalog review
    <textarea value={note} maxLength={500} rows={2} onChange={e=>{setNote(e.target.value);resetReview();}}
     placeholder="Supplier, variant, package size, sale source…"/>
   </label>
   <div className="epd-action-row">
    <button type="submit" className="platform-primary-button">Review product for duplicates</button>
   </div>
  </form>
  {error&&<p role="alert" className="platform-error">{error}</p>}
  {notice&&<p role="status" className="epd-notice">{notice}</p>}
  {draft&&matched&&<div className="epc-capture-result">
   <h4>Uncataloged Product Review · Demo only</h4>
   <p><strong>{draft.title}</strong> · SKU {draft.sku||"not provided"} ·
    {draft.photoInfos.length} local photo{draft.photoInfos.length===1?"":"s"} ·
    {draft.externalUrl?"external source URL attached":"no source URL"}.</p>
   <p><strong>Duplicate check:</strong> {statusMessage(matched.matchStatus)}</p>
   {(matched.exactSkuMatches.length>0||matched.nameCandidates.length>0)&&<div className="epc-match-list">
    {[...matched.exactSkuMatches,...matched.nameCandidates].map(p=><div key={p.id}>
     <div><strong>{p.name}</strong><small>SKU {p.sku} · {p.trackInventory?"Inventory-tracked":"Not an inventory item"} · Demo catalog</small></div>
     <button type="button" disabled={draft.linkedProductId!==null} onClick={()=>link(p)}>Link this existing item (demo)</button>
    </div>)}
   </div>}
   {draft.linkedProductId&&<p>Existing product linked in the private preview. A second catalog product was NOT created.</p>}
   <div className="epd-action-row">
    <button type="button" className="platform-secondary-button" onClick={()=>exportDemo({
     kind:"ep_product_capture_review_export",draft,match:{
      matchStatus:matched.matchStatus,exactSkuIds:matched.exactSkuMatches.map(x=>x.id),
      nameCandidateIds:matched.nameCandidates.map(x=>x.id)
     },photosIncluded:false,allSourceRecordsUnverified:true,realInventoryChanged:false,
    },"ep-product-capture-demo.json")}>Export product draft JSON</button>
   </div>
  </div>}
  <section className="epc-double-sync" aria-labelledby="epc-sync-heading">
   <div className="epc-heading"><div><h4 id="epc-sync-heading">Double Sync · Historical Sales + Inventory</h4>
    <p>What happens when a product is already in the catalog but an invoice or another sales channel used a custom line item? We match it, check if it was counted, then propose a one-time adjustment.</p></div></div>
   <div className="epc-controls">
    <label>Review sample catalog item
     <select value={productId} onChange={e=>{setProductId(e.target.value);setError("");setNotice("");}}>
      {EP_CAPTURE_SAMPLE_PRODUCTS.filter(p=>p.organizationId==="demo-fairway-hangar").map(p=>
       <option value={p.id} key={p.id}>{p.name} · {p.sku}</option>)}
     </select>
    </label>
    <label>Search sales
     <input type="search" value={saleSearch} onChange={e=>setSaleSearch(e.target.value)}
      placeholder="Shopify, invoice, fulfilled…"/>
    </label>
    <label>Sort sample sales
     <select value={saleSort} onChange={e=>setSaleSort(e.target.value)}>
      <option value="channel">Source channel</option><option value="status">Reconciliation status</option>
      <option value="quantity">Quantity (high to low)</option>
     </select>
    </label>
   </div>
   <div className="epc-stats">
    <div><small>Current illustrative on-hand</small><strong>{sampleOnHand===null?"Not stock-tracked":sampleOnHand}</strong></div>
    <div><small>Pending safe stock movements</small><strong>{eligible.pendingCount}</strong></div>
    <div><small>Actual stock changes</small><strong>0</strong></div>
   </div>
   <div className="epc-sale-list">
    {proposals.map(p=><div className="epc-sale" key={p.saleId}>
     <div><strong>{p.saleId.replace("demo-sale-","").replaceAll("-"," ")}</strong>
      <small>{p.channel.replaceAll("_"," ")} · {p.saleState} · Qty {p.quantity}</small>
      <span>{p.decision.replaceAll("_"," ")}</span>
     </div>
     <div>
      {p.proposedDelta<0&&<strong>Example −{p.quantity} units</strong>}
      {p.needsOwnerApproval?<button type="button"
        onClick={()=>move(p.saleId)}>Approve sample deduction</button>:
       <small>No new stock deduction</small>}
     </div>
    </div>)}
    {proposals.length===0&&<p>No matching sample sales.</p>}
   </div>
   <p className="epc-safe">A completed sale receives at most one stock movement. Unissued invoices do not deduct inventory. Shopify/POS deductions already recorded stay unchanged; external-authoritative inventory requires provider reconciliation. Never delete the original invoice line or silently reverse old financial records.</p>
   <div className="epd-action-row">
    <button type="button" className="platform-secondary-button" onClick={()=>exportDemo({
     kind:"ep_double_sync_review_export",schemaVersion:1,scope:"fictional_demo",productId,
     stockActualChange:0,preview:previewDoubleSync(productId,ledger),ledger,customerRecordsExported:false,
    },"ep-double-sync-demo.json")}>Export reconciliation preview</button>
   </div>
  </section>
  <p className="epc-caveat">Safety checks: {Object.values(EP_CAPTURE_SAFETY).every(x=>x===false)?"All automatic writes, AI recognition and real stock updates disabled.":"Review feature safety."}</p>
 </section>;
}

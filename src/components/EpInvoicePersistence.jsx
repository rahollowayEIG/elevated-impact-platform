import React,{useMemo,useState} from 'react';
import {supabase} from '../lib/supabase';
import {invoiceSandboxStore} from '../lib/epInvoicePersistence.mjs';
import {ITEM_KINDS} from '../lib/epCommerceContractReadiness.mjs';
import {centsDisplay,parseInvoiceCents} from '../lib/epInvoiceDraft.mjs';

// Only mounted by the explicit Sandbox URL + feature flag gate. Database access
// remains disabled until a separately reviewed installation and owner binding.
export default function EpInvoicePersistence({draft,store:providedStore}) {
 const [org,setOrg]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [data,setData]=useState({invoices:[],products:[],reviews:[]});
 const [opened,setOpened]=useState(null);
 const [line,setLine]=useState(null);
 const [review,setReview]=useState(null);
 const [details,setDetails]=useState(null);
 const [matches,setMatches]=useState([]);
 const [query,setQuery]=useState('');
 const [ascending,setAscending]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const store=useMemo(()=>providedStore||invoiceSandboxStore(supabase,org),[providedStore,org]);
 const invoices=data.invoices.filter(i=>[i.snapshot.recipient,i.snapshot.reference,i.id].join(' ').toLowerCase().includes(query.toLowerCase()))
  .sort((a,b)=>(a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id))*(ascending?1:-1));
 async function run(action){
  if(busy)return;setBusy(true);setMessage('');
  try{await action();}catch(err){setMessage(err.message||'Sandbox request failed.');}finally{setBusy(false);}
 }
 function selectLine(l){
  const r=data.reviews.find(x=>x.line_id===l.id)||null;
  setLine(l);setReview(r);setMatches([]);
  setDetails(r?{...r.details,price:(r.details.unit_cents/100).toFixed(2)}:{name:l.description,sku:'',description:'',kind:'noninventory_service',track_inventory:false,price:(l.unit_cents/100).toFixed(2)});
 }
 function edit(key,value){setDetails(d=>({...d,[key]:value}));setReview(null);setMatches([]);}
 async function load(){setData(await store.list());}
 async function open(id){setOpened(await store.read(id));setLine(null);setReview(null);setDetails(null);setMatches([]);}
 return <section className="epi-actions" aria-label="Sandbox invoice records">
  <h4>Sandbox saved snapshots & product review</h4>
  <p>Fictional, unissued records only. Saving keeps every line, including one-time items. Product approval never deducts inventory.</p>
  <fieldset disabled={busy}>
   {!providedStore&&<label>Approved test organization ID<input value={org} onChange={e=>{setOrg(e.target.value);setData({invoices:[],products:[],reviews:[]});setOpened(null);setLine(null);setDetails(null);setReview(null);setMessage('');}}/></label>}
   <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm these details are fictional and the customer email is empty.</label>
   <button type="button" onClick={()=>run(async()=>{const saved=await store.save(draft,confirmed);await load();await open(saved.id);setMessage('Unissued fictional snapshot saved. One-time lines remain valid without a product.');})} disabled={!draft||!confirmed}>Save fictional snapshot</button>
   <button type="button" onClick={()=>run(load)}>Load saved snapshots</button>
   <label>Search saved invoices<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <button type="button" onClick={()=>setAscending(x=>!x)}>Saved date {ascending?'↑':'↓'}</button>
   <ul>{invoices.map(i=><li key={i.id}><button type="button" onClick={()=>run(()=>open(i.id))}>{i.snapshot.recipient} · {i.snapshot.reference||'No reference'} · {centsDisplay(i.snapshot.totalCents)}</button></li>)}</ul>
   {opened&&<div><h4>Saved snapshot: {opened.invoice.snapshot.recipient}</h4>
    <p>{opened.invoice.status} · {centsDisplay(opened.invoice.snapshot.totalCents)} · invoice details stay fixed.</p>
    <ol>{opened.lines.map(l=><li key={l.id}>{l.description} · {l.quantity} × {centsDisplay(l.unit_cents)} <button type="button" onClick={()=>selectLine(l)}>Optional product review</button></li>)}</ol>
   </div>}
   {line&&details&&<div>
    <h4>Review catalog details for “{line.description}”</h4>
    <p>Keeping this as a one-time invoice item requires no action.</p>
    <label>Product name<input value={details.name} maxLength={160} onChange={e=>edit('name',e.target.value)}/></label>
    <label>SKU (optional)<input value={details.sku} maxLength={48} onChange={e=>edit('sku',e.target.value)}/></label>
    <label>Description<textarea value={details.description} maxLength={1000} onChange={e=>edit('description',e.target.value)}/></label>
    <label>Classification<select aria-label="Classification" value={details.kind} onChange={e=>{edit('kind',e.target.value);edit('track_inventory',false);}}>{ITEM_KINDS.map(k=><option key={k} value={k}>{k.replaceAll('_',' ')}</option>)}</select></label>
    <label><input type="checkbox" checked={details.track_inventory} disabled={details.kind!=='physical_merchandise'} onChange={e=>edit('track_inventory',e.target.checked)}/>Track physical inventory (stock not initialized or changed)</label>
    <label>Proposed unit price ($)<input value={details.price} onChange={e=>edit('price',e.target.value)}/></label>
    <button type="button" onClick={()=>run(async()=>{
     const {price,...fields}=details;
     const current=data.reviews.find(r=>r.line_id===line.id);
     const r=await store.propose(line.id,{...fields,unit_cents:parseInvoiceCents(price)},current?.version||0);
     setReview(r);await load();setMessage('Proposal saved for explicit review. No product created.');
    })}>Save review details</button>
    {review?.status==='pending'&&<div>
     <p>Saved proposal version {review.version}. Review the details before approving.</p>
     <button type="button" onClick={()=>run(async()=>{
      const r=await store.approve(review);
      if(r.duplicate_candidates){setMatches(r.duplicate_candidates);setMessage('Possible duplicate: link an existing product or edit and save the proposal.');}
      else{setReview(r);await load();setMessage('Product approved in the shared Sandbox catalog. Invoice snapshot and stock unchanged.');}
     })}>Approve catalog creation</button>
     <button type="button" onClick={()=>run(async()=>{setReview(await store.dismiss(review));await load();setMessage('Proposal dismissed. Invoice item retained.');})}>Keep as one-time item</button>
     <ul>{matches.map(p=><li key={p.id}>{p.name} · {p.sku||'No SKU'} <button type="button" onClick={()=>run(async()=>{setReview(await store.link(review,p.id));await load();setMatches([]);setMessage('Linked existing product. Invoice and stock unchanged.');})}>Confirm link to existing product</button></li>)}</ul>
    </div>}
    {review&&review.status!=='pending'&&<p>Review status: {review.status}. Original line retained.</p>}
   </div>}
  </fieldset>
  {message&&<p role="status">{message}</p>}
 </section>;
}

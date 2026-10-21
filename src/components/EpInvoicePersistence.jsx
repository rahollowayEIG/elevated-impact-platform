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
 const [sort,setSort]=useState({key:'created_at',ascending:false});
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const store=useMemo(()=>providedStore||invoiceSandboxStore(supabase,org),[providedStore,org]);
 const value=(invoice,key)=>key==='created_at'?invoice.created_at:invoice.snapshot[key];
 const invoices=data.invoices.filter(i=>[i.snapshot.recipient,i.snapshot.reference,i.snapshot.dueDate,i.created_at,i.id].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  .sort((a,b)=>{
   const av=value(a,sort.key),bv=value(b,sort.key);
   const compared=sort.key==='totalCents'?av-bv:String(av).localeCompare(String(bv),undefined,{sensitivity:'base'});
   return compared*(sort.ascending?1:-1)||a.id.localeCompare(b.id);
  });
 const finalReview=review&&review.status!=='pending';
 const snapshot=opened?.invoice.snapshot;
 function heading(key,label){return <th scope="col" aria-sort={sort.key===key?(sort.ascending?'ascending':'descending'):'none'}><button type="button" onClick={()=>setSort(s=>({key,ascending:s.key===key?!s.ascending:true}))}>{label}{sort.key===key?(sort.ascending?' ↑':' ↓'):''}</button></th>;}
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
 async function load(){setData(await store.list());setLoaded(true);}
 async function open(id){setOpened(await store.read(id));setLine(null);setReview(null);setDetails(null);setMatches([]);}
 return <section className="epi-actions" aria-label="Sandbox invoice records">
  <h4>Sandbox saved snapshots & product review</h4>
  <p>Fictional, unissued records only. Saving keeps every line, including one-time items. Product approval never deducts inventory.</p>
  <fieldset disabled={busy}>
   {!providedStore&&<label>Approved test organization ID<input value={org} onChange={e=>{setOrg(e.target.value);setData({invoices:[],products:[],reviews:[]});setLoaded(false);setOpened(null);setLine(null);setDetails(null);setReview(null);setMatches([]);setConfirmed(false);setMessage('');}}/></label>}
   <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm these details are fictional and the customer email is empty.</label>
   <button type="button" onClick={()=>run(async()=>{const saved=await store.save(draft,confirmed);await load();await open(saved.id);setMessage('Unissued fictional snapshot saved. One-time lines remain valid without a product.');})} disabled={!draft||!confirmed}>Save fictional snapshot</button>
   <button type="button" onClick={()=>run(load)}>Load saved snapshots</button>
   <label>Search saved invoices<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
   {loaded&&<p>{invoices.length} of {data.invoices.length} saved snapshots</p>}
   {loaded&&invoices.length===0&&<p>{data.invoices.length?'No saved snapshots match your search.':'No saved snapshots yet. Save a fictional invoice to get started.'}</p>}
   {invoices.length>0&&<div className="epi-records-scroll" role="region" aria-label="Saved invoice list" tabIndex={0}><table className="epi-table">
    <caption>Saved fictional invoices</caption>
    <thead><tr>{heading('recipient','Recipient')}{heading('reference','Reference')}{heading('dueDate','Due date')}{heading('totalCents','Total')}{heading('created_at','Saved date')}<th scope="col">Actions</th></tr></thead>
    <tbody>{invoices.map(i=><tr key={i.id} aria-current={opened?.invoice.id===i.id?'true':undefined}>
     <td>{i.snapshot.recipient}</td><td>{i.snapshot.reference||'No reference'}</td><td>{i.snapshot.dueDate}</td><td>{centsDisplay(i.snapshot.totalCents)}</td><td><time dateTime={i.created_at}>{new Date(i.created_at).toLocaleString()}</time></td>
     <td><button type="button" aria-label={'Open snapshot for '+i.snapshot.recipient} onClick={()=>run(()=>open(i.id))}>Open</button></td>
    </tr>)}</tbody>
   </table></div>}
   {opened&&<div><h4>Saved snapshot: {opened.invoice.snapshot.recipient}</h4>
    <p>{opened.invoice.status} · {centsDisplay(opened.invoice.snapshot.totalCents)} · invoice details stay fixed.</p>
    <dl className="epi-snapshot-details"><dt>Sample issuer</dt><dd>{snapshot.issuerLabel}</dd><dt>Reference</dt><dd>{snapshot.reference||'No reference'}</dd><dt>Source</dt><dd>{snapshot.sourceType}</dd><dt>Issue date</dt><dd>{snapshot.issueDate}</dd><dt>Due date</dt><dd>{snapshot.dueDate}</dd><dt>Subtotal</dt><dd>{centsDisplay(snapshot.subtotalCents)}</dd><dt>Illustrative tax ({snapshot.taxBasisPoints/100}%)</dt><dd>{centsDisplay(snapshot.taxCents)}</dd><dt>Example total</dt><dd>{centsDisplay(snapshot.totalCents)}</dd><dt>Original notes / terms</dt><dd>{snapshot.notes||'None entered'}</dd></dl>
    <ol>{opened.lines.map(l=><li key={l.id}>{l.description} · {l.quantity} × {centsDisplay(l.unit_cents)} = {centsDisplay(l.quantity*l.unit_cents)} <button type="button" onClick={()=>selectLine(l)}>Optional product review</button></li>)}</ol>
   </div>}
   {line&&details&&<div>
    <h4>Review catalog details for “{line.description}”</h4>
    <p>Keeping this as a one-time invoice item requires no action.</p>
    {finalReview&&<p>This decision is complete. Saved product details are read-only; the original invoice line remains unchanged.</p>}
    <fieldset disabled={busy||Boolean(finalReview)}><legend>Catalog proposal details</legend>
    <label>Product name<input value={details.name} maxLength={160} onChange={e=>edit('name',e.target.value)}/></label>
    <label>SKU (optional)<input value={details.sku} maxLength={48} onChange={e=>edit('sku',e.target.value)}/></label>
    <label>Description<textarea value={details.description} maxLength={1000} onChange={e=>edit('description',e.target.value)}/></label>
    <label>Classification<select aria-label="Classification" value={details.kind} onChange={e=>{edit('kind',e.target.value);edit('track_inventory',false);}}>{ITEM_KINDS.map(k=><option key={k} value={k}>{k.replaceAll('_',' ')}</option>)}</select></label>
    <label><input type="checkbox" checked={details.track_inventory} disabled={details.kind!=='physical_merchandise'} onChange={e=>edit('track_inventory',e.target.checked)}/>Track physical inventory (stock not initialized or changed)</label>
    <label>Proposed unit price ($)<input value={details.price} onChange={e=>edit('price',e.target.value)}/></label>
    {!finalReview&&<button type="button" onClick={()=>run(async()=>{
     const {price,...fields}=details;
     const current=data.reviews.find(r=>r.line_id===line.id);
     const r=await store.propose(line.id,{...fields,unit_cents:parseInvoiceCents(price)},current?.version||0);
     setReview(r);await load();setMessage('Proposal saved for explicit review. No product created.');
    })}>Save review details</button>}
    </fieldset>
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

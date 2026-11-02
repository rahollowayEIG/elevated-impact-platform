import React,{useEffect,useState} from 'react';
import {
 managerStorageKey,validateManagerBlueprint,reviewManagerProposal,approveManagerBlueprint
} from '../lib/buildLabManagerBlueprint.mjs';
import {WORK_EVENT} from '../lib/buildLabWorkBuckets.mjs';
import {describeWorkItem} from '../lib/buildLabOwnerExplanations.mjs';

// Review-only plan for the owner. Deliberately does not import a builder, agent,
// source writer, deployment handler or a code execution client.
function currentPlan(owner){
 const key=managerStorageKey(owner);
 if(!key)return null;
 const raw=localStorage.getItem(key);
 if(!raw)return null;
 if(raw.length>600000)throw Error('Plan exceeds browser limit.');
 return validateManagerBlueprint(JSON.parse(raw));
}
export default function BuildLabLivePlanReview({ownerUserId}){
 const [plan,setPlan]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [ack,setAck]=useState(false);
 const [cursor,setCursor]=useState(()=>{try{return localStorage.getItem('eig:guided-plan:v1:'+ownerUserId)||'';}catch{return '';}});
 const [details,setDetails]=useState(false);
 const pending=plan?.proposals.filter(p=>p.decision==='pending')||[];
 const current=plan?.proposals.find(p=>p.id===cursor)||pending[0]||plan?.proposals[0]||null;
 const currentIndex=plan?.proposals.findIndex(p=>p.id===current?.id)??0;
 const currentDescription=current?describeWorkItem({...current,
  refs:current.sourceRefs,
  assessment:{basis:current.sourceRefs?.some(r=>r.type==='ai')?'scanner_metadata':'source_sample'},
  observation:'Plan recommendation from an earlier saved scan. Verify against current source before work.'}):null;
 useEffect(()=>{try{if(current)localStorage.setItem('eig:guided-plan:v1:'+ownerUserId,current.id);}catch{}},[ownerUserId,current?.id]);
 function move(direction){
  if(!plan?.proposals.length)return;
  setCursor(plan.proposals[(currentIndex+direction+plan.proposals.length)%plan.proposals.length].id);
  setDetails(false);
 }
 function refresh(){
  try{setPlan(currentPlan(ownerUserId));setError('');}
  catch{setError('Saved Manager plan could not be read. Existing browser evidence is unchanged.');}
 }
 useEffect(()=>{
  refresh();
  window.addEventListener(WORK_EVENT,refresh);
  window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener(WORK_EVENT,refresh);window.removeEventListener('storage',refresh);};
 },[ownerUserId]);
 function persist(next,label){
  try{
   const key=managerStorageKey(ownerUserId);
   if(!key)throw Error('Owner login required.');
   validateManagerBlueprint(next);
   localStorage.setItem(key,JSON.stringify(next));
   setPlan(next);setNotice(label);setError('');
  }catch(e){setError(e.message||'Review was not saved.');}
 }
 function decide(id,decision){
  if(!plan)return;
  const revision=decision==='revise'?window.prompt('Enter the revised requirement for the fix plan:',''):undefined;
  if(decision==='revise'&&revision===null)return;
  try{
   const next=reviewManagerProposal(plan,id,decision,revision||'');
   persist(next,'Decision saved in this browser. No changes to the platform were made.');
   const after=next.proposals.find(p=>p.decision==='pending');
   setCursor(after?.id||next.proposals[Math.min(currentIndex+1,next.proposals.length-1)]?.id||'');
   setDetails(false);
  }
  catch(e){setError(e.message||'Decision could not be saved.');}
 }
 function approve(){
  try{
   const next=approveManagerBlueprint(plan,{acknowledgeWarnings:ack});
   persist(next,'Plan reviewed and saved locally. Execution and deployment remain disconnected.');
  }catch(e){setError(e.message||'Plan is not ready for approval.');}
 }
 function download(){
  if(!plan)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;
  link.download='eig-build-lab-owner-plan.json';document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="platform-section-card" aria-label="Build Lab owner fix-plan review">
  <h2>Review &amp; Fix Plan</h2>
  <p>Turn approved Work Buckets into a reviewable, versioned plan. Choose a Work Bucket batch and select its planning handoff. This workspace cannot build, execute, repair or deploy code automatically.</p>
  <button type="button" className="platform-secondary-button" onClick={refresh}>Refresh saved plan</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!plan?<p>No Manager plan is open. In Work Buckets, approve a batch and select its planning handoff.</p>:<>
   <p><strong>{plan.title}</strong> · revision {plan.revision} · {plan.status}</p>
   {plan.warnings?.length>0&&<ul>{plan.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}
   {current&&<article className="bl-plan bl-guided" aria-label="Guided plan decision">
    <p className="platform-eyebrow">PLAIN-ENGLISH PLAN REVIEW</p>
    <p>Step {currentIndex+1} of {plan.proposals.length} · {pending.length} still awaiting a decision</p>
    <h3>{current.title}</h3>
    <p><strong>Status:</strong> {currentDescription.evidenceStatus}. This plan does not prove a bug or authorize a deployment.</p>
    <p><strong>What this means:</strong> {currentDescription.quick}</p>
    <p><strong>Why it matters:</strong> {currentDescription.why}</p>
    <p><strong>Next check:</strong> {currentDescription.next}</p>
    <details open={details} onToggle={e=>setDetails(e.currentTarget.open)}>
     <summary>Show detailed requirements &amp; technical evidence</summary>
     <p><strong>Proposed work:</strong> {current.detail}</p>
     <p><strong>Priority:</strong> {current.priority} · Decision: {current.decision}</p>
     <p><strong>Verification:</strong> {currentDescription.outcome}</p>
     <ul>{current.sourceRefs?.map((r,i)=><li key={i}>{r.type} · {r.sourceVersion.slice(0,12)} · {r.files?.join(', ')||'No files listed'}</li>)}</ul>
    </details>
    <div className="bl-input-pair">{['accept','revise','hold','reject'].map(decision=>
     <button type="button" key={decision} className="platform-secondary-button"
      onClick={()=>decide(current.id,decision)}>{decision[0].toUpperCase()+decision.slice(1)}</button>
    )}</div>
    <div className="bl-review-actions">
     <button type="button" className="platform-secondary-button" onClick={()=>move(-1)}>Previous</button>
     <button type="button" className="platform-primary-button" onClick={()=>move(1)}>Continue to next</button>
    </div>
   </article>}
   <details><summary>View all planned items ({plan.proposals.length})</summary>
    <ul>{plan.proposals.map(p=><li key={p.id}>{p.title} · {p.decision}</li>)}</ul>
   </details>
   {plan.warnings?.length>0&&<label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> I reviewed the source-version warnings.</label>}
   <p><button type="button" className="platform-primary-button" disabled={pending.length>0} onClick={approve}>Approve reviewed plan (planning only)</button>
    <button type="button" className="platform-secondary-button" onClick={download}>Download plan JSON</button></p>
   <p role="status">Implementation and verification tasks require separate reviewed development work. This button is NOT permission to deploy.</p>
  </>}
 </section>;
}

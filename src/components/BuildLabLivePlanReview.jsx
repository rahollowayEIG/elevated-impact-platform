import React,{useEffect,useState} from 'react';
import {
 managerStorageKey,validateManagerBlueprint,reviewManagerProposal,approveManagerBlueprint
} from '../lib/buildLabManagerBlueprint.mjs';
import {WORK_EVENT} from '../lib/buildLabWorkBuckets.mjs';

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
  try{persist(reviewManagerProposal(plan,id,decision,revision||''),'Decision saved in this browser. No changes to the platform were made.');}
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
   {plan.proposals.map(p=><article key={p.id} className="bl-plan">
    <h3>{p.title}</h3><p>{p.detail}</p><p>Priority: {p.priority} · Decision: {p.decision}</p>
    <div className="bl-input-pair">{['accept','revise','hold','reject'].map(decision=>
     <button type="button" key={decision} className="platform-secondary-button"
      onClick={()=>decide(p.id,decision)}>{decision[0].toUpperCase()+decision.slice(1)}</button>
    )}</div>
   </article>)}
   {plan.warnings?.length>0&&<label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> I reviewed the source-version warnings.</label>}
   <p><button type="button" className="platform-primary-button" onClick={approve}>Approve reviewed plan (planning only)</button>
    <button type="button" className="platform-secondary-button" onClick={download}>Download plan JSON</button></p>
   <p role="status">Implementation and verification tasks require separate reviewed development work. This button is NOT permission to deploy.</p>
  </>}
 </section>;
}

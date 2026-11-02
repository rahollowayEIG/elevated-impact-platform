import React,{useEffect,useState} from 'react';
import {describeWorkItem,guidedReviewQueue,nextGuidedItem} from '../lib/buildLabOwnerExplanations.mjs';
import {findingAssessment} from '../lib/buildLabFindingStandards.mjs';

// Owner-local navigator. The only mutations are explicit existing review decisions.
// No AI calls, background work, source edits, or deployments.
const key=uid=>'eig:guided-review:v1:'+uid;
function readCursor(uid){try{const value=localStorage.getItem(key(uid));return typeof value==='string'&&value.length<720?value:'';}catch{return '';}}
export default function BuildLabGuidedReview({ownerUserId,jobs,approvedIds,onDecision,onOpenPlan,approvedPlans=0}){
 const [cursor,setCursor]=useState(()=>readCursor(ownerUserId));
 const [level,setLevel]=useState('quick');
 const [message,setMessage]=useState('');
 const queue=guidedReviewQueue(jobs,approvedIds);
 const active=queue.find(j=>j.id===cursor)||queue[0]||null;
 const currentIndex=active?queue.findIndex(j=>j.id===active.id):0;
 useEffect(()=>{try{if(active)localStorage.setItem(key(ownerUserId),active.id);
  else localStorage.removeItem(key(ownerUserId));}catch{}},[ownerUserId,active?.id]);
 function move(direction){
  if(!active)return;
  setCursor(nextGuidedItem(queue,active.id,direction));
  setLevel('quick');setMessage('');
 }
 function decide(action){
  if(!active)return;
  if(onDecision(active,action)!==true)return;
  const remaining=queue.filter(j=>j.id!==active.id);
  setCursor(remaining.length?remaining[Math.min(currentIndex,remaining.length-1)].id:'');
  setLevel('quick');
  setMessage(action==='approve'?'Planning scope saved. This does not confirm a defect or change code.':
   action==='hold'?'Saved on hold until testing is complete.':'Dismissed from active review.');
 }
 const explanation=active?describeWorkItem(active):null;
 return <section className="bl-guided" aria-label="Guided owner review">
  <p className="platform-eyebrow">GUIDED OWNER WORKFLOW</p>
  <h3>One decision at a time</h3>
  <p>Build Lab organizes the next step automatically, saves your place in this browser and prepares a planning batch after approval. It never fixes code or releases changes on its own.</p>
  {message&&<p role="status" className="bl-notice">{message}</p>}
  {!active?<div>
   <p role="status">No unreviewed open findings are waiting. {approvedPlans>0?approvedPlans+' approved planning batch(es) are ready to inspect.':'Run another scan or add an owner goal whenever you are ready.'}</p>
   {approvedPlans>0&&<button type="button" className="platform-primary-button" onClick={onOpenPlan}>Continue to Review &amp; Fix Plan</button>}
  </div>:<>
   <p className="bl-quiet">Finding {currentIndex+1} of {queue.length} waiting for review · Priority: {explanation.priority}</p>
   <div className="bl-guided-progress" role="progressbar" aria-label="Guided review position" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={currentIndex+1}><span style={{width:((currentIndex+1)/queue.length*100)+'%'}} /></div>
   <h4>{explanation.title}</h4>
   <p><strong>Current assessment:</strong> {explanation.evidenceStatus}. Nothing has been diagnosed as broken from this recommendation alone.</p>
   <div className="bl-guided-levels" role="group" aria-label="Explanation detail">
    {[['quick','Quick explanation'],['full','Full explanation'],['technical','Technical details']].map(([id,label])=><button type="button" key={id}
     className={level===id?'platform-primary-button':'platform-secondary-button'}
     aria-pressed={level===id} onClick={()=>setLevel(id)}>{label}</button>)}
   </div>
   <div className="bl-guided-explanation">
    <p><strong>What does this mean?</strong> {explanation.quick}</p>
    <p><strong>Why should I care?</strong> {explanation.why}</p>
    <p><strong>What happens next?</strong> {explanation.next}</p>
    {level!=='quick'&&<>
     <p><strong>What could this affect?</strong> {explanation.impact}</p>
     <p><strong>What will be different once verified?</strong> {explanation.outcome}</p>
    </>}
    {level==='technical'&&<details open>
     <summary>Original scanner evidence and technical wording</summary>
     <p><strong>Assessment limits:</strong> {explanation.limits}</p>
     <p><strong>Scanner observation:</strong> {explanation.currentEvidence}</p>
     <p><strong>Proposed work:</strong> {explanation.suggestedWork}</p>
     <p><strong>Verification criteria:</strong> {explanation.completion}</p>
     <p><strong>Evidence type:</strong> {findingAssessment(active).basis}</p>
     <ul>{active.refs.map((ref,i)=><li key={i}>{ref.type} · {ref.sourceVersion.slice(0,12)} · {ref.files.join(', ')||'No file references'}</li>)}</ul>
    </details>}
   </div>
   <p className="bl-quiet">Approval below only creates a planning record. Testing, fixes and deployment require separate verification and authorization.</p>
   <div className="bl-review-actions bl-guided-actions">
    <button type="button" className="platform-primary-button" onClick={()=>decide('approve')}>Approve planning &amp; continue</button>
    <button type="button" className="platform-secondary-button" onClick={()=>decide('hold')}>Hold for testing</button>
    <button type="button" className="platform-secondary-button" onClick={()=>decide('dismiss')}>Dismiss suggestion</button>
   </div>
   <div className="bl-review-actions bl-guided-actions">
    <button type="button" className="platform-secondary-button" disabled={queue.length<2} onClick={()=>move(-1)}>Previous</button>
    <button type="button" className="platform-secondary-button" disabled={queue.length<2} onClick={()=>move(1)}>Continue to next</button>
    {approvedPlans>0&&<button type="button" className="platform-secondary-button" onClick={onOpenPlan}>Continue to Fix Plan</button>}
   </div>
  </>}
 </section>;
}

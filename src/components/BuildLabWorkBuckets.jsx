import React,{useEffect,useRef,useState} from 'react';
import {HISTORY_EVENT,SCAN_TYPES,historyKey,readScanHistory} from '../lib/buildLabScanHistory.mjs';
import {managerStorageKey} from '../lib/buildLabManagerBlueprint.mjs';
import {WORK_BUCKETS,WORK_INTENTS,WORK_STATES,WORK_EVENT,validateWorkLedger,readWorkLedger,saveWorkLedger,collectScanWork,approveBucketSelection,setBucketDisposition,batchWorkBlueprint,reviseWorkItem,addBuildBrief,addManualFinding,reviewManualFinding,MANUAL_OUTCOMES,createWorkBatch,approveWorkBatch,batchIsCurrent,workBatchPlan,workRoute} from '../lib/buildLabWorkBuckets.mjs';
import {FINDING_KINDS,findingAssessment} from '../lib/buildLabFindingStandards.mjs';
import './build-lab-work-buckets.css';
const blank={title:'',detail:'',completion:'',apps:'platform'};
const blankReport={title:'',app:'inception-apex',expected:'',actual:'',steps:'',completion:'',bucket:'interface',environment:'',sourceVersion:'',relatedId:''};
// Browser-only, owner-separated draft. Never part of the scan evidence or approved work ledger.
const manualDraftKey=uid=>historyKey(uid)?.replace('scan-history','work-manual-draft')||null;
function storedManualDraft(uid){
 const key=manualDraftKey(uid);if(!key)return null;
 try{
  const raw=localStorage.getItem(key);if(!raw||raw.length>6000)return null;
  const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))return null;
  const entry=Object.fromEntries(Object.entries(blankReport).map(([name,defaultValue])=>[name,typeof data[name]==='string'&&data[name].length<=1500?data[name]:defaultValue]));
  if(!Object.keys(blankReport).some(name=>entry[name]!==blankReport[name]))return null;
  return {data:entry,savedAt:typeof data.savedAt==='string'&&Number.isFinite(Date.parse(data.savedAt))?data.savedAt:null};
 }catch{return null;}
}
const readManualDraft=uid=>storedManualDraft(uid)?.data||{...blankReport};
function download(value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='build-lab-work-buckets.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function BuildLabWorkBuckets({ownerUserId,onOpenManager}){
 const selectionKey='eig:work-selection:v1:'+ownerUserId;
 const editorRef=useRef(null);
 const [batchQuery,setBatchQuery]=useState('');
 const [selectionError,setSelectionError]=useState('');
 const [ledger,setLedger]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [query,setQuery]=useState(''),[bucket,setBucket]=useState('all'),[intent,setIntent]=useState('all'),[state,setState]=useState('all'),[assessmentKind,setAssessmentKind]=useState('all'),[order,setOrder]=useState({key:'lastSeen',direction:'desc'});
 const [selected,setSelected]=useState(()=>{try{const x=JSON.parse(localStorage.getItem(selectionKey)||'[]');return Array.isArray(x)&&x.every(v=>typeof v==='string')?x:[];}catch{return [];}}),[batchTitle,setBatchTitle]=useState(''),[editing,setEditing]=useState(''),[draft,setDraft]=useState(null),[brief,setBrief]=useState(blank),[reportState,setReportState]=useState(()=>({owner:ownerUserId,data:readManualDraft(ownerUserId)})),[draftSaveError,setDraftSaveError]=useState(''),[draftSavedAt,setDraftSavedAt]=useState(()=>storedManualDraft(ownerUserId)?.savedAt||null),[draftExists,setDraftExists]=useState(()=>!!storedManualDraft(ownerUserId)),[draftExpanded,setDraftExpanded]=useState(()=>!!storedManualDraft(ownerUserId));
  const reported=reportState.owner===ownerUserId?reportState.data:readManualDraft(ownerUserId);
  function setReported(next){
   setReportState({owner:ownerUserId,data:next});
   const key=manualDraftKey(ownerUserId);
   try{
    if(!key)throw Error('Owner account is required.');
    // The untouched defaults need no draft. Clear only after an actual report save.
    const changed=Object.keys(blankReport).some(field=>next[field]!==blankReport[field]);
    if(changed){
     const savedAt=new Date().toISOString(),json=JSON.stringify({...next,savedAt});
     localStorage.setItem(key,json);
     if(localStorage.getItem(key)!==json)throw Error('Saved draft could not be read back.');
     setDraftExists(true);setDraftSavedAt(savedAt);
    }else{localStorage.removeItem(key);setDraftExists(false);setDraftSavedAt(null);}
    setDraftSaveError('');
   }catch{setDraftSaveError('Draft changes could not be saved in this browser. Keep a copy of your text before leaving this page.');}
  }
 useEffect(()=>{try{localStorage.setItem(selectionKey,JSON.stringify(selected));setSelectionError('');}catch{setSelectionError('Work selection could not be saved in this browser.');}},[selectionKey,selected]);
 useEffect(()=>{if(editing){editorRef.current?.scrollIntoView({block:'nearest'});editorRef.current?.querySelector('input')?.focus();}},[editing]);
 useEffect(()=>{
  function load(){try{const prior=readWorkLedger(localStorage,ownerUserId),next=collectScanWork(prior,readScanHistory(localStorage,ownerUserId));if(JSON.stringify(prior)!==JSON.stringify(next))saveWorkLedger(localStorage,ownerUserId,next);setLedger(next);setError('');}catch(e){setError(e.message+' Work buckets could not be saved or restored. Existing browser data has been preserved.');}}
  load();window.addEventListener(HISTORY_EVENT,load);window.addEventListener('storage',load);window.addEventListener(WORK_EVENT,load);
  return()=>{window.removeEventListener(HISTORY_EVENT,load);window.removeEventListener('storage',load);window.removeEventListener(WORK_EVENT,load);};
 },[ownerUserId]);
 function mutate(fn,message){try{const next=fn(readWorkLedger(localStorage,ownerUserId));saveWorkLedger(localStorage,ownerUserId,next);setLedger(next);setError('');setNotice(message);window.dispatchEvent(new Event(WORK_EVENT));return true;}catch(e){setError(e.message+' Nothing was saved.');return false;}}
 const jobs=ledger?.jobs||[],needle=query.trim().toLowerCase();
 const visible=jobs.filter(j=>(bucket==='all'||j.bucket===bucket)&&(intent==='all'||j.intent===intent)&&(assessmentKind==='all'||findingAssessment(j).kind===assessmentKind)&&(state==='all'||(state==='manual'?j.state!=='dismissed'&&workRoute(j).label==='Needs manual fix':j.state===state))&&(!needle||[j.title,j.detail,j.observation,j.manualFinding?.verificationNote||'',j.manualFinding?.relatedId||'',...j.apps,WORK_BUCKETS[j.bucket],WORK_INTENTS[j.intent],WORK_STATES[j.state],FINDING_KINDS[findingAssessment(j).kind],workRoute(j).label,...j.refs.flatMap(r=>r.files)].join(' ').toLowerCase().includes(needle))).sort((a,b)=>{
  const val=j=>order.key==='bucket'?WORK_BUCKETS[j.bucket]:order.key==='scope'?j.apps.join(', '):order.key==='priority'?({critical:0,high:1,medium:2,low:3}[j.priority]):j[order.key];
  const comparison=order.key==='lastSeen'?Date.parse(val(a))-Date.parse(val(b)):order.key==='priority'?val(a)-val(b):String(val(a)).localeCompare(String(val(b)),undefined,{sensitivity:'base'});
  return comparison*(order.direction==='asc'?1:-1)||a.id.localeCompare(b.id);
 });
 const approvedIds=new Set((ledger?.batches||[]).filter(b=>b.status==='approved'&&batchIsCurrent(ledger,b)).flatMap(b=>b.items.map(i=>i.id)));
 const eligible=visible.filter(j=>j.state==='open'&&!approvedIds.has(j.id)),allSelected=eligible.length>0&&eligible.every(j=>selected.includes(j.id));
 function reviewSelection(){return (selected.length?jobs.filter(j=>selected.includes(j.id)):eligible).map(j=>({id:j.id,signature:j.signature}));}
 function approveVisible(){const selection=reviewSelection();if(mutate(l=>approveBucketSelection(l,{selection,idPrefix:crypto.randomUUID(),title:bucket==='all'?'Reviewed scan findings':WORK_BUCKETS[bucket]}),'Review saved. Approved work plans were created automatically; implementation has not started.'))setSelected([]);}
 function disposition(value){if(mutate(l=>setBucketDisposition(l,{selection:reviewSelection(),state:value}),value==='hold'?'Findings placed on hold.':'Findings dismissed.'))setSelected([]);}
 function edit(j){setEditing(j.id);setDraft({...j,apps:j.apps.join(', ')});}
 function saveEdit(){const id=editing;if(mutate(l=>{let next=l;const previous=l.jobs.find(j=>j.id===id);if(draft.manualFinding&&(draft.manualFinding.outcome!==previous?.manualFinding?.outcome||draft.manualFinding.verificationNote!==previous?.manualFinding?.verificationNote))next=reviewManualFinding(next,id,{outcome:draft.manualFinding.outcome,note:draft.manualFinding.verificationNote});return reviseWorkItem(next,id,{title:draft.title,detail:draft.detail,completion:draft.completion,bucket:draft.bucket,intent:draft.intent,scope:draft.scope,apps:draft.apps.split(',').map(x=>x.trim()).filter(Boolean),state:draft.manualFinding?next.jobs.find(j=>j.id===id).state:draft.state,manualReason:draft.manualReason});},'Work item saved locally. Existing batches retain their original scope for review.')){setSelected(s=>s.filter(x=>x!==id));setEditing('');}}
 function reportIssue(){const title=reported.title;if(mutate(l=>addManualFinding(l,{...reported,id:'manual:'+crypto.randomUUID(),environment:reported.environment||window.location.origin}),'Manual issue recorded On hold. Verify its behavior before approving a repair.')){setReported(blankReport);setQuery(title);setBucket('all');setState('all');setIntent('all');setAssessmentKind('all');setSelected([]);}}
 function openPlan(batch){try{const current=readWorkLedger(localStorage,ownerUserId),plan=workBatchPlan(current,batch.id),key=managerStorageKey(ownerUserId);if(!key)throw Error('Owner account required.');if(localStorage.getItem(key)&&!window.confirm('Open this batch in implementation review? This replaces the current Manager draft. Your batch remains saved in Work Buckets.'))return;localStorage.setItem(key,JSON.stringify(plan));onOpenManager?.();}catch(e){setError(e.message);}}
 return <section className="platform-section-card bl-work" aria-labelledby="bl-work-title">
  <p className="platform-eyebrow">SCAN → BUCKETS → REVIEWED WORK BATCHES</p>
  <h2 id="bl-work-title">Work Buckets</h2>
  <p>Saved scans collect here automatically. You can also record an issue a scanner missed, verify it, then approve any confirmed repair. The work plan is created automatically.</p>
  <p className="bl-quiet">Assessment describes the evidence; Repair, Upgrade and New build describe proposed work. Approval does not confirm a defect. Needs manual fix is reserved for an identified capability gap.</p>
  <p className="bl-quiet">Saved in this browser and preview address only. Batch approval records scope; it does not run agents or deploy changes.</p>
  {error&&<p className="platform-error" role="alert">{error}</p>}{draftSaveError&&<p className="platform-error" role="alert">{draftSaveError}</p>}{selectionError&&<p className="platform-error" role="alert">{selectionError}</p>}{notice&&<p className="bl-notice" role="status">{notice}</p>}
  {ledger&&<>
   {draftExists&&<p role="status" className="bl-notice"><strong>Draft saved in this browser</strong>{draftSavedAt?' · '+new Date(draftSavedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):' · Restored from an earlier session'}. Not yet recorded as an issue. The report form reopens with your entries.</p>}
   <details className="bl-work-brief" open={draftExpanded} onToggle={e=>setDraftExpanded(e.currentTarget.open)}><summary>Report an issue scanners missed{draftExists?' · Unsubmitted draft saved':''}</summary>
    <p>Owner-only manual observation. Reports start On hold, not as scanner-confirmed defects. Do not include customer records, private screenshots, passwords or tokens. Nothing runs or deploys.</p><p className="bl-quiet">Draft autosave is on. Unsubmitted entries survive refreshing or leaving Work Buckets in this browser and preview address; they do not sync to other devices. Recording the issue saves it separately and clears the draft.</p>
    <form onSubmit={e=>{e.preventDefault();reportIssue();}}>
     <label>Issue title<input aria-label="Issue title" required maxLength={180} value={reported.title} onChange={e=>setReported({...reported,title:e.target.value})} placeholder="Clicking artwork does not enable arrow keys" /></label>
     <label>Affected app<input aria-label="Affected app" required maxLength={150} value={reported.app} onChange={e=>setReported({...reported,app:e.target.value})} /></label>
     <label>Suggested bucket<select aria-label="Suggested bucket" value={reported.bucket} onChange={e=>setReported({...reported,bucket:e.target.value})}>{Object.entries(WORK_BUCKETS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
     <label>Expected behavior<textarea aria-label="Expected behavior" required rows={2} maxLength={700} value={reported.expected} onChange={e=>setReported({...reported,expected:e.target.value})} /></label>
     <label>Observed behavior<textarea aria-label="Observed behavior" required rows={2} maxLength={700} value={reported.actual} onChange={e=>setReported({...reported,actual:e.target.value})} /></label>
     <label>How to reproduce<textarea aria-label="How to reproduce" required rows={3} maxLength={800} value={reported.steps} onChange={e=>setReported({...reported,steps:e.target.value})} /></label>
     <label>Repair acceptance criteria<textarea aria-label="Repair acceptance criteria" required rows={2} maxLength={1500} value={reported.completion} onChange={e=>setReported({...reported,completion:e.target.value})} /></label>
     <div className="bl-scan-controls">
      <label>Environment or preview URL<input aria-label="Environment or preview URL" maxLength={300} value={reported.environment} onChange={e=>setReported({...reported,environment:e.target.value})} placeholder="Defaults to current preview" /></label>
      <label>Source commit SHA (optional)<input aria-label="Source commit SHA (optional)" maxLength={40} value={reported.sourceVersion} onChange={e=>setReported({...reported,sourceVersion:e.target.value})} placeholder="Unknown unless verified" /></label>
      <label>Related issue or finding<input aria-label="Related issue or finding" maxLength={300} value={reported.relatedId} onChange={e=>setReported({...reported,relatedId:e.target.value})} placeholder="e.g. GitHub #112" /></label>
     </div>
     <button className="platform-primary-button" type="submit">Record observed issue</button>
    </form>
   </details>
   <div className="bl-work-summary">{Object.entries(WORK_INTENTS).map(([id,label])=><button type="button" key={id} aria-pressed={intent===id} onClick={()=>setIntent(intent===id?'all':id)}><strong>{jobs.filter(j=>j.intent===id&&!['dismissed'].includes(j.state)).length}</strong>{label}</button>)}<button type="button" aria-pressed={state==='manual'} onClick={()=>setState(state==='manual'?'all':'manual')}><strong>{jobs.filter(j=>j.state!=='dismissed'&&workRoute(j).label==='Needs manual fix').length}</strong>Needs manual fix</button></div>
   <div className="bl-bucket-cards" aria-label="Review buckets">{Object.entries(WORK_BUCKETS).map(([id,label])=><button type="button" key={id} aria-pressed={bucket===id} onClick={()=>{setBucket(id);setState('all');setIntent('all');}}><strong>{label}</strong><span>{jobs.filter(j=>j.bucket===id&&j.state!=='dismissed').length} findings</span></button>)}</div>
   <div className="bl-scan-controls">
    <label>Search work items<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Requirement, app, file…" /></label>
    <label>Work bucket<select aria-label="Work bucket" value={bucket} onChange={e=>setBucket(e.target.value)}><option value="all">All buckets</option>{Object.entries(WORK_BUCKETS).map(([id,label])=><option key={id} value={id}>{label} ({jobs.filter(j=>j.bucket===id).length})</option>)}</select></label>
    <label>Work type<select aria-label="Work type" value={intent} onChange={e=>setIntent(e.target.value)}><option value="all">All work types</option>{Object.entries(WORK_INTENTS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Finding assessment<select aria-label="Finding assessment" value={assessmentKind} onChange={e=>setAssessmentKind(e.target.value)}><option value="all">All assessments</option>{Object.entries(FINDING_KINDS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Work status<select aria-label="Work status" value={state} onChange={e=>setState(e.target.value)}><option value="all">All statuses</option>{Object.entries(WORK_STATES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   </div>
   <p>{visible.length} of {jobs.length} work items · {selected.length} selected across filters</p>
   <div className="bl-history-table"><table><thead><tr><th><input type="checkbox" aria-label="Select all visible open work items" checked={allSelected} disabled={!eligible.length} onChange={()=>setSelected(s=>allSelected?s.filter(id=>!eligible.some(j=>j.id===id)):[...new Set([...s,...eligible.map(j=>j.id)])])} /></th>{[['title','Work item'],['bucket','Bucket'],['scope','Affected apps']].map(([key,label])=><th key={key} aria-sort={order.key===key?(order.direction==='asc'?'ascending':'descending'):'none'}><button type="button" onClick={()=>setOrder(s=>({key,direction:s.key===key&&s.direction==='asc'?'desc':'asc'}))}>{label}{order.key===key?(order.direction==='asc'?' ↑':' ↓'):''}</button></th>)}<th>Review</th></tr></thead><tbody>{visible.map(j=><tr key={j.id} className={selected.includes(j.id)?'bl-work-selected':''}>
    <td><input type="checkbox" aria-label={'Include work item '+j.title} checked={selected.includes(j.id)} disabled={j.state!=='open'||approvedIds.has(j.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,j.id]:s.filter(id=>id!==j.id))} /></td>
    <td><strong>{j.title}</strong><p><strong>{FINDING_KINDS[findingAssessment(j).kind]}</strong> · {WORK_INTENTS[j.intent]} · {approvedIds.has(j.id)?'Approved for work':WORK_STATES[j.state]}{j.manualFinding?' · '+MANUAL_OUTCOMES[j.manualFinding.outcome]:''}{!['manual','dismissed'].includes(j.state)&&workRoute(j).label==='Needs manual fix'?' · Needs manual fix':''}</p><details><summary>Requirement & evidence</summary><p>{j.detail}</p><p><strong>Complete when:</strong> {j.completion}</p><p>{j.observation}</p>{j.manualFinding&&<><p><strong>Manual report:</strong> {j.manualFinding.environment} · {new Date(j.manualFinding.reportedAt).toLocaleString()}</p><p><strong>Expected:</strong> {j.manualFinding.expected}</p><p><strong>Actual:</strong> {j.manualFinding.actual}</p><p><strong>Reproduce:</strong> {j.manualFinding.steps}</p><p><strong>Related:</strong> {j.manualFinding.relatedId||'Not linked'}</p><p><strong>Verification result:</strong> {MANUAL_OUTCOMES[j.manualFinding.outcome]}{j.manualFinding.verificationNote?' · '+j.manualFinding.verificationNote:''}</p></>}<p><strong>Evidence limits:</strong> {findingAssessment(j).limitation}</p><p><strong>Next verification:</strong> {findingAssessment(j).nextCheck}</p><p>{j.classificationReason}</p><p>Priority: {j.priority} · Last observed: {new Date(j.lastSeen).toLocaleString()}</p><ul>{j.evidence.map((e,i)=><li key={i}>{e}</li>)}</ul><ul>{j.refs.map((r,i)=><li key={i}>{r.type==='manual'?'Owner manual report':r.sourceVersion==='owner-brief'?'Owner brief':SCAN_TYPES[r.type]} · {r.sourceVersion.slice(0,12)}<p>{r.files.join(', ')||'Affected files require investigation.'}</p></li>)}</ul></details></td>
    <td>{WORK_BUCKETS[j.bucket]}</td><td>{j.scope.replace('_',' ')}<p>{j.apps.join(', ')}</p></td>
    <td><button type="button" className="platform-secondary-button" onClick={()=>edit(j)}>Revise</button><details><summary>Implementation readiness</summary><p><strong>{workRoute(j).label}</strong></p><p>{workRoute(j).reason}</p></details></td>
   </tr>)}</tbody></table></div>
   {!visible.length&&<p>{jobs.length?'No work matches these filters.':'Run a scan to collect findings, or add the next capability you want to build below.'}</p>}
   {editing&&draft&&<section className="bl-work-editor" aria-label="Review work item" ref={editorRef}>
    <h3>Review work item</h3><label>Work title<input maxLength={180} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} /></label>
    <label>Requirement<textarea rows={4} maxLength={3000} value={draft.detail} onChange={e=>setDraft({...draft,detail:e.target.value})} /></label>
    <label>Completion criteria<textarea rows={3} maxLength={3000} value={draft.completion} onChange={e=>setDraft({...draft,completion:e.target.value})} /></label>
    <div className="bl-scan-controls">{[['bucket','Bucket',WORK_BUCKETS],['intent','Work type',WORK_INTENTS],['scope','Change scope',{app:'One app',multi_app:'Multiple apps',platform:'Platform'}],['state','Work status',WORK_STATES]].map(([key,label,options])=><label key={key}>{label}<select aria-label={label} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}>{Object.entries(options).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>)}</div>
    <label>Affected apps, separated by commas<input maxLength={500} value={draft.apps} onChange={e=>setDraft({...draft,apps:e.target.value})} /></label>
    {draft.manualFinding&&<><label>Manual test result<select aria-label="Manual test result" value={draft.manualFinding.outcome} onChange={e=>setDraft({...draft,manualFinding:{...draft.manualFinding,outcome:e.target.value}})}>{Object.entries(MANUAL_OUTCOMES).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>What you tested and observed<textarea aria-label="What you tested and observed" rows={3} maxLength={1200} value={draft.manualFinding.verificationNote} onChange={e=>setDraft({...draft,manualFinding:{...draft.manualFinding,verificationNote:e.target.value}})} /></label><p>Confirmed reports become eligible for reviewed repair work. They do not impersonate IA scans or authorize automatic implementation.</p></>}<label>Manual work or missing capability<textarea rows={2} maxLength={1000} value={draft.manualReason} onChange={e=>setDraft({...draft,manualReason:e.target.value})} /></label>
    <div className="bl-review-actions"><button type="button" className="platform-primary-button" onClick={saveEdit}>Save work item</button><button type="button" className="platform-secondary-button" onClick={()=>setEditing('')}>Cancel</button></div>
   </section>}
   <section className="bl-work-approval" aria-label="Bucket review">
    <h3>{bucket==='all'?'Review findings':WORK_BUCKETS[bucket]}</h3>
    <p>{selected.length?'Review applies to your selection across filters.':'Review applies to the open findings visible above.'} Approval saves the requirements and creates work plans automatically, grouped into repairs, upgrades and new builds. It does not implement or deploy changes.</p>
    <div className="bl-review-actions"><button type="button" className="platform-primary-button" disabled={!(selected.length||eligible.length)} onClick={approveVisible}>Approve {selected.length?'selected':'visible'} findings ({selected.length||eligible.length})</button><button type="button" className="platform-secondary-button" disabled={!(selected.length||eligible.length)} onClick={()=>disposition('hold')}>Hold {selected.length?'selected':'visible'}</button><button type="button" className="platform-secondary-button" disabled={!(selected.length||eligible.length)} onClick={()=>disposition('dismissed')}>Dismiss {selected.length?'selected':'visible'}</button>{selected.length>0&&<button type="button" className="platform-secondary-button" onClick={()=>setSelected([])}>Clear selection</button>}</div>
   </section>
   <details className="bl-legacy-batch"><summary>Advanced batch tools</summary>
   <section className="bl-work-batch"><h3>Prepare a related work batch</h3><p>Choose jobs that share a purpose and can be implemented and tested together. Keep repairs, upgrades and new builds in separate batches. Approving a batch confirms its requirements only. Current source, shared files, dependencies and affected apps still need verification before implementation.</p>
    <label>Batch title<input maxLength={120} value={batchTitle} onChange={e=>setBatchTitle(e.target.value)} placeholder="Example: Shared confirmation dialog upgrade" /></label>
    <div className="bl-review-actions"><button type="button" className="platform-primary-button" disabled={!selected.length||!batchTitle.trim()} onClick={()=>{if(mutate(l=>createWorkBatch(l,{id:crypto.randomUUID(),title:batchTitle,jobIds:selected}),'Batch prepared. Review its requirements and affected apps below.')){setSelected([]);setBatchTitle('');}}}>Prepare batch ({selected.length})</button><button type="button" className="platform-secondary-button" disabled={!selected.length} onClick={()=>setSelected([])}>Clear selection</button></div>
   </section>
   </details>
   <h3>Approved work & batches ({ledger.batches.length})</h3>
   {ledger.batches.length>0&&<label>Search batches<input type="search" value={batchQuery} onChange={e=>setBatchQuery(e.target.value)} /></label>}
   {ledger.batches.filter(b=>[b.title,...b.items.map(i=>i.title)].join(' ').toLowerCase().includes(batchQuery.trim().toLowerCase())).map(b=><article className="bl-scan-finding" key={b.id} data-work-plan={batchWorkBlueprint(b).kind} data-batch-title={[b.title,...b.items.map(i=>i.title)].join(' ').toLowerCase()}><h4>{b.title}</h4><p>{WORK_INTENTS[b.intent]} · {b.items.length} jobs · {!batchIsCurrent(ledger,b)?'Changed since preparation — prepare a fresh batch':b.status==='approved'?'Scope approved · implementation pending':'Awaiting scope review'}</p><details><summary>View work plan & evidence</summary><ol>{b.items.map(i=><li key={i.id}><strong>{i.title}</strong><p>{i.detail}</p><p><strong>Complete when:</strong> {i.completion}</p><p><strong>{FINDING_KINDS[findingAssessment(i).kind]}</strong> · {findingAssessment(i).limitation}</p><p><strong>Next verification:</strong> {findingAssessment(i).nextCheck}</p><p>Affected apps: {i.apps?.join(', ')||'See original source scope.'}</p><ul>{(i.sourceRefs||[]).map((r,n)=><li key={n}>{r.sourceVersion.slice(0,12)} · {r.files.join(', ')}</li>)}</ul></li>)}</ol></details>
    <div className="bl-review-actions">{b.status==='draft'&&<details><summary>Legacy draft review</summary><button type="button" className="platform-primary-button" disabled={!batchIsCurrent(ledger,b)} onClick={()=>mutate(l=>approveWorkBatch(l,b.id),'Batch scope approved locally. No implementation or deployment has started.')}>Approve batch scope</button></details>}{b.status==='approved'&&<details><summary>Advanced implementation tools</summary><p>This batch is ready for assisted implementation review. The existing candidate tool supports one current IA finding; automatic batch implementation and deployment are not connected.</p><button type="button" className="platform-secondary-button" disabled={!batchIsCurrent(ledger,b)} onClick={()=>openPlan(b)}>Open implementation review</button></details>}</div>
   </article>)}
   <details className="bl-work-brief"><summary>Add a new-build goal</summary><p>Describe what ElevationPilot needs to do. This creates an owner brief, not a scanner-confirmed missing feature.</p>
    <form onSubmit={e=>{e.preventDefault();if(mutate(l=>addBuildBrief(l,{...brief,id:'brief:'+crypto.randomUUID(),apps:brief.apps.split(',').map(x=>x.trim()).filter(Boolean)}),'New-build goal added to Research & development.'))setBrief(blank);}}>
     {[['title','Build goal'],['detail','Required capability'],['completion','Build completion criteria'],['apps','Build affected apps, separated by commas']].map(([key,label])=><label key={key}>{label}{['detail','completion'].includes(key)?<textarea required rows={3} maxLength={3000} value={brief[key]} onChange={e=>setBrief({...brief,[key]:e.target.value})} />:<input required maxLength={key==='title'?180:500} value={brief[key]} onChange={e=>setBrief({...brief,[key]:e.target.value})} />}</label>)}<button type="submit" className="platform-primary-button">Add build goal</button>
    </form>
   </details>
   <details><summary>Backup & advanced tools</summary><p>Download a backup to retain all collected work and batches independently of scan-history limits. Browser storage does not sync to your phone.</p><button type="button" className="platform-secondary-button" onClick={()=>download(ledger)}>Download work buckets JSON</button><label>Restore work buckets JSON<input type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>2400000)throw Error('Choose a backup smaller than 2.4 MB.');const restored=validateWorkLedger(JSON.parse(await f.text()));if(!window.confirm('Replace work buckets and batches in this browser with this backup? Download the current backup first to keep it.'))return;if(mutate(()=>restored,'Work bucket backup restored locally.'))setSelected([]);}catch(problem){setError(problem.message);}}} /></label></details>
  </>}
 </section>;
}

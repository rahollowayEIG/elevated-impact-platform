import ScannerDirectionsDisclosure from "./ScannerDirectionsDisclosure.jsx";
import BuildLabScanDestination, {BuildLabReportBackup} from "./BuildLabScanDestination.jsx";
import useBuildLabScanHistory from "./useBuildLabScanHistory.jsx";
import ScannerToolsDisclosure from "./ScannerToolsDisclosure.jsx";
import React,{useEffect,useMemo,useState} from "react";
import {requestImprovementRadar,validateImprovementRadar} from "../lib/eigMasterScanClient.mjs";
import {MASTER_SCAN_TARGETS} from "../lib/eigMasterScanTargets.mjs";
import "./build-lab-improvement-radar.css";

const ID=/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;
const REVIEW_STATES=new Set(["accept","revise","park"]);
const SEVERITY={critical:0,high:1,medium:2,low:3};
const LANE_LABELS={essential:"Essential",wow:"Make it awesome"};
const PROGRESS_LABELS={
  preview_signals_found:"Source signals found · behavior unverified",
  partial_preview_signals:"Partial source signals · investigate",
  not_observed_in_sample:"Not observed in source sample",
};
function key(uid){return ID.test(uid||"")?"eig:improvement-radar:v1:"+uid.toLowerCase():null;}
function restore(uid){
 try{
  const value=window.localStorage.getItem(key(uid));
  if(!value||value.length>110000)return null;
  const saved=JSON.parse(value);
  const audit=validateImprovementRadar(saved.audit,saved.files,saved.sourceVersion,saved.scope);
  if(typeof saved.fingerprint!=="string"||!/^[0-9a-f]{64}$/i.test(saved.fingerprint))return null;
  const choices=Object.fromEntries(Object.entries(saved.choices||{}).filter(([id,row])=>
    audit.suggestions.some(item=>item.id===id)&&REVIEW_STATES.has(row?.review)&&
      typeof row?.note==="string"&&row.note.length<=1300));
  return {audit,files:saved.files,sourceVersion:saved.sourceVersion,scope:saved.scope,
    fingerprint:saved.fingerprint,inspectedAt:saved.inspectedAt||"",choices};
 }catch{return null;}
}
function exportJson(value,filename){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));
 const link=document.createElement("a");link.href=url;link.download=filename;
 document.body.appendChild(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),500);
}
function draftFor(item,choice,metadata){
 return {
  kind:"eig_upgrade_blueprint_brief",version:1,status:"draft_requires_owner_review",
  scope:"platform_capability",lane:item.lane,proposalId:item.id,
  title:item.title,priority:item.priority,impact:item.impact,effort:item.effort,
  why:item.why,goal:choice?.review==="revise"?choice.note:item.proposal,
  upgradeProposal:item.proposal,verification:item.verify,
  dependencies:item.dependencies,
  evidence:item.evidence,sourceVersion:metadata.sourceVersion,
  evidenceCaptured:metadata.inspectedAt,claim:item.claim,
  review:choice?.review||"pending",notes:choice?.note||"",
  gates:[
   "Verify the existing experience, including any code not covered by the sample.",
   "Create a scoped architecture with explicit account, authorization and data boundaries.",
   "Implement only in a protected feature branch or isolated Sandbox.",
   "Run synthetic functional tests, regression, accessibility and security checks.",
   "Request explicit owner approval before any production release.",
  ],
  safety:{autoDeployed:false,autoBuilt:false,ownerApprovalRequired:true},
  limitation:"This is a proposed improvement from static heuristics, not a confirmed missing feature, successful test or external competitor scan.",
 };
}
export default function BuildLabImprovementRadar({ownerUserId,supabaseClient,legacyReview=false,onViewBuckets,runScanner=requestImprovementRadar}){
 const [restored]=useState(()=>restore(ownerUserId));
 const [scope,setScope]=useState(()=>restored?.scope||"all");
 const [result,setResult]=useState(restored||null);
 const [choices,setChoices]=useState(restored?.choices||{});
 const [running,setRunning]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState(restored?"Previous Upgrade Radar review restored from this browser.":"");
 const [saveError,setSaveError]=useState(false);
 const [lane,setLane]=useState("all");
 const [search,setSearch]=useState("");
 const [sort,setSort]=useState("priority");
 const [editing,setEditing]=useState("");
 const [note,setNote]=useState("");
 useEffect(()=>{
  const storage=key(ownerUserId);
  if(!storage||!result)return;
  try{
   const value=JSON.stringify({...result,choices});
   if(value.length>110000)throw Error("Upgrade Radar draft exceeds browser storage limit");
   window.localStorage.setItem(storage,value);
   setSaveError(false);
  }catch{setSaveError(true);}
 },[ownerUserId,result,choices]);
 const history=useBuildLabScanHistory(ownerUserId,"radar",result?{...result,choices}:null,result?.scope||"all",result?.sourceVersion||result?.fingerprint);
 async function run(){
  if(running)return;
  setRunning(true);setError("");setNotice("");
  try{
   const response=await runScanner(supabaseClient,undefined,scope==="all"?null:scope);
   if(!response?.radar||!response?.fingerprint)
     throw Error("The protected scan returned no product upgrade evidence.");
   const audit=response.radar;
   const files=[...new Set(audit.suggestions.flatMap(s=>s.evidence.map(e=>e.path)))];
   // The production scanner already validates against the actual source report.
   // Local drafts preserve only the same allowlisted evidence paths.
   validateImprovementRadar(audit,files,audit.sourceVersion,scope);
   const same=result?.fingerprint===response.fingerprint;
   setChoices(current=>same?current:{});
   history.begin(scope);setResult({audit,files,sourceVersion:audit.sourceVersion,scope,
     fingerprint:response.fingerprint,inspectedAt:response.inspectedAt,choices:{}});
   setEditing("");
   setNotice((same?"Existing decisions preserved. ":"New source or rubric evidence: review decisions reset. ")+
     "Upgrade opportunities prepared from protected preview code. No live behavior or competitor sites were inspected.");
  }catch(e){setError(e?.message||"Upgrade Radar could not finish.");}
  finally{setRunning(false);}
 }
 const filtered=useMemo(()=>{
  if(!result)return[];
  const find=search.trim().toLowerCase();
  return result.audit.suggestions.filter(item=>
    (lane==="all"||item.lane===lane)&&
    (!find||[item.title,item.why,item.proposal,item.verify,...item.dependencies]
      .some(x=>String(x).toLowerCase().includes(find))))
    .sort((a,b)=>{
      if(sort==="title")return a.title.localeCompare(b.title);
      if(sort==="effort")return ({low:0,medium:1,high:2}[a.effort]??3)-({low:0,medium:1,high:2}[b.effort]??3)||a.title.localeCompare(b.title);
      if(sort==="evidence")return a.signalCount/a.signalsChecked-b.signalCount/b.signalsChecked||a.title.localeCompare(b.title);
      return (SEVERITY[a.priority]??4)-(SEVERITY[b.priority]??4)||a.title.localeCompare(b.title);
    });
 },[result,lane,search,sort]);
 const reviewed=Object.values(choices).filter(x=>x?.review==="accept"||x?.review==="revise").length;
 function decide(item,review){
  if(!REVIEW_STATES.has(review)||!result?.audit.suggestions.some(x=>x.id===item.id))return;
  const detail=review==="revise"?note.trim():"";
  if(review==="revise"&&(detail.length<10||detail.length>1300)){
   setError("Add a revised improvement of at least 10 characters, up to 1,300.");
   return;
  }
  setChoices(old=>({...old,[item.id]:{review,note:detail}}));
  setEditing("");setNote("");setError("");
 }
 function buildBrief(item){
  const data=draftFor(item,choices[item.id]||null,result);
  exportJson(data,"eig-upgrade-"+item.id+".json");
 }
 function exportBacklog(){
  if(!result)return;
  exportJson({
   kind:"eig_improvement_review_backlog",version:1,scope:result.scope,
   auditedAt:result.inspectedAt,sourceFingerprint:result.fingerprint,
   origin:result.audit.origin,benchmark:result.audit.benchmark,
   suggestions:result.audit.suggestions.map(item=>draftFor(item,choices[item.id]||null,result)),
   automaticBuild:false,requiresOwnerApproval:true,
  },"eig-essentials-and-wow-backlog.json");
 }
 const stale=result&&result.scope!==scope;
 return <section className="platform-section-card blr-root" aria-labelledby="blr-heading">
  <div className="blr-header">
   <div><p className="platform-eyebrow">BUILD LAB / PRODUCT INTELLIGENCE</p>
     <div className="bl-scanner-title"><h2 id="blr-heading">Essentials & Wow Radar</h2><ScannerToolsDisclosure kind="radar" /></div>
     <p>Automatically surface the overlooked software fundamentals and distinctive experiences worth building next.</p></div>
   <div className="blr-launch">
    <label htmlFor="blr-scope">Scan product opportunities for
     <select id="blr-scope" value={scope} disabled={running} onChange={e=>setScope(e.target.value)}>
      <option value="all">Entire ElevationPilot platform</option>
      {MASTER_SCAN_TARGETS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
     </select>
    </label>
    <button className="platform-primary-button" type="button" disabled={running} onClick={run}>
     {running?"Checking product capabilities…":"Scan for Essentials & Upgrades →"}
    </button>
   </div>
  </div>
  <ScannerDirectionsDisclosure kind="radar" moduleId={scope} />
  <p className="blr-disclosure">This uses the <strong>same owner-authorized, read-only source scanner</strong>, with a fixed product-quality rubric.
   It proposes areas to investigate; it cannot prove a capability is missing or implemented.
   No live browsers, external competitors, AI calls, records, payments or deployments are involved.</p>
  {history.error&&<p role="alert" className="platform-error">{history.error}</p>}
  {error&&<p className="platform-error" role="alert">{error}</p>}
  {notice&&<p className="blr-notice" role="status">{notice}</p>}
  {saveError&&<p className="platform-error">Browser autosave is unavailable. Export your reviewed backlog to keep it.</p>}
  {stale&&<p className="blr-notice">The report below is for a different target. Run the radar to refresh recommendations for this selection.</p>}
  {result&&<div className="blr-report">
   <BuildLabScanDestination onViewBuckets={onViewBuckets} />
   <div className="blr-stats">
    <div><strong>{result.audit.summary.essential}</strong><span>Essential capability checks</span></div>
    <div><strong>{result.audit.summary.wow}</strong><span>Standout opportunity ideas</span></div>
    <div><strong>{result.audit.summary.notObserved}</strong><span>No signal in sampled source</span></div>
    {legacyReview&&<div><strong>{reviewed}</strong><span>Accepted or revised</span></div>}
   </div>
   <div className="blr-controls">
    <label>Show
     <select value={lane} onChange={e=>setLane(e.target.value)} aria-label="Filter improvement categories">
      <option value="all">All opportunities</option>
      <option value="essential">Essential foundations</option>
      <option value="wow">Make it awesome</option>
     </select>
    </label>
    <label>Search opportunities
     <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
       placeholder="Accounts, accessibility, GPS, AI, notifications…" />
    </label>
    <label>Sort by
     <select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort product improvements">
      <option value="priority">Highest priority</option>
      <option value="title">Name</option>
      <option value="effort">Lowest effort first</option>
      <option value="evidence">Least evidence first</option>
     </select>
    </label>
    <BuildLabReportBackup legacyReview={legacyReview}><button type="button" className="platform-secondary-button" onClick={exportBacklog}>Export Upgrade Backlog JSON</button></BuildLabReportBackup>
   </div>
   <p className="blr-count">Showing {filtered.length} of {result.audit.suggestions.length} product capability candidates. Each requires verification before building.</p>
   <div className="blr-items">
    {filtered.map(item=><article className="blr-card" key={item.id}>
      <div className="blr-card-head">
       <div className="blr-card-title"><span className={"blr-lane blr-"+item.lane}>{LANE_LABELS[item.lane]}</span>
        <h3>{item.title}</h3>
       </div>
       <span className="blr-priority">{item.priority} priority</span>
      </div>
      <div className="blr-meta">
       <span><strong>Impact</strong> {item.impact}</span>
       <span><strong>Effort</strong> {item.effort}</span>
       <span><strong>Preview evidence</strong> {item.signalCount}/{item.signalsChecked} signals</span>
       {legacyReview&&<span><strong>Review</strong> {choices[item.id]?.review||"pending"}</span>}
      </div>
      <p className="blr-evidence-state">{PROGRESS_LABELS[item.status]}</p>
      <p><strong>Why it matters:</strong> {item.why}</p>
      <p><strong>Suggested improvement:</strong> {choices[item.id]?.review==="revise"?
        choices[item.id].note:item.proposal}</p>
      <details>
       <summary>Verification plan, dependencies and source evidence</summary>
       <div className="blr-details">
        <p><strong>Verify before building:</strong> {item.verify}</p>
        <p><strong>Depends on:</strong> {item.dependencies.join(", ")||"None identified"}</p>
        <p><strong>Benchmark:</strong> {result.audit.references.find(r=>r.id===item.standard)?.name||"Product review rubric"}</p>
        {item.evidence.length?<ul>{item.evidence.map((ev,j)=><li key={ev.path+j}>
          <code>{ev.path}:{ev.line}</code> <span>{ev.excerpt}</span>
         </li>)}</ul>:<p>No matching source markers in the approved sample. This does not establish the feature is absent.</p>}
       </div>
      </details>
      {legacyReview&&<div className="blr-actions">
       <button type="button" onClick={()=>decide(item,"accept")}>Accept for blueprint</button>
       <button type="button" onClick={()=>{setEditing(item.id);setNote(choices[item.id]?.note||item.proposal);}}>Revise</button>
       <button type="button" onClick={()=>decide(item,"park")}>Park idea</button>
       <button type="button" onClick={()=>buildBrief(item)}>Download Upgrade Brief</button>
      </div>}
      {legacyReview&&editing===item.id&&<div className="blr-revise">
       <label>Revised upgrade suggestion
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} maxLength={1300}/>
       </label>
       <button type="button" className="platform-primary-button" onClick={()=>decide(item,"revise")}>Save revised idea</button>
       <button type="button" onClick={()=>{setEditing("");setNote("");}}>Cancel</button>
      </div>}
    </article>)}
   </div>
   {!filtered.length&&<p>No upgrade ideas match that search.</p>}
   <p className="blr-footer">Source version: <code>{result.sourceVersion.slice(0,12)}</code> · Rulebook scan: {result.inspectedAt?new Date(result.inspectedAt).toLocaleString():"saved"}.
   Results save in this browser. Review the collected work in Work Buckets.</p>
  </div>}
 </section>;
}

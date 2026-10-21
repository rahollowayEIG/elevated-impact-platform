import React,{useEffect,useMemo,useState} from "react";
import {requestMasterScan,validateMasterScanReport} from "../lib/eigMasterScanClient.mjs";
import {MASTER_SCAN_TARGETS} from "../lib/eigMasterScanTargets.mjs";
import BuildLabEnvironmentPanel from "./BuildLabEnvironmentPanel.jsx";
import "./build-lab-master-scanner.css";

const LEVEL={high:0,medium:1,low:2};
const UID=/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;
const SORTS=new Set(["title","priority","status","sourceStatus","uiStatus","testStatus","dbStatus"]);
const REVIEWS=new Set(["accept","revise","reject"]);
function storageKey(uid){return UID.test(uid||"")?"eig:master-scan:v1:"+uid.toLowerCase():null;}
function restoreDraft(uid) {
 try {
  const key=storageKey(uid);if(!key)return null;
  const data=window.localStorage.getItem(key);
  if(!data||data.length>120000)return null;
  const saved=JSON.parse(data);
  const report=validateMasterScanReport(saved?.report);
  const reviews=Object.fromEntries(Object.entries(saved?.reviews||{}).filter(([id,value])=>
   report.modules.some(m=>m.id===id)&&REVIEWS.has(value?.review)&&
   (typeof value?.note==="string"&&value.note.length<=1000)));
  return {report,reviews};
 } catch {return null;}
}
function downloadJson(json,filename) {
 const url=URL.createObjectURL(new Blob([JSON.stringify(json,null,2)],{type:"application/json"}));
 const link=document.createElement("a");link.href=url;link.download=filename;
 document.body.appendChild(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function stateLabel(state) {
 return {
  evidence_present:"Evidence found",
  review_needed:"Needs verification",
  not_observed_in_sample:"Not observed in sample",
  source_marker_found:"Found",ui_marker_found:"Linked",
  test_code_found:"Test code found",tables_in_dated_snapshot:"In snapshot",
  snapshot_gap:"Snapshot gap",not_applicable:"N/A",not_sampled:"Not sampled",
 }[state]||"Not observed";
}
function StatePill({value}) {
 const cls=value==="evidence_present"||value==="source_marker_found"||
  value==="ui_marker_found"||value==="test_code_found"||value==="tables_in_dated_snapshot"
   ?"present":value==="not_observed_in_sample"||value==="snapshot_gap"?"unseen":"review";
 return <span className={"blm-state blm-"+cls}>{stateLabel(value)}</span>;
}
const COLS=[
 {key:"title",name:"Module"},
 {key:"priority",name:"Priority"},
 {key:"status",name:"Evidence status"},
 {key:"sourceStatus",name:"Preview source"},
 {key:"uiStatus",name:"Preview UI"},
 {key:"testStatus",name:"Preview tests"},
 {key:"dbStatus",name:"DB snapshot"},
];
export default function BuildLabMasterScanner({ownerUserId,supabaseClient}) {
 const [restored] = useState(()=>restoreDraft(ownerUserId));
 const [selectedScope,setSelectedScope] = useState(()=>restored?.report?.scope==="module"?restored.report.selectedModule:"all");
 const [selectedEnvironment,setSelectedEnvironment] = useState(()=>restored?.report?.environmentAudit?.selected||"compare");
 const [report,setReport] = useState(()=>restored?.report||null);
 const [reviews,setReviews] = useState(()=>restored?.reviews||{});
 const [running,setRunning] = useState(false);
 const [error,setError] = useState("");
 const [notice,setNotice] = useState(restored?"Previous evidence report restored from this browser.":"");
 const [query,setQuery] = useState("");
 const [sort,setSort] = useState({key:"priority",direction:"asc"});
 const [editing,setEditing] = useState("");
 const [note,setNote] = useState("");
 const [saveError,setSaveError] = useState(false);

 useEffect(()=>{
  const key=storageKey(ownerUserId);if(!key||!report)return;
  try {
   const json=JSON.stringify({report,reviews});
   if(json.length>120000)throw Error("Report too large for browser storage");
   window.localStorage.setItem(key,json);
   setSaveError(false);
  } catch {setSaveError(true);}
 },[report,reviews,ownerUserId]);

 const rows=useMemo(()=>{
  if(!report)return[];
  const needle=query.trim().toLowerCase();
  const list=report.modules.filter(m=>!needle||
   [m.title,m.priority,m.status,m.nextCheck,
    ...m.evidence.map(x=>x.path),...m.tables.map(x=>x.table)]
    .some(v=>String(v).toLowerCase().includes(needle)));
  const sign=sort.direction==="asc"?1:-1;
  return [...list].sort((a,b)=>{
   const compare=sort.key==="priority"
    ? (LEVEL[a.priority]??3)-(LEVEL[b.priority]??3)
    :String(a[sort.key]||"").localeCompare(String(b[sort.key]||""));
   return (compare||a.title.localeCompare(b.title))*sign;
  });
 },[report,query,sort]);
 function setOrder(key) {
  if(!SORTS.has(key))return;
  setSort(current=>({key,direction:current.key===key&&current.direction==="asc"?"desc":"asc"}));
 }
 async function run() {
  if(running)return;
  setRunning(true);setError("");setNotice("");
  try {
   const next=await requestMasterScan(supabaseClient,undefined,selectedScope==="all"?null:selectedScope,selectedEnvironment);
   const identical=report?.sourceFingerprint===next.sourceFingerprint;
   setReviews(current=>identical?current:{});
   setEditing("");setNote("");
   setReport(next);
   const label=selectedScope==="all"?"Entire platform":MASTER_SCAN_TARGETS.find(t=>t.id===selectedScope)?.label||"Selected module";
   const modeLabel={live:"Live (read-only)",sandbox:"Sandbox (read-only)",compare:"Compare Both"}[selectedEnvironment];
   setNotice((identical?"Existing decisions were preserved. ":"Evidence or scope changed; prior decisions were reset. ")+
    label+" · "+modeLabel+" scan complete. Deployment and database evidence comes from dated read-only snapshots.");
  } catch(e){setError(e?.message||"Unable to run protected Master Scanner.");}
  finally{setRunning(false);}
 }
 function decide(id,review,message="") {
  if(!report?.modules.some(m=>m.id===id)||!REVIEWS.has(review))return;
  if(review==="revise"&&(!message.trim()||message.trim().length>1000)){
   setError("Enter a revised recommendation of 1 to 1,000 characters.");return;
  }
  setReviews(current=>({...current,[id]:{review,note:review==="revise"?message.trim():""}}));
  setError("");setEditing("");setNote("");
 }
 const untouched=report?.summary;
 const selectedLabel=selectedScope==="all"?"Entire ElevationPilot platform":MASTER_SCAN_TARGETS.find(t=>t.id===selectedScope)?.label||"Selected module";
 const reportSelection=report?.scope==="module"?report.selectedModule:"all";
 const reportMatchesSelection=!report||(reportSelection===selectedScope&&report.environmentAudit?.selected===selectedEnvironment);
 return <section className="platform-section-card blm-root" aria-labelledby="blm-heading">
  <div className="blm-head">
   <div>
    <p className="platform-eyebrow">EIG BUILD LAB / MASTER SCANNER</p>
    <h2 id="blm-heading">ElevationPilot Source & Sandbox Audit</h2>
    <p>Inspect reference source evidence alongside actual deployed Live/Sandbox versions and read-only database metadata.</p>
   </div>
   <div className="blm-launch-controls">
    <label htmlFor="blm-scope">What should Build Lab scan?
     <select id="blm-scope" value={selectedScope} onChange={e=>setSelectedScope(e.target.value)} disabled={running}>
      <option value="all">Entire ElevationPilot platform (15 modules)</option>
      {MASTER_SCAN_TARGETS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
     </select>
    </label>
    <label htmlFor="blm-environment">Which environment?
     <select id="blm-environment" value={selectedEnvironment} onChange={e=>setSelectedEnvironment(e.target.value)} disabled={running}>
      <option value="compare">Compare Live + Sandbox</option>
      <option value="live">Live ElevationPilot · read-only</option>
      <option value="sandbox">ElevationPilot Sandbox · read-only</option>
     </select>
    </label>
    <button type="button" className="platform-primary-button" onClick={run} disabled={running}>
     {running?"Scanning approved code…":selectedScope==="all"?"Scan Entire Platform →":"Scan Selected Module →"}
    </button>
   </div>
  </div>
  <p className="blm-disclaimer">Owner-only. Choose an approved module or the entire platform, then select Live, Sandbox or Compare Both. Environment evidence uses actual deployment commit metadata and independent Supabase schema snapshots, not a live connection every time you click. Source/UI/test badges below are from this protected <strong>Build Lab preview code</strong>, not proof of behavior in either deployment. No browser automation or write operations are performed.</p>
  {error&&<p className="platform-error" role="alert">{error}</p>}
  {notice&&<p className="blm-message" role="status">{notice}</p>}
  {saveError&&<p className="platform-error" role="alert">Browser autosave unavailable. Export the report JSON to keep these review decisions.</p>}
  {report&&!reportMatchesSelection&&<p className="blm-message" role="status">Showing the previous {report.environmentAudit?.selected||"unknown"} report for {reportSelection==="all"?"the entire platform":"one module"}. Run <strong>{selectedScope==="all"?"Scan Entire Platform":"Scan Selected Module"}</strong> to inspect {selectedLabel} in the newly selected environment.</p>}
  {report&&<>
   <p className="blm-report-scope">Report scope: <strong>{report?.scope==="module"?report.modules[0]?.title:"Entire ElevationPilot platform"}</strong>{report?.scope==="module"?" (one module from the fixed source catalog)":""}.</p>
   <div className="blm-stats" aria-label="Scanner summary">
    <div><strong>{untouched.modulesReviewed}</strong><span>Modules compared</span></div>
    <div><strong>{untouched.evidencePresent}</strong><span>Evidence observed</span></div>
    <div><strong>{untouched.reviewNeeded}</strong><span>Needs verification</span></div>
    <div><strong>{untouched.notObservedInSample}</strong><span>Not observed in sample</span></div>
   </div>
   {report.improvementAudit&&<section className="blm-upgrade-teaser" aria-label="Proactive product improvement suggestions">
    <div>
      <h3>What should we improve next?</h3>
      <p>The same protected scan also identified <strong>{report.improvementAudit.summary.essential} essential capability checks</strong> and <strong>{report.improvementAudit.summary.wow} standout ideas</strong>.</p>
      <p>These are upgrade candidates, <strong>not confirmed missing features</strong>. Review evidence and create upgrade briefs in <strong>Essentials &amp; Wow Radar</strong> directly below this scanner.</p>
    </div>
    <ul>{report.improvementAudit.suggestions.filter(x=>x.lane==="essential").slice(0,3).map(item=>
      <li key={item.id}><strong>{item.title}</strong><span>{item.priority} · {item.status==="not_observed_in_sample"?"No source signal found":"Preview source signals found; functionality unverified"}</span></li>
    )}</ul>
   </section>}
   <BuildLabEnvironmentPanel audit={report.environmentAudit} />
   <div className="blm-toolbar">
    <label>Search modules
     <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
      placeholder="Search UI, payments, teams, source…" aria-label="Search Master Scanner modules" />
    </label>
    <div className="blm-toolbar-end">
     <small>Showing {rows.length} of {report.modules.length} modules</small>
     <button type="button" className="platform-secondary-button" onClick={()=>downloadJson({report,reviews},"eig-build-lab-master-scan.json")}>Export JSON</button>
    </div>
   </div>
   <div className="blm-table-wrap"><table className="blm-table">
    <thead><tr>{COLS.map(col=><th key={col.key} scope="col" aria-sort={sort.key===col.key?(sort.direction==="asc"?"ascending":"descending"):"none"}>
     <button type="button" onClick={()=>setOrder(col.key)} title={"Sort by "+col.name}>{col.name} {sort.key===col.key?(sort.direction==="asc"?"↑":"↓"):"↕"}</button>
    </th>)}</tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}>
     <td className="blm-module-name"><details>
      <summary>{row.title}</summary>
      <div className="blm-module-details">
       <p><strong>Next verification:</strong> {row.nextCheck}</p>
       <p><strong>Database fields checked:</strong> {row.tables.length?row.tables.map(x=>x.table+" ("+(x.production&&x.sandbox?"both snapshots":"snapshot gap")+")").join(", "):"Not applicable"}</p>
       <p><strong>Build Lab preview source and test references only:</strong></p>
       {row.evidence.length?<ul>{row.evidence.map((ev,i)=><li key={ev.path+ev.kind+i}>
        <code>{ev.path}:{ev.line}</code> ({ev.kind}) <span>{ev.excerpt}</span>
       </li>)}</ul>:<p>No matching evidence in approved source sample. This does not prove the feature is absent.</p>}
       <div className="blm-reviews">
        <span>Review: <strong>{reviews[row.id]?.review||"pending"}</strong></span>
        <button type="button" onClick={()=>decide(row.id,"accept")}>Accept for follow-up</button>
        <button type="button" onClick={()=>{setEditing(row.id);setNote(reviews[row.id]?.note||row.nextCheck);}}>Revise</button>
        <button type="button" onClick={()=>decide(row.id,"reject")}>Dismiss</button>
       </div>
       {reviews[row.id]?.review==="revise"&&<p>Saved revision: {reviews[row.id].note}</p>}
       {editing===row.id&&<div className="blm-revision">
        <label>Revised next step<textarea rows={3} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} /></label>
        <button type="button" onClick={()=>decide(row.id,"revise",note)}>Save revision</button>
        <button type="button" onClick={()=>setEditing("")}>Cancel</button>
       </div>}
      </div>
     </details></td>
     <td>{row.priority}</td>
     <td><StatePill value={row.status}/></td>
     <td><StatePill value={row.sourceStatus}/></td>
     <td><StatePill value={row.uiStatus}/></td>
     <td><StatePill value={row.testStatus}/></td>
     <td><StatePill value={row.dbStatus}/></td>
    </tr>)}
    {!rows.length&&<tr><td colSpan={7}>No modules match this search.</td></tr>}</tbody>
   </table></div>
   <p className="blm-footnote">Fingerprint: <code>{report.sourceFingerprint.slice(0,12)}</code> ·
    Source inspected: {new Date(report.inspectedAt).toLocaleString()} · {report.files.length} approved source/test files.
    Findings and decisions save only in this browser and on this preview origin.</p>
   <ul className="blm-limitations">{report.limitations.map((line,i)=><li key={i}>{line}</li>)}</ul>
  </>}
 </section>;
}

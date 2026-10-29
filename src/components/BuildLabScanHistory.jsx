import React,{useEffect,useRef,useState} from "react";
import {createBuildLabEvidencePackage} from "../lib/buildLabEvidencePackage.mjs";
import BuildLabCloudBackup from "./BuildLabCloudBackup.jsx";
const CLOUD_BACKUP_UI_ENABLED=import.meta.env.VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED==="true";
import {inspectBuildLabEvidencePackage,restoreBuildLabEvidencePackage} from "../lib/buildLabEvidenceRecovery.mjs";
import {WORK_EVENT} from "../lib/buildLabWorkBuckets.mjs";
import {HISTORY_EVENT,SCAN_TYPES,readScanHistory} from "../lib/buildLabScanHistory.mjs";
import {MASTER_SCAN_TARGETS} from "../lib/eigMasterScanTargets.mjs";
const scopeLabel=id=>id==="all"?"Entire platform":MASTER_SCAN_TARGETS.find(x=>x.id===id)?.label||id;
export default function BuildLabScanHistory({ownerUserId,supabaseClient}) {
 const [entries,setEntries]=useState([]),[error,setError]=useState("");
 const restoreInput=useRef(null);
 const [query,setQuery]=useState(""),[type,setType]=useState("all"),[sort,setSort]=useState({key:"savedAt",direction:"desc"});
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  function load(){try{setEntries(readScanHistory(window.localStorage,ownerUserId));setError("");}catch{setEntries([]);setError("Saved scan history could not be read. Existing browser data has been left in place.");}}
  load();window.addEventListener(HISTORY_EVENT,load);window.addEventListener("storage",load);
  return ()=>{window.removeEventListener(HISTORY_EVENT,load);window.removeEventListener("storage",load);};
 },[ownerUserId]);
 function order(key){setSort(s=>({key,direction:s.key===key&&s.direction==="asc"?"desc":"asc"}));}
 async function sharePackage(){try{const pkg=createBuildLabEvidencePackage(window.localStorage,ownerUserId);const payload=JSON.stringify(pkg,null,2);const file=new File([payload],"eig-build-lab-evidence-"+pkg.generatedAt.slice(0,10)+".json",{type:"application/json"});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:"EIG Build Lab Evidence",files:[file]});setError("");return;}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(payload);setError("");setNotice("Evidence JSON copied to clipboard. Paste into your intended secure destination. Check for sensitive content first.");return;}setError("Direct share is unavailable in this browser. Use Download instead.");}catch(e){if(e?.name!=="AbortError")setError("Could not share evidence. Saved records were not modified.");}}
 function exportPackage(){try{const pkg=createBuildLabEvidencePackage(window.localStorage,ownerUserId);const url=URL.createObjectURL(new Blob([JSON.stringify(pkg,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="eig-build-lab-evidence-"+pkg.generatedAt.slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setError("");}catch{setError("Evidence package unavailable. Existing records have not been modified.");}}
 async function restorePackage(event){
  const file=event.target.files?.[0];if(event.target)event.target.value="";
  if(!file)return;
  try{
   if(file.size>5000000)throw Error("Choose an evidence JSON file smaller than 5 MB.");
   const raw=await file.text();
   const inspection=inspectBuildLabEvidencePackage(ownerUserId,raw);
   const summary=inspection.summary;
   const accepted=window.confirm("Restore owner-local Build Lab evidence from "+new Date(summary.generatedAt).toLocaleString()+"?\\n\\nScans: "+summary.scans+"; work items: "+summary.workItems+"; approved/draft batches: "+summary.batches+"; Manager blueprint: "+(summary.manager?"yes":"no")+".\\n\\nThis REPLACES saved scan history, Work Buckets and Manager plan in THIS browser. Download your current evidence package FIRST if you want to retain it. It cannot be undone. No agents run and no production data is changed.");
   if(!accepted){setNotice("Restore cancelled. Existing records were not changed.");setError("");return;}
   restoreBuildLabEvidencePackage(window.localStorage,ownerUserId,raw,{allowReplace:true});
   window.dispatchEvent(new Event(HISTORY_EVENT));
   window.dispatchEvent(new Event(WORK_EVENT));
   window.dispatchEvent(new Event("storage"));
   setError("");
   setNotice("Evidence restored and verified in this browser: "+summary.scans+" scans, "+summary.workItems+" work items, "+summary.batches+" batches. Manager blueprint: "+(summary.manager?"restored":"none")+". This did not authorize execution or deployment.");
  }catch(e){setNotice("");setError(e?.message||"Evidence recovery failed. Existing records were not intentionally replaced.");}
 }
 function exportEntry(row){const url=URL.createObjectURL(new Blob([JSON.stringify(row,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="build-lab-"+row.type+"-"+row.savedAt.replace(/[:.]/g,"-")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const needle=query.trim().toLowerCase();
 const visible=entries.filter(x=>(type==="all"||x.type===type)&&(!needle||[SCAN_TYPES[x.type],scopeLabel(x.scope),x.source,x.savedAt,JSON.stringify(x.snapshot)].join(" ").toLowerCase().includes(needle)));
 return <section className="platform-section-card bl-history" aria-labelledby="bl-history-title">
  <h2 id="bl-history-title">Scan History</h2>
  <p>Completed scans grouped by scan type. Saved in this browser on this preview address; other devices and preview addresses have separate history. Keeps up to 20 scans per type within the browser history size limit; oldest scans are removed first. Download JSON to keep a permanent copy.</p>
  <p><button type="button" className="platform-primary-button" onClick={exportPackage}>Download Full Scanner Evidence Package (JSON)</button> <button type="button" className="platform-secondary-button" onClick={sharePackage}>Share Evidence Package</button> Share uses your device sharing options when available or copies evidence JSON to the clipboard; no cloud link is created. Includes saved scans, complete evidence, review choices, Work Buckets, the current Manager blueprint, and a readable README. Review contents before sharing. No live data is retrieved.</p>
  <p><button type="button" className="platform-secondary-button" onClick={()=>restoreInput.current?.click()}>Restore Saved Evidence (JSON)</button> <input ref={restoreInput} type="file" accept=".json,application/json" aria-label="Select owner evidence backup" onChange={restorePackage} style={{display:"none"}} /> Restore a v2 evidence backup from the same owner account. The app validates the file and asks before replacing local scan history, Work Buckets and Manager blueprint. Download the current package first. This is local recovery, not automatic cloud backup.</p>
  {CLOUD_BACKUP_UI_ENABLED&&<BuildLabCloudBackup ownerUserId={ownerUserId} supabaseClient={supabaseClient} />}
  <p>Existing saved scanner results are added when Build Lab opens. Earlier overwritten results and AI responses lost before this update cannot be recovered. Opening history never runs a scan or calls AI.</p>
  {error&&<p role="alert" className="platform-error">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  <div className="bl-scan-controls"><label>Search scan history<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Module, recommendation, source version…" /></label>
  <label>Scan type<select value={type} onChange={e=>setType(e.target.value)}><option value="all">All scan types</option>{Object.entries(SCAN_TYPES).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>
  <p role="status">Showing {visible.length} of {entries.length} saved scans.</p>
  {Object.entries(SCAN_TYPES).filter(([id])=>type==="all"||type===id).map(([id,name])=>{
   const rows=visible.filter(x=>x.type===id).sort((a,b)=>{const left=sort.key==="scope"?scopeLabel(a.scope):a[sort.key],right=sort.key==="scope"?scopeLabel(b.scope):b[sort.key];const cmp=sort.key==="savedAt"?Date.parse(left)-Date.parse(right):String(left).localeCompare(String(right));return cmp*(sort.direction==="asc"?1:-1);});
   return <section key={id} aria-label={name+" history"}><h3>{name} ({rows.length})</h3>{!rows.length?<p>No saved scans match.</p>:<div className="bl-history-table"><table><thead><tr>{[["savedAt","Date"],["scope","Module"],["source","Source version"]].map(([key,label])=><th key={key} aria-sort={sort.key===key?(sort.direction==="asc"?"ascending":"descending"):"none"}><button type="button" onClick={()=>order(key)}>{label}{sort.key===key?(sort.direction==="asc"?" ↑":" ↓"):""}</button></th>)}<th>Results</th></tr></thead><tbody>{rows.map(row=>{
    const s=row.snapshot,report=s.review||s.report||s.audit||s;
    const candidate=report.recommendations||report.findings||report.suggestions||report.modules;
    const items=Array.isArray(candidate)?candidate.filter(x=>x&&typeof x==="object"):[];
    return <tr key={row.id}><td>{new Date(row.savedAt).toLocaleString()}</td><td>{scopeLabel(row.scope)}</td><td><code>{row.source.slice(0,12)}</code></td><td><details><summary>View saved scan ({items.length} items)</summary>{report.summary&&typeof report.summary==="string"&&<p>{report.summary}</p>}{items.map((item,i)=><article key={item.id||i}><h4>{item.title||item.path||item.category}</h4><p>{item.nextAction||item.recommendation||item.proposal||item.nextCheck||item.reason}</p>{(s.reviews?.[item.id]||s.choices?.[item.id])&&<p>Saved decision: {JSON.stringify(s.reviews?.[item.id]||s.choices?.[item.id])}</p>}</article>)}<details><summary>Full saved evidence and decisions</summary><pre>{JSON.stringify(s,null,2)}</pre></details><button type="button" className="platform-secondary-button" onClick={()=>exportEntry(row)}>Download saved scan JSON</button></details></td></tr>;
   })}</tbody></table></div>}</section>;
  })}
 </section>;
}

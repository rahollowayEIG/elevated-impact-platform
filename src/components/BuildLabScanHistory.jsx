import React,{useEffect,useState} from "react";
import {HISTORY_EVENT,SCAN_TYPES,readScanHistory} from "../lib/buildLabScanHistory.mjs";
import {MASTER_SCAN_TARGETS} from "../lib/eigMasterScanTargets.mjs";
const scopeLabel=id=>id==="all"?"Entire platform":MASTER_SCAN_TARGETS.find(x=>x.id===id)?.label||id;
export default function BuildLabScanHistory({ownerUserId}) {
 const [entries,setEntries]=useState([]),[error,setError]=useState("");
 const [query,setQuery]=useState(""),[type,setType]=useState("all"),[sort,setSort]=useState({key:"savedAt",direction:"desc"});
 useEffect(()=>{
  function load(){try{setEntries(readScanHistory(window.localStorage,ownerUserId));setError("");}catch{setEntries([]);setError("Saved scan history could not be read. Existing browser data has been left in place.");}}
  load();window.addEventListener(HISTORY_EVENT,load);window.addEventListener("storage",load);
  return ()=>{window.removeEventListener(HISTORY_EVENT,load);window.removeEventListener("storage",load);};
 },[ownerUserId]);
 function order(key){setSort(s=>({key,direction:s.key===key&&s.direction==="asc"?"desc":"asc"}));}
 function exportEntry(row){const url=URL.createObjectURL(new Blob([JSON.stringify(row,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="build-lab-"+row.type+"-"+row.savedAt.replace(/[:.]/g,"-")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const needle=query.trim().toLowerCase();
 const visible=entries.filter(x=>(type==="all"||x.type===type)&&(!needle||[SCAN_TYPES[x.type],scopeLabel(x.scope),x.source,x.savedAt,JSON.stringify(x.snapshot)].join(" ").toLowerCase().includes(needle)));
 return <section className="platform-section-card bl-history" aria-labelledby="bl-history-title">
  <h2 id="bl-history-title">Scan History</h2>
  <p>Completed scans grouped by scan type. Saved in this browser on this preview address; other devices and preview addresses have separate history. Keeps up to 20 scans per type within the browser history size limit; oldest scans are removed first. Download JSON to keep a permanent copy.</p>
  <p>Existing saved scanner results are added when Build Lab opens. Earlier overwritten results and AI responses lost before this update cannot be recovered. Opening history never runs a scan or calls AI.</p>
  {error&&<p role="alert" className="platform-error">{error}</p>}
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

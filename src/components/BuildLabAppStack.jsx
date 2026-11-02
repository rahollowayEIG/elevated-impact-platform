import React,{useEffect,useMemo,useState} from 'react';
import {HISTORY_EVENT,readScanHistory} from '../lib/buildLabScanHistory.mjs';
import {WORK_EVENT,readWorkLedger,collectScanWork,saveWorkLedger} from '../lib/buildLabWorkBuckets.mjs';
import {buildAppStack,APP_STACK_CATALOG} from '../lib/buildLabAppStack.mjs';
import './build-lab-app-stack.css';

const stamp=value=>value?new Date(value).toLocaleString():'No saved Master Scan';
function Meter({title,value,reason}){
 const measured=Number.isFinite(value)&&value>=0&&value<=100;
 return <div className={'bl-stack-meter'+(measured?'':' unmeasured')}>
  <div className="bl-stack-meter-heading"><strong>{title}</strong><strong>{measured?Math.round(value)+'%':'Not measured'}</strong></div>
  <div className="bl-stack-track" role={measured?'progressbar':undefined}
   aria-label={measured?title+' completion':undefined} aria-valuemin={measured?0:undefined}
   aria-valuemax={measured?100:undefined} aria-valuenow={measured?value:undefined}>
   {measured&&<span style={{width:value+'%'}} />}
  </div>
  {!measured&&<small>{reason}</small>}
 </div>;
}
function Signal({title,signal}){
 const value=signal?.percent;
 return <div className="bl-stack-signal">
  <div><strong>{title}</strong><span>{signal?signal.observed+' of '+signal.expected:'Not scanned'}</span></div>
  {signal?.expected>0?<div className="bl-stack-track" role="progressbar"
   aria-label={title+' observed marker coverage'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
   <span style={{width:value+'%'}} />
  </div>:<small>{signal?.expected===0?'No checks specified in this scanner sample.':'No source sample saved.'}</small>}
 </div>;
}
export default function BuildLabAppStack({ownerUserId,onScan,onReview,onHangars}){
 const [history,setHistory]=useState([]);
 const [ledger,setLedger]=useState(null);
 const [error,setError]=useState('');
 const [group,setGroup]=useState('All');
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState('attention');
 const [expanded,setExpanded]=useState({});
 useEffect(()=>{
  function refresh(){
   try{
    const entries=readScanHistory(localStorage,ownerUserId);
    const prior=readWorkLedger(localStorage,ownerUserId);
    const next=collectScanWork(prior,entries);
    if(JSON.stringify(prior)!==JSON.stringify(next))saveWorkLedger(localStorage,ownerUserId,next);
    setHistory(entries);setLedger(next);setError('');
   }
   catch{setError('One or more saved evidence records could not be loaded. Nothing was erased.');}
  }
  refresh();
  window.addEventListener(HISTORY_EVENT,refresh);window.addEventListener(WORK_EVENT,refresh);
  window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener(HISTORY_EVENT,refresh);window.removeEventListener(WORK_EVENT,refresh);
   window.removeEventListener('storage',refresh);};
 },[ownerUserId]);
 const data=useMemo(()=>buildAppStack({history,ledger}),[history,ledger]);
 const groups=['All',...new Set(APP_STACK_CATALOG.map(a=>a.group))];
 const cards=data.cards.filter(card=>(group==='All'||card.group===group)&&
  (!search.trim()||(card.name+' '+card.id+' '+card.group).toLowerCase().includes(search.toLowerCase().trim())))
  .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='group'?
   a.group.localeCompare(b.group)||a.name.localeCompare(b.name):
   b.unresolved-a.unresolved||Number(a.scanned)-Number(b.scanned)||a.name.localeCompare(b.name));
 return <section className="platform-section-card bl-app-stack" aria-label="Build Lab app stack and completion gauges">
  <p className="platform-eyebrow">BUILD LAB / APP STACK</p>
  <h2>App Stack &amp; Build Meters</h2>
  <p>One place to see what has been scanned, where review is needed, and what's ready for planning. Built, Verified, Integration and Overall gauges stay <strong>Not measured</strong> until we have an approved scope, required app connections and real passing test evidence. An app may be ready on its own while its platform integrations remain unfinished. Code markers alone cannot produce an honest completion score.</p>
  {error&&<p role="alert" className="platform-error">{error}</p>}
  <div className="bl-stack-summary" aria-label="App Stack overview">
   <div><strong>{data.summary.tracked}</strong><span>Tracked app areas</span></div>
   <div><strong>{data.summary.scanned}</strong><span>With saved source scans</span></div>
   <div><strong>{data.summary.needingVerification}</strong><span>Need verification</span></div>
   <div><strong>{data.summary.open}</strong><span>Open work findings</span></div>
   <div><strong>{data.summary.planned}</strong><span>Items with current approved plans</span></div>
  </div>
  <p className="bl-stack-small">Last Master Scan: {stamp(data.lastScan)} {data.reportVersion?'· source '+data.reportVersion.slice(0,12):'· no scan saved in this browser'}. Counts come from the current owner's local browser records, not a live production database audit.</p>
  <div className="bl-stack-actions">
   <label>Find an app<input type="search" placeholder="Search app name…" value={search} onChange={e=>setSearch(e.target.value)} /></label>
   <label>App group<select aria-label="App group" value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g}>{g}</option>)}</select></label>
   <label>Sort<select aria-label="Sort app stack" value={sort} onChange={e=>setSort(e.target.value)}>
    <option value="attention">Needs attention first</option><option value="name">App name</option><option value="group">App group</option>
   </select></label>
   <button type="button" className="platform-primary-button" onClick={onScan}>Continue to Scan</button>
   <button type="button" className="platform-secondary-button" onClick={onHangars}>View Hangar Connections</button>
  </div>
  <div className="bl-stack-cards">
   {cards.map(card=><article key={card.id} className="bl-stack-card" aria-label={card.name+' completion overview'}>
    <div className="bl-stack-card-head">
     <div><p className="platform-eyebrow">{card.group}</p><h3>{card.name}</h3></div>
     <span className="bl-stack-stage">{card.stage}</span>
    </div>
    <div className="bl-stack-meters">
     <Meter title="Built %" value={card.build} reason="Awaiting approved feature scope and implementation evidence." />
     <Meter title="Verified %" value={card.verified} reason="Awaiting passing, exact-version feature tests." />
     <Meter title="Integration %" value={card.integration} reason="Awaiting approved app-to-app connections and passing integration tests." />
     <Meter title="Overall %" value={card.overall} reason="Awaiting measured build, verification and integration progress." />
    </div>
    <details className="bl-stack-signals">
     <summary>See available scan evidence</summary>
     <p className="bl-stack-small">The percentages below describe <strong>markers observed in sampled source and test scripts</strong>, not completed or passing functionality.</p>
     <Signal title="Source &amp; UI markers" signal={card.sourceSignal} />
     <Signal title="Test-script markers" signal={card.testMarkers} />
     <p><strong>Scan scope:</strong> {card.scannerScope}</p>
     <p><strong>Last scanned:</strong> {stamp(card.lastScan)}</p>
     <p><strong>Source:</strong> {card.scanCommit?card.scanCommit.slice(0,12):'Not available'}</p>
     <p><strong>Evidence:</strong> {card.evidence.length} source reference(s) in this scan. Inspect the Master Scanner report for full details.</p>
    </details>
    <dl className="bl-stack-metrics">
     <div><dt>Open findings</dt><dd>{card.open}</dd></div>
     <div><dt>On hold</dt><dd>{card.hold}</dd></div>
     <div><dt>Plans prepared</dt><dd>{card.planned}</dd></div>
     <div><dt>Fixes running</dt><dd>Not tracked</dd></div>
     <div><dt>Standalone readiness</dt><dd>{card.standaloneReadiness}</dd></div>
     <div><dt>Ecosystem readiness</dt><dd>{card.ecosystemReadiness}</dd></div>
     <div><dt>Launch readiness</dt><dd>{card.readiness}</dd></div>
    </dl>
    <details className="bl-stack-signals">
     <summary>App integrations to review ({card.integrationCandidates.length} candidates)</summary>
     <p className="bl-stack-small">These are proposed app-to-app connections from our architecture, not verified live links or approved launch requirements. The owner must confirm which are required for this app's current release.</p>
     {card.integrationCandidates.length?<ul>{card.integrationCandidates.map(link=><li key={link.id}><strong>{link.name}</strong> · {link.state}</li>)}</ul>:
      <p>No candidate integrations recorded yet. This does not prove integration is complete.</p>}
     <p><strong>Integration %:</strong> {card.integrationReason}</p>
    </details>
    <p className="bl-stack-small"><strong>Current activity:</strong> {card.activity}</p>
    <p className="bl-stack-next"><strong>Next step:</strong> {card.nextAction}</p>
    {card.unresolved>0&&<p className="bl-stack-small"><strong>Open review:</strong> {card.unresolved} finding(s) awaiting a decision or test.</p>}
    <div className="bl-stack-card-actions">
     <button type="button" className="platform-secondary-button" onClick={()=>onReview(card.id)}>Review this app</button>
     <button type="button" className="platform-secondary-button" onClick={()=>setExpanded(s=>({...s,[card.id]:!s[card.id]}))} aria-expanded={!!expanded[card.id]}>{expanded[card.id]?'Hide details':'What do the gauges mean?'}</button>
    </div>
    {expanded[card.id]&&<p className="bl-stack-small" role="note"><strong>Built %</strong> compares completed approved requirements with the current release scope. <strong>Verified %</strong> counts only requirements backed by passing tests. <strong>Integration %</strong> compares required, owner-approved app connections with verified end-to-end connections. <strong>Overall %</strong> is not calculated until those three measurements have an agreed weighting. <strong>Standalone readiness</strong> and <strong>Ecosystem readiness</strong> are separate. Adding requirements can lower a percentage without undoing earlier work. Repair activity has its own progress once a verified workflow records actual implementation steps. {card.note}</p>}
   </article>)}
  </div>
  {!cards.length&&<p>No apps match this filter. Clear the search to see the full stack.</p>}
  <p className="bl-stack-small">Launch Runway rule: an app can be standalone-ready and still need ecosystem integration. No app is marked launch-ready from AI suggestions, source-file matches, proposed integrations, planned batches, or test-script presence alone. Verified milestones, blockers, regression results and a release decision must be recorded first.</p>
 </section>;
}

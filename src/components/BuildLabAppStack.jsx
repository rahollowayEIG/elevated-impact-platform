import React,{useEffect,useMemo,useState} from 'react';
import {HISTORY_EVENT,readScanHistory} from '../lib/buildLabScanHistory.mjs';
import {WORK_EVENT,readWorkLedger,collectScanWork,saveWorkLedger} from '../lib/buildLabWorkBuckets.mjs';
import {buildAppStack} from '../lib/buildLabAppStack.mjs';
import {buildApplicationHierarchy} from '../lib/buildLabAppHierarchy.mjs';
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
const meters=[
 {key:'build',label:'Built %',reason:'Approved feature requirements and implementation evidence have not been measured.'},
 {key:'verified',label:'Verified %',reason:'Passing, exact-version test receipts have not been linked to all required components.'},
 {key:'integration',label:'Integration %',reason:'Required cross-app connections and passing integration tests have not been approved.'},
 {key:'overall',label:'Overall %',reason:'The approved scope and weighted component progress are not yet measured.'}
];
function FourMeters({data,parent=false}){
 return <div className="bl-stack-meters" aria-label={parent?'Whole-app completion gauges':'Component completion gauges'}>
  {meters.map(m=><Meter key={m.key} title={m.label} value={data[m.key]} reason={parent?m.reason:
   m.key==='build'?'Awaiting approved feature scope and implementation evidence.':
   m.key==='verified'?'Awaiting passing, exact-version feature tests.':
   m.key==='integration'?'Awaiting approved app-to-app connections and passing integration tests.':
   'Awaiting measured build, verification and integration progress.'}/>)}
 </div>;
}
function AppPartCard({card,onReview}){
 const [expanded,setExpanded]=useState(false);
 return <article className="bl-stack-card" aria-label={card.name+' component overview'}>
  <div className="bl-stack-card-head">
   <div><p className="platform-eyebrow">{card.group} · COMPONENT</p><h3>{card.name}</h3></div>
   <span className="bl-stack-stage">{card.stage}</span>
  </div>
  <FourMeters data={card}/>
  <details className="bl-stack-signals">
   <summary>See available scan evidence</summary>
   <p className="bl-stack-small">The percentages below describe <strong>markers observed in sampled source and test scripts</strong>, not completed or passing functionality.</p>
   <Signal title="Source &amp; UI markers" signal={card.sourceSignal}/>
   <Signal title="Test-script markers" signal={card.testMarkers}/>
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
   <p className="bl-stack-small">These are proposed app-to-app connections, not verified live links or approved launch requirements.</p>
   {card.integrationCandidates.length?<ul>{card.integrationCandidates.map(link=><li key={link.id}><strong>{link.name}</strong> · {link.state}</li>)}</ul>:
    <p>No candidate integrations recorded yet. This does not prove integration is complete.</p>}
   <p><strong>Integration %:</strong> {card.integrationReason}</p>
  </details>
  <p className="bl-stack-small"><strong>Current activity:</strong> {card.activity}</p>
  <p className="bl-stack-next"><strong>Next step:</strong> {card.nextAction}</p>
  {card.unresolved>0&&<p className="bl-stack-small"><strong>Open review:</strong> {card.unresolved} finding(s) awaiting a decision or test.</p>}
  <div className="bl-stack-card-actions">
   <button type="button" className="platform-primary-button" onClick={()=>onReview(card.id)}>Review this component</button>
   <button type="button" className="platform-secondary-button" onClick={()=>setExpanded(s=>!s)}
    aria-expanded={expanded}>{expanded?'Hide details':'What do the gauges mean?'}</button>
  </div>
  {expanded&&<p className="bl-stack-small" role="note"><strong>Built %</strong> compares completed approved requirements with release scope. <strong>Verified %</strong> counts requirements backed by passing tests. <strong>Integration %</strong> counts independently tested required app connections. <strong>Overall %</strong> needs an approved weighting and complete evidence. <strong>Standalone readiness</strong> and <strong>Ecosystem readiness</strong> are separate. Adding approved requirements can lower a percentage. {card.note}</p>}
 </article>;
}
function FamilyCard({app,onOpen}){
 return <article className="bl-stack-card bl-app-family" aria-label={app.name+' application overview'}>
  <div className="bl-stack-card-head">
   <div><p className="platform-eyebrow">{app.group} · APPLICATION</p><h3>{app.name}</h3></div>
   <span className="bl-stack-stage">{app.stage}</span>
  </div>
  <p className="bl-stack-small">{app.description}</p>
  <FourMeters data={app} parent/>
  <dl className="bl-stack-metrics">
   <div><dt>App components</dt><dd>{app.componentCount}</dd></div>
   <div><dt>With scan evidence</dt><dd>{app.scannedCount}</dd></div>
   <div><dt>Open findings</dt><dd>{app.open}</dd></div>
   <div><dt>On hold</dt><dd>{app.hold}</dd></div>
   <div><dt>Plans prepared</dt><dd>{app.planned}</dd></div>
   <div><dt>More scope to map</dt><dd>{app.coverageToScope}</dd></div>
  </dl>
  <p className="bl-stack-small"><strong>Inside:</strong> {app.parts.map(p=>p.name).join(' · ')}</p>
  <div className="bl-stack-card-actions">
   <button type="button" className="platform-primary-button" onClick={()=>onOpen(app.id)}
    aria-label={'Open '+app.shortName+' components'}>Open {app.shortName} components</button>
  </div>
 </article>;
}
export default function BuildLabAppStack({ownerUserId,onScan,onReview,onHangars}){
 const [history,setHistory]=useState([]);
 const [ledger,setLedger]=useState(null);
 const [error,setError]=useState('');
 const [group,setGroup]=useState('All');
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState('attention');
 const [appId,setAppId]=useState(null);
 useEffect(()=>{
  function refresh(){
   try{
    const entries=readScanHistory(localStorage,ownerUserId);
    const prior=readWorkLedger(localStorage,ownerUserId);
    const next=collectScanWork(prior,entries);
    if(JSON.stringify(prior)!==JSON.stringify(next))saveWorkLedger(localStorage,ownerUserId,next);
    setHistory(entries);setLedger(next);setError('');
   }catch{setError('One or more saved evidence records could not be loaded. Nothing was erased.');}
  }
  refresh();
  window.addEventListener(HISTORY_EVENT,refresh);window.addEventListener(WORK_EVENT,refresh);
  window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener(HISTORY_EVENT,refresh);window.removeEventListener(WORK_EVENT,refresh);
   window.removeEventListener('storage',refresh);};
 },[ownerUserId]);
 const data=useMemo(()=>buildAppStack({history,ledger}),[history,ledger]);
 const hierarchy=useMemo(()=>buildApplicationHierarchy(data.cards),[data]);
 const current=hierarchy.families.find(a=>a.id===appId)||null;
 const groups=['All',...new Set(hierarchy.families.map(a=>a.group))];
 const families=hierarchy.families.filter(a=>
  (group==='All'||a.group===group)&&(!search.trim()||
   (a.name+' '+a.description+' '+a.parts.map(p=>p.name).join(' ')).toLowerCase().includes(search.toLowerCase().trim())))
  .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):
   sort==='group'?a.group.localeCompare(b.group)||a.name.localeCompare(b.name):
   b.open-a.open||b.needsReview-a.needsReview||a.name.localeCompare(b.name));
 return <section className="platform-section-card bl-app-stack" aria-label="Build Lab application stack and completion gauges">
  <p className="platform-eyebrow">BUILD LAB / APP STACK</p>
  {!current?<><h2>Applications &amp; Build Meters</h2>
   <p>Start with each complete application, then open it to review the parts it contains. Built, Verified, Integration and Overall gauges remain <strong>Not measured</strong> until approved requirements and passing tests support real progress figures.</p>
  </>:<>
   <nav className="bl-stack-breadcrumb" aria-label="App Stack location">
    <button type="button" className="platform-secondary-button" onClick={()=>setAppId(null)}>All applications</button>
    <span aria-hidden="true">›</span><strong>{current.shortName}</strong>
   </nav>
   <h2>{current.name}</h2>
   <p>{current.description} This is the whole app. Its parts appear below, each with its own evidence and scanner findings.</p>
  </>}
  {error&&<p role="alert" className="platform-error">{error}</p>}
  {!current?<div className="bl-stack-summary" aria-label="Application Stack overview">
   <div><strong>{hierarchy.summary.applications}</strong><span>Main applications</span></div>
   <div><strong>{hierarchy.summary.components}</strong><span>Tracked components</span></div>
   <div><strong>{hierarchy.summary.scannedComponents}</strong><span>With saved source scans</span></div>
   <div><strong>{hierarchy.summary.open}</strong><span>Open work findings</span></div>
   <div><strong>{hierarchy.summary.planned}</strong><span>Items with current plans</span></div>
  </div>:<div className="bl-stack-summary" aria-label={current.shortName+' component summary'}>
   <div><strong>{current.componentCount}</strong><span>Tracked app components</span></div>
   <div><strong>{current.scannedCount}</strong><span>With saved scans</span></div>
   <div><strong>{current.open}</strong><span>Open findings</span></div>
   <div><strong>{current.hold}</strong><span>On hold</span></div>
   <div><strong>{current.planned}</strong><span>Plans prepared</span></div>
  </div>}
  <p className="bl-stack-small">Last Master Scan: {stamp(data.lastScan)} {data.reportVersion?'· source '+data.reportVersion.slice(0,12):'· no scan saved in this browser'}. Reports come from this owner's local browser records, not a live customer-data audit.</p>
  {!current?<div className="bl-stack-actions">
   <label>Find an application<input type="search" placeholder="Search apps or parts…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label>Application group<select aria-label="Application group" value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g}>{g}</option>)}</select></label>
   <label>Sort<select aria-label="Sort apps" value={sort} onChange={e=>setSort(e.target.value)}>
    <option value="attention">Needs attention first</option>
    <option value="name">Application name</option>
    <option value="group">Application group</option>
   </select></label>
   <button type="button" className="platform-secondary-button" onClick={onScan}>Continue to Scan</button>
   <button type="button" className="platform-secondary-button" onClick={onHangars}>View Hangar Connections</button>
  </div>:<div className="bl-stack-actions">
   <button type="button" className="platform-secondary-button" onClick={()=>setAppId(null)}>Back to all applications</button>
   <button type="button" className="platform-secondary-button" onClick={onScan}>Continue to Scan</button>
  </div>}
  {current?<div className="bl-app-family-detail">
   <section className="bl-app-family-overview" aria-label={current.shortName+' whole-app completion'}>
    <h3>{current.shortName} | Whole-app completion</h3>
    <FourMeters data={current} parent/>
    <p className="bl-stack-small">The whole-app meters will roll up the approved requirements and passing tests of its constituent parts. Matched source code alone cannot confirm completion. No percentages are invented.</p>
   </section>
   <h3>Parts of {current.shortName} ({current.parts.length})</h3>
   <div className="bl-stack-cards">
    {current.parts.map(part=><AppPartCard key={part.id} card={part} onReview={onReview}/>)}
   </div>
   {current.coverageCandidates.length>0&&<section className="bl-stack-future-scope" aria-label="Additional application parts to review">
    <h3>Additional parts to map into scanner coverage</h3>
    <p className="bl-stack-small">These known or planned work areas do not yet have their own entry in the current Master Scanner. Their presence here does not establish whether they are built, missing, approved or tested.</p>
    <ul>{current.scopeEntries.map(part=><li key={part.id}>
     <strong>{part.name}</strong>
     <span> · {part.scannerStatus}</span>
     {part.sourceHints.length>0&&<small className="bl-scope-source-hint">Source locations to inspect: {part.sourceHints.join(' · ')}</small>}
    </li>)}</ul>
   </section>}
  </div>:<>
   <div className="bl-stack-cards" aria-label="Main applications">
    {families.map(app=><FamilyCard key={app.id} app={app} onOpen={setAppId}/>)}
   </div>
   {!families.length&&<p>No applications match your filter. Clear the search to see the full stack.</p>}
  </>}
  <p className="bl-stack-small">Launch Runway rule: app and component completion cannot be inferred from AI suggestions, source matches, proposed integrations or unverified test scripts. Each app can be usable on its own while integration work remains.</p>
 </section>;
}

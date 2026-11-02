/**
 * Owner-only Build Lab App Stack.
 * App completion is intentionally UNMEASURED until an approved feature-scope
 * baseline and independent passing test receipts exist. Source markers,
 * saved recommendations and plan approvals must never become "Built %" or
 * "Verified %" through inference.
 */
export const APP_STACK_CATALOG=Object.freeze([
 {id:'event-builder',name:'Event Builder',group:'Events'},
 {id:'registration',name:'Registration & Main Cabin',group:'Events'},
 {id:'payments',name:'Team Payments',group:'Events'},
 {id:'roster',name:'Roster & Team Maintenance',group:'Events'},
 {id:'accounts',name:'Accounts & Permissions',group:'Platform'},
 {id:'squawk',name:'Squawk Box Communications',group:'Platform'},
 {id:'sponsors',name:'Sponsor Management',group:'Events'},
 {id:'event-packet',name:'Creative Event Packets',group:'Events'},
 {id:'event-budget',name:'Event Budget',group:'Events'},
 {id:'inception',name:'InceptionApex Creative Studio',group:'Creative & Marketing'},
 {id:'social',name:'Social Media & Ads',group:'Creative & Marketing'},
 {id:'build-lab',name:'Build Lab',group:'Platform'},
 {id:'maps',name:'Course Maps & Flyovers',group:'Golf'},
 {id:'invoices',name:'Universal Invoicing',group:'Commerce'},
 {id:'product-registry',name:'Product Capture & Inventory',group:'Commerce'},
 {id:'contracts',name:'Agreements & DocuSign',group:'Commerce'},
 {id:'pos-tax',name:'POS, Catalog & Tax',group:'Commerce'}
]);
export const NOT_IN_LIVE_SCANNER=new Set(['invoices','product-registry','contracts','pos-tax']);
const normalize=value=>String(value||'').toLowerCase().trim();
const IDS=[...APP_STACK_CATALOG.map(x=>x.id)].sort((a,b)=>b.length-a.length);
const ALIASES=Object.freeze({
 'inception-apex':'inception', 'eie':'registration','team registration':'registration',
 'squawkbox':'squawk','squawk box':'squawk','inventory':'product-registry',
 'event packet':'event-packet','payment':'payments','identity':'accounts',
 'roster':'roster','course map':'maps'
});
export function appForWorkItem(job){
 const refs=Array.isArray(job?.refs)?job.refs:[];
 const ids=refs.map(r=>normalize(r.itemId)).filter(Boolean);
 for(const item of ids)for(const id of IDS)
  if(item===id||item.startsWith(id+'-')||item.endsWith('-'+id)||item.includes('-'+id+'-'))return id;
 const apps=Array.isArray(job?.apps)?job.apps.map(normalize):[];
 for(const app of apps){
  if(APP_STACK_CATALOG.some(x=>x.id===app))return app;
  if(ALIASES[app])return ALIASES[app];
 }
 const title=normalize(job?.title);
 for(const [word,id] of Object.entries(ALIASES))
  if(title.includes(word))return id;
 // Fallback to exact named area, without guessing "all" means every app.
 for(const id of IDS)if(title.includes(id.replaceAll('-',' ')))return id;
 return null;
}
export function latestMasterReport(entries){
 const valid=(Array.isArray(entries)?entries:[]).filter(e=>
  e?.type==='master'&&e.snapshot?.report?.kind==='eig_build_lab_master_scan'&&
  Array.isArray(e.snapshot.report.modules)&&
  Number.isFinite(Date.parse(e.savedAt)));
 valid.sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt));
 return valid[0]?.snapshot?.report||null;
}
function marker(module,section){
 const coverage=module?.coverage?.[section];
 const expected=coverage?.expected,observed=coverage?.observed;
 if(!Number.isInteger(expected)||expected<0||expected>100||
   !Number.isInteger(observed)||observed<0||observed>expected)return null;
 return {expected,observed,percent:expected>0?Math.round(100*observed/expected):null,
  label:section==='test'?'Test script markers':'Source and UI markers'};
}
function evidenceMarker(module){
 const source=marker(module,'source'),ui=marker(module,'ui');
 if(!source||!ui)return null;
 const expected=source.expected+ui.expected,observed=source.observed+ui.observed;
 return {expected,observed,percent:expected?Math.round(100*observed/expected):null,
  label:'Source & UI signals, not a completion score'};
}
function recentDate(value){
 return typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
}
export function buildAppStack({history=[],ledger=null}={}){
 const report=latestMasterReport(history);
 const modules=new Map((report?.modules||[]).filter(m=>m?.id).map(m=>[m.id,m]));
 const jobs=Array.isArray(ledger?.jobs)?ledger.jobs:[];
 const batches=Array.isArray(ledger?.batches)?ledger.batches:[];
 const cards=APP_STACK_CATALOG.map(app=>{
  const mod=modules.get(app.id)||null;
  const scoped=jobs.filter(j=>appForWorkItem(j)===app.id);
  const open=scoped.filter(j=>j.state==='open').length;
  const hold=scoped.filter(j=>j.state==='hold'||j.state==='manual').length;
  const unresolved=open+hold;
  const approvedIds=new Set(batches.filter(b=>b.status==='approved').flatMap(b=>
   (b.items||[]).filter(i=>ledger.jobs.some(j=>j.id===i.id&&j.signature===i.signature&&j.state==='open')).map(i=>i.id)));
  const planned=scoped.filter(j=>approvedIds.has(j.id)).length;
  const latest=scoped.reduce((prev,j)=>Date.parse(j.lastSeen||'')>Date.parse(prev||0)?j.lastSeen:prev,null);
  const scanned=Boolean(mod);
  const notIncluded=NOT_IN_LIVE_SCANNER.has(app.id);
  const action=notIncluded?'Add this app to a separately reviewed scanner scope before measuring it.':
   !scanned?'Run a fresh Master Scanner to inspect approved source markers.':
   unresolved?'Review open findings. Verify the issue before approving actual code changes.':
   (mod.nextCheck||'Verify the app requirements against current test results.');
  return {
   ...app,scanned,scannerScope:notIncluded?'Outside current live scanner scope':'In current live scanner scope',
   stage:notIncluded?'Scope pending':!scanned?'Awaiting scan':mod.status==='evidence_present'?'Source evidence observed':'Needs verification',
   sourceStatus:mod?.sourceStatus||'not_scanned',
   build:null,verified:null,  // No approved scope baseline or passing test receipts.
   buildReason:'Approved feature checklist has not been measured against implementation evidence.',
   verifiedReason:'No accepted, exact-commit end-to-end test receipts have been linked to app requirements.',
   sourceSignal:evidenceMarker(mod),testMarkers:marker(mod,'test'),
   lastScan:scanned?recentDate(report.inspectedAt):null,
   scanCommit:scanned?String(report.sourceVersion||'').slice(0,40):null,
   open,hold,unresolved,planned,fixesInProgress:null,
   activity:latest?'Latest saved finding '+new Date(latest).toLocaleDateString('en-US'):
    scanned?'Source scan recorded. No live repair job telemetry.':'No scanner activity recorded in this browser.',
   readiness:'Not assessed',nextAction:action,
   evidence:mod?.evidence||[],nextCheck:mod?.nextCheck||'',
   blockers:unresolved?'Unresolved findings require review.':'No blockers confirmed by a runtime test.',
   note:scanned?'Source markers are not build progress or passing tests.':'Scan history is local to this browser and origin.'
  };
 });
 return {
  cards,summary:{tracked:cards.length,scanned:cards.filter(c=>c.scanned).length,
   needingVerification:cards.filter(c=>c.scanned&&c.stage==='Needs verification').length,
   open:cards.reduce((n,c)=>n+c.open,0),hold:cards.reduce((n,c)=>n+c.hold,0),
   planned:cards.reduce((n,c)=>n+c.planned,0)},
  reportVersion:report?.sourceVersion||null,
  lastScan:recentDate(report?.inspectedAt)
 };
}

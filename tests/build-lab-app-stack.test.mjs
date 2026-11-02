import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 APP_STACK_CATALOG,APP_INTEGRATION_CANDIDATES,candidateIntegrations,NOT_IN_LIVE_SCANNER,appForWorkItem,latestMasterReport,buildAppStack
} from '../src/lib/buildLabAppStack.mjs';
const stamp='2026-11-02T22:30:00.000Z';
const sha='a'.repeat(40);
const module=(id,status='review_needed')=>({
 id,title:id,status,sourceStatus:'source_marker_found',
 coverage:{source:{expected:2,observed:2},ui:{expected:2,observed:1},
  test:{expected:2,observed:1}},evidence:[{path:'src/PlatformApp.jsx',line:10}],
 nextCheck:'Verify live behavior using safe isolated records.'
});
const scan=(id,when,modules)=>({id,type:'master',scope:'all',savedAt:when,source:sha,
 snapshot:{report:{kind:'eig_build_lab_master_scan',schemaVersion:1,
  sourceVersion:sha,inspectedAt:when,modules}}});
const job=(id,itemId,state='open')=>({
 id,title:'Review '+itemId,state,priority:'high',signature:'sig-'+id,
 apps:['all'],lastSeen:stamp,refs:[{type:'ai',sourceVersion:sha,itemId,files:[],scanKey:'x'}]
});
test('app catalog includes all 17 platform areas and all four deferred scanner modules',()=>{
 assert.equal(APP_STACK_CATALOG.length,17);
 assert.equal(new Set(APP_STACK_CATALOG.map(x=>x.id)).size,17);
 assert.deepEqual([...NOT_IN_LIVE_SCANNER].sort(),['contracts','invoices','pos-tax','product-registry']);
});
test('App Stack starts with honest unscored gauges and no invented launch readiness',()=>{
 const data=buildAppStack();
 assert.equal(data.summary.tracked,17);
 assert.equal(data.summary.scanned,0);
 assert.equal(data.summary.open,0);
 assert.equal(data.cards.find(x=>x.id==='registration').build,null);
 assert.equal(data.cards.find(x=>x.id==='registration').verified,null);
 assert.equal(data.cards.find(x=>x.id==='registration').integration,null);
 assert.equal(data.cards.find(x=>x.id==='registration').overall,null);
 assert.ok(data.cards.every(x=>x.standaloneReadiness==='Not assessed'));
 assert.ok(data.cards.every(x=>x.ecosystemReadiness==='Not assessed'));
 assert.ok(data.cards.every(x=>x.readiness==='Not assessed'));
 assert.equal(data.cards.find(x=>x.id==='contracts').scannerScope,'Outside current live scanner scope');
 assert.equal(data.cards.find(x=>x.id==='contracts').stage,'Scope pending');
});
test('latest Master Scan supplies dated source marker evidence but never passing verification',()=>{
 const newer=scan('new',stamp,[module('registration'),module('payments','evidence_present')]);
 const older=scan('old','2026-11-01T22:00:00.000Z',[module('accounts')]);
 const data=buildAppStack({history:[older,newer]});
 assert.equal(data.summary.scanned,2);
 assert.equal(data.summary.needingVerification,1);
 assert.equal(data.reportVersion,sha);
 assert.equal(latestMasterReport([older,newer]).inspectedAt,stamp);
 const registration=data.cards.find(x=>x.id==='registration');
 assert.equal(registration.sourceSignal.observed,3);
 assert.equal(registration.sourceSignal.expected,4);
 assert.equal(registration.sourceSignal.percent,75);
 assert.equal(registration.testMarkers.observed,1);
 assert.equal(registration.testMarkers.percent,50);
 assert.equal(registration.verified,null);
 assert.equal(registration.build,null);
 assert.match(registration.buildReason,/approved feature checklist/i);
 assert.equal(registration.readiness,'Not assessed');
 assert.equal(data.cards.find(x=>x.id==='accounts').scanned,false);
});
test('AI findings map to their named apps only, not all apps or guessed customers',()=>{
 const items=[
  job('j1','ai-1-registration'),
  job('j2','ai-2-accounts','hold'),
  job('j3','ai-3-event-builder'),
  job('j4','ai-4-squawk'),
  job('j5','ai-5-payments')
 ];
 assert.deepEqual(items.map(appForWorkItem),
 ['registration','accounts','event-builder','squawk','payments']);
 const data=buildAppStack({ledger:{jobs:items,batches:[]}});
 assert.equal(data.summary.open,4);
 assert.equal(data.summary.hold,1);
 assert.equal(data.cards.find(x=>x.id==='registration').open,1);
 assert.equal(data.cards.find(x=>x.id==='accounts').hold,1);
 assert.equal(data.cards.find(x=>x.id==='inception').open,0);
 assert.equal(appForWorkItem({...job('other','unknown'),title:'Improve something else',apps:['all']}),null);
});
test('approved planning is counted without presenting it as an active repair',()=>{
 const item=job('j1','ai-1-registration');
 const data=buildAppStack({ledger:{jobs:[item],batches:[{
  status:'approved',items:[{id:item.id,signature:item.signature}]
 }]}});
 const c=data.cards.find(x=>x.id==='registration');
 assert.equal(c.planned,1);
 assert.equal(c.fixesInProgress,null);
 assert.equal(c.open,1);
 assert.equal(c.build,null);
 const changed=buildAppStack({ledger:{jobs:[item],batches:[{
  status:'approved',items:[{id:item.id,signature:'different'}]
 }]}});
 assert.equal(changed.cards.find(x=>x.id==='registration').planned,0);
});
test('untrusted or zero-denominator marker counts do not show fabricated percent',()=>{
 const m=module('squawk');m.coverage.source={expected:0,observed:0};
 m.coverage.ui={expected:0,observed:0};
 m.coverage.test={expected:0,observed:0};
 let report=buildAppStack({history:[scan('s',stamp,[m])]});
 assert.equal(report.cards.find(x=>x.id==='squawk').sourceSignal.percent,null);
 assert.equal(report.cards.find(x=>x.id==='squawk').testMarkers.percent,null);
 m.coverage.test={expected:1,observed:3};
 report=buildAppStack({history:[scan('s',stamp,[m])]});
 assert.equal(report.cards.find(x=>x.id==='squawk').testMarkers,null);
});
test('UI provides an App Stack entry, review navigation and clear verification caveats',()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const workspace=fs.readFileSync(path.join(root,'src/components/BuildLabLiveOwnerWorkspace.jsx'),'utf8');
 const panel=fs.readFileSync(path.join(root,'src/components/BuildLabAppStack.jsx'),'utf8');
 const buckets=fs.readFileSync(path.join(root,'src/components/BuildLabWorkBuckets.jsx'),'utf8');
 assert.match(workspace,/BuildLabAppStack/);
 assert.match(workspace,/\['stack','App Stack'\]/);
 assert.match(workspace,/initialModule=\{focusedModule\}/);
 assert.match(panel,/Built %/);
 assert.match(panel,/Verified %/);
 assert.match(panel,/Integration %/);
 assert.match(panel,/Overall %/);
 assert.match(panel,/Standalone readiness/);
 assert.match(panel,/Ecosystem readiness/);
 assert.match(panel,/App integrations to review/);
 assert.match(panel,/Launch readiness/);
 assert.match(panel,/Review this component/);
 assert.match(panel,/Open \{app.shortName\} components/);
 assert.match(panel,/Back to all applications/);
 assert.match(panel,/Continue to Scan/);
 assert.match(panel,/No scanner activity recorded|Scan source|No saved Master Scan/);
 assert.match(buckets,/appForWorkItem\(j\)===appFilter/);
 assert.match(buckets,/Filter work by app/);
 assert.doesNotMatch(panel,/OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
 assert.doesNotMatch(panel,/fetch\(/);
});

test('cross-app integration candidates never count as verified connections',()=>{
 const knownIds=new Set(APP_STACK_CATALOG.map(x=>x.id));
 assert.deepEqual(candidateIntegrations('inception').map(x=>x.id),
  ['event-packet','social','sponsors','product-registry']);
 assert.deepEqual(candidateIntegrations('registration').map(x=>x.id),
  ['accounts','roster','payments','squawk']);
 for(const [appId,ids] of Object.entries(APP_INTEGRATION_CANDIDATES)){
  assert.ok(knownIds.has(appId));
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ids){
   assert.ok(knownIds.has(id),appId+' points to unknown app '+id);
   assert.notEqual(id,appId);
  }
 }
 const cards=buildAppStack({history:[scan('s',stamp,[module('inception','evidence_present')])] }).cards;
 const app=cards.find(x=>x.id==='inception');
 assert.equal(app.integration,null);
 assert.equal(app.integrationRequirements,null);
 assert.equal(app.integrationDone,null);
 assert.equal(app.overall,null);
 assert.equal(app.standaloneReadiness,'Not assessed');
 assert.equal(app.ecosystemReadiness,'Not assessed');
 assert.equal(app.integrationCandidates.length,4);
 assert.ok(app.integrationCandidates.every(x=>x.state.startsWith('Candidate;')));
 assert.equal(app.readiness,'Not assessed');
});
test('standalone build readiness is not downgraded by unverified integration suggestions',()=>{
 const stack=buildAppStack();
 for(const item of stack.cards){
  assert.equal(item.build,null);
  assert.equal(item.verified,null);
  assert.equal(item.integration,null);
  assert.equal(item.overall,null);
  assert.ok(item.integrationReason.includes('not been approved'));
 }
});

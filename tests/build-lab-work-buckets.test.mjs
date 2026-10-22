import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkLedger,collectScanWork,reviseWorkItem,createWorkBatch,approveWorkBatch,batchIsCurrent,workBatchPlan,workRoute,addBuildBrief,readWorkLedger,saveWorkLedger,workStorageKey,validateWorkLedger} from '../src/lib/buildLabWorkBuckets.mjs';
const uid='11111111-1111-4111-8111-111111111111';
const scan=(id='run1',source='a'.repeat(40),savedAt='2026-10-22T12:00:00Z')=>({id,type:'inspector',scope:'inception-apex',source,savedAt,snapshot:{report:{findings:[{id:'dialog',title:'Review confirmation dialogs',recommendation:'Replace native confirmations with an accessible in-app dialog.',findingType:'verification_needed',evidence:[{path:'src/components/InceptionApex.jsx',line:232,excerpt:'window.confirm(message)'}]},{id:'preserve',title:'Keep existing save',findingType:'preserve_existing'}]}}});
const initial=()=>collectScanWork(emptyWorkLedger(),[scan()]);
test('rescans accumulate provenance without duplicate jobs, preserve existing patterns and never infer fixed',()=>{
 let ledger=collectScanWork(initial(),[scan(),scan('run2','a'.repeat(40),'2026-10-22T13:00:00Z')]);
 assert.equal(ledger.jobs.length,1);assert.equal(ledger.jobs[0].refs.length,2);assert.equal(ledger.jobs[0].bucket,'investigation');assert.equal(ledger.jobs[0].intent,'upgrade');
 const missing=scan('run3');missing.snapshot.report.findings=[];
 assert.equal(collectScanWork(ledger,[missing]).jobs[0].state,'open');
 assert.deepEqual(collectScanWork(ledger,[scan(),scan('run2','a'.repeat(40),'2026-10-22T13:00:00Z')]),ledger);
});
test('owner revisions, scope, manual reason and hold survive rescan with changed source',()=>{
 let ledger=initial(),id=ledger.jobs[0].id;
 assert.throws(()=>reviseWorkItem(ledger,id,{state:'manual'}),/Explain/);
 ledger=reviseWorkItem(ledger,id,{detail:'Cover leave and delete actions.',completion:'Cancel preserves all data.',bucket:'interface',scope:'multi_app',apps:['inception','events'],state:'manual',manualReason:'Current worker cannot edit shared dialog infrastructure.'});
 ledger=collectScanWork(ledger,[scan('new','b'.repeat(40),'2026-10-22T14:00:00Z')]);
 assert.equal(ledger.jobs[0].detail,'Cover leave and delete actions.');assert.equal(ledger.jobs[0].state,'manual');assert.equal(ledger.jobs[0].scope,'multi_app');assert.match(workRoute(ledger.jobs[0]).reason,/cannot edit/);
});
test('changed requirements or sources invalidate approved scope without erasing old batch',()=>{
 let ledger=initial(),id=ledger.jobs[0].id;
 ledger=createWorkBatch(ledger,{id:'b1',title:'Dialog upgrade',jobIds:[id]});ledger=approveWorkBatch(ledger,'b1');
 const plan=workBatchPlan(ledger,'b1');assert.equal(plan.status,'reviewed_for_handoff');assert.equal(plan.execution,'not_connected');assert.equal(plan.tasks.length,3);assert.equal(plan.safety.autoDeployed,false);
 const changed=collectScanWork(ledger,[scan('new','b'.repeat(40),'2026-10-22T15:00:00Z')]);
 assert.equal(batchIsCurrent(changed,changed.batches[0]),false);assert.throws(()=>workBatchPlan(changed,'b1'),/current batch/);
 const revised=reviseWorkItem(ledger,id,{detail:'A different requirement'});assert.equal(batchIsCurrent(revised,revised.batches[0]),false);
 assert.equal(revised.batches[0].items[0].detail,ledger.jobs[0].detail);
 const held=reviseWorkItem(ledger,id,{state:'hold'});assert.equal(batchIsCurrent(held,held.batches[0]),false);
});
test('same-source observations do not invalidate a batch but a revised source recommendation does',()=>{
 let ledger=initial();ledger=createWorkBatch(ledger,{id:'b',title:'Upgrade',jobIds:ledger.jobs.map(j=>j.id)});
 ledger=collectScanWork(ledger,[scan('repeat','a'.repeat(40),'2026-10-22T13:00:00Z')]);assert.equal(batchIsCurrent(ledger,ledger.batches[0]),true);
 const revision=scan('revised','a'.repeat(40),'2026-10-22T14:00:00Z');revision.snapshot.reviews={dialog:{review:'edit',editedDetail:'Replace both confirmation paths with cancellation support.'}};
 ledger=collectScanWork(ledger,[revision]);assert.equal(batchIsCurrent(ledger,ledger.batches[0]),false);assert.match(ledger.jobs[0].detail,/both/);
});
test('repair, upgrade and new-build jobs can span apps but cannot silently mix intent in a batch',()=>{
 let ledger=addBuildBrief(initial(),{id:'goal',title:'Shared product registry',detail:'Reuse products across invoices and contracts.',completion:'One product can be used by both apps.',apps:['invoices','contracts']});
 assert.equal(ledger.jobs[1].intent,'build');assert.equal(ledger.jobs[1].scope,'multi_app');assert.equal(workRoute(ledger.jobs[1]).label,'Needs manual fix');
 assert.throws(()=>createWorkBatch(ledger,{id:'mixed',title:'Mixed work',jobIds:ledger.jobs.map(j=>j.id)}),/separate/);
 ledger=createWorkBatch(ledger,{id:'build',title:'Product registry build',jobIds:['goal']});ledger=approveWorkBatch(ledger,'build');assert.equal(workBatchPlan(ledger,'build').proposals[0].detail,ledger.jobs[1].detail);
});
test('all existing scanner formats collect evidence and retain reject/hold dispositions',()=>{
 const entries=[
  {id:'m',type:'master',scope:'all',source:'a',savedAt:scan().savedAt,snapshot:{report:{modules:[{id:'invoices',title:'Invoice module',nextCheck:'Verify persistence.'}]}}},
  {id:'r',type:'radar',scope:'all',source:'a',savedAt:scan().savedAt,snapshot:{audit:{suggestions:[{id:'r',title:'Shared navigation',proposal:'Improve navigation.'}]},choices:{r:{review:'park'}}}},
  {id:'ai',type:'ai',scope:'events',source:'a',savedAt:scan().savedAt,snapshot:{review:{recommendations:[{id:'ai',title:'Registration regression',nextAction:'Repair broken registration.'}]}}},
  {id:'i',type:'impact',scope:'proposed-change',source:'a',savedAt:scan().savedAt,snapshot:{report:{findings:[{id:'identity:x',path:'src/Auth.jsx',reason:'Verify access.',severity:'critical'}]},reviews:{'identity:x':'reject'}}}
 ];
 const ledger=collectScanWork(emptyWorkLedger(),entries);assert.equal(ledger.jobs.length,4);assert.equal(ledger.jobs.find(j=>j.refs[0].type==='radar').state,'hold');assert.equal(ledger.jobs.find(j=>j.refs[0].type==='impact').state,'dismissed');assert.equal(ledger.jobs.find(j=>j.refs[0].type==='ai').intent,'repair');
});
test('account-separated bounded storage preserves corruption and exposes quota errors',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 saveWorkLedger(storage,uid,initial());assert.equal(readWorkLedger(storage,uid).jobs.length,1);assert.equal(readWorkLedger(storage,'22222222-2222-4222-8222-222222222222').jobs.length,0);
 assert.equal(workStorageKey('invalid'),null);assert.throws(()=>readWorkLedger(storage,'invalid'));
 map.set(workStorageKey(uid),'broken');assert.throws(()=>readWorkLedger(storage,uid));assert.equal(map.get(workStorageKey(uid)),'broken');
 assert.throws(()=>saveWorkLedger({setItem(){throw Error('quota');}},uid,initial()),/quota/);
 assert.throws(()=>validateWorkLedger({...initial(),jobs:[{...initial().jobs[0],state:'fixed'}]}));
});

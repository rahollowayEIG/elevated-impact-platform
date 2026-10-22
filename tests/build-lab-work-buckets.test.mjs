import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scanFindingAssessment,findingAssessment} from '../src/lib/buildLabFindingStandards.mjs';
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
 assert.equal(ledger.jobs[1].intent,'build');assert.equal(ledger.jobs[1].scope,'multi_app');assert.equal(workRoute(ledger.jobs[1]).label,'Capability not assessed');
 assert.throws(()=>createWorkBatch(ledger,{id:'mixed',title:'Mixed work',jobIds:ledger.jobs.map(j=>j.id)}),/separate/);
 ledger=createWorkBatch(ledger,{id:'build',title:'Product registry build',jobIds:['goal']});ledger=approveWorkBatch(ledger,'build');assert.equal(workBatchPlan(ledger,'build').proposals[0].detail,ledger.jobs[1].detail+'\n\nComplete when: '+ledger.jobs[1].completion);
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

test('multi-app or platform IA scope never advertises the bounded single-app route',()=>{
 const ledger=initial(),job=ledger.jobs[0];assert.equal(workRoute(job).label,'Bounded IA candidate review');
 assert.equal(workRoute({...job,scope:'platform'}).label,'Capability not assessed');
 assert.equal(workRoute({...job,scope:'multi_app',apps:['inception','events']}).label,'Capability not assessed');
});

test('implementation handoff carries completion criteria and refuses to truncate lengthy requirements',()=>{
 let ledger=initial();ledger=createWorkBatch(ledger,{id:'b',title:'Upgrade',jobIds:ledger.jobs.map(j=>j.id)});ledger=approveWorkBatch(ledger,'b');
 assert.match(workBatchPlan(ledger,'b').tasks.find(t=>t.phase==='work').instruction,/Complete when:/);
 ledger=reviseWorkItem(ledger,ledger.jobs[0].id,{detail:'x'.repeat(3000)});ledger=createWorkBatch(ledger,{id:'long',title:'Long requirement',jobIds:ledger.jobs.map(j=>j.id)});ledger=approveWorkBatch(ledger,'long');
 assert.throws(()=>workBatchPlan(ledger,'long'),/Shorten/);
});

test('one bucket approval splits mixed intents into approved plans and captures full source evidence',async()=>{
 const {approveBucketSelection,batchWorkBlueprint}=await import('../src/lib/buildLabWorkBuckets.mjs');
 const ledger=addBuildBrief(initial(),{id:'goal2',title:'New catalog',detail:'Build a shared catalog.',completion:'Products are reusable.'});
 const next=approveBucketSelection(ledger,{selection:ledger.jobs.map(j=>({id:j.id,signature:j.signature})),idPrefix:'review',title:'Platform review'});
 assert.equal(next.batches.length,2);assert.ok(next.batches.every(b=>b.status==='approved'));
 const upgrade=next.batches.find(b=>b.intent==='upgrade'),plan=batchWorkBlueprint(upgrade);
 assert.equal(plan.work[0].requirement,ledger.jobs[0].detail);assert.equal(plan.work[0].completion,ledger.jobs[0].completion);assert.equal(plan.work[0].sourceRefs[0].sourceVersion,'a'.repeat(40));assert.equal(plan.execution,'not_connected');assert.equal(plan.deployment,'not_authorized');
 assert.throws(()=>approveBucketSelection(next,{selection:[{id:next.jobs[0].id,signature:next.jobs[0].signature}],idPrefix:'again'}),/already/);
});
test('bucket approval rejects changed selections atomically and hold/dismiss survive rescans',async()=>{
 const {approveBucketSelection,setBucketDisposition}=await import('../src/lib/buildLabWorkBuckets.mjs');
 const ledger=initial(),selection=ledger.jobs.map(j=>({id:j.id,signature:j.signature}));
 const changed=reviseWorkItem(ledger,ledger.jobs[0].id,{detail:'Changed scope'});
 assert.throws(()=>approveBucketSelection(changed,{selection,idPrefix:'stale'}),/changed/);assert.equal(changed.batches.length,0);
 for(const state of ['hold','dismissed']){const next=setBucketDisposition(ledger,{selection,state});assert.equal(collectScanWork(next,[scan()]).jobs[0].state,state);}
 assert.throws(()=>setBucketDisposition(ledger,{selection,state:'fixed'}));
});

test('all five scanner assessments retain evidence limits without promoting proposals to confirmed defects',()=>{
 const expected={inspector:'investigation',master:'investigation',radar:'improvement',ai:'improvement',impact:'impact'};
 for(const [type,kind] of Object.entries(expected)){
  const assessment=scanFindingAssessment(type,{findingType:'confirmed_defect',status:'verified',title:'Repair broken access'});
  assert.equal(assessment.kind,kind);assert.ok(assessment.limitation);assert.ok(assessment.nextCheck);
 }
 assert.equal(scanFindingAssessment('inspector',{findingType:'coverage_gap'}).kind,'coverage');
 assert.equal(scanFindingAssessment('ai',{}).basis,'scanner_metadata');
 assert.equal(scanFindingAssessment('impact',{}).basis,'path_list');
 const directions=JSON.parse(readFileSync(new URL('../src/lib/buildLabScannerDirections.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(directions.scanners).sort(),Object.keys(expected).sort());
 for(const d of Object.values(directions.scanners)){assert.ok(d.mission&&d.handoff);assert.ok(d.identifies.length&&d.limits.length);}
});

test('assessment remains separate from domain grouping and explicit manual capability decisions',()=>{
 const entry=scan();entry.snapshot.report.findings[0].findingType='coverage_gap';
 let ledger=collectScanWork(emptyWorkLedger(),[entry]);
 assert.equal(ledger.jobs[0].bucket,'interface');assert.equal(ledger.jobs[0].assessment.kind,'coverage');
 const module={id:'m',type:'master',scope:'all',source:'b',savedAt:entry.savedAt,snapshot:{report:{modules:[{id:'events',title:'Event database',nextCheck:'Verify persistent saves.'}]}}};
 ledger=collectScanWork(ledger,[module]);const job=ledger.jobs.find(j=>j.refs[0].type==='master');
 assert.equal(job.bucket,'data');assert.equal(job.assessment.kind,'investigation');assert.equal(workRoute(job).label,'Capability not assessed');
 ledger=reviseWorkItem(ledger,job.id,{state:'manual',manualReason:'Requires a separately authorized database test setup.'});
 assert.equal(workRoute(ledger.jobs.find(j=>j.id===job.id)).label,'Needs manual fix');
 assert.equal(ledger.jobs.find(j=>j.id===job.id).assessment.kind,'investigation');
});

test('assessment is captured in plans and a changed assessment invalidates prior scope without erasing it',async()=>{
 const {approveBucketSelection,batchWorkBlueprint}=await import('../src/lib/buildLabWorkBuckets.mjs');
 let ledger=initial();ledger=approveBucketSelection(ledger,{selection:ledger.jobs.map(j=>({id:j.id,signature:j.signature})),idPrefix:'assessed'});
 assert.equal(batchWorkBlueprint(ledger.batches[0]).work[0].assessment.kind,'investigation');
 const entry=scan('changed','a'.repeat(40),'2026-10-22T14:00:00Z');entry.snapshot.report.findings[0].findingType='coverage_gap';
 ledger=collectScanWork(ledger,[entry]);assert.equal(batchIsCurrent(ledger,ledger.batches[0]),false);
 assert.equal(ledger.batches[0].items[0].assessment.kind,'investigation');assert.equal(ledger.jobs[0].assessment.kind,'coverage');
});

test('older work restores without invented verification and rejects malformed new assessments',()=>{
 const legacy=initial();delete legacy.jobs[0].assessment;
 assert.equal(validateWorkLedger(legacy),legacy);assert.equal(findingAssessment(legacy.jobs[0]).basis,'legacy_unknown');
 const malformed=initial();malformed.jobs[0].assessment.kind='confirmed_defect';assert.throws(()=>validateWorkLedger(malformed),/assessment/);
 const brief=addBuildBrief(legacy,{id:'owner',title:'New app',detail:'Build the reviewed app.',completion:'The goal passes review.'});
 assert.equal(brief.jobs[1].assessment.kind,'goal');assert.equal(brief.jobs[1].assessment.basis,'owner_brief');
});

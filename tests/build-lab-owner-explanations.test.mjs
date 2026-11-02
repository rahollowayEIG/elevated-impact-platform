import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {describeWorkItem,guidedReviewQueue,nextGuidedItem} from '../src/lib/buildLabOwnerExplanations.mjs';
import {emptyWorkLedger,collectScanWork,approveBucketSelection,batchWorkBlueprint,setBucketDisposition} from '../src/lib/buildLabWorkBuckets.mjs';

const sha='a'.repeat(40),stamp='2026-11-02T21:01:00.000Z';
const idea=(id,title)=>({
 id:'ai-'+id,title,priority:'high',
 moduleId:id,why:'Static scan markers need independent verification.',
 proposal:'Check the affected workflow with isolated test records.',
 verify:'Compare expected and actual results before approval.',
 findingType:'improvement_idea',ownerReview:'pending',
 evidence:[{path:'src/PlatformApp.jsx',line:12}]
});
const entry=(recommendations,id='review')=>({
 id,type:'ai',scope:'all',source:sha,savedAt:stamp,
 snapshot:{review:{recommendations}}
});
test('AI suggestions become simple owner explanations without declaring bugs',()=>{
 const idTitle=[
 ['registration','Verify registration identity reconciliation'],
 ['accounts','Verify identity visibility and role permissions'],
 ['event-builder','Verify Event Details and Registration persistence'],
 ['squawk','Test communication controls with mocked delivery'],
 ['payments','Verify split-payment calculations in Sandbox']
 ];
 const original=idTitle.map(([id,title])=>idea(id,title));
 const ledger=collectScanWork(emptyWorkLedger(),[entry(original)]);
 assert.equal(ledger.jobs.length,5);
 for(const job of ledger.jobs){
  const explanation=describeWorkItem(job);
  assert.equal(explanation.evidenceStatus,'AI suggestion based on limited scanner metadata, not a confirmed problem');
  assert.ok(explanation.quick.length>35);
  assert.ok(explanation.why.length>35);
  assert.ok(explanation.next.length>30);
  assert.ok(explanation.outcome.length>30);
  assert.equal(explanation.priority,'high');
 }
 assert.match(describeWorkItem(ledger.jobs.find(j=>j.title.includes('split-payment'))).quick,/team payments/i);
 assert.match(describeWorkItem(ledger.jobs.find(j=>j.title.includes('communication'))).next,/simulated/i);
 assert.ok(original.every(x=>x.ownerReview==='pending'),'AI originals stay unmodified');
});
test('generic explanations are cautious and do not invent a confirmed defect',()=>{
 const job={id:'custom',title:'Research golf GPS products',priority:'low',
  assessment:{kind:'improvement',basis:'scanner_metadata',limitation:'Source-only'},
  refs:[],detail:'Research competitor options.',observation:'No runtime tests'};
 const d=describeWorkItem(job);
 assert.match(d.quick,/not proof/i);
 assert.match(d.next,/isolated/i);
 assert.equal(d.currentEvidence,'No runtime tests');
 assert.equal(d.suggestedWork,'Research competitor options.');
});
test('smart queue prioritizes open work and skips existing approved planning',()=>{
 const jobs=[
  {id:'c',title:'Alpha',priority:'low',state:'open'},
  {id:'b',title:'Beta',priority:'high',state:'open'},
  {id:'a',title:'Zeta',priority:'critical',state:'open'},
  {id:'d',title:'Hidden',priority:'critical',state:'hold'}
 ];
 const before=JSON.stringify(jobs);
 const q=guidedReviewQueue(jobs,['b']);
 assert.deepEqual(q.map(x=>x.id),['a','c']);
 assert.equal(nextGuidedItem(q,'a'), 'c');
 assert.equal(nextGuidedItem(q,'c'), 'a');
 assert.equal(nextGuidedItem(q,'c',-1),'a');
 assert.equal(nextGuidedItem(q,'missing'),'a');
 assert.equal(nextGuidedItem([],null),null);
 assert.equal(JSON.stringify(jobs),before);
});
test('approved owner planning is automated locally but never launches fixes',()=>{
 const ledger=collectScanWork(emptyWorkLedger(),[entry([idea('payments','Verify split-payment calculations in Sandbox')])]);
 const work=ledger.jobs[0];
 const reviewed=approveBucketSelection(ledger,{
  selection:[{id:work.id,signature:work.signature}],idPrefix:'owner-guided',title:'Verify split payment'
 });
 assert.equal(reviewed.batches.length,1);
 assert.equal(reviewed.batches[0].status,'approved');
 assert.equal(reviewed.jobs[0].state,'open');
 assert.equal(guidedReviewQueue(reviewed.jobs,reviewed.batches[0].items.map(x=>x.id)).length,0);
 const blueprint=batchWorkBlueprint(reviewed.batches[0]);
 assert.equal(blueprint.execution,'not_connected');
 assert.equal(blueprint.deployment,'not_authorized');
 assert.equal(blueprint.work[0].assessment.basis,'scanner_metadata');
 const held=setBucketDisposition(ledger,{selection:[{id:work.id,signature:work.signature}],state:'hold'});
 assert.equal(guidedReviewQueue(held.jobs).length,0);
 assert.equal(ledger.jobs[0].state,'open','original ledger is never modified');
});
test('review navigation and plan UI do not import autonomous builder or a deployment client',()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const guide=fs.readFileSync(path.join(root,'src/components/BuildLabGuidedReview.jsx'),'utf8');
 const bucket=fs.readFileSync(path.join(root,'src/components/BuildLabWorkBuckets.jsx'),'utf8');
 assert.match(guide,/Continue to next/);
 assert.match(guide,/Approve planning &amp; continue/);
 assert.match(guide,/Continue to Review &amp; Fix Plan/);
 assert.match(guide,/localStorage\.setItem/);
 assert.match(guide,/No unreviewed open findings/);
 assert.match(bucket,/onDecision=\{guidedDecision\}/);
 assert.match(bucket,/approveBucketSelection/);
 for(const s of [guide,bucket]){
  assert.doesNotMatch(s,/from ['"].*eigBuildLabBuilder/);
  assert.doesNotMatch(s,/from ['"].*vercel.*deployment/);
 }
});

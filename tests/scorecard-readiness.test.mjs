import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateScorecardReadiness, SCORECARD_CAPABILITIES } from '../src/lib/scorecardReadiness.mjs';
const checked = id => ({id,status:'verified',evidence:[{kind:'test',source:'tests/scorecard.test.mjs',locator:'test '+id}]});
test('unknown capabilities do not count as complete', () => {
 const r=evaluateScorecardReadiness();
 assert.equal(r.printReady,false);
 assert.equal(r.findings.length,SCORECARD_CAPABILITIES.length);
 assert.ok(r.priorityQueue.some(x=>x.id==='print-export'));
});
test('verified evidence must include test or documented review',()=>{
 assert.throws(()=>evaluateScorecardReadiness([{id:'score-grid',status:'verified',evidence:[]}]),/source evidence/);
 assert.throws(()=>evaluateScorecardReadiness([{id:'score-grid',status:'verified',evidence:[{kind:'source',source:'src/x',locator:'20'}]}]),/testing/);
});
test('cannot mark print ready until all critical gates have evidence',()=>{
 const critical=SCORECARD_CAPABILITIES.filter(c=>c.priority==='critical').map(c=>checked(c.id));
 const r=evaluateScorecardReadiness(critical);
 assert.equal(r.printReady,true);
 assert.ok(r.priorityQueue.every(x=>x.priority!=='critical'));
 assert.equal(r.requiresHumanApproval,true);
});
test('duplicate or unsupported claims rejected',()=>{
 assert.throws(()=>evaluateScorecardReadiness([checked('score-grid'),checked('score-grid')]),/duplicate/);
 assert.throws(()=>evaluateScorecardReadiness([checked('fake-capability')]),/Invalid/);
});
test('partial is not completion even with an evidence reference',()=>{
 const r=evaluateScorecardReadiness([{id:'print-export',status:'partial',evidence:[{kind:'source',source:'src/editor',locator:'PDF export'}]}]);
 assert.equal(r.printReady,false);
 assert.equal(r.findings.find(x=>x.id==='print-export').nextAction,'finish_and_test');
});

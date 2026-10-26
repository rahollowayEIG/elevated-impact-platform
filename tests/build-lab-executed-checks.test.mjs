import test from 'node:test';
import assert from 'node:assert/strict';
import {runRuntimeEvidence} from '../scripts/build-lab/run-executed-checks.mjs';
test('reports executed pass/fail without asserting browser verification',()=>{
 let count=0;
 const report=runRuntimeEvidence({commit:'example-sha',now:()=> '2026-10-26T00:00:00.000Z',spawn:()=>({status:count++===1?1:0})});
 assert.equal(report.checks.length,3);
 assert.deepEqual(report.checks.map(x=>x.status),['passed','failed','passed']);
 assert.equal(report.checks.every(x=>x.executed&&!x.verifiedBrowserBehavior),true);
 assert.equal(report.commit,'example-sha');
 assert.equal(report.environment,'isolated_source_tests');
});
test('crashed check reports error rather than pass',()=>{
 const report=runRuntimeEvidence({spawn:()=>({status:null,signal:'SIGTERM'})});
 assert.equal(report.checks.every(x=>x.status==='error'),true);
});

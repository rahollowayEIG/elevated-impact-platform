import test from 'node:test';
import assert from 'node:assert/strict';
import {scanSourceFiles,draftBuildPlan} from '../src/build-lab/masterScanner.mjs';
test('scanner inventories source without modification',()=>{
 const files=[{path:'src/Invoice.jsx',content:'invoice customer contract ACH TODO'},{path:'src/auth.mjs',content:'auth.session'}];
 const before=JSON.stringify(files);
 const result=scanSourceFiles(files);
 assert.equal(result.readOnly,true);assert.equal(result.filesScanned,2);
 assert.ok(result.findings.some(f=>f.category==='Invoicing'));
 assert.ok(result.findings.some(f=>f.category==='Finance'));
 assert.deepEqual(JSON.stringify(files),before);
});
test('build plan requires review and never deploys',()=>{
 const plan=draftBuildPlan(scanSourceFiles([]),'EIG Invoicing');
 assert.equal(plan.stage,'review');assert.equal(plan.autoDeploy,false);
});
test('rejects invalid input',()=>{
 assert.throws(()=>scanSourceFiles(null),TypeError);
 assert.throws(()=>draftBuildPlan(scanSourceFiles([]),''),TypeError);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {collectScanWork,emptyWorkLedger} from '../src/lib/buildLabWorkBuckets.mjs';

// Full source scanner integration: requires the actual approved source bundle.
// Must pass before release. Never replace source with dummy fixtures.
test('actual Master Scanner verification criteria and observations survive bucket collection and reviewed plans',async()=>{
 const require=createRequire(import.meta.url),{scanMasterSource,readAllowlistedMasterSource}=require('../server/eig-master-source-scan.cjs');
 const {approveBucketSelection,batchWorkBlueprint}=await import('../src/lib/buildLabWorkBuckets.mjs');
 const report=scanMasterSource(readAllowlistedMasterSource(),'a'.repeat(40));
 const entry={id:'master-criteria',type:'master',scope:'all',source:report.sourceVersion,savedAt:'2026-10-22T18:00:00Z',snapshot:{report}};
 const ledger=collectScanWork(emptyWorkLedger(),[entry]);assert.equal(ledger.jobs.length,report.modules.length);
 const module=report.modules.find(m=>m.id==='invoices'),job=ledger.jobs.find(j=>j.apps.includes('invoices'));
 assert.equal(job.completion,module.verify);assert.equal(job.observation,module.observation);assert.equal(job.assessment.kind,'investigation');
 const approved=approveBucketSelection(ledger,{selection:[{id:job.id,signature:job.signature}],idPrefix:'master-review'});
 const plan=batchWorkBlueprint(approved.batches[0]);assert.equal(plan.work[0].completion,module.verify);assert.equal(plan.work[0].sourceRefs[0].sourceVersion,report.sourceVersion);assert.equal(plan.execution,'not_connected');
});

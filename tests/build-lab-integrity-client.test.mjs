import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {requestLiveBuildLabScan} from '../src/lib/eigBuildLabLiveClient.mjs';
import {saveScanHistory,readScanHistory} from '../src/lib/buildLabScanHistory.mjs';
import {emptyWorkLedger,collectScanWork} from '../src/lib/buildLabWorkBuckets.mjs';
const require=createRequire(import.meta.url);
const {readApprovedIntegrityInputs,scanPlatformIntegrity}=require('../server/eig-build-lab-integrity-scan.cjs');
const owner='c7e46b1b-db97-4891-8bc9-daf0192a2dc4';
const now='2026-11-02T18:05:00Z';
const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}},error:null})}};
test('owner-only integrity client routes read-only scan through validated browser history and Work Buckets',async()=>{
 const serverReport=scanPlatformIntegrity(readApprovedIntegrityInputs(),'a'.repeat(40),now);
 const http=async(url,options)=>{
  assert.equal(url,'/api/eig-build-lab-live-integrity');
  assert.equal(options.method,'POST');
  assert.equal(options.headers.Authorization,'Bearer synthetic');
  assert.deepEqual(JSON.parse(options.body),{target:'platform_integrity'});
  return {ok:true,json:async()=>({ok:true,report:serverReport})};
 };
 const report=await requestLiveBuildLabScan(client,'integrity',http);
 assert.equal(report.kind,'eig_build_lab_platform_integrity');
 assert.equal(report.safety.autoDeleted,false);
 const map=new Map(),storage={getItem:key=>map.get(key)||null,setItem:(key,v)=>map.set(key,v)};
 const entry={id:'integrity-read-only',type:'integrity',scope:'all',source:report.sourceVersion,savedAt:now,snapshot:{report}};
 saveScanHistory(storage,owner,entry);
 assert.equal(readScanHistory(storage,owner).length,1);
 const ledger=collectScanWork(emptyWorkLedger(),readScanHistory(storage,owner));
 assert.ok(ledger.jobs.some(x=>x.title.includes('migration history')));
 assert.ok(ledger.jobs.every(x=>x.assessment.kind==='investigation'));
 assert.ok(ledger.jobs.every(x=>x.apps.includes('elevationpilot')));
 assert.ok(ledger.jobs.every(x=>x.state==='open'));
});
test('forged integrity response is rejected before browser saving',async()=>{
 await assert.rejects(()=>requestLiveBuildLabScan(client,'integrity',async()=>({
  ok:true,json:async()=>({ok:true,report:{kind:'eig_build_lab_platform_integrity',safety:{autoDeleted:true}}})
 })),/integrity report/i);
 await assert.rejects(()=>requestLiveBuildLabScan(client,'cleanup',async()=>{throw Error('never call')}),/Unsupported production/);
});

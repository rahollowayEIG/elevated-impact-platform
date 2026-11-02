'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readApprovedIntegrityInputs,scanPlatformIntegrity,FILES}=require('../server/eig-build-lab-integrity-scan.cjs');
const {createIntegrityScanHandler}=require('../server/eig-build-lab-integrity-handler.cjs');
const source='a'.repeat(40);
const now='2026-11-02T18:00:00Z';
const run=i=>scanPlatformIntegrity(i,source,now);
const copy=x=>JSON.parse(JSON.stringify(x));
function response(){return {statusCode:null,headers:{},data:null,setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.data=v;return this;}};}

test('scanner inventories real approved sources and pinned version metadata without modifying them',()=>{
 const input=readApprovedIntegrityInputs(),before=JSON.stringify(input);
 const report=run(input);
 assert.equal(JSON.stringify(input),before);
 assert.deepEqual(report.inventory.sampledFiles,FILES);
 assert.equal(report.inventory.baselineMigrationCount,67);
 assert.ok(report.inventory.sourceMigrationCount>=10);
 assert.ok(report.inventory.baselineOnlyVersions.length>0);
 assert.ok(report.findings.some(x=>x.id==='migration-history-parity'));
 assert.equal(report.safety.readOnly,true);
 assert.equal(report.safety.databaseQueried,false);
 assert.ok(report.inventory.sourceFileCount>=50,'Broad first-party source inventory should run');
 assert.ok(report.inventory.unresolvedImportCount>=0);
 assert.match(report.inventory.sourceInventoryFingerprint,/^[a-f0-9]{64}$/);
 assert.notEqual(report.inventory.sourceInventoryFingerprint,report.sourceFingerprint);
 assert.equal(report.safety.deletedItems,0);
 assert.equal(report.safety.autoDeleted,false);
 assert.equal(report.safety.liveChanges,false);
 assert.equal(report.limitations.length,4);
 assert.match(report.findings.find(x=>x.id==='migration-history-parity').observation,/NOT a fresh database query/);
});
test('route and cloud safety drift is review-only and generates evidence',()=>{
 const inputs=readApprovedIntegrityInputs();
 const changed=copy(inputs);
 changed.sources['src/PlatformApp.jsx']=changed.sources['src/PlatformApp.jsx'].replace(/adminView\s*===\s*['"]build_lab_live['"]\s*&&\s*liveBuildLabAllowed/,'adminView === "old_preview"');
 changed.sources['src/components/BuildLabCloudBackup.jsx']=changed.sources['src/components/BuildLabCloudBackup.jsx'].replaceAll('wouldOverwriteCloudWithEmptyBrowser','notFound');
 const report=run(changed);
 assert.ok(report.findings.some(x=>x.id==='approved-route-guard'));
 assert.ok(report.findings.some(x=>x.id==='cloud-overwrite-guard'));
 assert.ok(report.findings.every(x=>x.findingType==='verification_needed'&&x.review==='pending'));
 assert.equal(report.safety.autoApproved,false);
});
test('known retired marker appears as candidate, never a deletion command',()=>{
 const input=readApprovedIntegrityInputs();
 input.sources['src/PlatformApp.jsx']+='\n// legacy project-5gwts reference\n';
 const report=run(input);
 assert.ok(report.findings.some(x=>x.id==='legacy-link-project-5gwts'));
 assert.equal(report.safety.deletedItems,0);
});
test('duplicate migration versions fail rather than conceal discrepancies',()=>{
 const input=readApprovedIntegrityInputs();
 input.migrationFilenames.push(input.migrationFilenames[0]);
 assert.throws(()=>run(input),/duplicate/);
});
test('server endpoint denies unauthorized and invalid targets before source reads',async()=>{
 let reads=0,checks=0;
 const settings={
  env:key=>key==='VERCEL_GIT_COMMIT_SHA'?source:null,
  readSources:()=>{reads++;return readApprovedIntegrityInputs();},
  scan:run,verifyUser:async()=>null,membershipsForUser:async()=>null,
  verifyLiveSession:async()=>false,
  authorize:async()=>{checks++;return {allowed:false,status:403};}
 };
 const handler=createIntegrityScanHandler(settings);
 const denied=response();
 await handler({method:'POST',body:{target:'platform_integrity'}},denied);
 assert.equal(denied.statusCode,403);
 assert.equal(reads,0);
 assert.deepEqual(denied.data,{ok:false});
 assert.equal(checks,1);
 const enabled=createIntegrityScanHandler({...settings,authorize:async()=>({allowed:true,status:200})});
 const malformed=response();
 await enabled({method:'POST',body:{target:'platform_integrity',path:'../private'}},malformed);
 assert.equal(malformed.statusCode,400);assert.equal(reads,0);
 const valid=response();
 await enabled({method:'POST',body:{target:'platform_integrity'}},valid);
 assert.equal(valid.statusCode,200);
 assert.equal(reads,1);
 assert.equal(valid.data.report.safety.autoDeleted,false);
 assert.equal(valid.headers['Cache-Control'],'private, no-store, max-age=0');
});

test('bounded source candidate reaches protected report with review-only evidence',()=>{
 const input=readApprovedIntegrityInputs();
 input.sourceInventory={...input.sourceInventory,unresolvedCount:1,unresolved:[{file:'src/PlatformApp.jsx',line:2,specifier:'./missing'}]};
 const report=run(input),finding=report.findings.find(x=>x.id==='bounded-source-import-review');
 assert.ok(finding);
 assert.equal(finding.priority,'medium');
 assert.equal(finding.review,'pending');
 assert.deepEqual(finding.evidence,[{path:'src/PlatformApp.jsx',line:2}]);
 assert.equal(report.safety.deletedItems,0);
 assert.equal(report.safety.autoApproved,false);
});
test('rejects tampered bounded inventory without generating report',()=>{
 const input=readApprovedIntegrityInputs();
 input.sourceInventory={...input.sourceInventory,safety:{...input.sourceInventory.safety,deletedItems:1}};
 assert.throws(()=>run(input),/Invalid bounded source inventory/);
});

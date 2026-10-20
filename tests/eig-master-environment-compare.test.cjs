const test=require("node:test");
const assert=require("node:assert/strict");
const {MODULES}=require("../server/eig-master-source-scan.cjs");
const {MODES,buildEnvironmentAudit,tableDifferences,rpcDifferences}=
 require("../server/eig-master-environment-compare.cjs");

test("Live and Sandbox are independent production deployments, never a Build Lab preview alias",()=>{
 assert.deepEqual(MODES,["live","sandbox","compare"]);
 const audit=buildEnvironmentAudit({modules:MODULES});
 assert.equal(audit.selected,"compare");
 assert.equal(audit.sourceInspection,"preview_reference_only");
 assert.equal(audit.live.vercelProject,"elevated-impact-platform");
 assert.equal(audit.live.gitRef,"main");
 assert.equal(audit.sandbox.vercelProject,"elevationpilot-sandbox");
 assert.equal(audit.sandbox.gitRef,"feature/sandbox-readonly-live-ui-20261019");
 assert.notEqual(audit.live.deployedCommit,audit.sandbox.deployedCommit);
 assert.equal(audit.live.deployedCommit.length,40);
 assert.equal(audit.sandbox.deployedCommit.length,40);
 assert.equal(audit.live.tables,71);
 assert.equal(audit.sandbox.tables,71);
 assert.equal(audit.live.functions,38);
 assert.equal(audit.sandbox.functions,42);
 assert.deepEqual(audit.live.rlsDisabled,[]);
 assert.deepEqual(audit.sandbox.rlsDisabled,[]);
 assert.equal(audit.freshDatabaseQuery,false);
 assert.equal(audit.freshDeploymentQuery,false);
 assert.equal(audit.functionalTests.live,"not_run");
 assert.equal(audit.functionalTests.sandbox,"not_run");
 assert.deepEqual(audit.safety,{
  readOnly:true,liveModified:false,sandboxModified:false,
  paymentsAttempted:false,automaticRepairsEnabled:false
 });
});

test("normalized project-wide schema diff pinpoints two policy differences and four sandbox-only functions",()=>{
 const differences=tableDifferences(null);
 assert.deepEqual(differences.map(x=>x.table),["events","sponsors"]);
 assert.deepEqual(differences.map(x=>[x.livePolicyCount,x.sandboxPolicyCount]),[[4,5],[3,4]]);
 assert.ok(differences.every(x=>x.policyDifferent));
 assert.ok(differences.every(x=>!x.indexDifferent&&!x.rlsDifferent));
 assert.ok(differences.every(x=>x.liveOnlyColumns.length===0&&x.sandboxOnlyColumns.length===0&&x.changedColumns.length===0));
 const fs=rpcDifferences();
 assert.equal(fs.length,4);
 assert.ok(fs.every(x=>x.status==="sandbox_only"&&x.signature.startsWith("sandbox_")));
 assert.ok(fs.some(x=>x.signature.startsWith("sandbox_save_practice_event_details(")));
 assert.ok(fs.some(x=>x.signature.startsWith("sandbox_save_practice_registration_details(")));
});

test("compare scoped to Event Builder only surfaces relevant code and database schema differences",()=>{
 const audit=buildEnvironmentAudit({mode:"compare",moduleId:"event-builder",modules:MODULES});
 assert.equal(audit.scope,"event-builder");
 assert.equal(audit.live.relevantTables.length,4);
 assert.equal(audit.sandbox.relevantTables.length,4);
 assert.equal(audit.compare.source.totalChangedFiles,78);
 assert.ok(audit.compare.source.relevantChangedFiles.some(f=>f.path==="src/EieEventSetupSteps.jsx"));
 assert.ok(audit.compare.source.relevantChangedFiles.some(f=>f.path==="src/PlatformApp.jsx"));
 assert.ok(audit.compare.source.relevantChangedFiles.every(f=>typeof f.additions==="number"&&typeof f.deletions==="number"));
 assert.deepEqual(audit.compare.database.selectedDifferentTables.map(x=>x.table),["events"]);
 assert.equal(audit.compare.database.totalDifferentTables,2);
 assert.equal(audit.compare.database.totalDifferentFunctions,4);
});

test("live-only and Sandbox-only modes never imply the other environment was browsed or scanned live",()=>{
 for(const mode of ["live","sandbox"]){
  const audit=buildEnvironmentAudit({mode,moduleId:"event-builder",modules:MODULES});
  assert.equal(audit.selected,mode);
  assert.equal(audit.compare,null);
  assert.equal(audit.live===null,mode==="sandbox");
  assert.equal(audit.sandbox===null,mode==="live");
  assert.equal(audit.scope,"event-builder");
  assert.ok(audit.notes.some(x=>x.includes("pressing Scan does not refresh")));
 }
});

test("arbitrary modules and environment targets fail without creating or updating data",()=>{
 for(const mode of ["preview","production","../../.env","",[],{},undefined]){
  if(mode===undefined)continue;
  assert.throws(()=>buildEnvironmentAudit({mode,moduleId:"event-builder",modules:MODULES}),/Unsupported audit environment/);
 }
 for(const moduleId of ["../secrets","organizations","not-a-real-module",7,{}])
  assert.throws(()=>buildEnvironmentAudit({mode:"compare",moduleId,modules:MODULES}),/Unknown approved module/);
 assert.throws(()=>buildEnvironmentAudit({mode:"compare",modules:[]}),/catalog required/);
});

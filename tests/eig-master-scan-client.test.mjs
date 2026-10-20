import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {requestMasterScan,validateMasterScanReport} from "../src/lib/eigMasterScanClient.mjs";
import {MASTER_SCAN_TARGETS} from "../src/lib/eigMasterScanTargets.mjs";
const require=createRequire(import.meta.url);
const {MODULES}=require("../server/eig-master-source-scan.cjs");
const {buildEnvironmentAudit}=require("../server/eig-master-environment-compare.cjs");

function fixture(mode="compare",moduleId=null) {
 return {schemaVersion:1,kind:"eig_build_lab_master_scan",target:"elevationpilot",
  scope:moduleId===null?"full":"module",selectedModule:moduleId,
  safety:{readOnly:true,liveChanges:false,customerRowsRead:false,autoApproved:false,autoDeployed:false},
  sourceFingerprint:"a".repeat(64),
  files:[{path:"src/PlatformApp.jsx",lines:200,kind:"source"}],
  modules:[{id:moduleId||"event-builder",title:moduleId||"Event Builder",status:"review_needed",
   nextCheck:"Verify event creation in Sandbox.",
   evidence:[{kind:"ui",path:"src/PlatformApp.jsx",line:4,excerpt:"<EieEventSetupSteps"}],
   tables:[{table:"events",production:true,sandbox:true}],priority:"high"}],
  database:{capturedOn:"2026-10-20",freshLiveQuery:false,productionTables:71,sandboxTables:71,
   missingInSandbox:[],missingInProduction:[],policyDifferences:[]},
  environmentAudit:buildEnvironmentAudit({mode,moduleId,modules:MODULES}),
  limitations:["Static preview source inspection only.","Dated environment snapshots only."],
 };
}
const client={auth:{getSession:async()=>({data:{session:{access_token:"test-session"}},error:null})}};
test("authorized Master Scanner sends exact read-only Compare Both target and validates evidence",async()=>{
 const report=await requestMasterScan(client,async(url,options)=>{
  assert.equal(url,"/api/eig-build-lab-master-scan");
  assert.equal(options.method,"POST");
  assert.equal(options.cache,"no-store");
  assert.equal(options.credentials,"same-origin");
  assert.equal(options.headers.Authorization,"Bearer test-session");
  assert.deepEqual(JSON.parse(options.body),{target:"elevationpilot",environmentMode:"compare"});
  return {ok:true,json:async()=>({ok:true,report:fixture()})};
 });
 assert.equal(report.environmentAudit.selected,"compare");
 assert.equal(report.environmentAudit.compare.source.totalChangedFiles,78);
});
test("server evidence must explicitly prove the environment is read-only and not a live test",()=>{
 for(const patch of [
  {kind:"other"},{sourceFingerprint:"broken"},
  {safety:{readOnly:false,liveChanges:true}},
  {database:{...fixture().database,freshLiveQuery:true}},
  {modules:[{...fixture().modules[0],evidence:[{kind:"ui",path:"../../.env",line:1,excerpt:"PRIVATE"}]}]},
  {modules:[{...fixture().modules[0],status:"deployed_to_production"}]},
  {environmentAudit:{...fixture().environmentAudit,freshDatabaseQuery:true}},
  {environmentAudit:{...fixture().environmentAudit,safety:{readOnly:true,liveModified:true}}},
  {environmentAudit:{...fixture().environmentAudit,sourceInspection:"live_browser_verified"}},
  {environmentAudit:{...fixture().environmentAudit,functionalTests:{live:"passed",sandbox:"passed"}}},
 ]) assert.throws(()=>validateMasterScanReport({...fixture(),...patch}),/report|Invalid/);
});
test("missing session or revoked owner permission cannot claim completion",async()=>{
 await assert.rejects(requestMasterScan(null),/Sign in/);
 await assert.rejects(requestMasterScan({auth:{getSession:async()=>({data:{session:null},error:null})}}),/Sign in again/);
 await assert.rejects(requestMasterScan(client,async()=>({ok:false,status:403})),/owner authorization/);
});
test("selected module and deployment mode are sent and matching response is required",async()=>{
 for(const mode of ["live","sandbox","compare"]){
  const id="event-builder";
  const report=await requestMasterScan(client,async(_,options)=>{
   assert.deepEqual(JSON.parse(options.body),{target:"elevationpilot",moduleId:id,environmentMode:mode});
   return {ok:true,json:async()=>({ok:true,report:fixture(mode,id)})};
  },id,mode);
  assert.equal(report.environmentAudit.selected,mode);
  assert.equal(report.environmentAudit.scope,id);
 }
 await assert.rejects(requestMasterScan(client,async()=>({
  ok:true,json:async()=>({ok:true,report:fixture("sandbox","event-builder")})
 }),"event-builder","live"),/different environment/);
 await assert.rejects(requestMasterScan(client,async()=>({
  ok:true,json:async()=>({ok:true,report:fixture()})
 }),"event-builder"),/different module/);
 await assert.rejects(requestMasterScan(client,async()=>({
  ok:true,json:async()=>({ok:true,report:fixture("compare","event-builder")})
 })),/targeted report for a full scan/);
 for(const invalid of ["../../.env","",{},7])
  await assert.rejects(requestMasterScan(client,async()=>{throw Error("should not fetch");},invalid),/Unsupported Master Scanner module/);
 for(const invalid of ["production","preview","../live",{},null])
  await assert.rejects(requestMasterScan(client,async()=>{throw Error("should not fetch");},null,invalid),/Unsupported Master Scanner environment/);
});
test("module picker remains aligned with the server allowlist",()=>{
 const ids=MASTER_SCAN_TARGETS.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(ids,MODULES.map(x=>x.id));
 assert.deepEqual(MASTER_SCAN_TARGETS.map(x=>x.label),MODULES.map(x=>x.title));
});

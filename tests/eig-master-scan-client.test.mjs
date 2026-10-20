import test from "node:test";
import assert from "node:assert/strict";
import {requestMasterScan,validateMasterScanReport} from "../src/lib/eigMasterScanClient.mjs";

function fixture(){
 return {schemaVersion:1,kind:"eig_build_lab_master_scan",target:"elevationpilot",
  safety:{readOnly:true,liveChanges:false,customerRowsRead:false,autoApproved:false,autoDeployed:false},
  sourceFingerprint:"a".repeat(64),
  files:[{path:"src/PlatformApp.jsx",lines:200,kind:"source"}],
  modules:[{id:"event-builder",title:"Event Builder",status:"evidence_present",nextCheck:"Verify event creation in Sandbox.",
   evidence:[{kind:"ui",path:"src/PlatformApp.jsx",line:4,excerpt:"<EieEventSetupSteps"}],
   tables:[{table:"events",production:true,sandbox:true}],priority:"high"}],
  database:{capturedOn:"2026-10-20",freshLiveQuery:false,productionTables:71,sandboxTables:71,
   missingInSandbox:[],missingInProduction:[],policyDifferences:[]},
  limitations:["Static source inspection only.","Dated snapshot only."],
 };
}
const client={auth:{getSession:async()=>({data:{session:{access_token:"test-session"}},error:null})}};
test("authorized Master Scanner sends exact target and validates server evidence",async()=>{
 const report=await requestMasterScan(client,async(url,options)=>{
  assert.equal(url,"/api/eig-build-lab-master-scan");
  assert.equal(options.method,"POST");
  assert.equal(options.cache,"no-store");
  assert.equal(options.credentials,"same-origin");
  assert.equal(options.headers.Authorization,"Bearer test-session");
  assert.deepEqual(JSON.parse(options.body),{target:"elevationpilot"});
  return {ok:true,json:async()=>({ok:true,report:fixture()})};
 });
 assert.equal(report.database.productionTables,71);
});
test("rejects forged or unsafe report",()=>{
 for(const patch of [
  {kind:"other"},{sourceFingerprint:"broken"},
  {safety:{readOnly:false,liveChanges:true}},
  {database:{...fixture().database,freshLiveQuery:true}},
  {modules:[{...fixture().modules[0],evidence:[{kind:"ui",path:"../../.env",line:1,excerpt:"PRIVATE"}]}]},
  {modules:[{...fixture().modules[0],status:"deployed_to_production"}]},
 ]) assert.throws(()=>validateMasterScanReport({...fixture(),...patch}),/report|Invalid/);
});
test("no session or revoked permission never reports completion",async()=>{
 await assert.rejects(requestMasterScan(null),/Sign in/);
 await assert.rejects(requestMasterScan({auth:{getSession:async()=>({data:{session:null},error:null})}}),/Sign in again/);
 await assert.rejects(requestMasterScan(client,async()=>({ok:false,status:403})),/owner authorization/);
});

test("selected module is sent as allowlisted target and must match returned scoped report",async()=>{
 const id="inception";
 const scoped={...fixture(),scope:"module",selectedModule:id,
   modules:[{...fixture().modules[0],id,title:"InceptionApex"}]};
 const found=await requestMasterScan(client,async(_,options)=>{
  assert.deepEqual(JSON.parse(options.body),{target:"elevationpilot",moduleId:id});
  return {ok:true,json:async()=>({ok:true,report:scoped})};
 },id);
 assert.equal(found.selectedModule,id);
 await assert.rejects(requestMasterScan(client,async()=>({
  ok:true,json:async()=>({ok:true,report:fixture()})
 }),id),/different module/);
 await assert.rejects(requestMasterScan(client,async()=>({
  ok:true,json:async()=>({ok:true,report:scoped})
 })),/targeted report for a full scan/);
 for(const invalid of ["../../.env","",{},7]){
  await assert.rejects(requestMasterScan(client,async()=>{throw Error("should not fetch");},invalid),/Unsupported Master Scanner module/);
 }
});

import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {validateImprovementRadar,requestImprovementRadar} from "../src/lib/eigMasterScanClient.mjs";
const require=createRequire(import.meta.url);
const {scanMasterSource,FILE_PATHS,readAllowlistedMasterSource}=require("../server/eig-master-source-scan.cjs");
const SHA="a".repeat(40);
const report=scanMasterSource(readAllowlistedMasterSource(),SHA,"2026-10-20T20:00:00.000Z");
const session={auth:{getSession:async()=>({data:{session:{access_token:"fake-owner-token"}},error:null})}};
function fixture(){
 return structuredClone(report.improvementAudit);
}
test("radar response validator accepts source-grounded candidates and real standards",()=>{
 const audit=validateImprovementRadar(fixture(),FILE_PATHS,SHA,"all");
 assert.equal(audit.suggestions.length,report.improvementAudit.suggestions.length);
 assert.ok(audit.references.some(x=>x.id==="owasp-asvs"));
});
test("radar response validator rejects invented evidence, fake safety or external scan claims",()=>{
 const first=fixture().suggestions[0];
 const variants=[
  {...fixture(),kind:"different"},
  {...fixture(),scope:"../../secret"},
  {...fixture(),safety:{...fixture().safety,autoBuilt:true}},
  {...fixture(),safety:{...fixture().safety,aiCalled:true}},
  {...fixture(),safety:{...fixture().safety,liveChanges:true}},
  {...fixture(),origin:"external_ai_scanned_competitors"},
  {...fixture(),references:[{id:"owasp-asvs",name:"Fake",url:"http://internal/secrets"}]},
  {...fixture(),suggestions:[{...first,claim:"confirmed_missing_feature"}]},
  {...fixture(),suggestions:[{...first,evidence:[{path:"../.env",line:1,excerpt:"PRIVATE"}]}]},
  {...fixture(),suggestions:[{...first,status:"preview_signals_found",signalCount:0}]},
  {...fixture(),suggestions:[{...first,id:"new_unknown",lane:"deleted"}]},
  {...fixture(),summary:{...fixture().summary,wow:1234}},
 ];
 for(const bad of variants)
  assert.throws(()=>validateImprovementRadar(bad,FILE_PATHS,SHA,"all"),/Radar|Invalid/);
});
test("Radar uses authenticated protected Master Scanner and preserves source/version boundaries",async()=>{
 let calls=0;
 const result=await requestImprovementRadar(session,async(url,options)=>{
  calls++;
  assert.equal(url,"/api/eig-build-lab-master-scan");
  assert.equal(options.credentials,"same-origin");
  assert.equal(options.cache,"no-store");
  assert.equal(options.headers.Authorization,"Bearer fake-owner-token");
  assert.deepEqual(JSON.parse(options.body),{target:"elevationpilot",environmentMode:"compare"});
  return {ok:true,json:async()=>({ok:true,report})};
 });
 assert.equal(calls,1);
 assert.equal(result.fingerprint,report.sourceFingerprint);
 assert.equal(result.radar.summary.wow>0,true);
 assert.equal(result.radar.safety.liveChanges,false);
});
test("missing Radar or invalid owner session fail closed",async()=>{
 const noRadar={...report};delete noRadar.improvementAudit;
 await assert.rejects(requestImprovementRadar(session,async()=>({
  ok:true,json:async()=>({ok:true,report:noRadar})
 })),/not included/);
 await assert.rejects(requestImprovementRadar(null,async()=>{throw Error("Should not call");}),/Sign in/);
 await assert.rejects(requestImprovementRadar(session,async()=>({ok:false,status:403})),/owner authorization/);
});

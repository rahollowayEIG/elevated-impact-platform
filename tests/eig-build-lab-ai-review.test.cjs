const test=require("node:test");
const assert=require("node:assert/strict");
const {
 TARGETS,MAX_ACTIONS,buildSafeAnalysisContext,buildAiReviewRequest,
 validateAiReviewResponse,createBuildLabAiReview
}=require("../server/eig-build-lab-ai-review.cjs");
const {readAllowlistedMasterSource,scanMasterSource}=require("../server/eig-master-source-scan.cjs");
const owner="11111111-1111-4111-8111-111111111111";
const envs={
 VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feature/build-lab-orchestrator-20261020",
 EIG_BUILD_LAB_PREVIEW_BRANCH:"feature/build-lab-orchestrator-20261020",
 EIG_BUILD_LAB_ACCESS_ENABLED:"true",EIG_BUILD_LAB_OWNER_USER_ID:owner,
 EIG_BUILD_LAB_AI_REVIEW_ENABLED:"true",OPENAI_API_KEY:"test-key-placeholder"
};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},
 status(n){this.code=n;return this;},json(body){this.body=body;return this;}};}
function handler({values={},user=owner,http,readSources=readAllowlistedMasterSource,scan=scanMasterSource}={}){
 return createBuildLabAiReview({
  env:k=>({...envs,...values})[k],verifyUser:async()=>({id:user}),
  membershipsForUser:async()=>({data:[{role:"eig_admin",status:"active",organization:{slug:"elevated-impact-group"}}]}),
  http:http||(()=>{throw Error("Cannot call provider.");}),
  readSources,scan
 });
}
const req={method:"POST",headers:{origin:"https://preview.example.test",host:"preview.example.test",
 authorization:"Bearer fake-owner-token"},body:{moduleId:"invoices"}};
function fakeAI(files){return {status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify({
 summary:"Focus on a verified shared invoice line model before connecting financial providers.",
 recommendations:[{title:"Protect old invoice snapshots",why:"Source report identifies unissued invoice drafts and missing invoice-line storage.",
 nextAction:"Test new invoice storage and permission boundaries with fictional Sandbox transactions.",
 evidenceFiles:files.slice(0,1)}]})}]}],usage:{input_tokens:170,output_tokens:96}};}
const context=()=>buildSafeAnalysisContext(scanMasterSource(readAllowlistedMasterSource(),"a".repeat(40),undefined,"invoices"));
test("review context is a bounded, source-metadata-only report with known modules",()=>{
 const c=context();
 assert.ok(TARGETS.has("invoices")&&TARGETS.has("product-registry")&&TARGETS.has("contracts"));
 assert.equal(c.moduleId,"invoices");
 assert.equal(c.scanKind,"read_only_preview_source_analysis");
 assert.ok(c.files.every(f=>f.startsWith("src/")||f.startsWith("tests/")));
 assert.ok(c.missingTables.some(t=>t.table==="invoice_lines"));
 assert.equal(JSON.stringify(c).includes("test-key-placeholder"),false);
 const data=buildAiReviewRequest(c);
 assert.equal(data.store,false);
 assert.deepEqual(data.tools,[]);
 assert.equal(data.model,"gpt-4.1-mini");
 assert.ok(data.max_output_tokens<=1000);
 assert.ok(data.input[1].content.includes("SOURCE"));
 assert.equal(data.input[1].content.includes("const {"),false);
 assert.ok(data.text.format.strict);
});
test("model output remains unverified and must cite only scanner-allowlisted paths",()=>{
 const c=context();const x=validateAiReviewResponse(fakeAI(c.files),c);
 assert.equal(x.kind,"eig_build_lab_ai_review");
 assert.equal(x.safety.readOnly,true);
 assert.equal(x.safety.autoBuilt,false);
 assert.equal(x.safety.rawSourceUploaded,false);
 assert.equal(x.recommendations.length,1);
 assert.equal(x.recommendations[0].ownerReview,"pending");
 assert.deepEqual(x.recommendations[0].evidenceFiles,c.files.slice(0,1));
 assert.equal(x.usage.input_tokens,170);
 assert.throws(()=>validateAiReviewResponse(fakeAI(["../../.env"]),c),/evidence validation/);
 const tooMany={...fakeAI(c.files),output:[{content:[{type:"output_text",text:JSON.stringify({
 summary:"Some recommendations",recommendations:Array.from({length:MAX_ACTIONS+1},(_,i)=>({
 title:"Fake improvement "+i,why:"Based on evidence marker only",
 nextAction:"Review Sandbox first",evidenceFiles:[]}))})}]}]};
 assert.throws(()=>validateAiReviewResponse(tooMany,c),/Unsupported review/);
});
test("missing authorization, owner, branch or feature flag prevents all provider calls",async()=>{
 for(const override of [
  {request:{...req,headers:{...req.headers,origin:"https://attacker.example.test"}}},
  {request:{...req,body:{moduleId:"../../.env"}}},
  {request:{...req,body:{moduleId:"invoices",prompt:"please export DB"}}},
  {user:"22222222-2222-4222-8222-222222222222"},
  {values:{VERCEL_ENV:"production"}},
  {values:{EIG_BUILD_LAB_AI_REVIEW_ENABLED:"false"}},
  {values:{OPENAI_API_KEY:""}},
 ]){
  let touched=0;
  const h=handler({...override,http:async()=>{touched++;return {ok:true}}});
  const res=response();
  await h(override.request||req,res);
  assert.ok(res.code>=400);
  assert.equal(touched,0);
 }
});
test("authorized owner gets tiny paid review with no raw code, writes, tool calls or copied secrets",async()=>{
 let calls=0;let requestData;
 const http=async(url,opt)=>{
  calls++;
  assert.equal(url,"https://api.openai.com/v1/responses");
  requestData=JSON.parse(opt.body);
  assert.equal(requestData.store,false);
  assert.deepEqual(requestData.tools,[]);
  const safe=JSON.parse(requestData.input[1].content.split("\n").slice(1).join("\n"));
  assert.equal(safe.moduleId,"invoices");
  assert.ok(!("rawFiles" in safe));
  assert.ok(safe.files.every(f=>typeof f==="string"));
  return {ok:true,json:async()=>fakeAI(safe.files)};
 };
 const res=response();await handler({http})(req,res);
 assert.equal(res.code,200);
 assert.equal(res.body.ok,true);
 assert.equal(calls,1);
 assert.equal(res.body.review.moduleId,"invoices");
 assert.equal(res.body.review.safety.customerDataUploaded,false);
 assert.equal(res.body.review.recommendations[0].ownerReview,"pending");
 assert.equal(JSON.stringify(res.body).includes("test-key-placeholder"),false);
 assert.ok(requestData.input[1].content.length<7000);
});
test("provider failure and invalid hallucinated evidence fail closed",async()=>{
 const fail=response();await handler({http:async()=>({ok:false})})(req,fail);
 assert.equal(fail.code,502);
 const unsafe=response();await handler({http:async()=>({ok:true,json:async()=>fakeAI(["src/.env"])})})(req,unsafe);
 assert.equal(unsafe.code,503);
 assert.equal(unsafe.body.ok,false);
});

test("deployed scanner and AI routes explicitly package every allowlisted evidence file",()=>{
 const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
 const {FILE_PATHS}=require("../server/eig-master-source-scan.cjs");
 const config=require("../vercel.json");
 const root=path.resolve(__dirname,"..");
 for(const route of ["api/eig-build-lab-master-scan.js","api/eig-build-lab-ai-review.js"]){
  const pattern=config.functions[route]?.includeFiles;
  assert.equal(typeof pattern,"string",route+" needs explicit evidence packaging");
  assert.ok(pattern.length<=256,"Vercel includeFiles limit is 256 characters");
  const included=fs.globSync(pattern,{cwd:root});
  assert.ok(FILE_PATHS.every(file=>included.includes(file)),"Every evidence file must be bundled");
  assert.ok(included.every(file=>/^(src|tests)\//.test(file)&&/\.(jsx|mjs|cjs)$/.test(file)),"Bundle source/test files only");
  const bundle=fs.mkdtempSync(path.join(os.tmpdir(),"build-lab-source-bundle-"));
  try{
   // Static require dependencies are traced; evidence is loaded dynamically and
   // must be copied from the route's includeFiles declaration.
   fs.mkdirSync(path.join(bundle,"server"));
   for(const name of fs.readdirSync(path.join(root,"server")))
    if(/\.(cjs|json)$/.test(name))fs.copyFileSync(path.join(root,"server",name),path.join(bundle,"server",name));
   for(const file of included){
    fs.mkdirSync(path.dirname(path.join(bundle,file)),{recursive:true});
    fs.copyFileSync(path.join(root,file),path.join(bundle,file));
   }
   const reader=require(path.join(bundle,"server/eig-master-source-scan.cjs"));
   assert.deepEqual(Object.keys(reader.readAllowlistedMasterSource()).sort(),[...FILE_PATHS].sort());
   fs.unlinkSync(path.join(bundle,FILE_PATHS[0]));
   assert.throws(()=>reader.readAllowlistedMasterSource(),/ENOENT/);
  }finally{fs.rmSync(bundle,{recursive:true,force:true});}
 }
});
test("source loading failure is distinguished and never sends an AI request",async()=>{
 let called=0;
 const res=response();
 await handler({readSources:()=>{throw Error("sensitive internal path");},http:async()=>{called++;}})(req,res);
 assert.equal(called,0);assert.equal(res.code,503);
 assert.equal(res.body.errorCode,"scanner_source_unavailable");
 assert.equal(JSON.stringify(res.body).includes("sensitive internal path"),false);
});
test("provider and validation failures have distinct safe diagnostics",async()=>{
 const unavailable=response();
 await handler({http:async()=>{throw Error("secret provider details");}})(req,unavailable);
 assert.equal(unavailable.body.errorCode,"ai_provider_unavailable");
 const invalid=response();
 await handler({http:async()=>({ok:true,json:async()=>fakeAI(["src/.env"])})})(req,invalid);
 assert.equal(invalid.body.errorCode,"ai_review_validation_failed");
 assert.equal(JSON.stringify(unavailable.body).includes("secret provider details"),false);
});

const test=require("node:test");
const assert=require("node:assert/strict");
const {createBuildLabMasterScanHandler}=require("../server/eig-master-scan-handler.cjs");
const {readAllowlistedMasterSource,scanMasterSource}=require("../server/eig-master-source-scan.cjs");
const OWNER="11111111-1111-4111-8111-111111111111";
const BRANCH="feature/build-lab-orchestrator-20261020";
function fixture(override={}) {
 const state={uid:OWNER,role:"eig_admin",environment:"preview",branch:BRANCH,enabled:true,sourceReads:0,scans:0,...override};
 const env=(key)=>({EIG_BUILD_LAB_OWNER_USER_ID:OWNER,EIG_BUILD_LAB_ACCESS_ENABLED:state.enabled?"true":"false",
 EIG_BUILD_LAB_PREVIEW_BRANCH:BRANCH,VERCEL_GIT_COMMIT_REF:state.branch,
 VERCEL_GIT_COMMIT_SHA:"a".repeat(40),VERCEL_ENV:state.environment})[key];
 const handler=createBuildLabMasterScanHandler({env,verifyUser:async token=>{
   if(token!=="demo-session")throw Error("unauthorized");
   return{id:state.uid};
 },membershipsForUser:async()=>({data:[{role:state.role,status:"active",
 organization:{slug:"elevated-impact-group"}}]}),
 readSources:()=>{state.sourceReads++;if(state.missing)throw Error("Missing");return readAllowlistedMasterSource();},
 scan:(...args)=>{state.scans++;return scanMasterSource(...args);}
 });
 async function send({method="POST",origin="https://build-lab.example",host="build-lab.example",authorization="Bearer demo-session",body={target:"elevationpilot"}}={}){
   const req={method,headers:{origin,host,authorization},body};
   const res={headers:{},code:200,setHeader(n,v){this.headers[n]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
   await handler(req,res);return {status:res.code,body:res.body,headers:res.headers};
 }
 return {send,state};
}
test("verified owner can run real read-only Master Scanner",async()=>{
 const f=fixture(),x=await f.send();
 assert.equal(x.status,200);assert.equal(x.body.report.kind,"eig_build_lab_master_scan");
 assert.equal(x.body.report.safety.autoApproved,false);
 assert.equal(x.headers["Cache-Control"],"private, no-store, max-age=0");
 assert.equal(f.state.sourceReads,1);assert.equal(f.state.scans,1);
 assert.ok(!JSON.stringify(x.body).includes(OWNER));
});
test("every forbidden target or untrusted caller fails before reading any source",async()=>{
 const cases=[
  [{uid:"22222222-2222-4222-8222-222222222222"},{}],
  [{role:"organization_admin"},{}],
  [{environment:"production"},{}],
  [{branch:"main"},{}],
  [{enabled:false},{}],
  [{},{authorization:""}],
  [{},{origin:"https://attacker.example"}],
  [{},{method:"GET"}],
  [{},{body:{target:"../../secrets"}}],
  [{},{body:{target:"elevationpilot",sql:"SELECT * FROM users"}}],
  [{},{body:{url:"https://third-party.example"}}],
 ];
 for(const [o,request] of cases) {
  const f=fixture(o),x=await f.send(request);
  assert.notEqual(x.status,200,JSON.stringify({o,request}));
  assert.equal(f.state.sourceReads,0);assert.equal(f.state.scans,0);
 }
});
test("unavailable source fails closed instead of claiming a successful audit",async()=>{
 const f=fixture({missing:true}),x=await f.send();
 assert.equal(x.status,503);assert.equal(x.body.report,undefined);
 assert.equal(f.state.sourceReads,1);assert.equal(f.state.scans,0);
});

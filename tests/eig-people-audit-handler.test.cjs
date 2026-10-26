const test=require("node:test");
const assert=require("node:assert/strict");
const {createPeopleAuditHandler}=require("../server/eig-people-audit-handler.cjs");
const owner="123e4567-e89b-12d3-a456-426614174000";
const settings={
 VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feature/build-lab-orchestrator-20261020",
 EIG_BUILD_LAB_PREVIEW_BRANCH:"feature/build-lab-orchestrator-20261020",
 EIG_BUILD_LAB_ACCESS_ENABLED:"true",EIG_BUILD_LAB_OWNER_USER_ID:owner
};
const membership={role:"eig_admin",status:"active",organization:{slug:"elevated-impact-group"}};
function response(){
 return {statusCode:0,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(s){this.statusCode=s;return this;},
  json(b){this.body=b;return this;}
 };
}
function request(body={scope:"eie_golf_registrations"}){
 return {method:"POST",body,headers:{origin:"https://preview.vercel.app",host:"preview.vercel.app",authorization:"Bearer token"}};
}
function handler(userId=owner,audit=async()=>({kind:"eig_people_integrity_audit",totals:{activeNamed:2}})){
 return createPeopleAuditHandler({
  env:k=>settings[k],verifyUser:async()=>({id:userId}),
  membershipsForUser:async()=>({data:[membership]}),audit,
  now:()=>Date.parse("2026-10-26T12:00:00Z")
 });
}
test("owner can run a read-only audit; no data is supplied in request",async()=>{
 const res=response();await handler()(request(),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);
 assert.equal(res.body.audit.totals.activeNamed,2);
 assert.equal(res.headers["Cache-Control"],"private, no-store, max-age=0");
});
test("rejects non-owner, unexpected scope and incomplete audit",async()=>{
 const other=response();await handler("00000000-0000-0000-0000-000000000001")(request(),other);
 assert.equal(other.statusCode,403);
 const bad=response();await handler()(request({scope:"all",query:"drop table"}),bad);
 assert.equal(bad.statusCode,400);
 const broken=response();await handler(owner,async()=>{throw Error("RLS incomplete");})(request(),broken);
 assert.equal(broken.statusCode,503);assert.equal(broken.body.ok,false);
 assert.equal(JSON.stringify(broken.body).includes("RLS incomplete"),false);
});

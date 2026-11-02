'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {authorizeBuildLabLiveReadOnlyOwner}=require('../server/eig-build-lab-live-readonly-access.cjs');
const {createBuildLabDurableRecordsHandler}=require('../server/eig-build-lab-durable-records.cjs');
const {createBuildLabAiReviewHandler}=require('../server/eig-build-lab-ai-review.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const origin='https://elevated-impact-platform.vercel.app';
const request={method:'POST',headers:{origin,host:'elevated-impact-platform.vercel.app',authorization:'Bearer synthetic'}};
const baseEnv={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main',
 EIG_BUILD_LAB_LIVE_READONLY_ENABLED:'true',EIG_BUILD_LAB_LIVE_OWNER_USER_ID:owner};
const env=(v={})=>key=>({...baseEnv,...v})[key];
const providers={verifyUser:async()=>({id:owner}),verifyLiveSession:async()=>true,
 membershipsForUser:async()=>({data:[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'}}]})};
const grant=extra=>authorizeBuildLabLiveReadOnlyOwner(request,{env:env(),...providers,...extra});
function response(){return{statusCode:null,body:null,headers:{},
 setHeader(key,value){this.headers[key]=value;},
 status(code){this.statusCode=code;return this;},
 json(body){this.body=body;return this;}};}
test('production owner gate allows only exact EIG owner with valid live session and scoped membership',async()=>{
 assert.equal((await grant({})).allowed,true);
 assert.equal((await grant({verifyUser:async()=>({id:'22222222-2222-4222-8222-222222222222'})})).allowed,false);
 assert.equal((await grant({verifyLiveSession:async()=>false})).allowed,false);
 assert.equal((await grant({membershipsForUser:async()=>({data:[]})})).allowed,false);
 assert.equal((await grant({membershipsForUser:async()=>({data:[{role:'eig_admin',status:'inactive',organization:{slug:'elevated-impact-group'}}]})})).allowed,false);
 assert.equal((await grant({membershipsForUser:async()=>({data:[{role:'pilot',status:'active',organization:{slug:'elevated-impact-group'}}]})})).allowed,false);
});
test('production gate fails closed for wrong branch, disabled flag, missing provider, wrong request origin/host',async()=>{
 for(const [key,value] of [['VERCEL_GIT_COMMIT_REF','other'],['VERCEL_ENV','preview'],['EIG_BUILD_LAB_LIVE_READONLY_ENABLED','false'],['EIG_BUILD_LAB_LIVE_OWNER_USER_ID','']]){
  const result=await grant({env:env({[key]:value})});assert.equal(result.allowed,false,key);
 }
 assert.equal((await grant({verifyLiveSession:null})).allowed,false);
 for(const headers of [{...request.headers,origin:'https://another.example'},{...request.headers,host:'other.vercel.app'}]){
  const x=await authorizeBuildLabLiveReadOnlyOwner({...request,headers},{env:env(),...providers});
  assert.equal(x.allowed,false);
 }
});
test('production cloud records deny access when write flag is unset, even for a valid owner',async()=>{
 let storageReads=0,storageWrites=0;
 const handler=createBuildLabDurableRecordsHandler({
  env:env(),...providers,authorizeOwner:async()=>({allowed:true,status:200}),
  store:{read:async()=>{storageReads++;return null;},save:async()=>{storageWrites++;return {saved:true};}}
 });
 const res=response();
 await handler({...request,body:{action:'save',kind:'scan_history',expectedRevision:0,payload:{}}},res);
 assert.equal(res.statusCode,403);assert.equal(storageReads,0);assert.equal(storageWrites,0);
});
test('AI never reaches its source reader or provider on production, regardless of AI flag',async()=>{
 let reads=0,calls=0;
 const handler=createBuildLabAiReviewHandler({
  env:env({EIG_BUILD_LAB_AI_REVIEW_ENABLED:'true',OPENAI_API_KEY:'synthetic'}),
  ...providers,authorize:async()=>({allowed:true,status:200}),
  readSources:()=>{reads++;return {};},scan:()=>({}),
  fetchFn:async()=>{calls++;return {};}
 });
 const res=response();
 await handler({...request,body:{target:'master'}},res);
 assert.equal(res.statusCode,403);assert.equal(reads,0);assert.equal(calls,0);
});
test('production source, client UI and routes preserve explicit opt-in / no autoproduction AI',()=>{
 const fs=require('node:fs');const path=require('node:path');
 const root=path.resolve(__dirname,'..');
 const app=fs.readFileSync(path.join(root,'src/PlatformApp.jsx'),'utf8');
 const ai=fs.readFileSync(path.join(root,'api/eig-build-lab-ai-review.js'),'utf8');
 const workspace=fs.readFileSync(path.join(root,'src/components/BuildLabLiveOwnerWorkspace.jsx'),'utf8');
 assert.match(app,/VITE_EIG_BUILD_LAB_LIVE_OWNER_UI_ENABLED/);
 assert.match(app,/requestLiveBuildLabAccess\(supabase\)/);
 assert.match(ai,/authorizeBuildLabOwnerPreview/);
 assert.match(workspace,/VITE_EIG_BUILD_LAB_AI_REVIEW_UI_ENABLED/);
 assert.doesNotMatch(workspace,/BuildLabBuilder|BuildLabAiConnection/);
});

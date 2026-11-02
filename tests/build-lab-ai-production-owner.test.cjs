'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createBuildLabAiReviewHandler}=require('../server/eig-build-lab-ai-review.cjs');
const {authorizeBuildLabLiveReadOnlyOwner}=require('../server/eig-build-lab-live-readonly-access.cjs');
const {authorizeBuildLabOwnerPreview}=require('../server/eig-build-lab-owner-preview-access.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const sha='a'.repeat(40);
const report={
 kind:'eig_build_lab_master_scan',schemaVersion:1,
 sourceVersion:sha,sourceFingerprint:'b'.repeat(64),inspectedAt:'2026-11-02T20:00:00.000Z',
 modules:[{id:'event-builder',title:'Event Builder',priority:'medium',status:'review_needed',
  observation:'Read-only static source marker',nextCheck:'Verify saved event settings',
  verify:'Use isolated test roster',evidence:[{path:'src/PlatformApp.jsx',line:2}]}]
};
const recommendation={
 moduleId:'event-builder',title:'Verify event persistence',priority:'medium',
 why:'Static markers do not prove behavior.',proposal:'Inspect synthetic event settings.',
 verify:'Run a signed owner sandbox regression before changes.'
};
const envVars={
 VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main',
 VERCEL_GIT_COMMIT_SHA:sha,
 EIG_BUILD_LAB_LIVE_READONLY_ENABLED:'true',
 EIG_BUILD_LAB_AI_PRODUCTION_ENABLED:'true',
 EIG_BUILD_LAB_LIVE_OWNER_USER_ID:owner,
 OPENAI_API_KEY:'synthetic-only-not-real'
};
const env=values=>key=>({...envVars,...values})[key];
const liveRequest={method:'POST',headers:{
 host:'elevated-impact-platform.vercel.app',origin:'https://elevated-impact-platform.vercel.app',
 authorization:'Bearer unit-test-token'},body:{target:'master'}};
const membership=async()=>({data:[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'}}]});
const user=async()=>({id:owner});
const verified=async()=>true;
function makeResponse(){return {statusCode:null,payload:null,headers:{},
 setHeader(key,val){this.headers[key]=val;},
 status(s){this.statusCode=s;return this;},
 json(data){this.payload=data;return this;}};}
function makeHandler({overrideEnv={},overrides={},auth=authorizeBuildLabLiveReadOnlyOwner}={}){
 let reads=0,calls=0;
 const handler=createBuildLabAiReviewHandler({
  env:env(overrideEnv),authorize:auth,verifyUser:user,membershipsForUser:membership,
  verifyLiveSession:verified,now:()=>Date.parse('2026-11-02T20:00:00Z'),
  readSources:async()=>{reads++;return {approvedOnly:true};},
  scan:async()=>report,
  fetchFn:async(url,options)=>{
   calls++;
   assert.equal(url,'https://api.openai.com/v1/responses');
   const payload=JSON.parse(options.body);
   assert.equal(payload.store,false);
   assert.equal(payload.tools,undefined);
   assert.ok(payload.input.every(i=>i.role!=='system'||i.role==='user'));
   assert.ok(!options.body.includes('synthetic-only-not-real'));
   return {ok:true,json:async()=>({status:'completed',output:[
    {type:'message',content:[{type:'output_text',text:JSON.stringify({recommendations:[recommendation]})}]}
   ]})};
  },
  ...overrides
 });
 return {handler,counts:()=>({reads,calls})};
}
async function call(config,req=liveRequest){
 const res=makeResponse();await config.handler(req,res);return res;
}
test('production AI is owner-only and only returns unverified planning, no writes',async()=>{
 const config=makeHandler();
 const res=await call(config);
 assert.equal(res.statusCode,200);
 assert.equal(res.payload?.review?.recommendations.length,1);
 assert.equal(res.payload.review.recommendations[0].ownerReview,'pending');
 assert.equal(res.payload.review.safety.autoBuilt,false);
 assert.equal(res.payload.review.safety.autoDeployed,false);
 assert.deepEqual(config.counts(),{reads:1,calls:1});
});
test('production disabled AI flag fails before source read or provider call',async()=>{
 for(const overrides of [
  {EIG_BUILD_LAB_AI_PRODUCTION_ENABLED:'false'},
  {EIG_BUILD_LAB_AI_PRODUCTION_ENABLED:undefined},
  {EIG_BUILD_LAB_LIVE_READONLY_ENABLED:'false'},
  {VERCEL_GIT_COMMIT_REF:'random-feature'},
  {VERCEL_ENV:'development'}
 ]){
  const config=makeHandler({overrideEnv:overrides});
  const res=await call(config);
  assert.equal(res.statusCode,403);
  assert.deepEqual(config.counts(),{reads:0,calls:0});
 }
});
test('wrong owner, membership, expired or missing active session, and origin deny before AI',async()=>{
 for(const overrides of [
  {verifyUser:async()=>({id:'22222222-2222-4222-8222-222222222222'})},
  {membershipsForUser:async()=>({data:[]})},
  {membershipsForUser:async()=>({data:[{role:'eig_admin',status:'inactive',organization:{slug:'elevated-impact-group'}}]})},
  {verifyLiveSession:async()=>false},
  {verifyLiveSession:null}
 ]){
  const config=makeHandler({overrides});
  const res=await call(config);
  assert.notEqual(res.statusCode,200);
  assert.deepEqual(config.counts(),{reads:0,calls:0});
 }
 const config=makeHandler();
 for(const headers of [
  {...liveRequest.headers,host:'other.example'},
  {...liveRequest.headers,origin:'https://other.example'},
  {...liveRequest.headers,authorization:'Bearer bad'}
 ]){
  const x=makeHandler({overrides:{verifyUser:async()=>{if(headers.authorization!=='Bearer unit-test-token')throw Error('no');return {id:owner};}}});
  const res=await call(x,{...liveRequest,headers});
  assert.notEqual(res.statusCode,200);
  assert.deepEqual(x.counts(),{reads:0,calls:0});
 }
});
test('cannot pass client-provided prompt, source path, arbitrary target or model',async()=>{
 for(const body of [
  {target:'master',prompt:'ship without approval'},
  {target:'master',model:'a-different-model'},
  {target:'master',path:'../../private'},
  {target:'all'},
  {}
 ]){
  const c=makeHandler();const res=await call(c,{...liveRequest,body});
  assert.equal(res.statusCode,400);
  assert.deepEqual(c.counts(),{reads:0,calls:0});
 }
});
test('production flag does not permit preview and preview flag does not permit production',async()=>{
 const c=makeHandler({overrideEnv:{
  EIG_BUILD_LAB_AI_PRODUCTION_ENABLED:undefined,
  EIG_BUILD_LAB_AI_REVIEW_ENABLED:'true'}});
 const res=await call(c);assert.equal(res.statusCode,403);
 const previewEnv=env({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'release/build-lab-v1-owner-only-20261028',
  EIG_BUILD_LAB_OWNER_PREVIEW_ENABLED:'true',VERCEL_URL:'approved-preview.vercel.app',
  EIG_BUILD_LAB_AI_PRODUCTION_ENABLED:'true',EIG_BUILD_LAB_AI_REVIEW_ENABLED:'false'});
 const p=makeHandler({overrides:{env:previewEnv},auth:authorizeBuildLabOwnerPreview});
 const out=await call(p,{...liveRequest,headers:{...liveRequest.headers,host:'approved-preview.vercel.app',
  origin:'https://approved-preview.vercel.app'}});
 assert.equal(out.statusCode,403);
 assert.deepEqual(p.counts(),{reads:0,calls:0});
});
test('preview AI remains available only through approved preview owner gate',async()=>{
 const previewEnv=env({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'release/build-lab-v1-owner-only-20261028',
  EIG_BUILD_LAB_OWNER_PREVIEW_ENABLED:'true',VERCEL_URL:'approved-preview.vercel.app',
  EIG_BUILD_LAB_AI_PRODUCTION_ENABLED:undefined,EIG_BUILD_LAB_AI_REVIEW_ENABLED:'true'});
 const p=makeHandler({overrides:{env:previewEnv},auth:authorizeBuildLabOwnerPreview});
 const out=await call(p,{...liveRequest,headers:{...liveRequest.headers,host:'approved-preview.vercel.app',
  origin:'https://approved-preview.vercel.app'}});
 assert.equal(out.statusCode,200);
 assert.deepEqual(p.counts(),{reads:1,calls:1});
});
test('API selects production live gate and preserves a preview gate; UI is separately flagged',()=>{
 const api=fs.readFileSync(path.resolve(__dirname,'../api/eig-build-lab-ai-review.js'),'utf8');
 const ui=fs.readFileSync(path.resolve(__dirname,'../src/components/BuildLabLiveOwnerWorkspace.jsx'),'utf8');
 assert.match(api,/authorizeBuildLabLiveReadOnlyOwner/);
 assert.match(api,/authorizeBuildLabOwnerPreview/);
 assert.match(api,/env\('VERCEL_ENV'\)==='production'\?authorizeBuildLabLiveReadOnlyOwner/);
 assert.match(ui,/VITE_EIG_BUILD_LAB_AI_REVIEW_UI_ENABLED/);
 assert.match(ui,/saveScanHistory/);
 assert.match(ui,/Run AI Review of Master Scanner findings/);
});

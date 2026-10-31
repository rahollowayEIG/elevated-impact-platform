'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBuildLabPreviewDocumentStore}=require('../server/eig-build-lab-preview-document-store.cjs');
const {createBuildLabDurableRecordsHandler}=require('../server/eig-build-lab-durable-records.cjs');
const {authorizeBuildLabOwnerPreview}=require('../server/eig-build-lab-owner-preview-access.cjs');

const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const REF='abcdefghijklmnopqrst'; // Synthetic, not an actual Supabase project
const HOST='build-lab-ci-preview.vercel.app';
const BASE={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'release/build-lab-v1-owner-only-20261028',
 EIG_BUILD_LAB_OWNER_PREVIEW_ENABLED:'true',
 EIG_BUILD_LAB_PREVIEW_RECORDS_ENABLED:'true',
 EIG_BUILD_LAB_LIVE_OWNER_USER_ID:OWNER,VERCEL_URL:HOST,
 VITE_SUPABASE_URL:'https://aszixzrdayrivungodwq.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'production-mock-key',
 EIG_BUILD_LAB_PREVIEW_STORAGE_PROJECT_REF:REF,
 EIG_BUILD_LAB_PREVIEW_STORAGE_URL:'https://'+REF+'.supabase.co',
 EIG_BUILD_LAB_PREVIEW_STORAGE_SERVICE_ROLE_KEY:'isolated-preview-mock-key'
};
const env=(override={})=>name=>Object.hasOwn(override,name)?override[name]:BASE[name];
const WORK={kind:'eig_work_buckets',version:1,jobs:[],batches:[]};

function storeCapture(){
 const calls=[];
 const client={
  from(name){
   calls.push(['table',name]);
   const q={select(cols){calls.push(['select',cols]);return q;},
    eq(k,v){calls.push(['filter',k,v]);return q;},
    async maybeSingle(){return {data:null,error:null};}};
   return q;
  },
  async rpc(name,params){
   calls.push(['rpc',name,params]);
   return {data:[{saved:true,new_revision:1,saved_at:'2026-10-31T20:00:00Z'}],error:null};
  }
 };
 const makeClient=(url,secret,options)=>{
  calls.push(['client',url,secret,options.auth.persistSession]);
  return client;
 };
 return {calls,makeClient};
}
function handlerFixture(overrides={}){
 const settings={user:OWNER,active:true,role:'eig_admin',org:'elevated-impact-group',...overrides};
 const e=env(settings.extraEnv||{});
 const calls=[];
 const store={
  async read(owner,kind){calls.push(['read',owner,kind]);return null;},
  async save(owner,kind,expected,payload){
   calls.push(['save',owner,kind,expected,payload]);
   return {saved:true,revision:expected+1,updatedAt:'2026-10-31T20:00:00Z'};
  }
 };
 const handler=createBuildLabDurableRecordsHandler({
  env:e,store,authorizeOwner:authorizeBuildLabOwnerPreview,
  recordsFlag:'EIG_BUILD_LAB_PREVIEW_RECORDS_ENABLED',
  verifyUser:async()=>({id:settings.user}),
  verifyLiveSession:async()=>settings.active,
  membershipsForUser:async()=>({data:[{role:settings.role,status:'active',
   organization:{slug:settings.org}}]})
 });
 const call=async(body,changes={})=>{
  const req={method:'POST',body,headers:{
   host:HOST,origin:'https://'+HOST,authorization:'Bearer synthetic-only',
   ...changes.headers
  },...('method' in changes?{method:changes.method}:{})};
  const res={headers:{},statusCode:200,body:null,
   setHeader(k,v){this.headers[k]=v;},
   status(n){this.statusCode=n;return this;},
   json(value){this.body=value;return this;}};
  await handler(req,res);
  return res;
 };
 return {call,calls};
}

test('preview storage adapter uses only independently named isolated project and secret',async()=>{
 const {calls,makeClient}=storeCapture();
 const store=createBuildLabPreviewDocumentStore(env(),makeClient);
 assert.equal(await store.read(OWNER,'scan_history'),null);
 assert.deepEqual(await store.save(OWNER,'work_buckets',0,WORK),{
  saved:true,revision:1,updatedAt:'2026-10-31T20:00:00Z'
 });
 assert.deepEqual(calls[0],['client','https://'+REF+'.supabase.co',
  'isolated-preview-mock-key',false]);
 assert.equal(calls.filter(x=>x[0]==='client').length,1);
 assert.ok(calls.some(x=>x[0]==='table'&&x[1]==='eig_build_lab_documents'));
 assert.ok(calls.some(x=>x[0]==='rpc'&&x[1]==='eig_build_lab_save_document'&&
  x[2].p_owner_user_id===OWNER));
});

test('adapter refuses production, pink Sandbox, Ticketing, main branch and reused production key',async()=>{
 const invalid=[
  {VERCEL_ENV:'production'},
  {VERCEL_GIT_COMMIT_REF:'main'},
  {EIG_BUILD_LAB_PREVIEW_RECORDS_ENABLED:'false'},
  {EIG_BUILD_LAB_PREVIEW_STORAGE_PROJECT_REF:'aszixzrdayrivungodwq',
   EIG_BUILD_LAB_PREVIEW_STORAGE_URL:'https://aszixzrdayrivungodwq.supabase.co'},
  {EIG_BUILD_LAB_PREVIEW_STORAGE_PROJECT_REF:'publruuuyvpggogrrgwp',
   EIG_BUILD_LAB_PREVIEW_STORAGE_URL:'https://publruuuyvpggogrrgwp.supabase.co'},
  {EIG_BUILD_LAB_PREVIEW_STORAGE_PROJECT_REF:'fyihtdhpkniuthsvxwla',
   EIG_BUILD_LAB_PREVIEW_STORAGE_URL:'https://fyihtdhpkniuthsvxwla.supabase.co'},
  {EIG_BUILD_LAB_PREVIEW_STORAGE_URL:'https://wrong.supabase.co'},
  {VITE_SUPABASE_URL:'https://'+REF+'.supabase.co'},
  {EIG_BUILD_LAB_PREVIEW_STORAGE_SERVICE_ROLE_KEY:'production-mock-key'},
  {EIG_BUILD_LAB_PREVIEW_STORAGE_SERVICE_ROLE_KEY:''},
  {EIG_BUILD_LAB_PREVIEW_STORAGE_PROJECT_REF:''}
 ];
 for(const item of invalid){
  const {calls,makeClient}=storeCapture();
  const store=createBuildLabPreviewDocumentStore(env(item),makeClient);
  await assert.rejects(()=>store.read(OWNER,'scan_history'),/not configured/,JSON.stringify(item));
  assert.equal(calls.length,0,'No database client may be created for '+JSON.stringify(item));
 }
 const {makeClient}=storeCapture();
 await assert.rejects(()=>createBuildLabPreviewDocumentStore(env(),makeClient)
  .save(OWNER,'payments',0,{}),/scope/);
 await assert.rejects(()=>createBuildLabPreviewDocumentStore(env(),makeClient)
  .save(OWNER,'scan_history',-1,{}),/revision/);
});

test('preview route handles explicit owner-only read and save with the same validation as production',async()=>{
 const f=handlerFixture();
 const empty=await f.call({action:'read',kind:'scan_history'});
 assert.equal(empty.statusCode,200);assert.equal(empty.body.found,false);
 const saved=await f.call({action:'save',kind:'work_buckets',expectedRevision:0,payload:WORK});
 assert.equal(saved.statusCode,200);assert.equal(saved.body.revision,1);
 assert.deepEqual(f.calls.map(c=>c[0]),['read','save']);
 assert.ok(f.calls.every(c=>c[1]===OWNER));
});

test('preview route refuses missing flag, wrong owner, revoked session, invalid origin and production deployment',async()=>{
 for(const opts of [
  {extraEnv:{EIG_BUILD_LAB_PREVIEW_RECORDS_ENABLED:'false'}},
  {extraEnv:{EIG_BUILD_LAB_OWNER_PREVIEW_ENABLED:'false'}},
  {extraEnv:{VERCEL_ENV:'production'}},
  {extraEnv:{VERCEL_GIT_COMMIT_REF:'main'}},
  {user:OTHER},{active:false},{role:'guest'},{org:'other-tenant'}
 ]){
  const f=handlerFixture(opts);
  assert.notEqual((await f.call({action:'read',kind:'scan_history'})).statusCode,200,JSON.stringify(opts));
  assert.equal(f.calls.length,0,'Denied request must not reach storage');
 }
 const wrongHost=handlerFixture();
 assert.equal((await wrongHost.call({action:'read',kind:'scan_history'},
  {headers:{origin:'https://evil.example'}})).statusCode,403);
 assert.equal(wrongHost.calls.length,0);
});

test('preview route cannot accept document owner overrides or arbitrary SQL',async()=>{
 const f=handlerFixture();
 for(const payload of [
  {action:'read',kind:'work_buckets',ownerUserId:OTHER},
  {action:'read',kind:'user_accounts'},
  {action:'save',kind:'scan_history',expectedRevision:0,payload:WORK,sql:'drop table'},
  {action:'save',kind:'work_buckets',expectedRevision:0,payload:{version:1,wrong:true}}
 ]){
  const response=await f.call(payload);
  assert.equal(response.statusCode,400,JSON.stringify(payload));
 }
 assert.equal(f.calls.length,0);
});

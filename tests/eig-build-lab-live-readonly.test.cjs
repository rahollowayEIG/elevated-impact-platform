const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {authorizeBuildLabLiveReadOnlyOwner,createBuildLabLiveReadOnlyAccessHandler,LIVE_ORIGIN}=require('../server/eig-build-lab-live-readonly-access.cjs');
const {buildLabLiveAuthProviders,verifiedSessionId}=require('../server/eig-build-lab-live-auth-client.cjs');
const {authorizeBuildLabPreviewOwner}=require('../server/eig-build-lab-preview-access.cjs');
const {createBuildLabMasterScanHandler}=require('../server/eig-master-scan-handler.cjs');
const {createBuildLabInceptionScanHandler}=require('../server/eig-build-lab-scan-handler.cjs');

const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const SESSION='33333333-3333-4333-8333-333333333333';
const WHEN=Date.parse('2026-10-28T21:00:00Z');
const DEFAULTS={
 mode:'production',branch:'main',enabled:true,owner:OWNER,
 authUser:OWNER,session:true,memberRole:'eig_admin',memberStatus:'active',
 org:'elevated-impact-group',since:null,until:null,memberError:false
};
function fixture(overrides={}){
 const state={...DEFAULTS,...overrides,authCalls:0,sessionCalls:0,memberCalls:0,reads:0};
 const env=k=>({
  VERCEL_ENV:state.mode,VERCEL_GIT_COMMIT_REF:state.branch,
  EIG_BUILD_LAB_LIVE_READONLY_ENABLED:state.enabled?'true':'false',
  EIG_BUILD_LAB_LIVE_OWNER_USER_ID:state.owner,
  VERCEL_GIT_COMMIT_SHA:'b'.repeat(40)
 })[k];
 const deps={env,now:()=>WHEN,
  verifyUser:async()=>{state.authCalls++;return {id:state.authUser};},
  verifyLiveSession:async(id,token)=>{state.sessionCalls++;assert.equal(id,OWNER);assert.equal(token,'test-access-token');return state.session;},
  membershipsForUser:async(id,token)=>{state.memberCalls++;assert.equal(id,OWNER);assert.equal(token,'test-access-token');return {
    error:state.memberError?{message:'membership rejected'}:null,
    data:[{role:state.memberRole,status:state.memberStatus,organization:{slug:state.org},access_starts_at:state.since,access_ends_at:state.until}]
  };}
 };
 const req=(settings={})=>({method:'POST',headers:{origin:LIVE_ORIGIN,host:'elevated-impact-platform.vercel.app',authorization:'Bearer test-access-token'},body:{},...settings,headers:{origin:LIVE_ORIGIN,host:'elevated-impact-platform.vercel.app',authorization:'Bearer test-access-token',...settings.headers}});
 const res=()=>({headers:{},code:200,setHeader(k,v){this.headers[k]=v;return this;},status(x){this.code=x;return this;},json(v){this.body=v;return this;}});
 return {state,deps,req,res};
}

test('strict Live grant requires owner, active admin session and active EIG membership',async()=>{
 const f=fixture();
 const grant=await authorizeBuildLabLiveReadOnlyOwner(f.req(),f.deps);
 assert.deepEqual(grant,{allowed:true,status:200,scope:'read_only'});
 assert.equal(f.state.authCalls,1);assert.equal(f.state.sessionCalls,1);assert.equal(f.state.memberCalls,1);
 const response=f.res();
 await createBuildLabLiveReadOnlyAccessHandler(f.deps)(f.req(),response);
 assert.equal(response.code,200);
 assert.deepEqual(response.body,{allowed:true,access:'build_lab_live_readonly',scope:'read_only'});
 assert.equal(response.headers['Cache-Control'],'private, no-store, max-age=0');
 assert.doesNotMatch(JSON.stringify(response.body),/11111111/);
});

test('Live gate is disabled by default, and NEVER accepts preview/development/wrong branch',async()=>{
 for(const overrides of [
  {enabled:false},{mode:'preview'},{mode:'development'},{branch:'feature/build-lab-orchestrator-20261020'},
  {branch:undefined},{owner:''},{owner:'not-uuid'}
 ]){
  const f=fixture(overrides),result=await authorizeBuildLabLiveReadOnlyOwner(f.req(),f.deps);
  assert.equal(result.allowed,false,JSON.stringify(overrides));
  assert.equal(f.state.authCalls,0,'Denied before touching auth provider');
 }
});

test('wrong origins, forged host, missing tokens and unsupported methods fail before scanning',async()=>{
 const cases=[
  {headers:{origin:'https://attacker.example'}},{headers:{origin:undefined}},
  {headers:{host:'attacker.example'}},{headers:{host:'preview.example'}},
  {headers:{authorization:''}},{headers:{authorization:'Bearer '}},{method:'GET'},{method:'OPTIONS'}
 ];
 for(const opts of cases){
  const f=fixture(),result=await authorizeBuildLabLiveReadOnlyOwner(f.req(opts),f.deps);
  assert.equal(result.allowed,false,JSON.stringify(opts));
  assert.equal(f.state.authCalls,0);
 }
});

test('non-owner, revoked session, expired or wrong organization and membership query failures all deny',async()=>{
 const cases=[
  {authUser:OTHER},{authUser:null},{session:false},{memberRole:'organization_admin'},
  {memberStatus:'disabled'},{org:'unrelated-tenant'},{memberError:true},
  {since:'2026-10-29T00:00:00Z'},{until:'2026-10-27T00:00:00Z'},
  {since:'malformed'}
 ];
 for(const opts of cases){
  const f=fixture(opts),result=await authorizeBuildLabLiveReadOnlyOwner(f.req(),f.deps);
  assert.equal(result.allowed,false,JSON.stringify(opts));
 }
});

test('unavailable or throwing auth/session/membership dependencies always fail closed',async()=>{
 const f=fixture();
 for(const missing of ['verifyUser','verifyLiveSession','membershipsForUser']){
  const deps={...f.deps};delete deps[missing];
  assert.equal((await authorizeBuildLabLiveReadOnlyOwner(f.req(),deps)).allowed,false);
 }
 for(const callback of ['verifyUser','verifyLiveSession','membershipsForUser']){
  const deps={...f.deps,[callback]:async()=>{throw Error('offline')}};
  assert.equal((await authorizeBuildLabLiveReadOnlyOwner(f.req(),deps)).allowed,false);
 }
});

test('Live scanner API injection allows ONLY authorized fixed-target read-only scans',async()=>{
 const f=fixture(),authorize=authorizeBuildLabLiveReadOnlyOwner;
 const master=createBuildLabMasterScanHandler({...f.deps,authorize,
  readSources:async()=>{f.state.reads++;return {fixture:'sources'};},
  scan:async(source,version,target,mod,mode)=>({kind:'test_master',version,mode})
 });
 let output=f.res();
 await master(f.req({body:{target:'elevationpilot',environmentMode:'compare'}}),output);
 assert.equal(output.code,200);assert.equal(f.state.reads,1);
 for(const body of [{target:'some-other-platform'},{moduleId:'unknown'},{environmentMode:'write'},{arbitrarySql:'select *'}]){
  output=f.res();await master(f.req({body}),output);assert.equal(output.code,400);assert.equal(f.state.reads,1);
 }
 const blocked=fixture({session:false}),denied=createBuildLabMasterScanHandler({...blocked.deps,authorize,
  readSources:async()=>{blocked.state.reads++;return {};},scan:async()=>({})});
 output=blocked.res();await denied(blocked.req(),output);assert.equal(output.code,403);assert.equal(blocked.state.reads,0);
 const ia=createBuildLabInceptionScanHandler({...f.deps,authorize,
  readSources:async()=>{f.state.reads++;return {};},scan:async()=>({kind:'test_ia'})});
 output=f.res();await ia(f.req({body:{target:'inception_apex'}}),output);
 assert.equal(output.code,200);assert.equal(f.state.reads,2);
 output=f.res();await ia(f.req({body:{target:'other'}}),output);
 assert.equal(output.code,400);assert.equal(f.state.reads,2);
});

test('preview authorization still DENIES production despite enabling Live scanner gate',async()=>{
 const f=fixture(),result=await authorizeBuildLabPreviewOwner(f.req(),f.deps);
 assert.equal(result.allowed,false);assert.equal(f.state.authCalls,0);
});

test('privileged session verifier rejects missing server key or invalid session claim without querying',async()=>{
 const payload={session_id:SESSION};
 const token='header.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.sig';
 assert.equal(verifiedSessionId(token),SESSION);
 assert.equal(verifiedSessionId('not.a.jwt'),'');
 assert.equal(verifiedSessionId('header.'+Buffer.from('{}').toString('base64url')+'.sig'),'');
 const deps=buildLabLiveAuthProviders(k=>k==='VITE_SUPABASE_URL'?'https://placeholder.supabase.co':undefined);
 await assert.rejects(()=>deps.verifyLiveSession(OWNER,token),/unavailable/);
 const wrongProject=buildLabLiveAuthProviders(k=>({VITE_SUPABASE_URL:'https://publruuuyvpggogrrgwp.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'not-a-real-secret'})[k]);
 await assert.rejects(()=>wrongProject.verifyLiveSession(OWNER,token),/unavailable/);
});

test('production read-only policy cannot be passed to preview-only AI builder or AI review',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server/eig-build-lab-builder.cjs'),'utf8');
 const ai=fs.readFileSync(path.join(__dirname,'../server/eig-build-lab-ai-review.cjs'),'utf8');
 assert.match(source,/authorizeBuildLabPreviewOwner/);
 assert.match(ai,/authorizeBuildLabPreviewOwner/);
 assert.doesNotMatch(source,/authorizeBuildLabLiveReadOnlyOwner/);
 assert.doesNotMatch(ai,/authorizeBuildLabLiveReadOnlyOwner/);
});

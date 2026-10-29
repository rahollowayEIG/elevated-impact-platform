const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createBuildLabDurableRecordsHandler,validateBuildLabDocument}=require('../server/eig-build-lab-durable-records.cjs');
const {createBuildLabDocumentStore}=require('../server/eig-build-lab-document-store.cjs');

const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const NOW=Date.parse('2026-10-28T20:00:00Z');
const SOURCE='a'.repeat(40);
const SCANS={version:1,entries:[{type:'master',id:'scan-1',scope:'all',source:SOURCE,
 savedAt:'2026-10-28T19:00:00.000Z',snapshot:{report:{modules:[]},reviews:{}}}]};
const WORK={kind:'eig_work_buckets',version:1,jobs:[],batches:[]};
function memoryStore(){
 const values=new Map();
 const operations=[];
 return {
  operations,
  async read(owner,kind){
   operations.push(['read',owner,kind]);
   const x=values.get(owner+':'+kind);
   return x?JSON.parse(JSON.stringify(x)):null;
  },
  async save(owner,kind,expected,payload){
   operations.push(['save',owner,kind,expected]);
   const key=owner+':'+kind,prior=values.get(key);
   if((prior?.revision||0)!==expected)
    return {saved:false,revision:prior?.revision||0};
   const record={revision:expected+1,payload:JSON.parse(JSON.stringify(payload)),
    updatedAt:'2026-10-28T20:00:00.000Z'};
   values.set(key,record);
   return {saved:true,revision:record.revision,updatedAt:record.updatedAt};
  }
 };
}
function fixture(overrides={}){
 const settings={enabled:true,readEnabled:true,mode:'production',branch:'main',
 owner:OWNER,session:true,user:OWNER,role:'eig_admin',org:'elevated-impact-group',...overrides};
 const store=memoryStore();
 const env=name=>({
  VERCEL_ENV:settings.mode,VERCEL_GIT_COMMIT_REF:settings.branch,
  EIG_BUILD_LAB_LIVE_READONLY_ENABLED:settings.readEnabled?'true':'false',
  EIG_BUILD_LAB_LIVE_RECORDS_ENABLED:settings.enabled?'true':'false',
  EIG_BUILD_LAB_LIVE_OWNER_USER_ID:settings.owner
 })[name];
 let authCalls=0;
 const handler=createBuildLabDurableRecordsHandler({env,store,now:()=>NOW,
  verifyUser:async()=>{authCalls++;return {id:settings.user};},
  verifyLiveSession:async()=>settings.session,
  membershipsForUser:async()=>({data:[{role:settings.role,status:'active',
   access_starts_at:null,access_ends_at:null,organization:{slug:settings.org}}]})
 });
 const call=async(body,opts={})=>{
  const req={method:'POST',body,headers:{origin:'https://elevated-impact-platform.vercel.app',
   host:'elevated-impact-platform.vercel.app',authorization:'Bearer verified-token',...opts.headers},
   ...(opts.method?{method:opts.method}:{})};
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},
   status(x){this.statusCode=x;return this;},json(v){this.body=v;return this;}};
  await handler(req,res);
  return {status:res.statusCode,data:res.body,headers:res.headers};
 };
 return {call,store,authCalls:()=>authCalls};
}

test('creates versioned owner records and refuses stale browser saves',async()=>{
 const {call,store}=fixture();
 assert.deepEqual((await call({action:'read',kind:'scan_history'})).data,
  {ok:true,found:false,revision:0});
 let result=await call({action:'save',kind:'scan_history',expectedRevision:0,payload:SCANS});
 assert.equal(result.status,200);
 assert.equal(result.data.revision,1);
 assert.equal(result.headers['Cache-Control'],'private, no-store, max-age=0');
 const saved=await call({action:'read',kind:'scan_history'});
 assert.equal(saved.status,200);
 assert.deepEqual(saved.data.payload,SCANS);
 assert.equal(saved.data.revision,1);
 result=await call({action:'save',kind:'scan_history',expectedRevision:0,payload:SCANS});
 assert.equal(result.status,409);
 assert.equal(result.data.currentRevision,1);
 assert.equal(store.operations.filter(x=>x[0]==='save').length,2);
 result=await call({action:'save',kind:'scan_history',expectedRevision:1,payload:SCANS});
 assert.equal(result.status,200);
 assert.equal(result.data.revision,2);
 assert.equal((await call({action:'read',kind:'scan_history'})).data.revision,2);
 assert.ok(store.operations.every(x=>x[1]===OWNER));
});

test('work buckets and manager plans are separate from scanners, not execution authority',async()=>{
 const f=fixture();
 assert.equal((await f.call({action:'save',kind:'work_buckets',expectedRevision:0,payload:WORK})).status,200);
 const {stackScanBlueprint}=await import('../src/lib/buildLabManagerBlueprint.mjs');
 const plan=stackScanBlueprint([SCANS.entries[0]],{title:'Read-only audit review'});
 const result=await f.call({action:'save',kind:'manager_blueprint',expectedRevision:0,payload:plan});
 assert.equal(result.status,200);
 const read=await f.call({action:'read',kind:'manager_blueprint'});
 assert.deepEqual(read.data.payload,plan);
 assert.equal(read.data.payload.safety.autoDeployed,false);
 assert.equal(read.data.payload.execution,'not_connected');
 assert.equal((await f.call({action:'read',kind:'work_buckets'})).data.payload.jobs.length,0);
});

test('disabled, preview, wrong account, wrong org or revoked session never reaches storage',async()=>{
 for(const options of [{enabled:false},{readEnabled:false},{mode:'preview'},
  {branch:'feature/build-lab-orchestrator-20261020'},{user:OTHER},
  {session:false},{role:'organization_admin'},{org:'another-company'}]){
  const f=fixture(options),r=await f.call({action:'save',kind:'scan_history',expectedRevision:0,payload:SCANS});
  assert.notEqual(r.status,200,JSON.stringify(options));
  assert.equal(f.store.operations.length,0);
 }
});

test('body allowlist blocks owner spoofing, arbitrary tables, commands and SQL',async()=>{
 const cases=[
  {action:'read',kind:'users'},
  {action:'read',kind:'scan_history',ownerUserId:OTHER},
  {action:'save',kind:'scan_history',expectedRevision:0,payload:SCANS,sql:'DELETE FROM ...'},
  {action:'delete',kind:'scan_history'},
  {action:'read',kind:'scan_history',payload:{}},
  {action:'read',kind:'scan_history',expectedRevision:0},
  {action:'save',kind:'scan_history',expectedRevision:-1,payload:SCANS},
  {action:'save',kind:'scan_history',expectedRevision:1.5,payload:SCANS},
  {action:'save',kind:'scan_history',expectedRevision:0,payload:[]},
  {action:'save',kind:'scan_history',expectedRevision:0,payload:{version:1,entries:'bad'}},
  {action:'save',kind:'work_buckets',expectedRevision:0,payload:{kind:'wrong'}},
  {action:'save',kind:'manager_blueprint',expectedRevision:0,payload:{kind:'wrong'}}
 ];
 const f=fixture();
 for(const body of cases){
  const res=await f.call(body);
  assert.equal(res.status,400,JSON.stringify(body));
 }
 assert.equal(f.store.operations.length,0);
});

test('read-only authorization is still checked per request; invalid origin and unsupported verbs fail',async()=>{
 const f=fixture();
 for(const opts of [{headers:{origin:'https://evil.test'}},{headers:{host:'wrong.test'}},
  {headers:{authorization:''}},{method:'GET'}]){
  const r=await f.call({action:'read',kind:'work_buckets'},opts);
  assert.notEqual(r.status,200);
 }
 assert.equal(f.store.operations.length,0);
});

test('storage outage fails closed without claiming evidence was saved',async()=>{
 const f=fixture();
 f.store.save=async()=>{throw Error('DB unavailable');};
 const result=await f.call({action:'save',kind:'scan_history',expectedRevision:0,payload:SCANS});
 assert.equal(result.status,503);assert.equal(result.data.ok,false);
 assert.doesNotMatch(JSON.stringify(result.data),/secret|supabase_service_role/i);
});

test('Supabase adapter pins project, uses fixed table/RPC and sends only verified owner scope',async()=>{
 const queries=[];
 const makeClient=(url,secret,config)=>{
  queries.push(['create',url,secret,config.auth.persistSession]);
  return {
   from(name){
    queries.push(['from',name]);
    const query={select(cols){queries.push(['select',cols]);return query;},
     eq(k,v){queries.push(['eq',k,v]);return query;},
     async maybeSingle(){return {data:null,error:null};}};
    return query;
   },
   async rpc(name,params){
    queries.push(['rpc',name,params]);
    return {data:[{saved:true,new_revision:1,saved_at:'2026-10-28T20:00:00Z'}],error:null};
   }
  };
 };
 const env=k=>({VERCEL_ENV:'production',VITE_SUPABASE_URL:'https://aszixzrdayrivungodwq.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-only-key'})[k];
 const store=createBuildLabDocumentStore(env,makeClient);
 assert.equal(await store.read(OWNER,'scan_history'),null);
 const result=await store.save(OWNER,'scan_history',0,SCANS);
 assert.deepEqual(result,{saved:true,revision:1,updatedAt:'2026-10-28T20:00:00Z'});
 assert.ok(queries.some(x=>x[0]==='from'&&x[1]==='eig_build_lab_documents'));
 assert.ok(queries.some(x=>x[0]==='eq'&&x[1]==='owner_user_id'&&x[2]===OWNER));
 assert.ok(queries.some(x=>x[0]==='rpc'&&x[1]==='eig_build_lab_save_document'));
 assert.equal(queries.filter(x=>x[0]==='create').length,1);
 await assert.rejects(()=>store.save(OTHER,'users',0,{}),/scope/);
 const badEnv=k=>({VERCEL_ENV:'production',VITE_SUPABASE_URL:'https://publruuuyvpggogrrgwp.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-only-key'})[k];
 await assert.rejects(()=>createBuildLabDocumentStore(badEnv,makeClient).read(OWNER,'scan_history'),/not configured/);
});

test('schema is service-only, RLS protected and uses atomic compare-and-swap with revision history',()=>{
 const schema=fs.readFileSync(path.join(__dirname,'../docs/BUILD-LAB-DURABLE-STORAGE-SCHEMA.sql'),'utf8');
 assert.match(schema,/alter table public\.eig_build_lab_documents enable row level security/i);
 assert.match(schema,/alter table public\.eig_build_lab_document_revisions enable row level security/i);
 assert.match(schema,/revoke all on table public\.eig_build_lab_documents from public, anon, authenticated/i);
 assert.match(schema,/revoke all on function public\.eig_build_lab_save_document\(uuid,text,integer,jsonb\) from public,anon,authenticated/i);
 assert.match(schema,/security invoker/i);
 assert.doesNotMatch(schema,/security definer/i);
 assert.match(schema,/d\.revision=p_expected_revision/i);
 assert.match(schema,/insert into public\.eig_build_lab_document_revisions/i);
 assert.match(schema,/on conflict do nothing/i);
});

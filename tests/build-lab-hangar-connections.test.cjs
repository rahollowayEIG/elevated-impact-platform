'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {summarizeHangarConnections,createBuildLabHangarConnectionsHandler}=
 require('../server/eig-build-lab-hangar-connections.cjs');
const {authorizeBuildLabLiveReadOnlyOwner}=
 require('../server/eig-build-lab-live-readonly-access.cjs');
const {readHangarConnectionSnapshot}=
 require('../server/eig-build-lab-hangar-db.cjs');

const owner='11111111-1111-4111-8111-111111111111';
const chapel='22222222-2222-4222-8222-222222222222';
const hq='33333333-3333-4333-8333-333333333333';
const demo='44444444-4444-4444-8444-444444444444';
const stamp='2026-11-02T14:00:00.000Z';
const snapshot={
 organizations:[
  {id:chapel,name:'Chapel Hill Golf Course',slug:'chapel-hill-golf-course',organization_type:'golf_course',is_test:false,status:'active'},
  {id:hq,name:'Elevated Impact Group',slug:'elevated-impact-group',organization_type:'provider',is_test:false,status:'active'},
  {id:demo,name:'Demo Hangar',slug:'demo',organization_type:'business',is_test:true,status:'active'}
 ],
 channels:[
  {organization_id:chapel,channel:'email',provider:'resend',connection_status:'connected',compliance_status:'not_applicable',last_verified_at:stamp,access_token:'SENSITIVE-NEVER-SERIALIZE'},
  {organization_id:chapel,channel:'sms',provider:'twilio',connection_status:'setup_required',compliance_status:'not_started',last_verified_at:null}
 ],
 driveMappings:[{organization_id:hq,folder_key:'hangar-root'}],
 campaigns:[{id:'safe-id',organization_id:chapel,content:'PRIVATE-NEVER-SERIALIZE'}]
};
const request={method:'POST',headers:{
 host:'elevated-impact-platform.vercel.app',
 origin:'https://elevated-impact-platform.vercel.app',
 authorization:'Bearer synthetic-owner-token'
},body:{target:'hangar_connections'}};
const envValues={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main',
 EIG_BUILD_LAB_LIVE_READONLY_ENABLED:'true',EIG_BUILD_LAB_LIVE_OWNER_USER_ID:owner};
const env=(patch={})=>k=>({...envValues,...patch})[k];
const authorized={
 verifyUser:async()=>({id:owner}),verifyLiveSession:async()=>true,
 membershipsForUser:async()=>({data:[{role:'eig_admin',status:'active',
  organization:{slug:'elevated-impact-group'}}]})
};
function makeRes(){return {statusCode:null,payload:null,headers:{},
 setHeader(k,v){this.headers[k]=v;},
 status(s){this.statusCode=s;return this;},
 json(data){this.payload=data;return this;}};}
function create(options={}){
 let calls=0;
 const handler=createBuildLabHangarConnectionsHandler({
  env:env(),authorize:authorizeBuildLabLiveReadOnlyOwner,
  ...authorized,
  loadSnapshot:async()=>{calls++;return snapshot;},
  now:()=>Date.parse(stamp),...options
 });
 return {handler,calls:()=>calls};
}
async function call(a,req=request){const res=makeRes();await a.handler(req,res);return res;}
test('per-Hangar overview measures only verified configured channels; demo and HQ remain separate',()=>{
 const r=summarizeHangarConnections(snapshot,stamp);
 assert.equal(r.kind,'eig_build_lab_hangar_connections');
 assert.equal(r.schemaVersion,1);
 assert.equal(r.summary.realHangars,1);
 assert.equal(r.summary.testHangars,1);
 assert.equal(r.summary.hqOrganizations,1);
 assert.equal(r.summary.verifiedChannels,1);
 assert.equal(r.summary.configuredChannels,2);
 assert.equal(r.summary.channelCoverage,50);
 const chapelCard=r.hangars.find(x=>x.slug==='chapel-hill-golf-course');
 assert.equal(chapelCard.verifiedChannels,1);
 assert.equal(chapelCard.configuredChannels,2);
 assert.equal(chapelCard.channelsNeedingAttention,1);
 assert.equal(chapelCard.channelCoverage,50);
 assert.equal(chapelCard.channels[0].verified,true);
 assert.equal(chapelCard.channels[1].verified,false);
 assert.equal(chapelCard.savedCampaigns,1);
 assert.equal(chapelCard.driveFolderMappings,0);
 assert.equal(chapelCard.adoptionPercent,null);
 assert.equal(chapelCard.socialPublishing.implemented,false);
 assert.equal(chapelCard.socialPublishing.connectedCount,null);
 assert.match(chapelCard.nextAction,/Finish setup/);
 const output=JSON.stringify(r);
 assert.doesNotMatch(output,/SENSITIVE-NEVER-SERIALIZE|PRIVATE-NEVER-SERIALIZE|access_token|refresh_token/);
 assert.equal(r.hangars.find(x=>x.kind==='hq').driveFolderMappings,1);
});
test('zero configured connection records must NOT be labeled zero percent adoption',()=>{
 const r=summarizeHangarConnections({organizations:[snapshot.organizations[0]],
  channels:[],driveMappings:[],campaigns:[]},stamp);
 assert.equal(r.hangars[0].channelCoverage,null);
 assert.equal(r.hangars[0].adoptionPercent,null);
 assert.equal(r.summary.channelCoverage,null);
});
test('unverified connected status does not count as a verified connection',()=>{
 const r=summarizeHangarConnections({...snapshot,channels:[{
  organization_id:chapel,channel:'email',provider:'resend',
  connection_status:'connected',last_verified_at:null
 }]},stamp);
 assert.equal(r.summary.verifiedChannels,0);
 assert.equal(r.summary.configuredChannels,1);
 assert.equal(r.hangars[0].channels[0].verified,false);
});
test('production owner may read a sanitized report, without changing connections',async()=>{
 const a=create();
 const r=await call(a);
 assert.equal(r.statusCode,200);
 assert.equal(r.payload.ok,true);
 assert.equal(r.payload.report.summary.verifiedChannels,1);
 assert.equal(a.calls(),1);
 assert.match(r.headers['Cache-Control'],/no-store/);
});
test('unauthorized origin, user, live session, role, environment and request shape deny before DB access',async()=>{
 const opts=[
  {req:{...request,headers:{...request.headers,host:'other.vercel.app'}}},
  {req:{...request,headers:{...request.headers,origin:'https://other.example'}}},
  {req:{...request,method:'GET'}},
  {opts:{verifyUser:async()=>({id:'55555555-5555-4555-8555-555555555555'})}},
  {opts:{verifyLiveSession:async()=>false}},
  {opts:{membershipsForUser:async()=>({data:[]})}},
  {opts:{env:env({VERCEL_ENV:'preview'})}},
  {opts:{env:env({VERCEL_GIT_COMMIT_REF:'feature'})}},
  {opts:{env:env({EIG_BUILD_LAB_LIVE_READONLY_ENABLED:'false'})}},
  {req:{...request,body:{target:'hangar_connections',organization_id:chapel}}},
  {req:{...request,body:{target:'all'}}}
 ];
 for(const c of opts){
  const a=create(c.opts||{});
  const r=await call(a,c.req||request);
  assert.notEqual(r.statusCode,200);
  assert.equal(a.calls(),0);
 }
});
test('fail closed on missing loader or incomplete source inventory',async()=>{
 const a=create({loadSnapshot:null});
 assert.equal((await call(a)).statusCode,503);
 const b=create({loadSnapshot:async()=>({...snapshot,organizations:new Array(101).fill(snapshot.organizations[0])})});
 assert.equal((await call(b)).statusCode,503);
});
test('server loader uses only bounded allowlisted connection metadata fields',async()=>{
 const selections=[];
 const tableData={
  organizations:[snapshot.organizations[0]],
  squawk_channel_connections:snapshot.channels,
  platform_google_drive_folders:[],
  social_campaigns:[]
 };
 const factory=(url,key,opts)=>({
  from(table){
   assert.ok(Object.hasOwn(tableData,table));
   const q={
    select(fields){selections.push({table,fields});return q;},
    in(k,values){assert.equal(k,'organization_id');assert.deepEqual(values,[chapel]);return q;},
    order(){return q;},
    async limit(l){assert.ok(l<=501);return {data:tableData[table],error:null};}
   };return q;
  }
 });
 const data=await readHangarConnectionSnapshot(k=>({
  VITE_SUPABASE_URL:'https://aszixzrdayrivungodwq.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic'
 })[k],factory);
 assert.equal(data.organizations.length,1);
 assert.equal(selections.length,4);
 for(const x of selections)assert.doesNotMatch(x.fields,/access_token|refresh_token|contact|data|body|content|email/i);
 assert.deepEqual(selections.map(x=>x.table).sort(),
  ['organizations','squawk_channel_connections','platform_google_drive_folders','social_campaigns'].sort());
});
test('production API file always reuses exact owner and session gate',()=>{
 const root=path.resolve(__dirname,'..');
 const api=fs.readFileSync(path.join(root,'api/eig-build-lab-hangar-connections.js'),'utf8');
 const ui=fs.readFileSync(path.join(root,'src/components/BuildLabHangarConnections.jsx'),'utf8');
 const page=fs.readFileSync(path.join(root,'src/components/BuildLabLiveOwnerWorkspace.jsx'),'utf8');
 assert.match(api,/authorizeBuildLabLiveReadOnlyOwner/);
 assert.match(api,/buildLabLiveAuthProviders/);
 assert.match(page,/\['hangars','Hangar Connections'\]/);
 assert.match(ui,/requestHangarConnections/);
 assert.match(ui,/Include demo Hangars/);
 assert.match(ui,/Overall integration adoption/);
 assert.match(ui,/Social channel connection opportunities/);
 assert.doesNotMatch(ui,/OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|google_oauth_tokens/);
});

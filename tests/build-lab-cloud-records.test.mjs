import test from 'node:test';
import assert from 'node:assert/strict';
import {readBuildLabCloudRecord,saveBuildLabCloudRecord} from '../src/lib/buildLabCloudRecords.mjs';

const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-only-token'}},error:null})}};
function transport(status,payload,requests){
 return async (endpoint,options)=>{
  requests.push({endpoint,...options});
  return {status,ok:status>=200&&status<300,json:async()=>payload};
 };
}

test('explicit cloud reads are owner-session authenticated, scoped and never mutate data',async()=>{
 const calls=[],http=transport(200,{ok:true,found:true,revision:4,
  payload:{version:1,entries:[]},updatedAt:'2026-10-28T20:00:00Z'},calls);
 const result=await readBuildLabCloudRecord(client,'scan_history',http);
 assert.equal(result.revision,4);
 assert.equal(result.found,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].endpoint,'/api/eig-build-lab-live-records');
 assert.equal(calls[0].method,'POST');
 assert.equal(calls[0].cache,'no-store');
 assert.equal(calls[0].credentials,'same-origin');
 assert.equal(calls[0].headers.Authorization,'Bearer synthetic-only-token');
 assert.deepEqual(JSON.parse(calls[0].body),{action:'read',kind:'scan_history'});
});

test('save requires matching next revision and sends only typed records',async()=>{
 const calls=[],http=transport(200,{ok:true,saved:true,kind:'work_buckets',revision:5,
  updatedAt:'2026-10-28T20:00:00Z'},calls);
 const value={kind:'eig_work_buckets',version:1,jobs:[],batches:[]};
 const r=await saveBuildLabCloudRecord(client,'work_buckets',4,value,http);
 assert.equal(r.revision,5);
 assert.deepEqual(JSON.parse(calls[0].body),{
  action:'save',kind:'work_buckets',expectedRevision:4,payload:value
 });
});

test('stale browser record returns actionable conflict and does not claim a save',async()=>{
 const http=transport(409,{ok:false,conflict:true,currentRevision:7},[]);
 await assert.rejects(
  ()=>saveBuildLabCloudRecord(client,'scan_history',4,{version:1,entries:[]},http),
  error=>error.code==='build_lab_revision_conflict'&&error.currentRevision===7
 );
});

test('wrong account, unsupported document and unavailable endpoint fail closed',async()=>{
 const noSession={auth:{getSession:async()=>({data:{session:null}})}};
 await assert.rejects(()=>readBuildLabCloudRecord(noSession,'scan_history',transport(200,{},[])),/Sign in again/);
 await assert.rejects(()=>readBuildLabCloudRecord(client,'payments',transport(200,{},[])),/Unsupported/);
 await assert.rejects(()=>saveBuildLabCloudRecord(client,'manager_blueprint',-1,{},transport(200,{},[])),/Invalid/);
 await assert.rejects(()=>saveBuildLabCloudRecord(client,'manager_blueprint',0,[],transport(200,{},[])),/Invalid/);
 await assert.rejects(()=>readBuildLabCloudRecord(client,'scan_history',transport(403,{ok:false},[])),/unavailable/);
 await assert.rejects(()=>readBuildLabCloudRecord(client,'scan_history',transport(503,{ok:false},[])),/could not/);
 await assert.rejects(()=>saveBuildLabCloudRecord(client,'scan_history',0,{},transport(200,{ok:true,saved:true,kind:'scan_history',revision:99},[])),/not be verified/);
 await assert.rejects(()=>readBuildLabCloudRecord(client,'scan_history',transport(200,{ok:true,found:true,revision:0,payload:{}},[])),/not valid/);
});

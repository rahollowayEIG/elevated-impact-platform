import test from 'node:test';
import assert from 'node:assert/strict';
import {
 readBuildLabBrowserSnapshot,cloudDocumentComparison,inspectBuildLabCloudSnapshot,
 saveOneBuildLabCloudDocument,restoreBuildLabCloudSnapshot
} from '../src/lib/buildLabCloudBackup.mjs';
import {historyKey,saveScanHistory,readScanHistory} from '../src/lib/buildLabScanHistory.mjs';
import {workStorageKey,emptyWorkLedger,addBuildBrief,saveWorkLedger,readWorkLedger} from '../src/lib/buildLabWorkBuckets.mjs';
import {managerStorageKey,stackScanBlueprint,validateManagerBlueprint} from '../src/lib/buildLabManagerBlueprint.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const date='2026-10-28T21:00:00.000Z';
const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-owner-token'}}})}};
const scan={type:'inspector',id:'s1',scope:'inception-apex',source:'a'.repeat(40),savedAt:date,
 snapshot:{report:{findings:[{id:'focus',title:'Keyboard focus',recommendation:'Verify selection'}]},reviews:{focus:{review:'accept'}}}};

function memory(){
 const map=new Map();
 return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
}
function seed(){
 const db=memory();
 saveScanHistory(db,owner,scan);
 saveWorkLedger(db,owner,addBuildBrief(emptyWorkLedger(),{
  id:'task1',title:'Shared database contract',detail:'Verify shared owner records',
  completion:'Preserve tenant boundaries',now:date
 }));
 const plan=stackScanBlueprint([scan],{title:'Focus review',now:date});
 db.setItem(managerStorageKey(owner),JSON.stringify(plan));
 return db;
}
function remoteStore(){
 const records=new Map(),requests=[];
 const clone=x=>JSON.parse(JSON.stringify(x));
 const http=async(url,opts)=>{
  assert.equal(url,'/api/eig-build-lab-live-records');
  assert.equal(opts.headers.Authorization,'Bearer synthetic-owner-token');
  const {action,kind,expectedRevision,payload,...extras}=JSON.parse(opts.body);
  assert.deepEqual(extras,{});
  requests.push({action,kind,expectedRevision});
  const current=records.get(kind);
  if(action==='read')
   return {status:200,ok:true,json:async()=>current?
    {ok:true,found:true,revision:current.revision,updatedAt:date,payload:clone(current.payload)}:
    {ok:true,found:false,revision:0}};
  if((current?.revision||0)!==expectedRevision)
   return {status:409,ok:false,json:async()=>({ok:false,currentRevision:current.revision})};
  const record={revision:expectedRevision+1,payload:clone(payload)};
  records.set(kind,record);
  return {status:200,ok:true,json:async()=>({ok:true,saved:true,kind,revision:record.revision,updatedAt:date})};
 };
 return {http,records,requests};
}
test('local scan history, owner work, manager plan are separately prepared for comparison',()=>{
 const storage=seed(),snapshot=readBuildLabBrowserSnapshot(storage,owner);
 assert.equal(snapshot.documents.scan_history.entries.length,1);
 assert.equal(snapshot.documents.work_buckets.jobs.length,1);
 assert.equal(snapshot.documents.manager_blueprint.kind,'eig_build_lab_manager_blueprint');
 assert.equal(snapshot.report.ownerScope.userId,owner);
 assert.deepEqual(readScanHistory(storage,other),[]);
});
test('cloud inspection reports absent revisions and does not alter browser storage',async()=>{
 const db=seed(),before=[...db.map.entries()],cloud=remoteStore();
 const result=await inspectBuildLabCloudSnapshot(client,db,owner,cloud.http);
 assert.deepEqual(result.compare,{
  scan_history:'cloud_empty',work_buckets:'cloud_empty',manager_blueprint:'cloud_empty'
 });
 assert.equal(result.summary.localScans,1);
 assert.equal(result.summary.cloudScans,0);
 assert.deepEqual([...db.map.entries()],before);
 assert.deepEqual(cloud.requests.map(x=>x.action),['read','read','read']);
});
test('explicit one-type-at-a-time cloud saves produce revisions and readable comparisons',async()=>{
 const db=seed(),cloud=remoteStore();
 let inspection=await inspectBuildLabCloudSnapshot(client,db,owner,cloud.http);
 for(const kind of ['scan_history','work_buckets','manager_blueprint']){
  const saved=await saveOneBuildLabCloudDocument(client,db,owner,inspection,kind,cloud.http);
  assert.equal(saved.revision,1);
  inspection=await inspectBuildLabCloudSnapshot(client,db,owner,cloud.http);
  assert.equal(inspection.compare[kind],'identical');
 }
 assert.equal(cloud.records.size,3);
 assert.equal(inspection.summary.cloudWorkItems,1);
 assert.equal(inspection.summary.cloudManager,true);
 assert.deepEqual(cloud.requests.filter(x=>x.action==='save').map(x=>x.kind),
  ['scan_history','work_buckets','manager_blueprint']);
});
test('cloud revisions and stale local comparisons cannot overwrite newer work',async()=>{
 const db=seed(),cloud=remoteStore();
 const initial=await inspectBuildLabCloudSnapshot(client,db,owner,cloud.http);
 const saved=await saveOneBuildLabCloudDocument(client,db,owner,initial,'scan_history',cloud.http);
 assert.equal(saved.revision,1);
 await assert.rejects(()=>saveOneBuildLabCloudDocument(client,db,owner,initial,'scan_history',cloud.http),
  e=>e.code==='build_lab_revision_conflict'&&e.currentRevision===1);
 const stale=await inspectBuildLabCloudSnapshot(client,db,owner,cloud.http);
 saveScanHistory(db,owner,{...scan,id:'s2',savedAt:'2026-10-28T22:00:00.000Z'});
 await assert.rejects(()=>saveOneBuildLabCloudDocument(client,db,owner,stale,'scan_history',cloud.http),
  /Browser work changed/);
 assert.equal(cloud.records.get('scan_history').revision,1);
});
test('recovery requires a complete cloud snapshot, never silently wiping missing Work Buckets',async()=>{
 const db=seed(),cloud=remoteStore();
 let report=await inspectBuildLabCloudSnapshot(client,db,owner,cloud.http);
 await saveOneBuildLabCloudDocument(client,db,owner,report,'scan_history',cloud.http);
 report=await inspectBuildLabCloudSnapshot(client,db,owner,cloud.http);
 const prior=new Map(db.map);
 assert.throws(()=>restoreBuildLabCloudSnapshot(db,owner,report,{allowReplace:true}),/both be backed up/);
 assert.deepEqual(db.map,prior);
});
test('entire cloud snapshot restores into another browser after owner confirmation',async()=>{
 const original=seed(),cloud=remoteStore();
 let inspection=await inspectBuildLabCloudSnapshot(client,original,owner,cloud.http);
 for(const kind of ['scan_history','work_buckets','manager_blueprint']){
  await saveOneBuildLabCloudDocument(client,original,owner,inspection,kind,cloud.http);
  inspection=await inspectBuildLabCloudSnapshot(client,original,owner,cloud.http);
 }
 const receiver=memory();
 assert.throws(()=>restoreBuildLabCloudSnapshot(receiver,owner,inspection),/owner|current|exists/i);
 // No previous records means owner can restore without replacement authorization.
 const summary=restoreBuildLabCloudSnapshot(receiver,owner,inspection,{allowReplace:true});
 assert.equal(summary.scans,1);assert.equal(summary.workItems,1);assert.equal(summary.manager,true);
 assert.deepEqual(readScanHistory(receiver,owner),readScanHistory(original,owner));
 assert.deepEqual(readWorkLedger(receiver,owner),readWorkLedger(original,owner));
 assert.deepEqual(validateManagerBlueprint(JSON.parse(receiver.getItem(managerStorageKey(owner)))),
  validateManagerBlueprint(JSON.parse(original.getItem(managerStorageKey(owner)))));
 assert.equal(receiver.getItem(historyKey(other)),null);
});
test('browser-local recovery does not overwrite existing records without explicit owner choice',async()=>{
 const original=seed(),cloud=remoteStore();
 let inspection=await inspectBuildLabCloudSnapshot(client,original,owner,cloud.http);
 for(const kind of ['scan_history','work_buckets']){
  await saveOneBuildLabCloudDocument(client,original,owner,inspection,kind,cloud.http);
  inspection=await inspectBuildLabCloudSnapshot(client,original,owner,cloud.http);
 }
 const receiver=seed(),prior=new Map(receiver.map);
 assert.throws(()=>restoreBuildLabCloudSnapshot(receiver,owner,inspection),/explicitly approve replacement/);
 assert.deepEqual(receiver.map,prior);
 const r=restoreBuildLabCloudSnapshot(receiver,owner,inspection,{allowReplace:true});
 assert.equal(r.manager,false);
 assert.equal(receiver.getItem(managerStorageKey(owner)),null);
});
test('cloud payload corruption cannot be restored, even with replacement permission',async()=>{
 const local=seed(),cloud=remoteStore();
 cloud.records.set('scan_history',{revision:1,payload:{version:1,entries:'not an array'}});
 cloud.records.set('work_buckets',{revision:1,payload:emptyWorkLedger()});
 const inspected=await inspectBuildLabCloudSnapshot(client,local,owner,cloud.http);
 const old=new Map(local.map);
 assert.throws(()=>restoreBuildLabCloudSnapshot(local,owner,inspected,{allowReplace:true}));
 assert.deepEqual(local.map,old);
});
test('comparison is stable against JSON key ordering and rejects untrusted result shapes',()=>{
 assert.equal(cloudDocumentComparison({b:2,a:{d:4,c:3}},{found:true,revision:1,payload:{a:{c:3,d:4},b:2}}),'identical');
 assert.throws(()=>cloudDocumentComparison({},null),/revision must be checked/);
});

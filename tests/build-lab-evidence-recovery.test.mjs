import test from 'node:test';
import assert from 'node:assert/strict';
import {createBuildLabEvidencePackage} from '../src/lib/buildLabEvidencePackage.mjs';
import {inspectBuildLabEvidencePackage,restoreBuildLabEvidencePackage} from '../src/lib/buildLabEvidenceRecovery.mjs';
import {historyKey,readScanHistory,saveScanHistory} from '../src/lib/buildLabScanHistory.mjs';
import {workStorageKey,readWorkLedger,saveWorkLedger,emptyWorkLedger,addBuildBrief} from '../src/lib/buildLabWorkBuckets.mjs';
import {managerStorageKey,stackScanBlueprint,reviewManagerProposal,approveManagerBlueprint,validateManagerBlueprint} from '../src/lib/buildLabManagerBlueprint.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const at='2026-10-28T21:00:00.000Z';
const scan=(id='s1')=>({id,type:'inspector',scope:'inception-apex',source:'a'.repeat(40),savedAt:at,snapshot:{report:{findings:[{id:'focus',title:'Artwork keyboard focus',recommendation:'Focus the selected canvas object.'}]},reviews:{focus:{review:'revise',editedDetail:'Preserve arrow navigation'}}}});

function memory(init=[]){
 const data=new Map(init);
 return {data,getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}
function fixture(){
 const storage=memory();
 saveScanHistory(storage,owner,scan());
 const ledger=addBuildBrief(emptyWorkLedger(),{id:'objective',title:'Cross-app reuse',detail:'Reuse shared services across applications.',completion:'Independent and integrated entry points pass tests.',now:at});
 saveWorkLedger(storage,owner,ledger);
 const entry=scan();
 let manager=stackScanBlueprint([entry],{title:'Fix IA focus',now:at});
 manager=reviewManagerProposal(manager,manager.proposals[0].id,'accept');
 manager=approveManagerBlueprint(manager,{now:at});
 storage.setItem(managerStorageKey(owner),JSON.stringify(manager));
 return {storage,manager,archive:JSON.stringify(createBuildLabEvidencePackage(storage,owner,at))};
}

test('v2 export is owner-bound and round trips scans, decisions, work and approved Manager plans',()=>{
 const {archive,manager,storage:original}=fixture();
 const inspected=inspectBuildLabEvidencePackage(owner,archive);
 assert.deepEqual(inspected.summary,{generatedAt:at,scans:1,workItems:1,batches:0,manager:true});
 const target=memory();
 const result=restoreBuildLabEvidencePackage(target,owner,archive);
 assert.deepEqual(result,inspected.summary);
 assert.deepEqual(readScanHistory(target,owner),readScanHistory(original,owner));
 assert.equal(readScanHistory(target,owner)[0].snapshot.reviews.focus.editedDetail,'Preserve arrow navigation');
 assert.deepEqual(readWorkLedger(target,owner),readWorkLedger(original,owner));
 const restoredManager=validateManagerBlueprint(JSON.parse(target.getItem(managerStorageKey(owner))));
 assert.deepEqual(restoredManager,manager);
 assert.equal(restoredManager.safety.autoDeployed,false);
 assert.equal(restoredManager.execution,'not_connected');
 assert.deepEqual(readScanHistory(target,other),[]);
});

test('older exports, malformed content and other owners are rejected without writing',()=>{
 const {archive}=fixture();
 const target=memory();
 for(const raw of [
  '{invalid',JSON.stringify({...JSON.parse(archive),version:1}),
  JSON.stringify({...JSON.parse(archive),ownerScope:{userId:other}}),
  JSON.stringify({...JSON.parse(archive),generatedAt:'wrong'}),
  JSON.stringify({...JSON.parse(archive),manifest:{...JSON.parse(archive).manifest,scanCount:2}}),
  JSON.stringify({...JSON.parse(archive),workBuckets:{kind:'wrong',version:1,jobs:[],batches:[]}}),
  'x'.repeat(5000001),
 ]){
  assert.throws(()=>restoreBuildLabEvidencePackage(target,owner,raw),/JSON|restorable|another owner|invalid|counts|unreadable|5 MB/i);
  assert.equal(target.data.size,0);
 }
});

test('oversized, duplicate, unrecognized and invalid scan evidence is denied',()=>{
 const {archive}=fixture(),source=JSON.parse(archive),target=memory();
 const tampered=[
  {...source,scans:[source.scans[0],source.scans[0]],manifest:{...source.manifest,scanCount:2}},
  {...source,scans:[{...source.scans[0],type:'unknown'}]},
  {...source,scans:[{...source.scans[0],savedAt:'invalid'}]},
  {...source,managerBlueprint:{...source.managerBlueprint,status:'reviewed_for_handoff',execution:'automatic'}},
 ];
 for(const record of tampered){
  assert.throws(()=>restoreBuildLabEvidencePackage(target,owner,JSON.stringify(record)));
  assert.equal(target.data.size,0);
 }
});

test('existing records cannot be overwritten without explicit owner replacement',()=>{
 const {archive}=fixture(),target=memory();
 saveScanHistory(target,owner,{...scan(),id:'other-scan'});
 const before=target.getItem(historyKey(owner));
 assert.throws(()=>restoreBuildLabEvidencePackage(target,owner,archive),/Download its current evidence/);
 assert.equal(target.getItem(historyKey(owner)),before);
 const restored=restoreBuildLabEvidencePackage(target,owner,archive,{allowReplace:true});
 assert.equal(restored.scans,1);
 assert.equal(readScanHistory(target,owner)[0].id,'s1');
});

test('invalid existing records are preserved even when replacement is approved',()=>{
 const {archive}=fixture();
 const target=memory([[historyKey(owner),'corrupted data']]);
 assert.throws(()=>restoreBuildLabEvidencePackage(target,owner,archive,{allowReplace:true}));
 assert.equal(target.getItem(historyKey(owner)),'corrupted data');
});

test('mid-restore storage failure rolls back all three prior values and reports failure',()=>{
 const {archive}=fixture(),target=memory();
 const current=scan('pre-existing');
 saveScanHistory(target,owner,current);
 saveWorkLedger(target,owner,emptyWorkLedger());
 const prior=new Map(target.data);
 let fail=true;
 const rejecting={
  getItem:key=>target.getItem(key),
  removeItem:key=>target.removeItem(key),
  setItem(key,value){
   if(key===workStorageKey(owner)&&fail){fail=false;throw Error('quota');}
   target.setItem(key,value);
  },
 };
 assert.throws(()=>restoreBuildLabEvidencePackage(rejecting,owner,archive,{allowReplace:true}),/Original browser records were restored/);
 assert.deepEqual([...target.data.entries()],[...prior.entries()]);
});

test('a valid export without a Manager plan clears that slot on explicitly approved replacement',()=>{
 const {archive}=fixture(),pkg=JSON.parse(archive),target=memory();
 pkg.managerBlueprint=null;pkg.manifest.hasManagerBlueprint=false;
 target.setItem(managerStorageKey(owner),JSON.stringify(fixture().manager));
 const result=restoreBuildLabEvidencePackage(target,owner,JSON.stringify(pkg),{allowReplace:true});
 assert.equal(result.manager,false);
 assert.equal(target.getItem(managerStorageKey(owner)),null);
});

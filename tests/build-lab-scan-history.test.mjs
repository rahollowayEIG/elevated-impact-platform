import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historyKey,readScanHistory,saveScanHistory} from '../src/lib/buildLabScanHistory.mjs';
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
const row=(id,type='ai')=>({id:String(id),type,scope:'invoices',source:'abc',savedAt:new Date(1700000000000+id*1000).toISOString(),snapshot:{review:{summary:'saved result'}}});
test('runs survive reload, remain owner scoped and retain decisions without duplicating a run',()=>{
 const storage=memory();saveScanHistory(storage,uid,row(1));
 assert.equal(readScanHistory(storage,uid).length,1);assert.deepEqual(readScanHistory(storage,other),[]);
 assert.equal(saveScanHistory(storage,uid,row(1)),false);
 const edited={...row(1),savedAt:new Date().toISOString(),snapshot:{review:{summary:'saved result'},reviews:{a:{review:'accept'}}}};
 saveScanHistory(storage,uid,edited);
 const [saved]=readScanHistory(storage,uid);assert.equal(saved.savedAt,row(1).savedAt);assert.equal(saved.snapshot.reviews.a.review,'accept');
 saveScanHistory(storage,uid,row(2));assert.equal(readScanHistory(storage,uid).length,2);
});
test('all scanner types retain separate runs, newest first, with bounded retention',()=>{
 const storage=memory();
 for(const type of ['master','radar','inspector','impact','ai'])for(let i=0;i<23;i++)saveScanHistory(storage,uid,row(i,type));
 const entries=readScanHistory(storage,uid);assert.equal(entries.length,100);
 for(const type of ['master','radar','inspector','impact','ai']){const group=entries.filter(x=>x.type===type);assert.equal(group.length,20);assert.equal(group[0].id,'22');assert.equal(group.at(-1).id,'3');}
});
test('blocked and corrupt storage cannot silently claim a save or overwrite existing data',()=>{
 const storage=memory();storage.setItem(historyKey(uid),'broken');
 assert.throws(()=>readScanHistory(storage,uid));assert.throws(()=>saveScanHistory(storage,uid,row(1)));assert.equal(storage.getItem(historyKey(uid)),'broken');
 assert.throws(()=>saveScanHistory({getItem:()=>null,setItem:()=>{throw Error('quota');}},uid,row(1)));
 assert.equal(historyKey('not-an-owner'),null);assert.throws(()=>saveScanHistory(storage,'',row(1)));
});
test('size cap removes complete oldest records and preserves current results',()=>{
 const storage=memory();for(let i=0;i<15;i++)saveScanHistory(storage,uid,{...row(i),snapshot:{text:'x'.repeat(150000)}});
 const entries=readScanHistory(storage,uid);assert.ok(entries.length<15);assert.equal(entries[0].id,'14');assert.ok(storage.getItem(historyKey(uid)).length<=1800000);
});

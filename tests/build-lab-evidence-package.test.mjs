import test from 'node:test';
import assert from 'node:assert/strict';
import {createBuildLabEvidencePackage} from '../src/lib/buildLabEvidencePackage.mjs';
import {historyKey} from '../src/lib/buildLabScanHistory.mjs';
import {workStorageKey,emptyWorkLedger} from '../src/lib/buildLabWorkBuckets.mjs';
test('portable evidence package contains retained scan and work metadata without changing storage',()=>{
 const uid='12345678-1234-1234-1234-123456789abc';
 const source=new Map([[historyKey(uid),JSON.stringify({version:1,entries:[{type:'master',id:'scan1',scope:'all',source:'abc',savedAt:'2026-10-26T00:00:00.000Z',snapshot:{report:{modules:[]}}}]})],[workStorageKey(uid),JSON.stringify(emptyWorkLedger())]]);
 const storage={getItem:key=>source.get(key)||null};
 const report=createBuildLabEvidencePackage(storage,uid,'2026-10-26T01:00:00.000Z');
 assert.equal(report.kind,'eig_build_lab_evidence_package');
 assert.equal(report.manifest.scanCount,1);
 assert.equal(report.scans[0].snapshot.report.modules.length,0);
 assert.equal(report.manifest.workItemCount,0);
 assert.match(report.README,/not a fresh scan/);
});


test('full evidence export retains complete findings and decisions from all five scanner types',()=>{
 const uid='12345678-1234-1234-1234-123456789abc';
 const payload=[
  {type:'master',scope:'all',snapshot:{report:{modules:[{id:'m1',title:'Registration identity',evidence:[{path:'src/registration.mjs',line:8}]}]},reviews:{m1:{review:'accept'}}}},
  {type:'inspector',scope:'inception-apex',snapshot:{report:{findings:[{id:'ia-native-confirm',title:'Review native confirmation',evidence:[{path:'src/components/InceptionApex.jsx',line:25}]}]},reviews:{'ia-native-confirm':{review:'revise',editedDetail:'Keep cancel behavior'}}}},
  {type:'radar',scope:'all',snapshot:{audit:{suggestions:[{id:'r1',title:'Improve experience',evidence:[{path:'src/App.jsx'}]}]},choices:{r1:{review:'hold'}}}},
  {type:'ai',scope:'inception',snapshot:{review:{recommendations:[{id:'ai1',title:'Verify accessibility',evidence:['bounded scanner metadata']}]}}},
  {type:'impact',scope:'proposed-change',snapshot:{report:{findings:[{id:'imp1',title:'Regression risk',affectedFiles:['src/App.jsx']}]},reviews:{imp1:{review:'accept'}}}}
 ].map((record,i)=>({id:'scan'+i,source:'a'.repeat(40),savedAt:new Date(Date.UTC(2026,9,27,12,i)).toISOString(),...record}));
 const data=new Map([[historyKey(uid),JSON.stringify({version:1,entries:payload})],[workStorageKey(uid),JSON.stringify(emptyWorkLedger())]]);
 const storage={getItem:key=>data.get(key)||null};
 const report=createBuildLabEvidencePackage(storage,uid,'2026-10-27T13:00:00.000Z');
 assert.equal(report.manifest.scanCount,5);
 assert.deepEqual(Object.keys(report.manifest.scansByType),['ai','impact','inspector','master','radar']);
 assert.deepEqual(report.scans.map(x=>x.type),['master','inspector','radar','ai','impact']);
 assert.equal(report.scans[1].snapshot.report.findings[0].id,'ia-native-confirm');
 assert.equal(report.scans[1].snapshot.reviews['ia-native-confirm'].editedDetail,'Keep cancel behavior');
 assert.equal(report.scans[2].snapshot.audit.suggestions[0].title,'Improve experience');
 assert.equal(report.scans[4].snapshot.report.findings[0].title,'Regression risk');
 assert.equal(data.get(historyKey(uid)),JSON.stringify({version:1,entries:payload}),'Export must not change browser history');
});

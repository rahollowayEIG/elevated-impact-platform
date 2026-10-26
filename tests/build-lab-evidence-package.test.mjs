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

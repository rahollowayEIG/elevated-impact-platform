/**
 * Explicit, review-first cloud backup workflow for the one authorized EIG owner.
 * Browser and cloud records remain independent until the owner chooses an action.
 * No automatic sync, no agent execution, no deployment, no writes to event data.
 */
import {readBuildLabCloudRecord,saveBuildLabCloudRecord} from './buildLabCloudRecords.mjs';
import {createBuildLabEvidencePackage} from './buildLabEvidencePackage.mjs';
import {inspectBuildLabEvidencePackage,restoreBuildLabEvidencePackage} from './buildLabEvidenceRecovery.mjs';
import {readScanHistory} from './buildLabScanHistory.mjs';
import {readWorkLedger,emptyWorkLedger} from './buildLabWorkBuckets.mjs';
import {managerStorageKey,validateManagerBlueprint} from './buildLabManagerBlueprint.mjs';

export const CLOUD_RECORD_KINDS=Object.freeze([
 ['scan_history','Scan history'],['work_buckets','Work Buckets'],['manager_blueprint','Manager plan']
]);
const kindSet=new Set(CLOUD_RECORD_KINDS.map(([name])=>name));
const emptyHistory=()=>({version:1,entries:[]});
const json=x=>JSON.stringify(x);
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'
 ?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;

export function readBuildLabBrowserSnapshot(storage,ownerUserId){
 const report=createBuildLabEvidencePackage(storage,ownerUserId);
 const documents={
  scan_history:{version:1,entries:report.scans},
  work_buckets:report.workBuckets,
  manager_blueprint:report.managerBlueprint
 };
 // Ensure the same validation is used for both local exports and restores.
 inspectBuildLabEvidencePackage(ownerUserId,json(report));
 return {documents,report};
}
export function cloudDocumentComparison(browserDocument,cloudRecord){
 if(!cloudRecord||typeof cloudRecord.found!=='boolean'||!Number.isSafeInteger(cloudRecord.revision))
  throw Error('Cloud revision must be checked before comparing records.');
 if(!cloudRecord.found)return browserDocument===null?'both_empty':'cloud_empty';
 return json(stable(browserDocument))===json(stable(cloudRecord.payload))?'identical':'different';
}
export async function inspectBuildLabCloudSnapshot(client,storage,ownerUserId,http=fetch){
 const local=readBuildLabBrowserSnapshot(storage,ownerUserId);
 // Read all three keys before deciding what to restore. Never infer cloud data.
 const rows=await Promise.all(CLOUD_RECORD_KINDS.map(async([kind])=>
  [kind,await readBuildLabCloudRecord(client,kind,http)]));
 const remote=Object.fromEntries(rows);
 const compare=Object.fromEntries(CLOUD_RECORD_KINDS.map(([kind])=>
  [kind,cloudDocumentComparison(local.documents[kind],remote[kind])]));
 const remoteScans=remote.scan_history.found
  ?remote.scan_history.payload.entries.length:0;
 const remoteWork=remote.work_buckets.found?remote.work_buckets.payload:null;
 return {
  local,remote,compare,
  summary:{
   cloudScans:remoteScans,
   cloudWorkItems:remoteWork?.jobs?.length||0,
   cloudBatches:remoteWork?.batches?.length||0,
   cloudManager:remote.manager_blueprint.found,
   localScans:local.report.scans.length,
   localWorkItems:local.report.workBuckets.jobs.length,
   localBatches:local.report.workBuckets.batches.length,
   localManager:!!local.report.managerBlueprint
  }
 };
}
export async function saveOneBuildLabCloudDocument(client,storage,ownerUserId,inspection,kind,http=fetch){
 if(!kindSet.has(kind)||!inspection?.remote?.[kind]||!inspection?.local)
  throw Error('Inspect current cloud records before saving.');
 const fresh=readBuildLabBrowserSnapshot(storage,ownerUserId);
 if(json(stable(fresh.documents[kind]))!==json(stable(inspection.local.documents[kind])))
  throw Error('Browser work changed since comparison. Refresh the cloud comparison before saving.');
 const document=fresh.documents[kind];
 if(document===null)throw Error('No saved Manager plan exists in this browser. Nothing was sent.');
 const expected=inspection.remote[kind].revision;
 const saved=await saveBuildLabCloudRecord(client,kind,expected,document,http);
 return saved;
}
export function restoreBuildLabCloudSnapshot(storage,ownerUserId,inspection,{allowReplace=false}={}){
 if(!inspection?.remote)throw Error('Inspect cloud records before restoring.');
 const records=inspection.remote;
 // Partial cloud backups must not silently wipe browser work in missing slots.
 if(!records.scan_history?.found||!records.work_buckets?.found)
  throw Error('Cloud scan history and Work Buckets must both be backed up before full recovery.');
 const scans=records.scan_history.payload?.entries;
 const work=records.work_buckets.payload;
 const plan=records.manager_blueprint?.found?records.manager_blueprint.payload:null;
 if(!Array.isArray(scans)||!work)throw Error('Cloud backup is incomplete.');
 const byType=Object.fromEntries([...new Set(scans.map(x=>x.type))].sort().map(type=>
  [type,scans.filter(x=>x.type===type).length]));
 const report={
  kind:'eig_build_lab_evidence_package',version:2,
  generatedAt:new Date().toISOString(),
  ownerScope:{userId:ownerUserId.toLowerCase()},
  manifest:{scanCount:scans.length,scansByType:byType,
   workItemCount:work.jobs?.length,batchCount:work.batches?.length,
   hasManagerBlueprint:!!plan},
  scans,workBuckets:work,managerBlueprint:plan
 };
 // Validate the *entire* incoming cloud snapshot before changing any browser key.
 inspectBuildLabEvidencePackage(ownerUserId,json(report));
 return restoreBuildLabEvidencePackage(storage,ownerUserId,json(report),{allowReplace});
}

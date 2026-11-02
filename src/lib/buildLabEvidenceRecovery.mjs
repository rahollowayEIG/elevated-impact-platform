/**
 * Owner-local evidence recovery. No external requests, customer data reads,
 * agent execution, deployment privileges, or database mutations.
 *
 * Browser storage is not transactional. Validate everything before the first
 * write, verify each write, and attempt to roll back every touched key on error.
 * This is a recoverable owner-only pilot, NOT durable cloud persistence.
 */
import {historyKey,readScanHistory} from './buildLabScanHistory.mjs';
import {workStorageKey,readWorkLedger,validateWorkLedger} from './buildLabWorkBuckets.mjs';
import {managerStorageKey,validateManagerBlueprint} from './buildLabManagerBlueprint.mjs';

const MAX_ARCHIVE=5000000;
const MAX_HISTORY=1800000;
const MAX_WORK=2400000;
const MAX_MANAGER=600000;
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const safeJson=x=>JSON.stringify(x);

function keysFor(ownerUserId){
 const history=historyKey(ownerUserId),work=workStorageKey(ownerUserId),manager=managerStorageKey(ownerUserId);
 if(!history||!work||!manager)throw Error('Sign in with the original owner account before restoring evidence.');
 return {history,work,manager};
}

export function inspectBuildLabEvidencePackage(ownerUserId,raw){
 keysFor(ownerUserId);
 if(typeof raw!=='string'||raw.length>MAX_ARCHIVE)throw Error('Choose a Build Lab evidence JSON file smaller than 5 MB.');
 let pkg;
 try{pkg=JSON.parse(raw);}catch{throw Error('Evidence file is not valid JSON. Nothing was changed.');}
 if(!pkg||typeof pkg!=='object'||Array.isArray(pkg)||pkg.kind!=='eig_build_lab_evidence_package'||pkg.version!==2)
   throw Error('This is not a restorable Build Lab v2 evidence package. Older exports must be re-exported from their original browser.');
 if(pkg.ownerScope?.userId!==ownerUserId.toLowerCase())
   throw Error('This evidence belongs to another owner account. Nothing was changed.');
 if(!validDate(pkg.generatedAt)||!Array.isArray(pkg.scans)||pkg.scans.length>100)
   throw Error('Evidence package is incomplete or has an invalid date.');
 const historyJson=safeJson({version:1,entries:pkg.scans});
 if(historyJson.length>MAX_HISTORY)throw Error('Saved scans exceed the browser history limit.');
 const stage=new Map([[historyKey(ownerUserId),historyJson]]);
 const scans=readScanHistory({getItem:key=>stage.get(key)||null},ownerUserId);
 const ids=new Set(),counts={};
 for(const s of scans){
  const key=s.type+':'+s.id;
  if(ids.has(key))throw Error('Evidence contains duplicate scan IDs.');
  ids.add(key);counts[s.type]=(counts[s.type]||0)+1;
  if(counts[s.type]>20)throw Error('Evidence contains more than 20 scans of one type.');
 }
 const work=validateWorkLedger(pkg.workBuckets);
 const workJson=safeJson(work);
 if(workJson.length>MAX_WORK)throw Error('Saved Work Buckets exceed the browser limit.');
 const plan=pkg.managerBlueprint===null?null:validateManagerBlueprint(pkg.managerBlueprint);
 const managerJson=plan?safeJson(plan):null;
 if(managerJson&&managerJson.length>MAX_MANAGER)throw Error('Manager blueprint exceeds the browser limit.');
 if(pkg.manifest?.scanCount!==scans.length||pkg.manifest?.workItemCount!==work.jobs.length||
    pkg.manifest?.batchCount!==work.batches.length||pkg.manifest?.hasManagerBlueprint!==!!plan)
   throw Error('Evidence package counts do not match its contents.');
 return {
  summary:{generatedAt:pkg.generatedAt,scans:scans.length,workItems:work.jobs.length,batches:work.batches.length,manager:!!plan},
  values:{history:historyJson,work:workJson,manager:managerJson}
 };
}

export function restoreBuildLabEvidencePackage(storage,ownerUserId,raw,{allowReplace=false}={}){
 const keys=keysFor(ownerUserId);
 const inspected=inspectBuildLabEvidencePackage(ownerUserId,raw);
 // Do not erase corrupted/unknown old records or overwrite them on a guessed owner.
 readScanHistory(storage,ownerUserId);
 readWorkLedger(storage,ownerUserId);
 const old={history:storage.getItem(keys.history),work:storage.getItem(keys.work),manager:storage.getItem(keys.manager)};
 if(old.manager){
  if(old.manager.length>MAX_MANAGER)throw Error('Existing Manager blueprint is too large. Download or preserve it before continuing.');
  validateManagerBlueprint(JSON.parse(old.manager));
 }
 const hasCurrent=readScanHistory(storage,ownerUserId).length>0||
   readWorkLedger(storage,ownerUserId).jobs.length>0||
   readWorkLedger(storage,ownerUserId).batches.length>0||!!old.manager;
 if(hasCurrent&&!allowReplace)throw Error('Saved work already exists. Download its current evidence package and explicitly approve replacement.');
 const put=(key,value)=>{
  if(value===null)storage.removeItem(key);
  else storage.setItem(key,value);
  if(storage.getItem(key)!==value)throw Error('Browser storage did not confirm the evidence write.');
 };
 const entries=Object.entries(keys);
 try{
  for(const [name,key] of entries)put(key,inspected.values[name]);
 }catch(error){
  let rollbackFailed=false;
  for(const [name,key] of entries){
   try{put(key,old[name]);}catch{rollbackFailed=true;}
  }
  if(rollbackFailed)throw Error('Restore interrupted and rollback could not be verified. Keep your downloaded backups and inspect local records.');
  throw Error('Restore could not be completed. Original browser records were restored.');
 }
 return inspected.summary;
}

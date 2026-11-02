import {readScanHistory} from './buildLabScanHistory.mjs';
import {readWorkLedger} from './buildLabWorkBuckets.mjs';
import {managerStorageKey,validateManagerBlueprint} from './buildLabManagerBlueprint.mjs';

// Exports only existing owner-local scan records. Never fetches credentials, customers, or providers.
export function createBuildLabEvidencePackage(storage, ownerUserId, now=new Date().toISOString()) {
 const scans=readScanHistory(storage,ownerUserId);
 const work=readWorkLedger(storage,ownerUserId);
 const managerKey=managerStorageKey(ownerUserId);
 if(!managerKey)throw Error('Owner account required for evidence export.');
 const managerRaw=storage.getItem(managerKey);
 if(managerRaw&&managerRaw.length>600000)throw Error('Manager blueprint exceeds the safe export limit.');
 const managerBlueprint=managerRaw?validateManagerBlueprint(JSON.parse(managerRaw)):null;
 const counts=Object.fromEntries([...new Set(scans.map(s=>s.type))].sort().map(type=>[type,scans.filter(s=>s.type===type).length]));
 const summary=[
  '# EIG Build Lab - Scanner Evidence Package',
  '',
  'Generated: '+now,
  'Saved scans: '+scans.length,
  'Work Bucket items: '+work.jobs.length,
  'Reviewed batches: '+work.batches.length,
  'Current Manager blueprint included: '+(managerBlueprint?'yes':'no'),
  '',
  'Scans by type: '+(Object.entries(counts).map(([k,v])=>k+': '+v).join(', ')||'none'),
  '',
  '## Limitations',
  '- This is a copy of owner-local records in the current browser and preview origin, not a fresh scan.',
  '- Only scans retained in browser history are included. Other devices/origins are not included.',
  '- Source markers and snapshots are not executed end-to-end functionality tests.',
  '- Read all exported content before sharing; notes and evidence may contain sensitive business data.',
  '- This export contains the owner account identifier so recovery cannot silently import into a different account.',
  '- No secrets, authentication tokens, or connection settings are intentionally collected.',
  '- Import restores saved evidence only. It never approves code, executes agents or authorizes deployment.',
  '',
  '## Saved scans',
  ...scans.map(s=>'- '+s.savedAt+' | '+s.type+' | '+s.scope+' | source '+s.source),
  '',
  '## Work items',
  ...work.jobs.map(j=>'- ['+j.state+'] '+j.title+' | '+j.bucket+' | '+j.priority),
 ].join('\n');
 return {
  kind:'eig_build_lab_evidence_package', version:2, generatedAt:now,
  ownerScope:{userId:ownerUserId.toLowerCase()},
  manifest:{format:'portable JSON',scope:'current-browser owner-local saved records',scanCount:scans.length,scansByType:counts,workItemCount:work.jobs.length,batchCount:work.batches.length,hasManagerBlueprint:!!managerBlueprint,containsLiveCustomerQueries:false,verifiedRuntimeBehavior:false},
  README:summary,
  scans,workBuckets:work,managerBlueprint,
 };
}

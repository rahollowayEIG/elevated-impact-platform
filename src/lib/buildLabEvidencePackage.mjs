import {readScanHistory} from './buildLabScanHistory.mjs';
import {readWorkLedger} from './buildLabWorkBuckets.mjs';

// Exports only existing owner-local scan records. Never fetches credentials, customers, or providers.
export function createBuildLabEvidencePackage(storage, ownerUserId, now=new Date().toISOString()) {
 const scans=readScanHistory(storage,ownerUserId);
 const work=readWorkLedger(storage,ownerUserId);
 const counts=Object.fromEntries([...new Set(scans.map(s=>s.type))].sort().map(type=>[type,scans.filter(s=>s.type===type).length]));
 const summary=[
  '# EIG Build Lab - Scanner Evidence Package',
  '',
  'Generated: '+now,
  'Saved scans: '+scans.length,
  'Work Bucket items: '+work.jobs.length,
  'Reviewed batches: '+work.batches.length,
  '',
  'Scans by type: '+(Object.entries(counts).map(([k,v])=>k+': '+v).join(', ')||'none'),
  '',
  '## Limitations',
  '- This is a copy of owner-local records in the current browser and preview origin, not a fresh scan.',
  '- Only scans retained in browser history are included. Other devices/origins are not included.',
  '- Source markers and snapshots are not executed end-to-end functionality tests.',
  '- Read all exported content before sharing; notes and evidence may contain sensitive business data.',
  '- No secrets, authentication tokens, or connection settings are intentionally collected.',
  '',
  '## Saved scans',
  ...scans.map(s=>'- '+s.savedAt+' | '+s.type+' | '+s.scope+' | source '+s.source),
  '',
  '## Work items',
  ...work.jobs.map(j=>'- ['+j.state+'] '+j.title+' | '+j.bucket+' | '+j.priority),
 ].join('\n');
 return {
  kind:'eig_build_lab_evidence_package', version:1, generatedAt:now,
  manifest:{format:'portable JSON',scope:'current-browser owner-local saved records',scanCount:scans.length,scansByType:counts,workItemCount:work.jobs.length,batchCount:work.batches.length,containsLiveCustomerQueries:false,verifiedRuntimeBehavior:false},
  README:summary,
  scans,workBuckets:work,
 };
}

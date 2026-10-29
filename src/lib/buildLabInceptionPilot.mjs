import {validateInceptionSourceReport} from './eigBuildLabScanClient.mjs';
import {stackScanBlueprint} from './buildLabMissionOrchestrator.mjs';
export function prepareInceptionPilotBlueprint(entry,findingId){
 if(entry?.type!=='inspector')throw Error('Choose an IA Inspector scan.');
 const report=validateInceptionSourceReport(entry.snapshot?.report);
 const finding=report.findings.find(x=>x.id===findingId);
 if(!finding)throw Error('That finding is not in the selected source report.');
 if(finding.findingType==='preserve_existing')throw Error('This finding describes existing behavior to preserve, not an implementation task.');
 const decision=entry.snapshot.reviews?.[findingId]?.review;
 if(['reject','hold','park'].includes(decision))throw Error('This finding is rejected or held. Review it before preparing a blueprint.');
 const selected={...entry,scope:'inception',snapshot:{...entry.snapshot,report:{...report,findings:[finding]}}};
 const plan=stackScanBlueprint([selected],{title:'IA pilot · '+finding.title});
 return {...plan,pilot:{scanner:'inspector',findingId,sourceFingerprint:report.sourceFingerprint,sourceVersion:report.sourceVersion,evidence:finding.evidence,
  verification:['Confirm the sampled gap against existing tests and the exact branch before adding coverage.','Run the affected synthetic InceptionApex browser test and preserve save/reopen/approval behavior.','Rescan the changed source; compare the selected rule and retain test-run evidence separately.'],
  execution:'manual_approved_implementation',status:'awaiting_owner_review'}};
}

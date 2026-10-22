// Existing Build Lab adapters, combined without introducing a competing UI or permissions layer.
import { scanBuildChangeImpact } from './buildChangeImpact.mjs';
import { createBuildBlueprint } from './eigBuildArchitect.mjs';
export function prepareBuildLabMission({ brief, repository, baseRef, headRef, files }={}) {
  const impact=scanBuildChangeImpact({repository,baseRef,headRef,files});
  const blueprint=createBuildBlueprint(brief);
  return {
    kind:'build_lab_mission_review',schemaVersion:1,
    mission:blueprint,impact,
    status:'owner_review_required',deploymentDecision:'blocked_pending_review',
    evidenceLevels:{blueprint:'user_brief_not_verified',impact:'file_path_inference_only'},
    safety:{readOnly:true,autoApproved:false,autoDeployed:false},
    nextChecks:[
      'Inspect first-party source files with the existing owner-authorized source scanner',
      'Verify findings against the exact committed code and permitted Sandbox screens',
      'Check RLS, integration isolation, event and payment regression behavior',
      'Require explicit approval before creating implementation pull requests',
    ],
  };
}

export {MANAGER_AGENTS,managerStorageKey,stackScanBlueprint,reviewManagerProposal,assignManagerProposal,approveManagerBlueprint,validateManagerBlueprint,restoreManagerBlueprint} from './buildLabManagerBlueprint.mjs';

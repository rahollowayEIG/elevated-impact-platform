import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBuildLabMission} from '../src/lib/buildLabMissionOrchestrator.mjs';
const brief={name:'EIG Invoicing',goal:'Issue EIG invoices for Chapel Hill services with manual payment tracking and future contract/Stripe integrations',audience:'EIG owner and approved billing staff',mode:'new_feature',reuse:'many'};
test('reuses existing blueprint and impact engines and denies deployment',()=>{
 const x=prepareBuildLabMission({brief,repository:'rahollowayEIG/elevated-impact-platform',baseRef:'main',headRef:'feature/sandbox',files:[{path:'src/billing/Invoice.jsx',status:'added'}]});
 assert.equal(x.mission.kind,'eig_build_lab_blueprint');
 assert.equal(x.impact.kind,'build_change_impact');
 assert.equal(x.status,'owner_review_required');
 assert.equal(x.deploymentDecision,'blocked_pending_review');
 assert.equal(x.safety.autoDeployed,false);
 assert.ok(x.impact.findings.length>0);
});
test('rejects invalid source changes and missing briefs',()=>{
 assert.throws(()=>prepareBuildLabMission({brief,repository:'owner/repo',baseRef:'main',headRef:'new',files:[{path:'../secret',status:'added'}]}));
 assert.throws(()=>prepareBuildLabMission({brief:{},repository:'owner/repo',baseRef:'main',headRef:'new',files:[]}));
});

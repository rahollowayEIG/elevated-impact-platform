import test from 'node:test';
import assert from 'node:assert/strict';
import { scanBuildChangeImpact } from '../src/lib/buildChangeImpact.mjs';
const base = { repository:'rahollowayEIG/elevated-impact-platform',baseRef:'main',headRef:'draft' };
test('payment and event paths demand review',()=>{
 const report=scanBuildChangeImpact({...base,files:[{path:'api/stripe-webhook.js',status:'modified'},{path:'src/event-registration.jsx',status:'modified'}]});
 assert.equal(report.riskLevel,'critical');
 assert.equal(report.deploymentDecision,'blocked_pending_review');
 assert.equal(report.productionDataAccessed,false);
 assert.ok(report.findings.some(x=>x.category==='payments'));
 assert.ok(report.findings.some(x=>x.category==='registration'));
});
test('low-risk file still requires owner review',()=>{
 const report=scanBuildChangeImpact({...base,files:[{path:'docs/README.md',status:'modified'}]});
 assert.equal(report.ownerApprovalRequired,true);
 assert.equal(report.deploymentDecision,'blocked_pending_review');
});
test('invalid paths and duplicate paths are rejected',()=>{
 assert.throws(()=>scanBuildChangeImpact({...base,files:[{path:'../secrets',status:'modified'}]}));
 assert.throws(()=>scanBuildChangeImpact({...base,files:[{path:'a',status:'modified'},{path:'a',status:'added'}]}));
});
test('migrations and auth files flagged critical',()=>{
 const r=scanBuildChangeImpact({...base,files:[{path:'supabase/migrations/001.sql',status:'added'},{path:'src/auth/session.mjs',status:'modified'}]});
 assert.ok(r.findings.some(x=>x.category==='database'));
 assert.ok(r.findings.some(x=>x.category==='identity'));
});

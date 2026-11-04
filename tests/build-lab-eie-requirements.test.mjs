import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {EIE_BASELINE,EIE_REQUIREMENTS,validateEieBaseline,eieRequirementOverview} from '../src/lib/buildLabEieRequirements.mjs';
import {APP_FAMILIES} from '../src/lib/buildLabAppHierarchy.mjs';
import {APP_NEW_SOURCE_OWNERS} from '../src/lib/buildLabSourceOwners.mjs';

const root=path.resolve(import.meta.dirname,'..');
test('EIE baseline is a draft and all requirements have stable IDs, acceptance criteria, and owner component mapping',()=>{
 const app=APP_FAMILIES.find(a=>a.id==='eie');
 assert.equal(EIE_BASELINE.status,'proposed_for_owner_review');
 assert.equal(EIE_BASELINE.approvedAt,null);
 assert.equal(EIE_BASELINE.approvedReleaseCommit,null);
 assert.deepEqual(validateEieBaseline(),[]);
 assert.equal(EIE_REQUIREMENTS.length,26);
 assert.equal(new Set(EIE_REQUIREMENTS.map(r=>r.id)).size,EIE_REQUIREMENTS.length);
 assert.ok(EIE_REQUIREMENTS.every(r=>app.components.includes(r.component)));
 assert.ok(EIE_REQUIREMENTS.every(r=>r.scopeStatus==='proposed'&&r.verifiedStatus==='no_exact_version_receipt'));
});
test('every proposed requirement with a test mapping points to an existing exact test-script marker',()=>{
 const withTests=EIE_REQUIREMENTS.filter(r=>r.test);
 const without=EIE_REQUIREMENTS.filter(r=>!r.test);
 assert.ok(withTests.length>=14);
 assert.ok(without.length>=5);
 for(const r of withTests){
  const src=fs.readFileSync(path.join(root,r.test.file),'utf8');
  assert.ok(src.includes(r.test.marker),r.id+' marker absent from '+r.test.file+': '+r.test.marker);
 }
});
test('EIE exposes real mapping counts, not invented build, pass, integration, or launch percentages',()=>{
 const summary=eieRequirementOverview();
 assert.equal(summary.total,26);
 assert.equal(summary.mapped,EIE_REQUIREMENTS.filter(r=>r.test).length);
 assert.equal(summary.unmapped,EIE_REQUIREMENTS.filter(r=>!r.test).length);
 assert.equal(summary.testMappingPercent,Math.round(summary.mapped/summary.total*100));
 assert.equal(summary.built,null);
 assert.equal(summary.verified,null);
 assert.equal(summary.integration,null);
 assert.equal(summary.overall,null);
 assert.ok(summary.linkedTargets.includes('accounts'));
 assert.equal(summary.byComponent.registration.filter(r=>r.test).length,0);
 assert.ok(summary.byComponent.roster.some(r=>r.test?.level==='unit'));
 assert.ok(summary.byComponent['event-builder'].every(r=>!r.test),
  'Event Details and Registration saves do not yet have verified mapped tests');
 assert.ok(summary.byComponent['event-packet'].some(r=>r.test?.level==='browser'));
});
test('missing mapping, expired version and invalid approval cannot quietly pass as complete',()=>{
 const missing=EIE_REQUIREMENTS.find(r=>r.id==='EIE-REG-05');
 assert.equal(missing.test,null);
 assert.equal(missing.implementationStatus,'not_independently_verified');
 assert.equal(missing.verifiedStatus,'no_exact_version_receipt');
 const forged=[...EIE_REQUIREMENTS];
 forged[0]={...forged[0],scopeStatus:'approved',verifiedStatus:'passed'};
 assert.ok(validateEieBaseline(forged).some(x=>x.includes('incorrectly marked verified')));
 assert.ok(validateEieBaseline(EIE_REQUIREMENTS,{
  ...EIE_BASELINE,status:'approved',approvedAt:'2026-11-04'
 }).some(x=>x.includes('unapproved draft')));
});
test('new requirement registry belongs to EIE and remains outside the production scanner until reviewed',()=>{
 const owner=APP_NEW_SOURCE_OWNERS.find(x=>x.path==='src/lib/buildLabEieRequirements.mjs');
 assert.ok(owner);
 assert.equal(owner.appId,'eie');
 assert.ok(APP_FAMILIES.find(a=>a.id==='eie').components.includes(owner.component));
 assert.equal(owner.scannerStatus,'review_pending');
});
test('EIE feature list renders at the app and component levels with strict no-false-completion labels',()=>{
 const src=fs.readFileSync(path.join(root,'src/components/BuildLabAppStack.jsx'),'utf8');
 assert.match(src,/EieScopePanel/);
 assert.match(src,/EieComponentChecklist/);
 assert.match(src,/current\.id==='eie'/);
 assert.match(src,/Test mapping coverage \(not completion\)/);
 assert.match(src,/No passing receipt|Passing version not verified/);
 assert.match(src,/owner review/);
 assert.match(src,/eiePlan\.byComponent\[part\.id\]/);
 assert.doesNotMatch(src,/approveRequirementAutomatically|livePayment|deployFix/);
});

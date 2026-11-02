import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_FAMILIES,APP_PART_SOURCE_HINTS,buildApplicationHierarchy} from '../src/lib/buildLabAppHierarchy.mjs';
import {APP_STACK_CATALOG,buildAppStack} from '../src/lib/buildLabAppStack.mjs';
import {APP_NEW_SOURCE_OWNERS} from '../src/lib/buildLabSourceOwners.mjs';
import {auditBuildLabCoverage,changedSourceFilesFromGit} from '../scripts/build-lab-source-coverage-audit.mjs';

test('EIE contains both existing scanner areas and explicit feature-level scope candidates',()=>{
 const app=APP_FAMILIES.find(x=>x.id==='eie');
 assert.deepEqual(app.components,[
  'event-builder','registration','payments','roster','sponsors','event-packet','event-budget'
 ]);
 for(const title of [
  'Public Event Hub','ATC Event Operations','Event Directory & Outing Inquiries',
  'Check-in & Attendance','Team Invitations & Account Claims',
  'Golf Genius Export & Print Rosters','Event Contracts & Insurance'
 ])assert.ok(app.coverageCandidates.includes(title),title);
 const hierarchy=buildApplicationHierarchy(buildAppStack().cards);
 const eie=hierarchy.families.find(x=>x.id==='eie');
 assert.equal(eie.scopeEntries.length,app.coverageCandidates.length);
 assert.equal(eie.coverageToScope,app.coverageCandidates.length);
 assert.deepEqual(eie.scopeEntries.find(x=>x.name==='Team Invitations & Account Claims').sourceHints,
  ['src/GolfTeamInvitation.jsx','src/EieTeamManagement.jsx']);
 assert.equal(eie.build,null);
 assert.equal(eie.verified,null);
 assert.equal(eie.integration,null);
 assert.equal(eie.overall,null);
});
test('remaining apps have an actionable source-coverage inventory without pretending it is complete',()=>{
 const families=['inception-apex','social-marketing','squawk-box','commerce','platform','golf','build-lab'];
 for(const id of families){
  const app=APP_FAMILIES.find(x=>x.id===id);
  assert.ok(app);
  assert.ok(app.coverageCandidates.length>=3,id);
 }
 const scannerParts=APP_FAMILIES.flatMap(a=>a.components);
 assert.equal(new Set(scannerParts).size,APP_STACK_CATALOG.length);
 assert.ok(APP_FAMILIES.every(a=>a.coverageCandidates.every(x=>typeof x==='string'&&x.length>5)));
});
test('coverage audit verifies all product families against existing live scanner scope',()=>{
 const audit=auditBuildLabCoverage();
 assert.deepEqual(audit.errors,[]);
 assert.equal(audit.ok,true);
 assert.equal(audit.summary.applications,8);
 assert.equal(audit.summary.scannerComponents,17);
 assert.equal(audit.summary.componentsInLiveScan,13);
 assert.equal(audit.summary.componentsExcludedFromLiveScan,4);
 assert.ok(audit.summary.featureScopeCandidates>=40);
 assert.ok(audit.summary.candidateSourcePathsOutsideLiveScanner>0);
 assert.equal(audit.summary.newlyAddedSourceFiles,0);
 assert.ok(audit.pendingParts.every(x=>x.scannerStatus==='candidate_feature_coverage_not_registered'));
});
test('new product source files without explicit app ownership fail the gate',()=>{
 const audit=auditBuildLabCoverage({changedFiles:[
  {change:'A',path:'src/components/BrandNewApp.jsx'}
 ]});
 assert.equal(audit.ok,false);
 assert.deepEqual(audit.unregisteredNew,['src/components/BrandNewApp.jsx']);
 assert.match(audit.errors.join(' '),/Unregistered new first-party source/);
});
test('enrolling a source under Build Lab does not silently expand the live production scanner',()=>{
 const audit=auditBuildLabCoverage({changedFiles:[
  {change:'A',path:'src/lib/buildLabSourceOwners.mjs'}
 ]});
 assert.equal(audit.ok,true);
 assert.deepEqual(audit.registeredPending,['src/lib/buildLabSourceOwners.mjs']);
 assert.equal(audit.summary.newFilesAwaitingScannerReview,1);
 assert.ok(audit.notes.some(x=>x.includes('NOT added to live scanner')));
});
test('modified old source outside the fixed scanner remains visible as a review gap',()=>{
 const audit=auditBuildLabCoverage({changedFiles:[
  {change:'M',path:'src/EieTeamManagement.jsx'},
  {change:'M',path:'src/EieRosterMaintenance.jsx'}
 ]});
 assert.equal(audit.ok,true);
 assert.deepEqual(audit.modifiedOutOfScope,['src/EieTeamManagement.jsx']);
 assert.equal(audit.summary.modifiedSourceFilesOutsideLiveScanner,1);
});
test('reject invalid app ownership, duplicate source registration and false live-scan status',()=>{
 const original=APP_NEW_SOURCE_OWNERS[0];
 const sourceOwners=[
  {...original,appId:'unknown-app',scannerStatus:'in_live_scanner'},
  {...original}
 ];
 const audit=auditBuildLabCoverage({sourceOwners});
 assert.equal(audit.ok,false);
 assert.match(audit.errors.join(' '),/Unknown app\/component assignment/);
 assert.match(audit.errors.join(' '),/Duplicate new-source registration/);
 assert.match(audit.errors.join(' '),/Cannot label source as live-scanned/);
});
test('stale source hints and unknown candidate names are caught before release',()=>{
 const hints={...APP_PART_SOURCE_HINTS,eie:{
  ...APP_PART_SOURCE_HINTS.eie,
  'Unknown Sneaky Component':['src/PlatformApp.jsx'],
  'Team Invitations & Account Claims':['src/not-a-real-eie-feature.mjs']
 }};
 const audit=auditBuildLabCoverage({hints});
 assert.equal(audit.ok,false);
 assert.match(audit.errors.join(' '),/unknown app part/);
 assert.match(audit.errors.join(' '),/not found/);
});
test('git diff runner is bounded and never passes user-controlled values through a shell',()=>{
 assert.throws(()=>changedSourceFilesFromGit({baseSha:'abc;touch dangerous'}),/40-character/);
 let called;
 const changed=changedSourceFilesFromGit({
  baseSha:'a'.repeat(40),runner:(bin,args,options)=>{
   called={bin,args,options};
   return 'A\tsrc/components/NewComponent.jsx\nM\tsrc/PlatformApp.jsx\nA\tREADME.md\nD\tsrc/removed.js\n';
  }
 });
 assert.equal(called.bin,'git');
 assert.deepEqual(called.args,['diff','--name-status','--diff-filter=AM','a'.repeat(40),'HEAD']);
 assert.deepEqual(changed,[
  {change:'A',path:'src/components/NewComponent.jsx'},
  {change:'M',path:'src/PlatformApp.jsx'}
 ]);
});

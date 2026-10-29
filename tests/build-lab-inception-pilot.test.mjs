import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareInceptionPilotBlueprint} from '../src/lib/buildLabInceptionPilot.mjs';
import {reviewManagerProposal,approveManagerBlueprint,stackScanBlueprint} from '../src/lib/buildLabMissionOrchestrator.mjs';
const require=createRequire(import.meta.url);
const {readAllowlistedInceptionSource,scanInceptionSource,tabletViewportSignals}=require('../server/eig-inception-source-scan.cjs');
// Recreate the pre-fix sample so the handoff remains tested after the real gap closes.
const inputs=()=>{
 const source=readAllowlistedInceptionSource();
 source['tests/inception-apex-browser.cjs']=source['tests/inception-apex-browser.cjs'].replace(/^\s*await page\.setViewportSize\(\{ width: (?:949|950|951), height: 900 \}\);$/gm,'');
 return source;
};
const entry=report=>({id:'pilot-run',type:'inspector',scope:'inception',source:report.sourceVersion,savedAt:'2026-10-21T23:00:00Z',snapshot:{report,reviews:{}}});
test('pre-fix source sample selects one gap into an unapproved blueprint with exact provenance',()=>{
 const source=inputs(),report=scanInceptionSource(source,'a'.repeat(40));
 const gap=report.findings.find(x=>x.id==='ia-responsive-coverage');assert.equal(gap.findingType,'coverage_gap');
 const plan=prepareInceptionPilotBlueprint(entry(report),gap.id);
 assert.equal(plan.proposals.length,1);assert.equal(plan.proposals[0].decision,'pending');assert.equal(plan.proposals[0].requiresVerification,true);
 assert.equal(plan.pilot.sourceFingerprint,report.sourceFingerprint);assert.deepEqual(plan.pilot.evidence,gap.evidence);
 assert.equal(plan.execution,'not_connected');assert.equal(plan.tasks.length,0);assert.throws(()=>approveManagerBlueprint(plan),/Review each/);
 const approved=approveManagerBlueprint(reviewManagerProposal(plan,'proposal-1','accept'));
 assert.equal(approved.tasks.length,3);assert.equal(approved.tasks[0].phase,'verify');assert.equal(approved.tasks[2].phase,'inspect');
 assert.equal(approved.safety.autoBuilt,false);assert.equal(approved.safety.autoDeployed,false);
});
test('synthetic after-source removes only the selected coverage gap; test execution is still unverified',()=>{
 const source=inputs(),before=scanInceptionSource(source);
 const calls=[949,950,951].map(width=>`\nawait page.setViewportSize({ width: ${width}, height: 900 });`).join('');
 const after=scanInceptionSource({...source,'tests/inception-apex-browser.cjs':source['tests/inception-apex-browser.cjs']+calls});
 assert.notEqual(before.sourceFingerprint,after.sourceFingerprint);assert.ok(!after.findings.some(x=>x.id==='ia-responsive-coverage'));
 assert.deepEqual(after.coverageChecks[0].observedWidths,[949,950,951]);assert.equal(after.coverageChecks[0].runtimeVerified,false);
 assert.ok(after.findings.some(x=>x.id==='ia-image-keyboard'&&x.findingType==='preserve_existing'));
 assert.deepEqual(after.findings.map(x=>x.id),before.findings.filter(x=>x.id!=='ia-responsive-coverage').map(x=>x.id));
});
test('partial coverage, prose, comments, template text and unrelated widths do not clear the gap',()=>{
 const text=`// await page.setViewportSize({ width: 949, height: 900 });\n/*\nawait page.setViewportSize({ width: 950, height: 900 });\n*/\nconst example=\`\nawait page.setViewportSize({ width: 951, height: 900 });\n\`;\nawait page.setViewportSize({ width: 390, height: 900 });`;
 assert.deepEqual(tabletViewportSignals(text),[]);
 const source=inputs();const after=scanInceptionSource({...source,'tests/inception-apex-browser.cjs':source['tests/inception-apex-browser.cjs']+'\nawait page.setViewportSize({ width: 949, height: 900 });'});
 assert.ok(after.findings.some(x=>x.id==='ia-responsive-coverage'));assert.deepEqual(after.coverageChecks[0].observedWidths,[949]);
});
test('preserve-existing, rejected and invented findings cannot enter the pilot',()=>{
 const report=scanInceptionSource(inputs());
 assert.throws(()=>prepareInceptionPilotBlueprint(entry(report),'ia-image-keyboard'),/preserve/);
 assert.throws(()=>prepareInceptionPilotBlueprint(entry(report),'not-in-report'),/not in/);
 const rejected=entry(report);rejected.snapshot.reviews['ia-responsive-coverage']={review:'reject'};
 assert.throws(()=>prepareInceptionPilotBlueprint(rejected,'ia-responsive-coverage'),/rejected/);
 assert.throws(()=>prepareInceptionPilotBlueprint({...entry(report),type:'ai'},'ia-responsive-coverage'));
});

test('stacking a whole IA scan preserves existing strengths without creating duplicate build tasks',()=>{
 const report=scanInceptionSource(inputs());const plan=stackScanBlueprint([entry(report)]);
 assert.equal(plan.preserved,2);assert.equal(plan.proposals.length,report.findings.length-2);
 assert.ok(!plan.proposals.some(x=>/Preserve keyboard|Keep save, reopen/.test(x.title)));
});

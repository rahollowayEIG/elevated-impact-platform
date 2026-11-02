import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {APP_STACK_CATALOG,buildAppStack} from '../src/lib/buildLabAppStack.mjs';
import {APP_FAMILIES,buildApplicationHierarchy,findAppFamily} from '../src/lib/buildLabAppHierarchy.mjs';

const all=APP_STACK_CATALOG.map((app,i)=>({...app,
 scanned:i%2===0,open:i===0?2:i===1?1:0,hold:i===1?1:0,planned:i===0?1:0,
 stage:i===0?'Needs verification':'Awaiting scan',
 build:null,verified:null,integration:null,overall:null
}));
test('top-level App Stack contains EIE and other product families, not 17 separate top-level cards',()=>{
 const hierarchy=buildApplicationHierarchy(all);
 assert.ok(hierarchy.summary.applications<APP_STACK_CATALOG.length);
 assert.equal(hierarchy.summary.applications,APP_FAMILIES.length);
 assert.equal(hierarchy.summary.components,17);
 const eie=findAppFamily('eie');
 assert.equal(eie.name,'EIE | Elevated Impact Events');
 assert.deepEqual(eie.components,[
  'event-builder','registration','payments','roster','sponsors','event-packet','event-budget'
 ]);
 assert.ok(eie.coverageCandidates.includes('Public Event Hub'));
 assert.ok(eie.coverageCandidates.includes('ATC Event Operations'));
 assert.ok(eie.coverageCandidates.includes('Event Directory & Outing Inquiries'));
});
test('each scanned module belongs to one application family, with no double-counting of findings',()=>{
 const ids=APP_FAMILIES.flatMap(a=>a.components);
 assert.equal(ids.length,APP_STACK_CATALOG.length);
 assert.deepEqual([...new Set(ids)].sort(),APP_STACK_CATALOG.map(a=>a.id).sort());
 assert.ok(APP_FAMILIES.every(a=>a.components.length>=1));
 const result=buildApplicationHierarchy(all);
 assert.equal(result.summary.open,3);
 assert.equal(result.summary.hold,1);
 assert.equal(result.summary.planned,1);
 assert.equal(result.families.reduce((n,a)=>n+a.componentCount,0),17);
 assert.equal(result.families.reduce((n,a)=>n+a.open,0),3);
 assert.equal(result.families.find(x=>x.id==='eie').open,3);
});
test('parent meters stay unmeasured even when components have source markers',()=>{
 const scan={type:'master',savedAt:'2026-11-02T20:00:00.000Z',
  snapshot:{report:{kind:'eig_build_lab_master_scan',sourceVersion:'a'.repeat(40),
   inspectedAt:'2026-11-02T20:00:00.000Z',
   modules:APP_STACK_CATALOG.map(a=>({id:a.id,stage:'evidence_present',status:'evidence_present',
    coverage:{source:{expected:1,observed:1},ui:{expected:1,observed:1},
     test:{expected:1,observed:1}},evidence:[]}))}}};
 const cards=buildAppStack({history:[scan]}).cards;
 const eie=buildApplicationHierarchy(cards).families.find(a=>a.id==='eie');
 assert.equal(eie.scannedCount,7);
 assert.equal(eie.componentCount,7);
 assert.equal(eie.build,null);
 assert.equal(eie.verified,null);
 assert.equal(eie.integration,null);
 assert.equal(eie.overall,null);
 assert.ok(eie.coverageToScope>0,'candidate parts need their own scanner coverage');
});
test('parent rolls up only its own parts; missing scanner records cannot turn into completed work',()=>{
 const subset=all.filter(x=>x.id!=='event-budget');
 const hierarchy=buildApplicationHierarchy(subset);
 const eie=hierarchy.families.find(a=>a.id==='eie');
 assert.equal(eie.componentCount,7);
 assert.equal(eie.parts.length,6);
 assert.ok(eie.coverageToScope>eie.coverageCandidates.length);
 assert.equal(eie.build,null);
 assert.equal(eie.overall,null);
 const full=buildApplicationHierarchy(all);
 const platform=full.families.find(a=>a.id==='platform');
 assert.equal(platform.componentCount,1);
 assert.equal(platform.open,0);
});
test('even synthetic complete component scores cannot yield an unapproved parent score',()=>{
 const scored=all.map(p=>({...p,build:100,verified:100,integration:100,overall:100}));
 const hierarchy=buildApplicationHierarchy(scored);
 assert.ok(hierarchy.families.every(f=>f.build===null&&f.verified===null&&f.overall===null));
 assert.ok(hierarchy.families.every(f=>f.measuredSourceReady===true));
});
test('click-through routes to component work review, and top-level view has accessible navigation',()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const panel=fs.readFileSync(path.join(root,'src/components/BuildLabAppStack.jsx'),'utf8');
 assert.match(panel,/buildApplicationHierarchy\(data\.cards\)/);
 assert.match(panel,/appId,setAppId/);
 assert.match(panel,/aria-label="Main applications"/);
 assert.match(panel,/Open \{app\.shortName\} components/);
 assert.match(panel,/Back to all applications/);
 assert.match(panel,/Whole-app completion/);
 assert.match(panel,/Parts of \{current\.shortName\}/);
 assert.match(panel,/current\.coverageCandidates/);
 assert.match(panel,/onClick=\{\(\)=>onReview\(card\.id\)\}/);
 assert.match(panel,/aria-label="App Stack location"/);
 assert.doesNotMatch(panel,/autoDeploy|deployToProduction|approveChangesAutomatically/);
});

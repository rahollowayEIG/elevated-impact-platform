#!/usr/bin/env node
/**
 * Read-only Build Lab coverage registration audit.
 *
 * Runs in CI for new first-party source files. It never modifies the Master
 * Scanner's production allowlist or treats a source hit as a passing test.
 * New code must be assigned an app/component, then separately reviewed for
 * scanner enrollment. Existing in-scope files may still gain untested
 * functionality; this tool cannot infer feature semantics.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {APP_FAMILIES,APP_PART_SOURCE_HINTS} from '../src/lib/buildLabAppHierarchy.mjs';
import {APP_STACK_CATALOG} from '../src/lib/buildLabAppStack.mjs';
import {APP_NEW_SOURCE_OWNERS} from '../src/lib/buildLabSourceOwners.mjs';

const require=createRequire(import.meta.url);
const {RELEASE_PATHS,RELEASE_MODULES,EXCLUDED_MODULES}=require('../server/eig-build-lab-v1-source-scope.cjs');
const CODE_PATH=/^(?:src|server|api)\/[a-zA-Z0-9_./-]+\.(?:js|jsx|mjs|cjs|ts|tsx)$/;
const SHA=/^[0-9a-f]{40}$/i;
const tidy=value=>String(value||'').replace(/\\/g,'/').replace(/^\.\/+/,'');
const uniq=arr=>[...new Set(arr)];

export function changedSourceFilesFromGit({baseSha=process.env.BUILD_LAB_BASE_SHA||'',
 rootDir=process.cwd(),runner=execFileSync}={}){
 if(!baseSha)return [];
 if(!SHA.test(baseSha))throw Error('Build Lab source audit requires a validated 40-character base commit SHA.');
 const out=runner('git',['diff','--name-status','--diff-filter=AM',baseSha,'HEAD'],{
  cwd:rootDir,encoding:'utf8',maxBuffer:4*1024*1024
 });
 return String(out).split('\n').filter(Boolean).map(line=>{
  const [change,filename]=line.split('\t');
  return {change,path:tidy(filename)};
 }).filter(row=>(row.change==='A'||row.change==='M')&&CODE_PATH.test(row.path));
}

export function auditBuildLabCoverage({changedFiles=[],rootDir=process.cwd(),
 families=APP_FAMILIES,componentCatalog=APP_STACK_CATALOG,
 hints=APP_PART_SOURCE_HINTS,sourceOwners=APP_NEW_SOURCE_OWNERS,
 releasePaths=RELEASE_PATHS,releaseModules=RELEASE_MODULES,
 excludedModules=EXCLUDED_MODULES}={}){
 const errors=[],notes=[];
 const knownComponents=new Set(componentCatalog.map(m=>m.id));
 const allFamilyIds=new Set(),ownedComponents=new Map();
 for(const app of families){
  if(allFamilyIds.has(app.id))errors.push('Duplicate main application: '+app.id);
  allFamilyIds.add(app.id);
  for(const id of app.components){
   if(!knownComponents.has(id))errors.push('Unknown scanner component '+id+' in '+app.id);
   if(ownedComponents.has(id))errors.push('Component '+id+' belongs to multiple main applications.');
   else ownedComponents.set(id,app.id);
  }
 }
 for(const id of knownComponents)if(!ownedComponents.has(id))
  errors.push('Unassigned scanner component: '+id);
 const liveModules=new Set(releaseModules.map(x=>x.id));
 const livePaths=new Set(releasePaths);
 const scoped=componentCatalog.filter(x=>liveModules.has(x.id)).length;
 const deferred=componentCatalog.filter(x=>excludedModules.includes(x.id)).length;
 for(const id of liveModules)if(!knownComponents.has(id))
  errors.push('Live scanner has a module missing from the App Stack: '+id);
 const pendingParts=[],hintPathsOutsideLive=new Set();
 for(const app of families){
  const candidates=new Set(app.coverageCandidates);
  if(candidates.size!==app.coverageCandidates.length)
   errors.push('Duplicate scope candidate in '+app.id);
  const hinted=hints[app.id]||{};
  for(const candidate of Object.keys(hinted)){
   if(!candidates.has(candidate))errors.push('Source hint references unknown app part '+app.id+' / '+candidate);
  }
  for(const name of app.coverageCandidates){
   const sourceHints=hinted[name]||[];
   if(!Array.isArray(sourceHints))errors.push('Invalid source hints for '+app.id+' / '+name);
   const candidatesPaths=Array.isArray(sourceHints)?sourceHints:[];
   for(const candidatePath of candidatesPaths){
    const normalized=tidy(candidatePath);
    if(!CODE_PATH.test(normalized)||normalized!==candidatePath)
     errors.push('Invalid source path hint '+app.id+' / '+name);
    else if(!fs.existsSync(path.resolve(rootDir,normalized)))
     errors.push('Candidate source path not found: '+normalized);
    else if(!livePaths.has(normalized))hintPathsOutsideLive.add(normalized);
   }
   pendingParts.push({appId:app.id,name,sourceHints:[...candidatesPaths],
    scannerStatus:'candidate_feature_coverage_not_registered'});
  }
 }
 const owners=new Map();
 for(const item of sourceOwners){
  if(!item||!CODE_PATH.test(item.path)||item.path!==tidy(item.path)){
   errors.push('Invalid new-source registration path.');
   continue;
  }
  if(owners.has(item.path))errors.push('Duplicate new-source registration: '+item.path);
  owners.set(item.path,item);
  const parent=families.find(x=>x.id===item.appId);
  if(!parent||!parent.components.includes(item.component))
   errors.push('Unknown app/component assignment for '+item.path);
  if(!['review_pending','in_live_scanner'].includes(item.scannerStatus))
   errors.push('Invalid scanner enrollment status for '+item.path);
  if(item.scannerStatus==='in_live_scanner'&&!livePaths.has(item.path))
   errors.push('Cannot label source as live-scanned when it is not allowlisted: '+item.path);
  if(typeof item.reason!=='string'||item.reason.trim().length<15)
   errors.push('Missing reviewed reason for '+item.path);
  if(!fs.existsSync(path.resolve(rootDir,item.path)))
   errors.push('Registered source file does not exist: '+item.path);
 }
 const newPaths=uniq(changedFiles.filter(x=>x?.change==='A'&&CODE_PATH.test(tidy(x.path)))
  .map(x=>tidy(x.path)));
 const modifiedOutOfScope=uniq(changedFiles.filter(x=>x?.change==='M'&&
   CODE_PATH.test(tidy(x.path))&&!livePaths.has(tidy(x.path)))
  .map(x=>tidy(x.path)));
 const unregisteredNew=newPaths.filter(p=>!owners.has(p));
 if(unregisteredNew.length)errors.push('Unregistered new first-party source: '+unregisteredNew.join(', '));
 const registeredPending=newPaths.filter(p=>owners.get(p)?.scannerStatus==='review_pending');
 if(registeredPending.length)notes.push('New source registered for ownership, but NOT added to live scanner: '+registeredPending.join(', '));
 if(modifiedOutOfScope.length)notes.push('Changed source outside live scanner allowlist; review required: '+modifiedOutOfScope.join(', '));
 return {
  ok:errors.length===0,errors,notes,
  summary:{
   applications:families.length,scannerComponents:componentCatalog.length,
   componentsInLiveScan:scoped,componentsExcludedFromLiveScan:deferred,
   featureScopeCandidates:pendingParts.length,
   candidateSourcePathsOutsideLiveScanner:hintPathsOutsideLive.size,
   newlyAddedSourceFiles:newPaths.length,newFilesAwaitingScannerReview:registeredPending.length,
   modifiedSourceFilesOutsideLiveScanner:modifiedOutOfScope.length
  },
  pendingParts,unregisteredNew,registeredPending,modifiedOutOfScope,
  sourceHintsOutsideLive:[...hintPathsOutsideLive].sort()
 };
}

function main(){
 const rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const changed=changedSourceFilesFromGit({rootDir});
 const audit=auditBuildLabCoverage({changedFiles:changed,rootDir});
 const s=audit.summary;
 console.log('Build Lab Coverage Gate: '+(audit.ok?'PASS':'FAIL'));
 console.log('Main applications: '+s.applications+
  ' | scanner areas: '+s.scannerComponents+
  ' | current live scope: '+s.componentsInLiveScan+
  ' | explicitly excluded: '+s.componentsExcludedFromLiveScan);
 console.log('Feature-level scope needing registration: '+s.featureScopeCandidates+
  ' | candidate source paths outside live scanner: '+s.candidateSourcePathsOutsideLiveScanner);
 console.log('Added source files: '+s.newlyAddedSourceFiles+
  ' | registered pending scanner review: '+s.newFilesAwaitingScannerReview+
  ' | changed code outside scanner: '+s.modifiedSourceFilesOutsideLiveScanner);
 for(const note of audit.notes)console.log('REVIEW: '+note);
 for(const error of audit.errors)console.error('ERROR: '+error);
 if(process.env.GITHUB_STEP_SUMMARY){
  const lines=[
   '### Build Lab Scanner Coverage Gate',
   'Status: **'+(audit.ok?'PASS':'FAIL')+'**',
   '- Main applications: '+s.applications+'; scanner areas: '+s.scannerComponents,
   '- Component areas currently in production scan: '+s.componentsInLiveScan,
   '- Scope candidates without feature-specific scanner tests: '+s.featureScopeCandidates,
   '- New code awaiting scanner enrollment review: '+s.newFilesAwaitingScannerReview,
   '- Modified code outside current live scanner allowlist: '+s.modifiedSourceFilesOutsideLiveScanner,
   '- Scanner enrollment is **not** automatic permission to read new production files.',
   ...audit.notes.map(line=>'- Review: '+line),
   ...audit.errors.map(line=>'- Error: '+line)
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
 }
 if(!audit.ok)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();

'use strict';
// Rule 3 integrity inspection: exact allowlisted sources and dated migration
// VERSION metadata only. No arbitrary file/URL/DB reads, changes or deletion.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {inventorySourceTree}=require('../scripts/build-lab-offline-source-inventory.cjs');
const root=path.resolve(__dirname,'..');
const FILES=Object.freeze([
 'src/PlatformApp.jsx',
 'src/components/BuildLabLiveOwnerWorkspace.jsx',
 'src/components/BuildLabCloudBackup.jsx',
 'vercel.json'
]);
const REPO_MIGRATIONS='supabase/migrations';
const BASELINE=require('./eig-build-lab-migration-baseline.json');
const validVersion=v=>/^[0-9]{14}$/.test(v||'');
function readApprovedIntegrityInputs(){
 const sources={};
 for(const p of FILES){
  const full=path.resolve(root,p);
  if(!full.startsWith(root+path.sep)||!fs.statSync(full).isFile())throw Error('Approved integrity source missing: '+p);
  const value=fs.readFileSync(full,'utf8');
  if(value.length>600000)throw Error('Integrity source is too large: '+p);
  sources[p]=value;
 }
 const filenames=fs.readdirSync(path.resolve(root,REPO_MIGRATIONS))
  .filter(s=>/^[0-9]{14}_[a-z0-9_]+\.sql$/.test(s)).sort();
 const sourceInventory=inventorySourceTree(root);
 return {sources,migrationFilenames:filenames,sourceInventory};
}
function location(s,search){
 const index=s.indexOf(search);
 return index<0?1:s.slice(0,index).split('\n').length;
}
function sourceEvidence(p,s,needle){return [{path:p,line:location(s,needle)}];}
function scanPlatformIntegrity(inputs,sourceVersion='local-unversioned',now='2026-11-02T00:00:00.000Z'){
 if(!inputs||!inputs.sources||!Array.isArray(inputs.migrationFilenames)||!Number.isFinite(Date.parse(now)))
  throw Error('Incomplete fixed integrity scan inputs.');
 for(const p of FILES)if(typeof inputs.sources[p]!=='string')throw Error('Missing approved source: '+p);
 const app=inputs.sources[FILES[0]],workspace=inputs.sources[FILES[1]],cloud=inputs.sources[FILES[2]];
 const baseline=BASELINE;
 if(baseline.kind!=='eig_platform_production_migration_history_reference'||
   baseline.isLiveQuery!==false||!Number.isFinite(Date.parse(baseline.capturedOn))||
   !Array.isArray(baseline.versions)||baseline.versions.length>250||
   baseline.versions.some(v=>!validVersion(v))||
   new Set(baseline.versions).size!==baseline.versions.length)
  throw Error('Pinned migration metadata is invalid.');
 const findings=[];
 const add=(id,title,priority,observation,recommendation,verify,evidence)=>{
  findings.push({id,title,priority,observation,recommendation,verify,
   findingType:'verification_needed',review:'pending',evidence:evidence.slice(0,6)});
 };
 const routePatterns=[
  ["live owner route",/adminView\s*===\s*['"]build_lab_live['"]\s*&&\s*liveBuildLabAllowed/],
  ["approved owner workspace",/<BuildLabLiveOwnerWorkspace\b/],
  ["legacy preview disabled",/const\s+EIG_BUILD_LAB_PREVIEW_ENABLED\s*=\s*false/]
 ];
 const missing=routePatterns.filter(([,pattern])=>!pattern.test(app)).map(([name])=>name);
 if(missing.length)add('approved-route-guard',
  'Review approved Build Lab route and owner guard','high',
  'Approved entrypoint markers are missing from the sampled source: '+missing.join(', ')+'.',
  'Trace the active Command Center navigation, deployment branch and server owner authorization before making any route change.',
  'Confirm the single approved Build Lab is accessible only to the owner, and the old preview cannot be entered.',
  sourceEvidence(FILES[0],app,'build_lab_live'));
 if(/\bEigBuildLab\b/.test(app))add('retired-lab-entrypoint',
  'Review legacy Build Lab entrypoint reference','medium',
  'The sampled production entrypoint still references EigBuildLab, which may be a legacy entrypoint.',
  'Check whether the reference is reachable, compare with the approved owner workspace, then retire only after a dependency review.',
  'Only the approved BuildLabLiveOwnerWorkspace is reachable for the owner and no other users can navigate to legacy pages.',
  sourceEvidence(FILES[0],app,'EigBuildLab'));
 if(!/RECORDS_UI_ENABLED/.test(workspace)||!/activeTool\s*===\s*['"]cloud['"]\s*&&\s*RECORDS_UI_ENABLED/.test(workspace))
  add('cloud-ui-guard','Review cloud storage navigation gate','high',
  'Expected feature-flag guarded cloud navigation was not observed in the approved workspace.',
  'Check the owner UI and server storage flags independently; do not expose production storage until approved.',
  'Cloud controls remain hidden and server-denied while production feature flags are OFF.',
  sourceEvidence(FILES[1],workspace,'RECORDS_UI_ENABLED'));
 if(!/wouldOverwriteCloudWithEmptyBrowser/.test(cloud))add('cloud-overwrite-guard',
  'Review empty-browser overwrite protection','high',
  'The sampled cloud component lacks the expected empty-browser overwrite safety marker.',
  'Confirm cloud save rejects an empty browser replacing populated server history.',
  'A newly opened preview cannot overwrite existing cloud records with empty history or work buckets.',
  sourceEvidence(FILES[2],cloud,'saveOneBuildLabCloudDocument'));
 const references=[["production entrypoint",FILES[0],app],["owner workspace",FILES[1],workspace]];
 for(const [label,p,s] of references) {
  for(const obsolete of ['project-5gwts','elevationpilot-sandbox-9e3a2ifda'])if(s.includes(obsolete))
   add('legacy-link-'+obsolete,label+': review old deployment marker','medium',
    'A known historical preview marker appears in sampled first-party source. Presence does not prove the route is active.',
    'Verify whether this URL is reachable and linked from the approved navigation. Preserve current references before disconnecting.',
    'No approved production navigation or active integration depends on a retired preview.',
    sourceEvidence(p,s,obsolete));
 }
 // The broader inventory is fixed-scope, bounded, and read-only. A missing
 // literal import is a candidate for review, never an automatic deletion.
 const sourceInventory=inputs.sourceInventory;
 if(sourceInventory!==undefined){
  if(sourceInventory?.kind!=='eig_build_lab_offline_source_inventory'||
     sourceInventory.schemaVersion!==1||sourceInventory.readOnly!==true||
     sourceInventory.safety?.readOnly!==true||
     sourceInventory.safety?.deletedItems!==0||
     sourceInventory.safety?.autoDeleted!==false||
     sourceInventory.safety?.autoDeployed!==false||
     !Number.isInteger(sourceInventory.sourceFileCount)||
     sourceInventory.sourceFileCount<0||sourceInventory.sourceFileCount>2500||
     !Number.isInteger(sourceInventory.unresolvedCount)||
     sourceInventory.unresolvedCount<0||sourceInventory.unresolvedCount>2500||
     !Array.isArray(sourceInventory.unresolved)||
     sourceInventory.unresolved.length>500||
     !/^[a-f0-9]{64}$/i.test(sourceInventory.sourceFingerprint||''))
   throw Error('Invalid bounded source inventory.');
  if(sourceInventory.unresolvedCount){
   const first=sourceInventory.unresolved.find(x=>
    x&&typeof x.file==='string'&&
    /^(?:(?:src|api|server)\/[a-zA-Z0-9_/.-]+|(?:App|LegacyApp|main|vite.config))\.(jsx?|mjs|cjs|tsx?)$/.test(x.file)&&
    !x.file.includes('..')&&
    Number.isInteger(x.line)&&x.line>0&&x.line<=30000);
   add('bounded-source-import-review',
    'Review unresolved first-party source imports','medium',
    'Bounded read-only source inventory found '+sourceInventory.unresolvedCount+
     ' literal relative import candidates across '+sourceInventory.sourceFileCount+
     ' first-party files. Legacy root files can be inactive: static resolution is not proof of an active broken route.',
    'Check listed candidates against bundler aliases, generated files and actual entrypoint dependencies before editing or retiring code.',
    'Confirm each candidate is either intentionally resolved by tooling or corrected in source without breaking approved routes.',
    first?[{path:first.file,line:first.line}]:[{path:'src/PlatformApp.jsx',line:1}]);
  }
 }
 const sourceVersions=inputs.migrationFilenames.map(f=>f.slice(0,14));
 if(sourceVersions.some(v=>!validVersion(v))||new Set(sourceVersions).size!==sourceVersions.length)
  throw Error('Invalid or duplicate local migration versions.');
 const repoSet=new Set(sourceVersions),dbSet=new Set(baseline.versions);
 const sourceOnly=sourceVersions.filter(v=>!dbSet.has(v));
 const baselineOnly=baseline.versions.filter(v=>!repoSet.has(v));
 if(sourceOnly.length||baselineOnly.length){
  add('migration-history-parity','Review production migration history against source','high',
   'Dated reference '+baseline.capturedOn+': '+baseline.versions.length+' production migration versions, '+sourceVersions.length+' repository SQL files; '+baselineOnly.length+' baseline-only and '+sourceOnly.length+' repo-only. This is NOT a fresh database query.',
   'Reconcile authoritative historical migration SQL and file versions in a controlled test baseline. Never delete or reset live migration history merely to align counts.',
   'Review all version mismatches against production schema and recover historic SQL safely; rehearse clean replay before production migration.',
   [{path:'server/eig-build-lab-migration-baseline.json',line:1},{path:'supabase/migrations',line:1}]);
 }
 const hash=createHash('sha256');
 for(const p of FILES){hash.update(p);hash.update(inputs.sources[p]);}
 hash.update(inputs.migrationFilenames.join('\n'));
 if(sourceInventory)hash.update(sourceInventory.sourceFingerprint);
 return {
  kind:'eig_build_lab_platform_integrity',schemaVersion:1,target:'elevationpilot',inspectedAt:now,
  scannerVersion:'platform-integrity-v1',sourceVersion,sourceFingerprint:hash.digest('hex'),
  inventory:{sampledFiles:[...FILES],sourceMigrationCount:sourceVersions.length,
    baselineMigrationCount:baseline.versions.length,baselineCapturedOn:baseline.capturedOn,
    sourceOnlyVersions:sourceOnly,baselineOnlyVersions:baselineOnly,
    ...(sourceInventory?{sourceFileCount:sourceInventory.sourceFileCount,
     unresolvedImportCount:sourceInventory.unresolvedCount,
     sourceInventoryFingerprint:sourceInventory.sourceFingerprint}:{} )},
  findings,
  limitations:[
   'Approved entrypoint guards and dated migration metadata were checked; a separate bounded source inventory checks literal imports, not route reachability or runtime dependencies.',
   'Migration history is compared with a dated read-only reference, not a fresh production database query.',
   'Deployments, branches, live navigation, unused code reachability, computed imports, and database object dependencies were NOT inspected.',
   'Static findings are retirement candidates for owner review, never evidence that an item can safely be deleted.'
  ],
  safety:{readOnly:true,serverOnly:true,liveChanges:false,databaseQueried:false,
   deletedItems:0,autoDeleted:false,autoApproved:false,autoDeployed:false}
 };
}
module.exports={FILES,readApprovedIntegrityInputs,scanPlatformIntegrity};

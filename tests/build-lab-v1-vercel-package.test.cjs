'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {RELEASE_PATHS,validateReleaseSourceScope}=require('../server/eig-build-lab-v1-source-scope.cjs');
const {FILE_PATHS:IA_PATHS}=require('../server/eig-inception-source-scan.cjs');
const config=require('../vercel.json');
const EXPECTED={
  'api/eig-build-lab-live-master-scan.js':'{src/*.jsx,src/components/*.jsx,tests/*.{cjs,mjs}}',
  'api/eig-build-lab-live-scan.js':'{src/components/*.{jsx,css},tests/*.cjs}'
};
function checkBundle(entry,approvedPaths){
 const pattern=config.functions?.[entry]?.includeFiles;
 assert.equal(pattern,EXPECTED[entry],'Only reviewed evidence file globs are authorized');
 assert.ok(pattern.length<=256,'Vercel limits includeFiles patterns to 256 characters');
 for(const p of approvedPaths){
   assert.ok(fs.existsSync(p),'Evidence source missing from release repository: '+p);
   assert.ok(path.matchesGlob(p,pattern),'Vercel function would omit approved scan evidence: '+p);
 }
}
test('V1 Master Scanner runtime includes every approved evidence file',()=>{
 const scope=validateReleaseSourceScope();
 assert.deepEqual(scope.missing,[]);
 assert.deepEqual(scope.unscoped,[]);
 checkBundle('api/eig-build-lab-live-master-scan.js',RELEASE_PATHS);
});
test('InceptionApex runtime includes every approved evidence file',()=>{
 checkBundle('api/eig-build-lab-live-scan.js',IA_PATHS);
});

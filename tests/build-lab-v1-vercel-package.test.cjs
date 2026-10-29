'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {RELEASE_PATHS,validateReleaseSourceScope}=require('../server/eig-build-lab-v1-source-scope.cjs');
const {FILE_PATHS:IA_PATHS}=require('../server/eig-inception-source-scan.cjs');
const config=require('../vercel.json');
function includedFor(name){
 const entry=config.functions?.[name];
 assert.equal(typeof entry?.includeFiles,'string',name+' must declare its source bundle');
 const pattern=entry.includeFiles;
 assert.ok(pattern.startsWith('{')&&pattern.endsWith('}'),'Require fixed exact file names, not broad wildcard sources');
 const paths=pattern.slice(1,-1).split(',');
 assert.ok(paths.every(p=>p.startsWith('src/')||p.startsWith('tests/')),'Only approved source and tests');
 assert.ok(paths.every(p=>!/[?*{}]/.test(p)),'No wildcard or nested glob');
 assert.equal(new Set(paths).size,paths.length,'No duplicate evidence files');
 for(const p of paths)assert.ok(fs.existsSync(p),'Evidence file missing from repo: '+p);
 return paths;
}
test('Vercel packages every and only V1 Master Scanner evidence file',()=>{
 const scope=validateReleaseSourceScope();
 assert.deepEqual(scope.missing,[]);
 assert.deepEqual(scope.unscoped,[]);
 assert.deepEqual(includedFor('api/eig-build-lab-live-master-scan.js').sort(),[...RELEASE_PATHS].sort());
});
test('Vercel packages every and only InceptionApex evidence file',()=>{
 assert.deepEqual(includedFor('api/eig-build-lab-live-scan.js').sort(),[...IA_PATHS].sort());
});

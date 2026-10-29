const test=require('node:test');
const assert=require('node:assert/strict');
const {FILE_PATHS,MODULES}=require('../server/eig-master-source-scan.cjs');
const {EXCLUDED_MODULES,RELEASE_MODULES,RELEASE_PATHS,validateReleaseSourceScope}=require('../server/eig-build-lab-v1-source-scope.cjs');

test('V1 profile excludes unfinished modules without altering development-wide scanner',()=>{
  assert.equal(MODULES.length,17);
  assert.equal(RELEASE_MODULES.length,13);
  assert.equal(FILE_PATHS.length>RELEASE_PATHS.length,true);
  for(const id of EXCLUDED_MODULES)assert.equal(RELEASE_MODULES.some(m=>m.id===id),false);
  assert.equal(MODULES.some(m=>m.id==='invoices'),true);
});
test('V1 profile reports missing code and any module evidence paths outside approved scope',()=>{
  const result=validateReleaseSourceScope();
  assert.deepEqual(result.missing,[]);
  assert.deepEqual(result.unscoped,[],'Every configured V1 module must use release-owned evidence');
  const owner=RELEASE_MODULES.find(x=>x.id==='build-lab');
  assert.ok(owner.source.some(x=>x[0]==='src/components/BuildLabLiveOwnerWorkspace.jsx'));
  assert.ok(owner.tests.some(x=>x[0]==='tests/eig-build-lab-live-client.test.mjs'));
});

test('scanner rejects unapproved source rules even when a known module id is reused',()=>{
 const {scanMasterSource,readAllowlistedMasterSource}=require('../server/eig-master-source-scan.cjs');
 const {RELEASE_MODULES,RELEASE_PATHS}=require('../server/eig-build-lab-v1-source-scope.cjs');
 const forged=RELEASE_MODULES.map(m=>m.id==='build-lab'?{...m,source:[['src/components/BuildLabLiveOwnerWorkspace.jsx','nonexistent privileged marker']]}:m);
 assert.throws(()=>scanMasterSource(readAllowlistedMasterSource(RELEASE_PATHS),'a'.repeat(40),new Date().toISOString(),null,'compare',{paths:RELEASE_PATHS,modules:forged}),/Invalid scanner source profile/);
});

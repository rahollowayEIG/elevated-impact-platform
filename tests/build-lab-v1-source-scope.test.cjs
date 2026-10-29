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
  assert.ok(result.unscoped.length>0,'Missing owner-console evidence must be reported, not silently suppressed');
  assert.ok(result.unscoped.some(x=>x.module==='build-lab'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {compareMigrationManifest} from '../scripts/build-lab-compare-migration-manifest.mjs';
const hash=s=>createHash('md5').update(s).digest('hex');
async function fixture() {
 const root=await mkdtemp(path.join(tmpdir(),'eig-migration-audit-'));
 await mkdir(path.join(root,'supabase/migrations'),{recursive:true});
 await mkdir(path.join(root,'docs/audits'),{recursive:true});
 const sql='select 1;\n';
 await writeFile(path.join(root,'supabase/migrations/20261001010101_first.sql'),sql);
 const manifest={schemaVersion:1,checkedOn:'2026-11-02',liveSqlIncluded:false,securityReviewComplete:false,
  entries:[{version:'20261001010101',name:'first',sqlMd5:hash(sql),sqlCharacters:sql.length,sqlStatementCount:1},
   {version:'20261002020202',name:'second',sqlMd5:hash('select 2;'),sqlCharacters:9,sqlStatementCount:1}],
  repositoryOnly:[]};
 const manifestPath=path.join(root,'docs/audits/build-lab-migration-recovery-manifest-20261102.json');
 await writeFile(manifestPath,JSON.stringify(manifest));
 return {root,manifestPath};
}
test('reports matches and db-only versions without changing data',async()=>{
 const f=await fixture();
 try{
  const result=await compareMigrationManifest(f);
  assert.equal(result.mode,'read-only');
  assert.deepEqual(result.exactContentMatches,['20261001010101']);
  assert.deepEqual(result.dbOnly,['20261002020202']);
  assert.equal(result.productionModified,false);
  assert.equal(result.historyModified,false);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('reports repository-only file and SQL drift as needing review',async()=>{
 const f=await fixture();
 try {
  await writeFile(path.join(f.root,'supabase/migrations/20261001010101_first.sql'),'select changed;');
  await writeFile(path.join(f.root,'supabase/migrations/20261003030303_third.sql'),'select 3;');
  const result=await compareMigrationManifest(f);
  assert.equal(result.exactContentMatches.length,0);
  assert.equal(result.contentReviewRequired.length,1);
  assert.deepEqual(result.repoOnly,['20261003030303_third.sql']);
  assert.equal(result.reviewNeeded,true);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('rejects forged duplicate migration version manifest',async()=>{
 const f=await fixture();
 try{
  const file=JSON.parse(await (await import('node:fs/promises')).readFile(f.manifestPath,'utf8'));
  file.entries.push({...file.entries[0]});
  await writeFile(f.manifestPath,JSON.stringify(file));
  await assert.rejects(()=>compareMigrationManifest(f),/Invalid or duplicated/);
 }finally{await rm(f.root,{recursive:true,force:true});}
});

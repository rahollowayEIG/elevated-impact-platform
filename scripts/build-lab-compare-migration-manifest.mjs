/**
 * Read-only comparison of a dated database migration metadata manifest against
 * repository SQL. No database connection, migration execution, or file mutation.
 * Run: node scripts/build-lab-compare-migration-manifest.mjs
 */
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const moduleDir=path.dirname(fileURLToPath(import.meta.url));
const defaultRoot=path.resolve(moduleDir,'..');
const versionRx=/^\d{14}$/;
const filenameRx=/^(\d{14})_[a-z0-9_]+\.sql$/;

export async function compareMigrationManifest({root=defaultRoot,manifestPath}={}) {
  const file=manifestPath||path.join(root,'docs/audits/build-lab-migration-recovery-manifest-20261102.json');
  const manifest=JSON.parse(await readFile(file,'utf8'));
  if(manifest.schemaVersion!==1||!Array.isArray(manifest.entries)||!Array.isArray(manifest.repositoryOnly)||
     manifest.liveSqlIncluded!==false||manifest.securityReviewComplete!==false)
    throw Error('Recovery manifest contract invalid');
  const versions=new Set();
  for (const row of manifest.entries) {
    if(!versionRx.test(row.version)||versions.has(row.version)||
      typeof row.sqlMd5!=='string'||!/^[a-f0-9]{32}$/i.test(row.sqlMd5)||
      !Number.isInteger(row.sqlCharacters)||row.sqlCharacters<0||
      !Number.isInteger(row.sqlStatementCount)||row.sqlStatementCount<1)
      throw Error('Invalid or duplicated migration metadata');
    versions.add(row.version);
  }
  const localFiles=(await readdir(path.join(root,'supabase/migrations')))
    .filter(name=>filenameRx.test(name)).sort();
  const localVersions=new Set(),localMap=new Map();
  for(const name of localFiles) {
    const version=filenameRx.exec(name)[1];
    if(localVersions.has(version))throw Error('Duplicate local migration version');
    localVersions.add(version);localMap.set(version,name);
  }
  const dbOnly=[],repoOnly=[],exactContentMatches=[],contentReviewRequired=[];
  for(const row of manifest.entries) {
    const filename=localMap.get(row.version);
    if(!filename) {dbOnly.push(row.version);continue;}
    const content=await readFile(path.join(root,'supabase/migrations',filename));
    const md5=createHash('md5').update(content).digest('hex');
    if(md5===row.sqlMd5)exactContentMatches.push(row.version);
    else contentReviewRequired.push({version:row.version,filename,repoBytes:content.length,
      dbSqlCharacters:row.sqlCharacters,reason:'Content differs or statement serialization differs; inspect before assuming equivalence'});
  }
  for(const name of localFiles)if(!versions.has(name.slice(0,14)))repoOnly.push(name);
  return {mode:'read-only',evidenceDate:manifest.checkedOn,
    databaseMigrationCount:manifest.entries.length,repositoryFileCount:localFiles.length,
    matchedVersions:exactContentMatches.length+contentReviewRequired.length,
    exactContentMatches,contentReviewRequired,dbOnly,repoOnly,
    reviewNeeded:dbOnly.length+repoOnly.length+contentReviewRequired.length>0,
    productionModified:false,historyModified:false,
    caveat:'A matching MD5 is evidence of byte equality only. No clean replay, functional parity or production-safe migration is certified.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  compareMigrationManifest().then(r=>process.stdout.write(JSON.stringify(r,null,2)+'\n'))
    .catch(e=>{console.error(e);process.exitCode=1;});
}

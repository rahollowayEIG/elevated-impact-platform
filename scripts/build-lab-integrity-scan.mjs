/**
 * Build Lab Platform Integrity & Cleanup Scanner, read-only foundation.
 * Inventory is evidence, not authority to remove production resources.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORED = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.vercel']);
const SOURCE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const ROUTE_EXT = new Set(['.jsx', '.tsx', '.js', '.ts']);

function normalized(p) { return p.split(path.sep).join('/'); }
function record(id, scope, category, reason, evidence, confidence='needs-review') {
  return { id, scope, category, reason, evidence, confidence, approvedForDeletion:false };
}

export async function scanPlatformIntegrity(root, options={}) {
  const base = path.resolve(root);
  const entries=[];
  async function visit(dir) {
    const list=await fs.readdir(dir, { withFileTypes:true });
    for (const item of list) {
      if (IGNORED.has(item.name) || item.name.startsWith('.env')) continue;
      const absolute=path.join(dir,item.name);
      const relative=normalized(path.relative(base,absolute));
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) await visit(absolute);
      else if (item.isFile()) entries.push(relative);
    }
  }
  await visit(base);
  entries.sort();
  const sourceFiles=entries.filter(p=>SOURCE_EXT.has(path.extname(p)));
  const migrationFiles=entries.filter(p=>/^supabase\/migrations\/.*\.sql$/i.test(p));
  const routes=sourceFiles.filter(p=>ROUTE_EXT.has(path.extname(p)) && (/(^|\/)(pages|routes)\//.test(p) || /(^|\/)(App|router)\.[jt]sx?$/.test(p)));
  const findings=[];
  const add=(...args)=>findings.push(record(...args));

  // A duplicate leaf name is NOT proof of unused code; review its location and imports.
  const byName=new Map();
  for (const file of sourceFiles) {
    const name=path.basename(file).toLowerCase();
    byName.set(name,[...(byName.get(name)||[]),file]);
  }
  for (const [name, paths] of byName) {
    if (paths.length>1) add('duplicate-name:'+name,'code','Repair',
      'Multiple source files share a basename; check imports and ownership before changing anything.',
      {paths},'candidate-only');
  }

  // Exact migration version comparison requires an externally approved inventory,
  // never a guess based on filename count.
  const localVersions=migrationFiles.map(p=>path.basename(p).match(/^(\d+)/)?.[1]).filter(Boolean);
  const liveVersions=Array.isArray(options.liveMigrationVersions)
    ? options.liveMigrationVersions.map(String) : null;
  if (liveVersions) {
    const live=new Set(liveVersions), local=new Set(localVersions);
    const missingLocally=[...live].filter(v=>!local.has(v)).sort();
    const absentLive=[...local].filter(v=>!live.has(v)).sort();
    if (missingLocally.length) add('migration:live-only','database','Repair',
      'Production migration versions have no matching version in the checked-out repository.',
      {versions:missingLocally, verifiedDatabaseSnapshot:false});
    if (absentLive.length) add('migration:repo-only','database','Repair',
      'Repository migration versions are absent from the supplied live migration inventory.',
      {versions:absentLive, verifiedDatabaseSnapshot:false});
  } else {
    add('migration:verification-required','database','Keep',
      'No live migration inventory supplied; database parity cannot be verified.',
      {localMigrationFiles:migrationFiles.length, liveComparison:'not-performed'});
  }

  add('deployment:verification-required','deployments','Keep',
    'Live deployments, aliases and branches cannot be classified from repository files alone.',
    {approvedVersionRegistryRequired:true, deploymentInspection:'not-performed'});
  add('dependency:verification-required','dependencies','Keep',
    'File counts and names alone cannot prove reachability or safe deletion.',
    {runtimeEvidenceRequired:true, retirementApproved:false});

  return {
    schemaVersion:1,
    scanner:'platform-integrity-cleanup',
    mode:'read-only',
    sourceRoot:base,
    generatedAt:new Date().toISOString(),
    inventory:{totalFiles:entries.length, sourceFiles:sourceFiles.length,
      routeCandidates:routes, migrationFiles},
    findings,
    safety:{deletionPerformed:false, databaseWritesPerformed:false,
      retirementRequiresOwnerApproval:true,
      categories:['Keep','Repair','Replace','Retirement Candidate']}
  };
}

async function main() {
  const root=path.resolve(process.argv[2]||process.cwd());
  const result=await scanPlatformIntegrity(root);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(e=>{console.error(e);process.exitCode=1;});
}

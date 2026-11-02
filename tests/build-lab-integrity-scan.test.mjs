import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanPlatformIntegrity } from '../scripts/build-lab-integrity-scan.mjs';

test('reports inventory and migration differences without changing files', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'eig-integrity-'));
  try {
    await fs.mkdir(path.join(root,'src','pages'),{recursive:true});
    await fs.mkdir(path.join(root,'src','routes'),{recursive:true});
    await fs.mkdir(path.join(root,'supabase','migrations'),{recursive:true});
    await fs.writeFile(path.join(root,'src','pages','Home.jsx'),'export const Home = 1;');
    await fs.writeFile(path.join(root,'src','routes','Home.jsx'),'export const Home = 2;');
    await fs.writeFile(path.join(root,'supabase','migrations','20261001_create.sql'),'select 1;');
    const before=await fs.readFile(path.join(root,'supabase','migrations','20261001_create.sql'),'utf8');
    const result=await scanPlatformIntegrity(root,{liveMigrationVersions:['20261001','20261002']});
    assert.equal(result.mode,'read-only');
    assert.equal(result.safety.deletionPerformed,false);
    assert.equal(result.safety.databaseWritesPerformed,false);
    assert.ok(result.findings.some(x=>x.id==='duplicate-name:home.jsx'));
    assert.ok(result.findings.some(x=>x.id==='migration:live-only'));
    assert.ok(result.findings.every(x=>x.approvedForDeletion===false));
    assert.equal(await fs.readFile(path.join(root,'supabase','migrations','20261001_create.sql'),'utf8'),before);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('does not assert database parity without live inventory',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'eig-integrity-'));
  try {
    const result=await scanPlatformIntegrity(root);
    assert.ok(result.findings.some(x=>x.id==='migration:verification-required'));
    assert.ok(result.findings.some(x=>x.id==='deployment:verification-required'));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

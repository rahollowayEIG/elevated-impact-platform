#!/usr/bin/env node
/** Offline preview only: deliberately no network, database or file writes. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { previewPracticePack, validatePracticeCatalog } from '../../src/sandbox/practicePacks.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../sandbox/practice-packs');
function load(file) { return JSON.parse(readFileSync(join(root,file),'utf8')); }
const catalog=load('catalog.json');
const packs=Object.fromEntries(catalog.packs.map(p=>[p.id,load(p.file)]));
const check=validatePracticeCatalog(catalog,packs);
if(!check.ok) throw new Error('Invalid practice packs:\n'+check.errors.join('\n'));
const requested=process.argv[2];
if(requested && !Object.hasOwn(packs,requested)) throw new Error('Unknown pack; omit ID to list all packs.');
console.log('ElevationPilot Practice Packs: READ-ONLY PREVIEW');
console.log('Default workspace EMPTY. No imports, outbound messages, charges or publishing.');
for(const entry of catalog.packs){
  if(requested && requested!==entry.id) continue;
  const p=previewPracticePack(packs[entry.id]);
  console.log('- '+p.title+' ['+p.packId+']: '+p.recordCount+' fictional records ('+p.kinds.join(', ')+')');
}
console.log('A secure sandbox-only import adapter and per-tester reset are still required.');

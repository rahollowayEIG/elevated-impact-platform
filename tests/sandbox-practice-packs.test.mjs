import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRACTICE_SANDBOX_REF, validatePracticePack,
  validatePracticeCatalog, previewPracticePack
} from '../src/sandbox/practicePacks.mjs';

const root=new URL('../sandbox/practice-packs/',import.meta.url);
const load=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
const catalog=load('catalog.json');
const packs=Object.fromEntries(catalog.packs.map(p=>[p.id,load(p.file)]));
const clone=x=>JSON.parse(JSON.stringify(x));

test('six tiny opt-in packs and no automatic import',()=>{
  assert.equal(PRACTICE_SANDBOX_REF,'publruuuyvpggogrrgwp');
  assert.equal(catalog.defaultWorkspace,'empty');
  assert.equal(catalog.packs.length,6);
  assert.deepEqual(validatePracticeCatalog(catalog,packs).errors,[]);
  for(const entry of catalog.packs){
    const pack=packs[entry.id];
    assert.equal(pack.autoImport,false);
    assert.equal(pack.requiresExplicitSelection,true);
    assert.equal(pack.sandboxOnly,true);
    assert.ok(pack.records.length<=5);
    const preview=previewPracticePack(pack);
    assert.equal(preview.mode,'PREVIEW_ONLY');
    assert.equal(preview.willImport,false);
    assert.equal(preview.willCharge,false);
    assert.equal(preview.willPublish,false);
    assert.equal(preview.willSendMessages,false);
  }
});

test('starter fixtures have one foursome and tiny examples',()=>{
  assert.equal(packs['event-builder-starter'].records.length,1);
  const team=packs['golf-foursome-starter'].records;
  assert.equal(team.filter(x=>x.kind==='golf_player').length,4);
  assert.equal(team.filter(x=>x.kind==='golf_player'&&x.data.custom_fields.is_captain).length,1);
  assert.ok(team.filter(x=>x.kind==='golf_player').every(x=>x.data.payment_status==='unpaid'));
  assert.equal(packs['advertising-starter'].records.length,2);
  assert.equal(packs['sponsors-starter'].records.filter(x=>x.kind==='sponsor').length,1);
  assert.equal(packs['coupon-starter'].records.length,1);
  assert.equal(packs['vendor-starter'].records.length,2);
});

test('rejects oversized and automatic imports',()=>{
  const original=packs['golf-foursome-starter'];
  const large=clone(original);large.records.push({key:'extra',kind:'golf_player',data:{first_name:'Extra'}});
  assert.equal(validatePracticePack(large).ok,false);
  const auto=clone(original);auto.autoImport=true;
  assert.equal(validatePracticePack(auto).ok,false);
  const live=clone(original);live.sandboxOnly=false;
  assert.equal(validatePracticePack(live).ok,false);
});

test('rejects real emails, public links, payments and publishing',()=>{
  const pack=clone(packs['golf-foursome-starter']);
  pack.records[1].data.email='someone@gmail.com';
  assert.equal(validatePracticePack(pack).ok,false);
  pack.records[1].data.email='avery@practice.example';
  pack.records[0].data.url='https://example.com';
  assert.equal(validatePracticePack(pack).ok,false);
  delete pack.records[0].data.url;
  pack.records[1].data.payment_status='paid';
  assert.equal(validatePracticePack(pack).ok,false);
  const ad=clone(packs['advertising-starter']);
  ad.records[1].data.publication_enabled=true;
  assert.equal(validatePracticePack(ad).ok,false);
});

test('refuses foreign references and credentials',()=>{
  const pack=clone(packs['sponsors-starter']);
  pack.records[2].data.event_ref='another-tenant-event';
  assert.equal(validatePracticePack(pack).ok,false);
  pack.records[2].data.event_ref='sponsor-event';
  pack.records[2].data.stripe_payment_intent_id='pi_test';
  assert.equal(validatePracticePack(pack).ok,false);
  delete pack.records[2].data.stripe_payment_intent_id;
  assert.equal(validatePracticePack(pack).ok,true);
});

test('catalog refuses traversal and hidden/unlisted packs',()=>{
  const unsafe=clone(catalog);
  unsafe.packs[0].file='../something.json';
  assert.equal(validatePracticeCatalog(unsafe,packs).ok,false);
  const extra={...packs,unlisted:clone(packs['event-builder-starter'])};
  assert.equal(validatePracticeCatalog(catalog,extra).ok,false);
});

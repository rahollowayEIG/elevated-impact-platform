import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRosterEntryNumbers, golfGeniusRosterRows, isReservedTba } from '../src/rosterNumbering.mjs';

const player = (id, team_id, payment_status = 'paid', extra = {}) => ({
  id, team_id, payment_status, created_at: '2026-10-04T12:00:00Z', registration_status: 'active',
  first_name: 'Golfer', last_name: id, ...extra,
});

const players = [
  ...['a','b','c','d'].map(id => player('t1'+id, '1', 'pending')),
  ...['a','b','c','d'].map(id => player('t2'+id, '2')),
  ...['a','b','c','d'].map(id => player('t19'+id, '19')),
  ...['a','b','c','d'].map(id => player('t20'+id, '20')),
  ...['a','b','c','d'].map(id => player('t31'+id, '31', 'comp')),
];

test('team IDs stay fixed; numbers are 1-4, 5-8, 73-76, 77-80, and 121-124', () => {
  const ids = buildRosterEntryNumbers(players, 4, true);
  for (const [team, start] of [['1',1],['2',5],['19',73],['20',77],['31',121]]) {
    assert.deepEqual(['a','b','c','d'].map(suffix => ids.get('t'+team+suffix)),
      [start,start+1,start+2,start+3]);
  }
  assert.equal(new Set([...ids.values()]).size, players.length);
});

test('confirmed-only exports preserve original Team IDs and entry positions with gaps', () => {
  const onlyConfirmed = golfGeniusRosterRows(players, { teamSize:4,teamMode:true,scope:'confirmed' });
  assert.equal(onlyConfirmed.length, 16);
  assert.equal(onlyConfirmed[0].__export_team_id, '2');
  assert.equal(onlyConfirmed[0].__export_entry_number, 5);
  assert.deepEqual(onlyConfirmed.slice(-4).map(x => x.__export_entry_number), [121,122,123,124]);
  const all = golfGeniusRosterRows(players, { teamSize:4,teamMode:true,scope:'all' });
  assert.equal(all.length,20);
  assert.deepEqual(all.slice(0,4).map(x=>x.__export_entry_number), [1,2,3,4]);
});

test('named and pending TBA spots export as TBA/TBA without changing source records', () => {
  const reserved = player('tba', '1', 'pending', {
    first_name:'TBA',last_name:'Reserved',custom_fields:{ reserved_tba:true },
  });
  const modified = [...players.filter(p=>p.id!=='t1d'),reserved];
  const exported = golfGeniusRosterRows(modified, { teamSize:4,teamMode:true,scope:'all' });
  const slot=exported.find(x=>x.id==='tba');
  assert.equal(isReservedTba(reserved),true);
  assert.equal(slot.__export_first_name,'TBA');
  assert.equal(slot.__export_last_name,'TBA');
  assert.equal(reserved.last_name,'Reserved');
  assert.equal(slot.__export_team_id,'1');
  assert.equal(slot.__export_entry_number,4);
});

test('moving a golfer updates the derived number without changing IDs or payments', () => {
  const changed=players.map(p => p.id==='t19d' ? {...p,team_id:'20'} : p.id==='t20d' ? {...p,team_id:'19'} : p);
  const ids=buildRosterEntryNumbers(changed,4,true);
  assert.ok(ids.get('t19d') >= 77 && ids.get('t19d') <= 80);
  assert.ok(ids.get('t20d') >= 73 && ids.get('t20d') <= 76);
  assert.equal(new Set([...ids.values()]).size, players.length);
  assert.equal(changed.find(p=>p.id==='t19d').payment_status,'paid');
  assert.equal(changed.find(p=>p.id==='t20d').payment_status,'paid');
});

test('individual rosters also get sequential numbers without a team', () => {
  const solo = [player('x','', 'pending'), player('y', '', 'paid')];
  const ids = buildRosterEntryNumbers(solo, 1, false);
  assert.equal(ids.get('x'),1);
  assert.equal(ids.get('y'),2);
  const all=golfGeniusRosterRows(solo,{teamMode:false, scope:'all'});
  assert.deepEqual(all.map(p=>p.__export_entry_number),[1,2]);
  assert.deepEqual(all.map(p=>p.__export_team_id),['','']);
});

test('invalid team IDs or overfull rosters cannot silently invent conflicting entry numbers', () => {
  assert.throws(()=>golfGeniusRosterRows([player('x','unknown')],{teamMode:true,scope:'all'}),/numeric Team ID/);
  assert.throws(()=>golfGeniusRosterRows([...players,player('extra','1')],{teamMode:true,teamSize:4,scope:'all'}),/more players/);
});

test('Golf Genius export has no required handicap or GHIN column', async () => {
  const source = await readFile(new URL('../src/EieRosterMaintenance.jsx',import.meta.url),'utf8');
  assert.ok(source.includes('golfGeniusRosterRows('));
  const start=source.indexOf('function exportGolfGenius(');
  const end=source.indexOf('function updateManual(',start);
  assert.ok(start>0 && end>start);
  const snippet=source.slice(start,end);
  assert.doesNotMatch(snippet,/'GHIN ID'|'Handicap'/);
});

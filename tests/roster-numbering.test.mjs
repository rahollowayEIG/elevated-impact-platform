import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRosterEntryNumbers, golfGeniusRosterRows, golfGeniusCsvFields, FALL_8IN_CUP_EVENT_ID, isReservedTba } from '../src/rosterNumbering.mjs';

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

test('all roster screens share the numbering helper; Sheets keep Team Id separate from Entry Number', async () => {
  const [staff, team, airport, sheet, admin] = await Promise.all([
    'src/EieRosterMaintenance.jsx',
    'src/EieTeamManagement.jsx',
    'src/ElevationAirport.jsx',
    'supabase/functions/sync-google-roster/index.ts',
    'supabase/functions/golf-admin-team-management/index.ts',
  ].map(path => readFile(new URL('../'+path, import.meta.url), 'utf8')));
  assert.match(staff,/buildRosterEntryNumbers\(rows, teamSize, teamMode\)/);
  assert.match(team,/buildRosterEntryNumbers\(registrations,/);
  assert.match(airport,/buildRosterEntryNumbers\(teamGroup\?\.members/);
  assert.match(sheet,/entryNumbers\.get\(String\(golfer\.id\)\) \?\? golfer\.entry_number/);
  assert.match(sheet,/golfer\.team_id \?\? ""/);
  assert.match(admin,/payment_for_team_id,created_at/);
  assert.match(admin,/swap_paid_teams/);
});

test('Fall 8in Cup exports exactly Team ID, First Name, Last Name; Golf Genius owns entry numbering', () => {
  const tba = player('tba','1','pending', { first_name:'TBA',last_name:'Reserved',custom_fields:{reserved_tba:true}});
  const complete = [...players.filter(p=>p.id!=='t1d'), tba];
  const full = golfGeniusRosterRows(complete, {teamMode:true,teamSize:4,scope:'all'});
  const csv = golfGeniusCsvFields(full, FALL_8IN_CUP_EVENT_ID, {
    teams: [{ team_id: '1', captain_registration_id: 't1a' }], registrations: complete,
  });
  assert.deepEqual(csv.headers, ['Team Id','First Name','Last Name']);
  assert.equal(csv.records.length, full.length);
  assert.equal(csv.records.every(record => record.length === 3), true);
  assert.deepEqual(csv.records.find(record => record[2].endsWith(' 1')), ['1','Golfer','t1a 1']);
  assert.equal(csv.records[0][0], '1');
  assert.equal(csv.records.at(-1)[0], '31');
  assert.equal(csv.headers.includes('Entry Number'),false);
  assert.equal(csv.headers.includes('GHIN ID'),false);
  assert.equal(csv.headers.includes('Payment Status'),false);
});

test('Fall 8in Cup confirmed export also has exactly three columns; other events retain their format', () => {
  const confirmed = golfGeniusRosterRows(players, { teamMode:true, teamSize:4, scope:'confirmed' });
  const selected = golfGeniusCsvFields(confirmed,FALL_8IN_CUP_EVENT_ID);
  assert.deepEqual(selected.headers, ['Team Id','First Name','Last Name']);
  assert.equal(selected.records.length,16);
  assert.deepEqual(selected.records[0].slice(0,1),['2']);
  const unrelated=golfGeniusCsvFields(confirmed,'unrelated-event');
  assert.deepEqual(unrelated.headers,['Team Id','Entry Number','First Name','Last Name','Email','Phone','Payment Status','Registration ID']);
  assert.equal(unrelated.records[0].length,8);
  assert.equal(unrelated.records[0][1],5);
});


test('three TBA placeholders use current captain name with 1/2/3 suffix in last name', () => {
  const captain = player('captain','10','paid',{first_name:'Ryan',last_name:'Holloway',price:480});
  const tbas = [1,2,3].map(n => player('tba'+n,'10','paid',{
    first_name:'TBA',last_name:'Reserved',custom_fields:{reserved_tba:true},
  }));
  const source = [captain,...tbas];
  const snapshot=JSON.stringify(source);
  const exported=golfGeniusRosterRows(source,{teamSize:4,teamMode:true,scope:'all'});
  const csv=golfGeniusCsvFields(exported,FALL_8IN_CUP_EVENT_ID,{
    teams:[{team_id:'10',captain_registration_id:'captain'}],registrations:source,
  });
  assert.deepEqual(csv.headers,['Team Id','First Name','Last Name']);
  assert.deepEqual(csv.records,[
    ['10','Ryan','Holloway'],
    ['10','Ryan','Holloway 1'],
    ['10','Ryan','Holloway 2'],
    ['10','Ryan','Holloway 3'],
  ]);
  assert.equal(JSON.stringify(source),snapshot,'Original placeholder records must not change');
});

test('suffix restarts for each team, even when captain names match', () => {
  const source=[
    player('c1','1','paid',{first_name:'Alex',last_name:'Smith'}),
    player('x1','1','paid',{first_name:'TBA',last_name:'Reserved',custom_fields:{reserved_tba:true}}),
    player('c2','2','paid',{first_name:'Alex',last_name:'Smith'}),
    player('x2','2','paid',{first_name:'TBA',last_name:'Reserved',custom_fields:{reserved_tba:true}}),
  ];
  const exported=golfGeniusRosterRows(source,{scope:'all'});
  const csv=golfGeniusCsvFields(exported,FALL_8IN_CUP_EVENT_ID,{
    teams:[{team_id:'1',captain_registration_id:'c1'}, {team_id:'2',captain_registration_id:'c2'}],
    registrations:source,
  });
  assert.deepEqual(csv.records,[
    ['1','Alex','Smith'],['1','Alex','Smith 1'],
    ['2','Alex','Smith'],['2','Alex','Smith 1'],
  ]);
});

test('a transferred captain is used, not the original $480 payment purchaser', () => {
  const oldPayer=player('original-payer','20','paid',{
    first_name:'Megan',last_name:'Fidler',price:480,amount_paid:480,
  });
  const currentCaptain=player('new-captain','20','paid',{
    first_name:'Don',last_name:'Taatjes',price:0,
  });
  const other=player('named','20','paid',{first_name:'Sam',last_name:'Schoener'});
  const tba=player('tba','20','paid',{
    first_name:'TBA',last_name:'Reserved',custom_fields:{reserved_tba:true},
  });
  const source=[oldPayer,currentCaptain,other,tba];
  const exported=golfGeniusRosterRows(source,{scope:'confirmed'});
  const csv=golfGeniusCsvFields(exported,FALL_8IN_CUP_EVENT_ID,{
    teams:[{team_id:'20',captain_registration_id:'new-captain'}],
    registrations:source,
  });
  assert.deepEqual(csv.records.find(row=>row[1]==='Don'&&row[2].endsWith(' 1')),
    ['20','Don','Taatjes 1']);
  assert.equal(csv.records.some(row=>row[2]==='Fidler 1'),false);
  assert.equal(oldPayer.amount_paid,480,'An export must never modify payment receipts');
});

test('do not silently use the payer or TBA/TBA when captain data is absent or stale', () => {
  const source=[
    player('pay','10','paid',{first_name:'Purchaser',last_name:'Name'}),
    player('tba','10','paid',{first_name:'TBA',last_name:'Reserved',custom_fields:{reserved_tba:true}}),
  ];
  const exported=golfGeniusRosterRows(source,{scope:'all'});
  assert.throws(()=>golfGeniusCsvFields(exported,FALL_8IN_CUP_EVENT_ID),
    /Team #10 needs a named current captain/);
  assert.throws(()=>golfGeniusCsvFields(exported,FALL_8IN_CUP_EVENT_ID,{
    teams:[{team_id:'10',captain_registration_id:'not-on-team'}],registrations:source,
  }),/Team #10 needs a named current captain/);
  const legacy=golfGeniusCsvFields(exported,'different-event-id');
  assert.deepEqual(legacy.records[1].slice(2,4),['TBA','TBA']);
});

test('full and confirmed Fall 8in Cup exports label only included TBA golfers', () => {
  const captain=player('captain','3','paid',{first_name:'Jamie',last_name:'Cole'});
  const paidTba=player('paidtba','3','paid',{first_name:'TBA',last_name:'Reserved',custom_fields:{reserved_tba:true}});
  const pendingTba=player('pendingtba','3','pending',{first_name:'TBA',last_name:'Reserved',custom_fields:{reserved_tba:true}});
  const named=player('named','3','paid',{first_name:'Teammate',last_name:'Person'});
  const source=[captain,paidTba,pendingTba,named];
  const context={teams:[{team_id:'3',captain_registration_id:'captain'}],registrations:source};
  const full=golfGeniusCsvFields(golfGeniusRosterRows(source,{scope:'all'}),FALL_8IN_CUP_EVENT_ID,context);
  const confirmed=golfGeniusCsvFields(golfGeniusRosterRows(source,{scope:'confirmed'}),FALL_8IN_CUP_EVENT_ID,context);
  assert.deepEqual(full.records.filter(r=>r[1]==='Jamie'&&r[2].startsWith('Cole ')).map(r=>r[2]),['Cole 1','Cole 2']);
  assert.deepEqual(confirmed.records.filter(r=>r[1]==='Jamie'&&r[2].startsWith('Cole ')).map(r=>r[2]),['Cole 1']);
  assert.deepEqual(full.records.find(r=>r[1]==='Teammate'),['3','Teammate','Person']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FALL_8IN_CUP_TEE_SHEET, buildPrintableCheckInRoster } from '../src/lib/checkInRoster.mjs';
import { checkInPrintHtml } from '../src/lib/checkInPrint.mjs';
import { FALL_8IN_CUP_EVENT_ID } from '../src/rosterNumbering.mjs';

const event = { id:FALL_8IN_CUP_EVENT_ID, name:'2026 Fall 8" Cup', field_settings:{team_size:4,registration_format:'team'} };
const paid = new Set([2,3,4,7,8,10,11,12,13,14,16,17,18,19,20,23,28,29]);
const status = (teamId) => teamId===31?'comp':paid.has(teamId)?'paid':'pending';
const registrations=[];
const teams=[];

for(let n=1;n<=31;n++){
  const members=[];
  for(let i=1;i<=4;i++){
    const id='team-'+n+'-slot-'+i;
    let name = { first_name:'Golfer'+i,last_name:'Team'+n };
    if(n===15&&i<=3)name={first_name:'TBA',last_name:'Reserved'};
    if(n===20){
      name=[{first_name:'Ben',last_name:'Perry'},{first_name:'Sam',last_name:'Schoener'},{first_name:'Jim',last_name:'Debiec'},{first_name:'Don',last_name:'Taatjes'}][i-1];
    }
    if(n===19){
      name=[{first_name:'Mandi',last_name:'Yoh'},{first_name:'Jocelyn',last_name:'Perry'},{first_name:'Amy',last_name:'Wagner'},{first_name:'Megan',last_name:'Fidler'}][i-1];
    }
    if(n===15&&i===4)name={first_name:'Dwayne',last_name:'Fassnacht'};
    members.push({
      id,event_id:event.id,team_id:String(n),registration_status:'active',
      created_at:'2026-10-09T12:00:0'+i+'Z',
      ...name,custom_fields: name.first_name==='TBA'?{reserved_tba:true}:{},
      payment_status:status(n),
    });
  }
  registrations.push(...members);
  const captain = n===20?members[3]:n===19?members[2]:members[3];
  teams.push({team_id:String(n),entry_number:String(n),event_id:event.id,team_size:4,captain_registration_id:captain.id});
}

test('supplied Golf Genius holes match 31 unique teams and include moved foursomes',()=>{
  assert.equal(FALL_8IN_CUP_TEE_SHEET.length,31);
  assert.equal(new Set(FALL_8IN_CUP_TEE_SHEET.map(x=>x.team_id)).size,31);
  assert.equal(new Set(FALL_8IN_CUP_TEE_SHEET.map(x=>x.hole)).size,31);
  const mapped=new Map(FALL_8IN_CUP_TEE_SHEET.map(x=>[x.team_id,x.hole]));
  assert.equal(mapped.get('15'),'1A');
  assert.equal(mapped.get('31'),'1B');
  assert.equal(mapped.get('19'),'11A');
  assert.equal(mapped.get('20'),'11B');
  assert.equal(mapped.get('1'),'18B');
});

test('entire active foursome roster prints in starting-hole order with per-golfer payment status',()=>{
  const source=JSON.stringify(registrations);
  const data=buildPrintableCheckInRoster({event,registrations,teams});
  assert.equal(data.summary.teams,31);
  assert.equal(data.summary.golfers,124);
  assert.equal(data.summary.paid,72);
  assert.equal(data.summary.comp,4);
  assert.equal(data.summary.pending,48);
  assert.equal(data.summary.assigned_holes,31);
  assert.deepEqual(data.warnings,[]);
  assert.equal(data.rows[0].hole,'1A');
  assert.equal(data.rows[0].team_id,'15');
  assert.deepEqual(data.rows[0].players.map(p=>p.name),[
    'Dwayne Fassnacht 1','Dwayne Fassnacht 2','Dwayne Fassnacht 3','Dwayne Fassnacht',
  ]);
  assert.deepEqual(data.rows[0].players.map(p=>p.payment_status),Array(4).fill('pending'));
  assert.equal(data.rows[1].team_id,'31');
  assert.deepEqual(data.rows[1].players.map(p=>p.payment_status),Array(4).fill('comp'));
  assert.equal(data.rows.find(r=>r.hole==='11A').team_id,'19');
  assert.deepEqual(data.rows.find(r=>r.hole==='11B').players.map(p=>p.name),[
    'Ben Perry','Sam Schoener','Jim Debiec','Don Taatjes',
  ]);
  assert.equal(JSON.stringify(registrations),source,'Read-only projection must not change payments or names');
});

test('each player has a printable check box, payment label and escaped name',()=>{
  const data=buildPrintableCheckInRoster({event,registrations,teams});
  const html=checkInPrintHtml(data,new Date('2026-10-10T12:30:00Z'));
  assert.match(html,/<table>/);
  assert.match(html,/11A/);
  assert.match(html,/11B/);
  assert.match(html,/Dwayne Fassnacht 1/);
  assert.match(html,/PENDING \/ UNPAID/);
  assert.match(html,/PAID/);
  assert.match(html,/COMP/);
  assert.equal((html.match(/class="tick"/g)||[]).length,124);
  assert.equal((html.match(/<td class="hole">/g)||[]).length,31);
  assert.match(html,/window.print\(\)/);
  const malicious=buildPrintableCheckInRoster({event,teams,registrations:registrations.map((r,i)=>
    i===0?{...r,first_name:'<script>alert(1)</script>',custom_fields:{}}:r
  )});
  const sanitized=checkInPrintHtml(malicious);
  assert.doesNotMatch(sanitized,/<strong><script>/);
  assert.match(sanitized,/&lt;script&gt;/);
});

test('unknown starting hole never inherits another event tee time and missing players are warned',()=>{
  const generic={...event,id:'unrelated-event',name:'Another Golf Outing'};
  const subset=registrations.filter(r=>r.team_id==='20').map(r=>({...r,event_id:generic.id}));
  const roster=buildPrintableCheckInRoster({event:generic,registrations:subset,teams:teams
    .filter(t=>t.team_id==='20').map(t=>({...t,event_id:generic.id}))});
  assert.equal(roster.rows[0].hole,'');
  assert.equal(roster.rows[0].tee_time,'');
  assert.equal(roster.summary.golfers,4);
  const short=buildPrintableCheckInRoster({event,registrations:registrations.slice(1),teams});
  assert.ok(short.warnings.some(x=>x.includes('Team #1')||x.includes('Team #15')));
  const overfull=buildPrintableCheckInRoster.bind(null,{event,teams,registrations:[
    ...registrations,{...registrations[0],id:'unexpected-fifth'}]});
  assert.throws(overfull,/has 5 active golfers/);
});

test('roster maintenance exposes the print action without calling a write endpoint',async()=>{
  const source=await readFile(new URL('../src/EieRosterMaintenance.jsx',import.meta.url),'utf8');
  const start=source.indexOf('async function openPrintCheckInSheet()');
  const end=source.indexOf('async function exportGolfGenius(',start);
  assert.ok(start>=0&&end>start);
  const scope=source.slice(start,end);
  assert.match(scope,/golf-admin-team-management/);
  assert.match(scope,/action: 'list'/);
  assert.match(scope,/checkInPrintHtml/);
  assert.doesNotMatch(scope,/\.update\(|\.insert\(|\.delete\(/);
  assert.match(source,/Print Check-In List/);
});

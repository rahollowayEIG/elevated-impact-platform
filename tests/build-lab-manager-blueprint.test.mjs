import test from 'node:test';
import assert from 'node:assert/strict';
import {stackScanBlueprint,reviewManagerProposal,assignManagerProposal,approveManagerBlueprint,restoreManagerBlueprint,managerStorageKey} from '../src/lib/buildLabMissionOrchestrator.mjs';
const item=(id,title='Repair broken invoice preview',nextAction='Reproduce the issue and repair the preview')=>({id,title,nextAction,evidenceFiles:['src/components/Invoice.jsx']});
const scan=(id,recommendations=[item('one')],source='a'.repeat(40))=>({id,type:'ai',scope:'invoices',source,savedAt:'2026-10-21T20:00:00Z',snapshot:{review:{recommendations}}});
function acceptAll(plan){return plan.proposals.reduce((next,p)=>reviewManagerProposal(next,p.id,'accept'),plan);}
test('stack merges exact repeated recommendations, preserves all provenance and starts pending',()=>{
 const plan=stackScanBlueprint([scan('run1'),scan('run2')]);
 assert.equal(plan.inputs.length,2);assert.equal(plan.proposals.length,1);assert.equal(plan.merged,1);
 assert.equal(plan.proposals[0].sourceRefs.length,2);assert.equal(plan.proposals[0].decision,'pending');assert.equal(plan.proposals[0].assignedTo,'fixer');assert.equal(plan.execution,'not_connected');
 assert.equal(plan.tasks.length,0);assert.throws(()=>approveManagerBlueprint(plan),/Review each/);
});
test('mixed versions and conflicting wording remain visible instead of being silently chosen',()=>{
 const plan=stackScanBlueprint([scan('run1'),scan('run2',[item('two','Repair broken invoice preview','Replace the preview implementation')],'b'.repeat(40))]);
 assert.equal(plan.proposals.length,2);assert.equal(plan.warnings.length,2);
 assert.throws(()=>approveManagerBlueprint(acceptAll(plan)),/Acknowledge/);
 const approved=approveManagerBlueprint(acceptAll(plan),{acknowledgeWarnings:true});
 assert.equal(approved.tasks.length,6);assert.deepEqual(approved.tasks[3].dependsOn,['proposal-1-inspect']);
});
test('specialists are assigned from proposed work and owner reassignment invalidates approval',()=>{
 let plan=stackScanBlueprint([scan('one',[item('ui','Improve responsive navigation'),item('exp','Prototype a new approach'),item('research','Compare providers'),item('build','Add invoice exports','Implement an invoice export feature')])]);
 assert.deepEqual(plan.proposals.map(p=>p.assignedTo),['designer','scientist','researcher','builder']);
 plan=approveManagerBlueprint(acceptAll(plan));
 const edited=assignManagerProposal(plan,'proposal-4','fixer');assert.equal(edited.revision,plan.revision+1);assert.equal(edited.approval,null);assert.deepEqual(edited.tasks,[]);assert.equal(edited.status,'owner_review_required');
 assert.throws(()=>assignManagerProposal(plan,'proposal-4','unknown'));
});
test('only accepted/revised items get tasks and edits clear a prior handoff approval',()=>{
 let plan=stackScanBlueprint([scan('one',[item('a','First change'),item('b','Second change'),item('c','Third change')])]);
 plan=reviewManagerProposal(plan,'proposal-1','revise','Use a scoped fix and regression check.');
 plan=reviewManagerProposal(plan,'proposal-2','hold');plan=reviewManagerProposal(plan,'proposal-3','reject');
 const approved=approveManagerBlueprint(plan);assert.equal(approved.tasks.length,3);assert.equal(approved.tasks[1].instruction,'Use a scoped fix and regression check.');
 assert.equal(approved.tasks[0].agent,'inspector');assert.equal(approved.tasks[2].agent,'inspector');
 assert.ok(approved.tasks.every(t=>t.status==='planned'));assert.equal(approved.execution,'not_connected');
 assert.equal(reviewManagerProposal(approved,'proposal-1','hold').approval,null);
 assert.throws(()=>approveManagerBlueprint(reviewManagerProposal(plan,'proposal-1','reject')),/at least one/);
});
test('independent files can proceed independently while unknown/shared files are sequenced',()=>{
 const first=item('a','One change'),second={...item('b','Another change'),evidenceFiles:['src/Other.jsx']};
 const approved=approveManagerBlueprint(acceptAll(stackScanBlueprint([scan('one',[first,second])])));
 assert.deepEqual(approved.tasks[3].dependsOn,[]);
 const unknown={...second,evidenceFiles:[]};const serial=approveManagerBlueprint(acceptAll(stackScanBlueprint([scan('one',[first,unknown])])));
 assert.deepEqual(serial.tasks[3].dependsOn,['proposal-1-inspect']);
 const visited=new Set();for(const task of serial.tasks){assert.ok(task.dependsOn.every(id=>visited.has(id)));visited.add(task.id);}
});
test('original source rejection/parking is honored and revised source wording is retained',()=>{
 const entry={id:'radar',type:'radar',scope:'invoices',source:'a',savedAt:'2026-10-21T20:00:00Z',snapshot:{audit:{suggestions:[{id:'x',title:'Original suggestion',proposal:'Original detail'},{id:'y',title:'Rejected',proposal:'No'},{id:'z',title:'Parked',proposal:'Later'}]},choices:{x:{review:'revise',note:'Owner revised requirement'},y:{review:'reject'},z:{review:'park'}}}};
 const plan=stackScanBlueprint([entry]);assert.equal(plan.proposals.length,1);assert.equal(plan.proposals[0].detail,'Owner revised requirement');assert.equal(plan.omitted,2);
});
test('restoration preserves decisions and regenerates planned assignments without granting execution',()=>{
 const plan=approveManagerBlueprint(acceptAll(stackScanBlueprint([scan('one')])));
 plan.tasks[0].status='complete';plan.tasks[0].dependsOn=['invented'];
 const restored=restoreManagerBlueprint(JSON.stringify(plan));assert.equal(restored.tasks[0].status,'planned');assert.deepEqual(restored.tasks[0].dependsOn,[]);
 assert.equal(restored.execution,'not_connected');assert.equal(restored.safety.autoDeployed,false);
 const invalid={...plan,revision:plan.revision+1};assert.throws(()=>restoreManagerBlueprint(JSON.stringify(invalid)),/approval/);
 assert.throws(()=>restoreManagerBlueprint(JSON.stringify({...plan,execution:'running'})));
 const invalidProposal=structuredClone(plan);invalidProposal.proposals[0].assignedTo='root';assert.throws(()=>restoreManagerBlueprint(JSON.stringify(invalidProposal)));
 assert.notEqual(managerStorageKey('11111111-1111-4111-8111-111111111111'),managerStorageKey('22222222-2222-4222-8222-222222222222'));
 assert.equal(managerStorageKey('invalid'),null);
});
test('bounded inputs fail visibly rather than silently dropping selected recommendations',()=>{
 assert.throws(()=>stackScanBlueprint([]));assert.throws(()=>stackScanBlueprint(Array.from({length:11},(_,i)=>scan(String(i)))));
 assert.throws(()=>stackScanBlueprint([scan('same'),scan('same')]));
 assert.throws(()=>stackScanBlueprint([scan('many',Array.from({length:101},(_,i)=>item(String(i),'Item '+i)))]),/100/);
 assert.throws(()=>stackScanBlueprint([scan('one')],{now:'invalid'}));
 assert.throws(()=>reviewManagerProposal(stackScanBlueprint([scan('one')]),'proposal-1','revise',''));
});

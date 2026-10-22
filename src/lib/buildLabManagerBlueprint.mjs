/** Local review adapter for the existing Build Lab orchestrator. No agent execution. */
import {SCAN_TYPES,historyKey} from './buildLabScanHistory.mjs';
export const MANAGER_AGENTS={builder:'Bob the Builder',fixer:'Mr. Fixit',designer:'The Designer',scientist:'The Scientist',researcher:'The Researcher',inspector:'The Inspector'};
const DECISIONS=new Set(['pending','accept','revise','hold','reject']);
const clone=value=>JSON.parse(JSON.stringify(value));
const text=(value,max=3000)=>typeof value==='string'?value.trim().slice(0,max):'';
const normalized=value=>text(value).toLowerCase().replace(/\s+/g,' ');
const runnable=p=>['accept','revise'].includes(p.decision);
export function managerStorageKey(uid){return historyKey(uid)?.replace('scan-history','manager-blueprint')||null;}
function suggestedAgent(title,detail){
 const value=title+' '+detail;
 if(/experiment|hypothesis|prototype|proof.of.concept/i.test(value))return 'scientist';
 if(/competitor|external research|compare providers/i.test(value))return 'researcher';
 if(/layout|navigation|visual|accessib|responsive|user experience/i.test(value))return 'designer';
 if(/repair|regression|crash|broken|bug\b|fix\b/i.test(value))return 'fixer';
 return 'builder';
}
function itemsFor(entry){
 const s=entry.snapshot,r=s.review||s.report||s.audit||s;
 const items=r.recommendations||r.findings||r.suggestions||r.modules;
 if(!Array.isArray(items))return [];
 return items.filter(x=>x&&typeof x==='object').map(item=>{
  const review=s.reviews?.[item.id]||s.choices?.[item.id];
  return {item,decision:typeof review==='string'?review:review?.review,revisedDetail:['edit','revise'].includes(review?.review)?review.editedDetail||review.note:''};
 });
}
export function stackScanBlueprint(entries,{title='Build Lab improvement blueprint',now=new Date().toISOString()}={}){
 if(!Array.isArray(entries)||!entries.length||entries.length>10)throw Error('Select between 1 and 10 completed scans.');
 if(!text(title,120)||!Number.isFinite(Date.parse(now)))throw Error('A blueprint title and valid date are required.');
 const proposals=[],seen=new Map(),inputs=[];let omitted=0,preserved=0,total=0;
 for(const entry of entries){
  if(!Object.hasOwn(SCAN_TYPES,entry?.type)||!text(entry.id,200)||!entry.snapshot||typeof entry.snapshot!=='object'||!text(entry.source,150)||!Number.isFinite(Date.parse(entry.savedAt)))throw Error('A selected scan is invalid.');
  const scanKey=entry.type+':'+entry.id;
  if(inputs.some(x=>x.key===scanKey))throw Error('The same scan was selected twice.');
  inputs.push({key:scanKey,type:entry.type,id:entry.id,source:entry.source,savedAt:entry.savedAt,scope:entry.scope});
  for(const {item,decision,revisedDetail} of itemsFor(entry)){
   if(item.findingType==='preserve_existing'){preserved++;continue;}
   if(['reject','park','hold'].includes(decision)){omitted++;continue;}
   const title=text(item.title||item.path||item.category,180);
   const detail=text(revisedDetail||item.nextAction||item.recommendation||item.proposal||item.nextCheck||item.reason);
   if(!title||!detail)continue;
   total++;if(total>100)throw Error('Select fewer scans: this blueprint is limited to 100 source recommendations.');
   const module=entry.type==='master'?text(item.id,150)||entry.scope:entry.scope;
   const files=[...new Set([...(item.evidenceFiles||[]),...(item.evidence||[]).map(x=>x?.path),item.path].filter(x=>typeof x==='string'&&x.length<=500&&!x.startsWith('/')&&!x.split('/').includes('..')))].slice(0,30);
   const ref={scanKey,type:entry.type,sourceVersion:entry.source,savedAt:entry.savedAt,itemId:text(item.id,200),files};
   const key=module+'|'+normalized(title)+'|'+normalized(detail);
   const existing=seen.get(key);
   if(existing){existing.sourceRefs.push(ref);continue;}
   const proposal={id:'proposal-'+(proposals.length+1),module,title,detail,priority:['critical','high','medium','low'].includes(item.priority||item.severity)?item.priority||item.severity:'medium',assignedTo:suggestedAgent(title,detail),decision:'pending',revision:text(revisedDetail),requiresVerification:true,sourceRefs:[ref]};
   proposals.push(proposal);seen.set(key,proposal);
  }
 }
 if(!proposals.length)throw Error('The selected scans contain no actionable recommendations. Rejected and parked findings are omitted.');
 const warnings=[];
 for(const module of new Set(proposals.map(x=>x.module))){
  const group=proposals.filter(x=>x.module===module);
  if(new Set(group.flatMap(x=>x.sourceRefs.map(r=>r.sourceVersion))).size>1)warnings.push('Multiple source versions for '+module+'. Verify against the current branch before implementation.');
  for(const title of new Set(group.map(x=>normalized(x.title))))if(group.filter(x=>normalized(x.title)===title).length>1)warnings.push('Different recommendations share a title in '+module+'. Review both; no approach was chosen automatically.');
 }
 return {kind:'eig_build_lab_manager_blueprint',schemaVersion:1,title:text(title,120),createdAt:now,revision:1,status:'owner_review_required',inputs,proposals,warnings,omitted,preserved,merged:total-proposals.length,tasks:[],approval:null,execution:'not_connected',safety:{localPlanningOnly:true,autoBuilt:false,autoDeployed:false}};
}
function changed(plan){const next=clone(validateManagerBlueprint(plan));next.revision++;next.approval=null;next.status='owner_review_required';next.tasks=[];return next;}
export function reviewManagerProposal(plan,id,decision,revision=''){
 if(!DECISIONS.has(decision))throw Error('Invalid review decision.');
 const next=changed(plan),p=next.proposals.find(x=>x.id===id);if(!p)throw Error('Unknown recommendation.');
 if(decision==='revise'&&(!text(revision)||revision.length>3000))throw Error('Enter a revision of 1 to 3,000 characters.');
 // Accepting a revised requirement must not silently restore the scanner wording.
 if(decision==='revise')p.revision=revision.trim();
 p.decision=decision==='accept'&&p.revision?'revise':decision;return next;
}
export function assignManagerProposal(plan,id,agent){
 if(!Object.hasOwn(MANAGER_AGENTS,agent))throw Error('Unknown specialist.');
 const next=changed(plan),p=next.proposals.find(x=>x.id===id);if(!p)throw Error('Unknown recommendation.');
 p.assignedTo=agent;return next;
}
export function approveManagerBlueprint(plan,{acknowledgeWarnings=false,now=new Date().toISOString()}={}){
 const next=clone(validateManagerBlueprint(plan));
 if(!Number.isFinite(Date.parse(now)))throw Error('A valid review date is required.');
 if(next.proposals.some(x=>x.decision==='pending'))throw Error('Review each recommendation before approving the blueprint.');
 const accepted=next.proposals.filter(runnable);if(!accepted.length)throw Error('Accept or revise at least one recommendation.');
 if(next.warnings.length&&!acknowledgeWarnings)throw Error('Acknowledge the source-version and recommendation warnings.');
 const tasks=[];
 for(const p of accepted){
  const files=[...new Set(p.sourceRefs.flatMap(x=>x.files))];
  const previous=tasks.filter(x=>x.phase==='inspect'&&(!files.length||!x.files.length||x.files.some(f=>files.includes(f)))).map(x=>x.id);
  tasks.push({id:p.id+'-verify',proposalId:p.id,phase:'verify',agent:'inspector',dependsOn:previous,files,status:'planned',instruction:'Verify the source evidence and reproduce the need for: '+p.title,completion:'Evidence confirmed against the exact branch using isolated test data. Escalate unsupported findings.'});
  tasks.push({id:p.id+'-work',proposalId:p.id,phase:'work',agent:p.assignedTo,dependsOn:[p.id+'-verify'],files,status:'planned',instruction:p.revision||p.detail,completion:['scientist','researcher'].includes(p.assignedTo)?'Return findings and a proposed next step for owner review.':'Produce a scoped implementation and relevant regression checks in an isolated branch.'});
  tasks.push({id:p.id+'-inspect',proposalId:p.id,phase:'inspect',agent:'inspector',dependsOn:[p.id+'-work'],files,status:'planned',instruction:'Independently review the result for: '+p.title,completion:'Attach test and rescan evidence, unresolved issues and a reviewable preview or research report.'});
 }
 next.tasks=tasks;next.approval={revision:next.revision,reviewedAt:now,localReviewOnly:true};next.status='reviewed_for_handoff';return next;
}
export function validateManagerBlueprint(plan){
 if(!plan||JSON.stringify(plan).length>600000||plan.kind!=='eig_build_lab_manager_blueprint'||plan.schemaVersion!==1||!Number.isInteger(plan.revision)||plan.revision<1||typeof plan.title!=='string'||!Array.isArray(plan.inputs)||!plan.inputs.length||plan.inputs.length>10||!Array.isArray(plan.proposals)||!plan.proposals.length||plan.proposals.length>100||!Array.isArray(plan.warnings)||!Array.isArray(plan.tasks)||!['owner_review_required','reviewed_for_handoff'].includes(plan.status)||plan.execution!=='not_connected'||plan.safety?.localPlanningOnly!==true||plan.safety?.autoBuilt!==false||plan.safety?.autoDeployed!==false)throw Error('Saved Manager blueprint is invalid.');
 if(plan.pilot!==undefined&&(!plan.pilot||plan.pilot.scanner!=="inspector"||!/^[a-f0-9]{64}$/i.test(plan.pilot.sourceFingerprint||"")||typeof plan.pilot.findingId!=="string"||!Array.isArray(plan.pilot.verification)||plan.pilot.verification.length!==3||plan.pilot.verification.some(x=>typeof x!=="string"||x.length>300)||plan.pilot.execution!=="manual_approved_implementation"||plan.pilot.status!=="awaiting_owner_review"))throw Error("Invalid scanner pilot metadata.");
 const ids=new Set();
 for(const p of plan.proposals){
  if(!text(p.id)||ids.has(p.id)||!text(p.title)||!text(p.detail)||typeof p.revision!=='string'||p.revision.length>3000||!DECISIONS.has(p.decision)||!Object.hasOwn(MANAGER_AGENTS,p.assignedTo)||p.requiresVerification!==true||!Array.isArray(p.sourceRefs)||!p.sourceRefs.length||!p.sourceRefs.every(x=>typeof x.scanKey==='string'&&typeof x.sourceVersion==='string'&&Array.isArray(x.files)&&x.files.every(f=>typeof f==='string')))throw Error('Saved Manager recommendation is invalid.');
  ids.add(p.id);
 }
 if(plan.status==='reviewed_for_handoff'&&(plan.approval?.revision!==plan.revision||plan.approval?.localReviewOnly!==true||!Number.isFinite(Date.parse(plan.approval?.reviewedAt))||plan.proposals.some(p=>p.decision==='pending')||!plan.proposals.some(runnable)))throw Error('Saved Manager approval does not match this revision.');
 return plan;
}
export function restoreManagerBlueprint(raw){
 if(!raw)return null;if(raw.length>600000)throw Error('Saved Manager blueprint is too large.');
 const plan=validateManagerBlueprint(JSON.parse(raw));
 // Browser state is editable; it is never a credential for execution or release.
 if(plan.status==='reviewed_for_handoff'){
  const rebuilt=approveManagerBlueprint({...plan,status:'owner_review_required',approval:null,tasks:[]},{acknowledgeWarnings:true,now:plan.approval?.reviewedAt});
  return rebuilt;
 }
 return {...plan,tasks:[],approval:null};
}

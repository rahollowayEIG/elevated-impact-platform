/** Owner-local work ledger. Planning data is never execution or deployment authority. */
import {historyKey, SCAN_TYPES} from './buildLabScanHistory.mjs';
import {stackScanBlueprint, validateManagerBlueprint, approveManagerBlueprint} from './buildLabManagerBlueprint.mjs';
import {scanFindingAssessment,ownerGoalAssessment,findingAssessment,validFindingAssessment} from './buildLabFindingStandards.mjs';
export const WORK_BUCKETS = {investigation:'Investigation',interface:'Interface & accessibility',behavior:'Application behavior',data:'Data & integrations',security:'Security & permissions',development:'Research & development'};
export const WORK_INTENTS = {repair:'Repair',upgrade:'Upgrade',build:'New build'};
export const WORK_STATES = {open:'Open',hold:'On hold',manual:'Needs manual fix',dismissed:'Dismissed'};
export const WORK_EVENT = 'eig-work-buckets-changed';
const MAX_SIZE=2400000;
const copy=x=>JSON.parse(JSON.stringify(x));
const clean=(s,n=3000)=>typeof s==='string'?s.trim().slice(0,n):'';
const date=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const validPath=p=>typeof p==='string'&&p.length<=500&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').includes('..');
export const workStorageKey=uid=>historyKey(uid)?.replace('scan-history','work-buckets')||null;
export const emptyWorkLedger=()=>({kind:'eig_work_buckets',version:1,jobs:[],batches:[]});
export function validateWorkLedger(value){
 if(!value||value.kind!=='eig_work_buckets'||value.version!==1||!Array.isArray(value.jobs)||value.jobs.length>500||!Array.isArray(value.batches)||value.batches.length>100||JSON.stringify(value).length>MAX_SIZE)throw Error('Work buckets are unreadable or exceed the local limit. Existing data has been preserved.');
 const ids=new Set();
 for(const j of value.jobs){
  if(!j||typeof j.id!=='string'||!j.id||j.id.length>700||ids.has(j.id)||!clean(j.title,180)||typeof j.detail!=='string'||j.detail.length>3000||!Object.hasOwn(WORK_BUCKETS,j.bucket)||!Object.hasOwn(WORK_INTENTS,j.intent)||!Object.hasOwn(WORK_STATES,j.state)||typeof j.manualReason!=='string'||j.manualReason.length>1000||typeof j.completion!=='string'||j.completion.length>3000||!Array.isArray(j.apps)||!j.apps.length||j.apps.length>30||!j.apps.every(a=>typeof a==='string'&&a.length<=150)||!['app','multi_app','platform'].includes(j.scope)||!date(j.firstSeen)||!date(j.lastSeen)||typeof j.signature!=='string'||j.signature.length>30000||!Array.isArray(j.refs)||!j.refs.length||j.refs.length>20||!j.refs.every(r=>Object.hasOwn(SCAN_TYPES,r.type)&&typeof r.scanKey==='string'&&typeof r.sourceVersion==='string'&&Array.isArray(r.files)&&r.files.every(validPath))||!Array.isArray(j.evidence)||j.evidence.length>30||!j.evidence.every(e=>typeof e==='string'&&e.length<=1000)||!['critical','high','medium','low'].includes(j.priority)||typeof j.observation!=='string'||j.observation.length>3000||typeof j.classificationReason!=='string'||typeof j.ownerEdited!=='boolean')throw Error('Saved work item is invalid. Existing data has been preserved.');
  ids.add(j.id);
  if(j.assessment!==undefined&&!validFindingAssessment(j.assessment))throw Error('Saved finding assessment is invalid. Existing data has been preserved.');
 }
 const batchIds=new Set();
 for(const b of value.batches){
  if(!b||typeof b.id!=='string'||!b.id||batchIds.has(b.id)||!clean(b.title,120)||!Object.hasOwn(WORK_INTENTS,b.intent)||!['draft','approved'].includes(b.status)||!date(b.createdAt)||!Array.isArray(b.items)||!b.items.length||b.items.length>50||new Set(b.items.map(i=>i.id)).size!==b.items.length||!b.items.every(i=>ids.has(i.id)&&typeof i.signature==='string'&&typeof i.detail==='string'&&typeof i.completion==='string')||(b.status==='approved'&&!date(b.approvedAt)))throw Error('Saved batch is invalid. Existing data has been preserved.');
  batchIds.add(b.id);
  if(b.items.some(i=>i.assessment!==undefined&&!validFindingAssessment(i.assessment)))throw Error('Saved batch assessment is invalid. Existing data has been preserved.');
 }
 return value;
}
export function readWorkLedger(storage,uid){
 const key=workStorageKey(uid);if(!key)throw Error('Owner account required.');
 const raw=storage.getItem(key);if(!raw)return emptyWorkLedger();
 if(raw.length>MAX_SIZE)throw Error('Work buckets exceed the local limit. Existing data has been preserved.');
 return validateWorkLedger(JSON.parse(raw));
}
export function saveWorkLedger(storage,uid,value){
 const key=workStorageKey(uid);if(!key)throw Error('Owner account required.');
 const json=JSON.stringify(validateWorkLedger(value));storage.setItem(key,json);
}
function classify(item,type){
 const s=(item.title+' '+item.detail).toLowerCase();
 let bucket='behavior',reason='Application behavior is the default; verify this classification.';
 for(const [id,pattern,why] of [
  ['security',/\b(auth|rls|permission|security|session|password|access control)/,'Access or security terms occur in the finding.'],
  ['data',/\b(database|persist|storage|sync|integration|api|schema|ledger)/,'Data storage or integration terms occur in the finding.'],
  ['interface',/\b(dialog|keyboard|focus|accessib|layout|responsive|viewport|navigation|visual|style)/,'Interface or accessibility terms occur in the finding.'],
  ['development',/\b(research|competitor|provider|experiment|hypothesis|build versus)/,'Research or experimentation terms occur in the finding.'],
 ])if(pattern.test(s)){bucket=id;reason=why;break;}
 const intent=/\b(broken|crash|regression|defect|repair)\b/.test(s)?'repair':/\b(new capability|not yet|missing feature|implement new|build new)\b/.test(s)?'build':'upgrade';
 if(item.findingType==='verification_needed'||type==='impact'){bucket='investigation';reason='The scan requires investigation before implementation.';}
 return {bucket,intent,classificationReason:reason+' Suggested intent and scope remain editable; source observations do not prove a defect.'};
}
function extract(entry){
 const s=entry.snapshot,r=s.review||s.report||s.audit||s;
 return r.recommendations||r.findings||r.suggestions||r.modules||[];
}
function signature(j){return JSON.stringify([j.title,j.detail,j.completion,j.bucket,j.intent,j.scope,j.apps,[...new Set(j.refs.map(r=>r.type+':'+r.sourceVersion))].sort(),j.assessment]);}
export function collectScanWork(ledger,entries){
 const next=copy(validateWorkLedger(ledger));
 // Oldest first: latest observation wins, without deleting jobs absent from a later scan.
 for(const entry of [...entries].sort((a,b)=>Date.parse(a.savedAt)-Date.parse(b.savedAt))){
  const rows=extract(entry);if(!Array.isArray(rows))continue;
  for(const item of rows){
   if(!item||item.findingType==='preserve_existing')continue;
   let proposal;try{
    const s=entry.snapshot,r=s.review||s.report||s.audit||s;
    const field=Array.isArray(r.recommendations)?'recommendations':Array.isArray(r.findings)?'findings':Array.isArray(r.suggestions)?'suggestions':'modules';
    const root=s.review?'review':s.report?'report':s.audit?'audit':null;
    const selected={...entry,snapshot:root?{...s,[root]:{...r,[field]:[item]},reviews:{},choices:{}}:{...s,[field]:[item],reviews:{},choices:{}}};
    proposal=stackScanBlueprint([selected]).proposals[0];
   }catch{continue;}
   if(!proposal)continue;
   const id=JSON.stringify([entry.type,entry.scope,clean(item.id||item.path||proposal.title,200),entry.type==='ai'?proposal.title.toLowerCase():null]);
   const prior=next.jobs.find(j=>j.id===id);
   if(prior&&Date.parse(prior.lastSeen)>Date.parse(entry.savedAt))continue;
   const choice=entry.snapshot.reviews?.[item.id]||entry.snapshot.choices?.[item.id];
   const decision=typeof choice==='string'?choice:choice?.review;
   const revised=clean(choice?.editedDetail||choice?.note);
   const ref=proposal.sourceRefs[0];
   const refs=[ref,...(prior?.refs||[]).filter(r=>r.scanKey!==ref.scanKey)].slice(0,20);
   const recommendation=['edit','revise'].includes(decision)&&revised?revised:proposal.detail;
   const assessment=scanFindingAssessment(entry.type,item);
   const j={id,title:proposal.title,detail:recommendation,assessment,completion:clean(item.verify||item.completion)||assessment.nextCheck,
    ...classify({...item,detail:recommendation},entry.type),scope:entry.scope==='all'?'platform':'app',apps:[entry.type==='master'?proposal.module:entry.scope],
    priority:proposal.priority,state:decision==='reject'?'dismissed':['hold','park'].includes(decision)?'hold':'open',manualReason:'',
    firstSeen:prior?.firstSeen||entry.savedAt,lastSeen:entry.savedAt,observation:clean(item.observation||item.why||item.reason),
    evidence:(item.evidence||[]).map(e=>clean(typeof e==='string'?e:[e.path,e.line,e.excerpt].filter(Boolean).join(': '),1000)).slice(0,30),refs,ownerEdited:false};
   if(prior){
    // Local triage belongs to the owner. Rescans update source evidence, not the owner's wording or disposition.
    if(prior.ownerEdited)for(const key of ['title','detail','completion','bucket','intent','scope','apps','state','manualReason','ownerEdited'])j[key]=prior[key];
    else if(prior.state==='manual'){j.state='manual';j.manualReason=prior.manualReason;}
   }
   j.signature=signature(j);
   if(prior)next.jobs[next.jobs.indexOf(prior)]=j;else next.jobs.push(j);
  }
 }
 return validateWorkLedger(next);
}
export function reviseWorkItem(ledger,id,patch){
 const next=copy(validateWorkLedger(ledger)),j=next.jobs.find(j=>j.id===id);if(!j)throw Error('Unknown work item.');
 for(const key of ['title','detail','completion','bucket','intent','scope','state','manualReason','apps'])if(Object.hasOwn(patch,key))j[key]=copy(patch[key]);
 j.ownerEdited=true;j.signature=signature(j);
 if(!clean(j.detail)||!clean(j.completion))throw Error('A requirement and completion criteria are required.');
 if(j.state==='manual'&&!clean(j.manualReason))throw Error('Explain what needs manual work or which capability is missing.');
 return validateWorkLedger(next);
}
export function addBuildBrief(ledger,{id,title,detail,completion,apps=['platform'],now=new Date().toISOString()}){
 const next=copy(validateWorkLedger(ledger));if(!id||next.jobs.some(j=>j.id===id))throw Error('Unique work ID required.');
 const j={id,title:clean(title,180),detail:clean(detail),completion:clean(completion),bucket:'development',intent:'build',scope:apps.includes('platform')?'platform':apps.length>1?'multi_app':'app',apps,
 state:'open',manualReason:'',assessment:ownerGoalAssessment(),priority:'medium',firstSeen:now,lastSeen:now,observation:'Owner-defined goal; implementation and existing capabilities require verification.',evidence:[],refs:[{scanKey:'owner:'+id,type:'master',sourceVersion:'owner-brief',files:[]}],ownerEdited:true,classificationReason:'Owner-defined new build.',signature:''};
 if(!j.title||!j.detail||!j.completion)throw Error('Enter a title, requirement and completion criteria.');
 j.signature=signature(j);next.jobs.push(j);return validateWorkLedger(next);
}
export function batchIsCurrent(ledger,batch){
 return batch.items.every(i=>{const j=ledger.jobs.find(j=>j.id===i.id);return j&&j.signature===i.signature&&j.state==='open';});
}
export function createWorkBatch(ledger,{id,title,jobIds,now=new Date().toISOString()}){
 const next=copy(validateWorkLedger(ledger)),jobs=next.jobs.filter(j=>jobIds.includes(j.id));
 if(!id||next.batches.some(b=>b.id===id)||!clean(title,120)||!jobs.length||jobs.length>50||jobs.length!==new Set(jobIds).size)throw Error('Choose 1–50 work items and enter a batch title.');
 if(jobs.some(j=>j.state!=='open'))throw Error('Only open items can enter a new batch. Reopen held or manual work deliberately first.');
 if(new Set(jobs.map(j=>j.intent)).size!==1)throw Error('Keep repairs, upgrades and new builds in separate batches.');
 next.batches.unshift({id,title:clean(title,120),intent:jobs[0].intent,createdAt:now,status:'draft',approvedAt:null,items:jobs.map(j=>({id:j.id,signature:j.signature,title:j.title,detail:j.detail,completion:j.completion,assessment:copy(findingAssessment(j)),apps:[...j.apps],scope:j.scope,sourceRefs:copy(j.refs),evidence:copy(j.evidence)}))});
 return validateWorkLedger(next);
}
export function approveWorkBatch(ledger,id,now=new Date().toISOString()){
 const next=copy(validateWorkLedger(ledger)),batch=next.batches.find(b=>b.id===id);
 if(!batch||!batchIsCurrent(next,batch))throw Error('This batch changed or contains held/manual work. Prepare a fresh batch from the current items.');
 if(!date(now))throw Error('A valid approval date is required.');
 batch.status='approved';batch.approvedAt=now;return next;
}
export function workBatchPlan(ledger,id){
 const batch=ledger.batches.find(b=>b.id===id);
 if(!batch||batch.status!=='approved'||!batchIsCurrent(ledger,batch))throw Error('Review and approve a current batch first.');
 const jobs=batch.items.map(i=>ledger.jobs.find(j=>j.id===i.id));
 const inputs=[...new Map(jobs.flatMap(j=>[j.refs[0]]).map(r=>[r.scanKey,{key:r.scanKey,type:r.type,id:r.scanKey,source:r.sourceVersion,savedAt:r.savedAt||batch.createdAt,scope:'batch'}])).values()];
 if(inputs.length>10)throw Error('This legacy implementation review accepts at most 10 source scans. Split the batch or use assisted implementation from its saved scope.');
 const proposals=jobs.map((j,i)=>{
  const requirement=j.detail+'\n\nComplete when: '+j.completion;
  if(requirement.length>3000)throw Error('The requirement and completion criteria for '+j.title+' exceed the implementation review limit of 3,000 characters. Shorten the work item and prepare a fresh batch.');
  return {id:'proposal-'+(i+1),module:j.apps.join(', '),title:j.title,detail:requirement,revision:requirement,priority:j.priority,assignedTo:j.intent==='repair'?'fixer':'builder',decision:'revise',requiresVerification:true,sourceRefs:[j.refs[0]]};
 });
 const plan=validateManagerBlueprint({kind:'eig_build_lab_manager_blueprint',schemaVersion:1,title:batch.title,createdAt:batch.createdAt,revision:1,status:'owner_review_required',inputs,proposals,
 warnings:['Batch scope approval does not authorize execution or release. Verify the exact current branch, dependencies and affected apps before implementation.'],tasks:[],approval:null,execution:'not_connected',safety:{localPlanningOnly:true,autoBuilt:false,autoDeployed:false}});
 return approveManagerBlueprint(plan,{acknowledgeWarnings:true,now:batch.approvedAt});
}
export function workRoute(job){
 const latest=job.refs[0];
 if(job.state==='manual')return {label:'Needs manual fix',reason:job.manualReason};
 if(job.scope==='app'&&latest?.type==='inspector'&&/^[a-f0-9]{40}$/.test(latest.sourceVersion)&&job.apps.every(a=>['inception','inception-apex'].includes(a)))return {label:'Bounded IA candidate review',reason:'One IA finding can use the existing candidate generator after current-source verification. Successful implementation is not guaranteed.'};
 return {label:'Capability not assessed',reason:'An implementation route has not been established for this scope. Assess the tools, permissions and tests needed before choosing assisted work or an agent. This does not establish a defect or an agent limitation.'};
}

function reviewedSelection(ledger,selection){
 if(!Array.isArray(selection)||!selection.length||selection.length>50||new Set(selection.map(x=>x.id)).size!==selection.length)throw Error('Review between 1 and 50 findings at a time.');
 return selection.map(s=>{const j=ledger.jobs.find(j=>j.id===s.id);if(!j||j.signature!==s.signature||j.state!=='open')throw Error('Findings changed since this review. Refresh the bucket and review the current work.');return j;});
}
/** One bucket approval creates reviewed batches by work intent; no provider or execution. */
export function approveBucketSelection(ledger,{selection,idPrefix,title='Reviewed bucket',now=new Date().toISOString()}){
 let next=copy(validateWorkLedger(ledger));const jobs=reviewedSelection(next,selection);
 if(!clean(idPrefix,150))throw Error('A unique review ID is required.');
 const alreadyApproved=new Set(next.batches.filter(b=>b.status==='approved'&&batchIsCurrent(next,b)).flatMap(b=>b.items.map(i=>i.id)));
 if(jobs.some(j=>alreadyApproved.has(j.id)))throw Error('Some findings already have an approved work plan. Review the existing batch instead.');
 for(const intent of Object.keys(WORK_INTENTS)){
  const group=jobs.filter(j=>j.intent===intent);if(!group.length)continue;
  const id=idPrefix+':'+intent;
  next=createWorkBatch(next,{id,title:WORK_INTENTS[intent]+' · '+title,jobIds:group.map(j=>j.id),now});
  next=approveWorkBatch(next,id,now);
 }
 return next;
}
export function setBucketDisposition(ledger,{selection,state}){
 if(!['hold','dismissed'].includes(state))throw Error('Choose hold or dismiss.');
 const jobs=reviewedSelection(validateWorkLedger(ledger),selection);
 return jobs.reduce((next,j)=>reviseWorkItem(next,j.id,{state}),copy(ledger));
}
/** The approved batch snapshot is the blueprint; no separate creation action is needed. */
export function batchWorkBlueprint(batch){
 return {kind:'eig_work_batch_blueprint',schemaVersion:1,title:batch.title,intent:batch.intent,status:batch.status,reviewedAt:batch.approvedAt||null,
  work:batch.items.map(i=>({title:i.title,requirement:i.detail,completion:i.completion,assessment:copy(findingAssessment(i)),apps:i.apps||[],scope:i.scope||'app',sourceRefs:i.sourceRefs||[],evidence:i.evidence||[]})),
  execution:'not_connected',deployment:'not_authorized'};
}

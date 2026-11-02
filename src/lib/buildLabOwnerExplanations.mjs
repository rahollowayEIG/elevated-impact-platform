/**
 * Plain-language explanations of Build Lab evidence.
 * No AI calls, writes, permissions, or defect verdicts. Templates are grounded
 * in the named scan module; technical claims remain in the saved source record.
 */
const examples={
 registration:{
  meaning:'Check that someone registering for an event is connected to the right person and account, regardless of how they joined.',
  why:'A player might register for more than one event or be added by a captain. Their information should remain connected without mixing up two different people.',
  next:'Compare registrations, invitations and claimed accounts with safe test records. Check the results before deciding that anything needs fixing.',
  impact:'Player lists, captain invitations, check-in and account history could be affected by a future change.',
  outcome:'Each test registration points to the intended person, and existing event records still work.'
 },
 accounts:{
  meaning:'Check that each person sees only the information and tools their account is allowed to access.',
  why:'A golfer, event coordinator and company administrator need different permissions. Nobody should accidentally see another person’s private records.',
  next:'Test each role with safe accounts, including unclaimed registrations, duplicates and directory filtering.',
  impact:'Sign-in, account profiles, the shared directory and role-based screens.',
  outcome:'The correct account sees the correct information, and unauthorized access is denied.'
 },
 'event-builder':{
  meaning:'Check that changing and saving event settings actually keeps those choices when you come back.',
  why:'Event details, player limits and registration rules need to remain accurate after reopening an event.',
  next:'Save a test event, close it, reopen it and compare each setting. Check existing tests before writing new ones.',
  impact:'Event setup, registration settings and the public Event Hub.',
  outcome:'Saved settings stay exactly as intended after leaving and reopening the event.'
 },
 squawk:{
  meaning:'Check that messages go to the intended people and that communication controls work correctly.',
  why:'Event participants and staff should receive only the messages meant for them.',
  next:'Use simulated message delivery to check recipients, duplicates, unread status and quiet hours without messaging real customers.',
  impact:'Squawk Box, notifications and event communications.',
  outcome:'Only authorized recipients receive the simulated messages, with the expected status updates.'
 },
 payments:{
  meaning:'Check how team payments are divided and tracked when people pay separately or a captain pays for everyone.',
  why:'Team changes, refunds and unpaid spots should not create unexpected balances or duplicate charges.',
  next:'Test split amounts, partial payments, captain-paid teams and TBA spots using simulated transactions only.',
  impact:'Registration checkout, team balances, refunds and clubhouse payment instructions.',
  outcome:'Every test balance adds up correctly, and no real charges are made during verification.'
 }
};
function moduleKey(job){
 const refs=Array.isArray(job?.refs)?job.refs:[];
 const ids=refs.map(r=>String(r.itemId||'')).join(' ').toLowerCase();
 const title=String(job?.title||'').toLowerCase();
 if(ids.includes('registration')||/registration identity|registration reconciliation/.test(title))return'registration';
 if(ids.includes('accounts')||/identity visibility|role permissions|account permission/.test(title))return'accounts';
 if(ids.includes('event-builder')||/event details.*registration|event builder.*persist/.test(title))return'event-builder';
 if(ids.includes('squawk')||/communication control|squawk/.test(title))return'squawk';
 if(ids.includes('payments')||/split.payment|team payment/.test(title))return'payments';
 return null;
}
const safeText=(value,max=1800)=>typeof value==='string'?value.trim().slice(0,max):'';
export function describeWorkItem(job){
 const module=examples[moduleKey(job)];
 const title=safeText(job?.title,180)||'this work item';
 const ai=job?.assessment?.basis==='scanner_metadata';
 const manual=job?.assessment?.basis==='owner_observation';
 const evidenceStatus=manual?'Owner-reported observation, not independently verified':
  ai?'AI suggestion based on limited scanner metadata, not a confirmed problem':
  job?.assessment?.kind==='goal'?'Owner-requested goal, not a verified missing feature':
  'Scanner finding requiring independent verification';
 const core=module||{
  meaning:'Build Lab recommends checking '+title.toLowerCase()+'. This is not proof that anything is broken.',
  why:'Confirming the current behavior before changing it helps protect parts of ElevationPilot that already work.',
  next:'Compare the existing behavior with the requirement using isolated test data. Review the finding and evidence before agreeing to work.',
  impact:'The affected area and related screens must be checked before planning a change.',
  outcome:'The expected behavior is verified, or a specific change is agreed and independently retested.'
 };
 return {
  title,evidenceStatus,quick:core.meaning,why:core.why,next:core.next,
  impact:core.impact,outcome:core.outcome,
  currentEvidence:safeText(job?.observation)||'The saved scan did not record a direct behavior test.',
  suggestedWork:safeText(job?.detail)||'Review the finding before proposing any change.',
  completion:safeText(job?.completion)||'Agree on a specific check before implementation.',
  limits:safeText(job?.assessment?.limitation)||'The finding requires source and runtime verification.',
  priority:['critical','high','medium','low'].includes(job?.priority)?job.priority:'medium'
 };
}
const priorityOrder={critical:0,high:1,medium:2,low:3};
export function guidedReviewQueue(jobs,approvedIds=[]){
 const approved=new Set(approvedIds);
 return (Array.isArray(jobs)?jobs:[])
  .filter(j=>j&&j.state==='open'&&!approved.has(j.id))
  .sort((a,b)=>(priorityOrder[a.priority]??5)-(priorityOrder[b.priority]??5)||
   String(a.title).localeCompare(String(b.title))||String(a.id).localeCompare(String(b.id)));
}
export function nextGuidedItem(queue,id,direction=1){
 if(!queue.length)return null;
 const index=queue.findIndex(j=>j.id===id);
 const next=index<0?0:(index+direction+queue.length)%queue.length;
 return queue[next].id;
}

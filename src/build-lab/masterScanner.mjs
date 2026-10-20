// Build Lab Master Scanner v1: deterministic, read-only repository audit.
// No network, credentials, database writes, deployment, or code mutation.
export const SCANNER_RULES = Object.freeze([
  { id:'payments', pattern:/stripe|payment[_ -]?intent|checkout|ach|quickbooks/i, severity:'high', category:'Finance', suggestion:'Verify provider isolation, accounting ownership, webhooks and idempotency.' },
  { id:'auth', pattern:/auth\\.|signIn|session|password|user_metadata/i, severity:'high', category:'Security', suggestion:'Review identity, authorization and session expiry; never trust browser-only checks.' },
  { id:'roles', pattern:/organization_memberships|permission|role|RLS|security definer/i, severity:'high', category:'Authorization', suggestion:'Verify scoped organization roles and row-level access on server.' },
  { id:'registration', pattern:/golf_registration_teams|golf_registrations|team_registrations|captain|tba/i, severity:'medium', category:'Registration', suggestion:'Check team identity, slot reassignment, cancellation and TBA handling.' },
  { id:'contracts', pattern:/contract|agreement|signatures?/i, severity:'medium', category:'Contracts', suggestion:'Ensure signed agreement versions can link to invoice schedules.' },
  { id:'invoice', pattern:/invoice|accounts? receivable|billing/i, severity:'medium', category:'Invoicing', suggestion:'Check issuer, customer, service location, immutable invoice number, payments and audit trail.' },
  { id:'squawk', pattern:/squawk|notification|reminder|send.email/i, severity:'medium', category:'Communications', suggestion:'Confirm recipient permissions, delivery status and sandbox suppression.' },
  { id:'builder', pattern:/event.builder|EieEventSetupSteps|event_offers/i, severity:'medium', category:'Event Builder', suggestion:'Compare visible UI to persisted schema and save operations.' },
]);
export function scanSourceFiles(files,{target='ElevationPilot',maxFindings=200}={}) {
  if (!Array.isArray(files)) throw new TypeError('files must be an array');
  const findings=[]; const inventory={};
  for (const file of files) {
    if (!file || typeof file.path!=='string' || typeof file.content!=='string') continue;
    if (/node_modules|\\.lock$|dist\\//.test(file.path)) continue;
    for (const rule of SCANNER_RULES) {
      if (rule.pattern.test(file.path+'\\n'+file.content)) {
        inventory[rule.category]=(inventory[rule.category]||0)+1;
        if(findings.length<maxFindings) findings.push({id:rule.id+':'+file.path,category:rule.category,severity:rule.severity,path:file.path,detail:rule.suggestion,reviewStatus:'proposed'});
      }
    }
    // Flag suspicious or incomplete implementation signals; never assert a bug from a text match.
    if (/TODO|FIXME|not implemented/i.test(file.content)&&findings.length<maxFindings)
      findings.push({id:'review:'+file.path,category:'Implementation review',severity:'medium',path:file.path,detail:'Review TODO/FIXME markers before making changes.',reviewStatus:'proposed'});
  }
  const score={high:3,medium:2,low:1};
  findings.sort((a,b)=>score[b.severity]-score[a.severity]||a.path.localeCompare(b.path));
  return {scanner:'Build Lab Master Scanner',version:1,target,readOnly:true,scannedAt:null,filesScanned:files.filter(f=>f&&typeof f.path==='string'&&typeof f.content==='string').length,inventory,findings,limitations:['Source-code heuristics only; results require verification.','No external competitor research or runtime browser testing in v1.','Never deploy or mutate production automatically.']};
}
export function draftBuildPlan(report, request) {
  if(!report || !Array.isArray(report.findings)) throw new TypeError('scan report required');
  if(typeof request!=='string'||!request.trim()) throw new TypeError('build request required');
  return {request:request.trim(),stage:'review',autoDeploy:false,steps:[
    'Map existing reusable modules, schema, roles and integrations',
    'Define organization-scoped domain model and safe migration',
    'Build feature behind Sandbox-only flag',
    'Add unit, RLS, integration and browser tests',
    'Verify with fictional Sandbox records and payment/email suppression',
    'Require explicit review before any production rollout'
  ],relatedFindings:report.findings.filter(x=>/invoice|contract|payment|auth|roles/i.test(x.category)).map(x=>x.id)};
}

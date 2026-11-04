/**
 * First EIE functionality baseline for the owner-only Build Lab.
 *
 * This is a proposed requirement inventory, NOT an approved release scope.
 * A reference to a test script means a test is mapped for review. It does not
 * show that the test ran, passed, covered the entire user flow, or verified
 * live/sandbox records. Do not derive Built/Verified/Overall percentages.
 *
 * Before measuring, require a reviewed release scope, exact deployed source
 * version, implementation evidence per requirement, and independent passing
 * receipts for each required end-to-end or integration test.
 */
export const EIE_BASELINE=Object.freeze({
 id:'eie-functionality-draft-20261104',
 appId:'eie',
 version:1,
 status:'proposed_for_owner_review',
 approvedAt:null,
 approvedReleaseCommit:null
});

const entry=(id,component,title,acceptance,test=null,links=[])=>Object.freeze({
 id,component,title,acceptance,
 test:test?Object.freeze({...test}):null,
 integrationTargets:Object.freeze([...links]),
 scopeStatus:'proposed',
 implementationStatus:'not_independently_verified',
 verifiedStatus:'no_exact_version_receipt'
});

export const EIE_REQUIREMENTS=Object.freeze([
 entry('EIE-SET-01','event-builder','Save event details','Event details persist after save and reopening.',
  null),
 entry('EIE-SET-02','event-builder','Save registration configuration','Registration configuration survives save and reopening.',
  null,['registration']),
 entry('EIE-SET-03','event-builder','Team size configuration','Saved players-per-team setting controls the event registration.',
  null,['registration']),
 entry('EIE-SET-04','event-builder','Publish or unpublish event','Published event is public; draft event stays private.',null,['registration']),
 entry('EIE-REG-01','registration','Universal person identity','Every named player can be reconciled with one shared person record without cross-organization leakage.',null,['accounts']),
 entry('EIE-REG-02','registration','Captain and teammate invitations','Captain enters real teammates; invites and claims retain original team and entry number.',null,['accounts','squawk']),
 entry('EIE-REG-03','registration','ATC manual registration','ATC manually enters captain and teammates; unpaid status and invitations appear correctly.',null,['accounts']),
 entry('EIE-REG-04','registration','TBA placeholders','Paid or unpaid TBA slots preserve the team without creating false people or auth accounts.',null,['roster','accounts']),
 entry('EIE-REG-05','registration','Central directory reconciliation','Registered named players, claimed users and the universal directory converge without duplicates.',null,['accounts']),
 entry('EIE-PAY-01','payments','Split share allocation','Four-person team shares sum to exact team total, including cents rounding.',
  {file:'tests/team-payment-cart.test.mjs',marker:'Glow Golf $240 four-person team shows four $60 unpaid shares',level:'unit'},['registration']),
 entry('EIE-PAY-02','payments','Captain pays all','Confirmed captain-all payment correctly covers teammates and TBA slots.',
  {file:'tests/team-payment-cart.test.mjs',marker:'confirmed captain-all payment covers every spot',level:'unit'},['roster']),
 entry('EIE-PAY-03','payments','Partial payment balance','Partial payments leave only the true remaining share due.',
  {file:'tests/team-payment-cart.test.mjs',marker:'partial payment shows remaining due',level:'unit'},['registration']),
 entry('EIE-PAY-04','payments','Refund and inactive golfer rules','Refunds reopen unpaid balances and inactive players cannot pay again.',
  {file:'tests/team-payment-cart.test.mjs',marker:'refund reopens unpaid share and an inactive golfer is not cart selectable',level:'unit'},['roster']),
 entry('EIE-ROS-01','roster','Stable team and entry numbering','Team IDs stay stable and four-player positions derive consistently.',
  {file:'tests/roster-numbering.test.mjs',marker:'team IDs stay fixed; numbers are 1-4',level:'unit'},['registration']),
 entry('EIE-ROS-02','roster','Confirmed-only Golf Genius export','Confirmed export preserves original team IDs and gaps.',
  {file:'tests/roster-numbering.test.mjs',marker:'confirmed-only exports preserve original Team IDs',level:'unit'}),
 entry('EIE-ROS-03','roster','TBA output without source mutation','Pending named or unnamed players export with proper placeholders without changing stored records.',
  {file:'tests/roster-numbering.test.mjs',marker:'named and pending TBA spots export as TBA/TBA',level:'unit'}),
 entry('EIE-ROS-04','roster','Move golfer without payment reassignment','Moving a player recalculates derived entry numbering without silently moving purchaser payments.',
  {file:'tests/roster-numbering.test.mjs',marker:'moving a golfer updates the derived number without changing IDs or payments',level:'unit'},['payments']),
 entry('EIE-ROS-05','roster','Golf Genius export fields','Golf Genius file uses correct columns and does not require handicap or GHIN.',
  {file:'tests/roster-numbering.test.mjs',marker:'Golf Genius export has no required handicap or GHIN column',level:'unit'}),
 entry('EIE-ROS-06','roster','Fall 8-inch Cup export format','Event-specific export retains exactly the approved four columns.',
  {file:'tests/roster-numbering.test.mjs',marker:'Fall 8in Cup exports exactly Team ID',level:'unit'}),
 entry('EIE-SPN-01','sponsors','Sponsorship pricing and quantities','Event sponsorship offerings track amounts, available units and purchase status.',null,['event-builder']),
 entry('EIE-SPN-02','sponsors','Sponsor assets in event materials','Approved sponsor creative appears in the intended event public and printable materials.',null,['event-packet']),
 entry('EIE-PKT-01','event-packet','Save and reopen event packet','Event packet content is retained when saved and reopened.',
  {file:'tests/event-builder-browser.cjs',marker:'Save event packet',level:'browser'},['event-builder']),
 entry('EIE-PKT-02','event-packet','Share and export event materials','Print and digital exports preserve the intended layout and links.',null,['inception']),
 entry('EIE-BUD-01','event-budget','Budget arithmetic and sources','Estimates, actuals, contingency and source totals use exact cents without duplication.',
  {file:'tests/event-budget.test.mjs',marker:'exact cents, estimates versus actual zero',level:'unit'},['event-builder']),
 entry('EIE-BUD-02','event-budget','Safe budget export','Sorting and export preserve values and neutralize spreadsheet formulas.',
  {file:'tests/event-budget.test.mjs',marker:'export includes provenance and prevents spreadsheet formulas',level:'unit'}),
 entry('EIE-BUD-03','event-budget','Budget storage and audit boundaries','Budget source totals, scope isolation and audit trail are validated.',
  {file:'tests/event-budget.test.mjs',marker:'real budget SQL aggregates sources once',level:'unit'},['event-builder'])
]);

const validId=s=>typeof s==='string'&&/^[A-Z0-9-]{3,48}$/.test(s);
export function validateEieBaseline(requirements=EIE_REQUIREMENTS,baseline=EIE_BASELINE){
 const errors=[];
 if(baseline?.appId!=='eie'||baseline?.status!=='proposed_for_owner_review'||
   baseline?.approvedAt!==null||baseline?.approvedReleaseCommit!==null)
  errors.push('EIE requirement baseline is not a clearly unapproved draft.');
 const components=new Set(['event-builder','registration','payments','roster','sponsors','event-packet','event-budget']);
 const ids=new Set();
 for(const req of requirements){
  if(!validId(req.id)||ids.has(req.id))errors.push('Invalid or duplicate requirement ID: '+req.id);
  ids.add(req.id);
  if(!components.has(req.component))errors.push('Unknown EIE component for '+req.id);
  if(typeof req.acceptance!=='string'||req.acceptance.trim().length<20)
   errors.push('Missing acceptance criteria for '+req.id);
  if(req.scopeStatus!=='proposed'||req.verifiedStatus!=='no_exact_version_receipt')
   errors.push('Unreviewed requirement incorrectly marked verified or approved: '+req.id);
  if(req.test&&(!/^tests\/[a-z0-9./-]+\.(?:mjs|cjs|js)$/.test(req.test.file)||
   typeof req.test.marker!=='string'||req.test.marker.length<12||
   !['unit','browser'].includes(req.test.level)))
   errors.push('Invalid mapped test reference for '+req.id);
 }
 for(const component of components)if(!requirements.some(r=>r.component===component))
  errors.push('Missing EIE checklist for '+component);
 return errors;
}
export function eieRequirementOverview(requirements=EIE_REQUIREMENTS){
 const byComponent={};
 for(const req of requirements){
  if(!byComponent[req.component])byComponent[req.component]=[];
  byComponent[req.component].push(req);
 }
 const total=requirements.length;
 const mapped=requirements.filter(r=>Boolean(r.test)).length;
 const linkedTargets=new Set(requirements.flatMap(r=>r.integrationTargets));
 return {
  baseline:EIE_BASELINE,
  total,mapped,unmapped:total-mapped,
  testMappingPercent:total?Math.round(mapped/total*100):null,
  linkedTargets:[...linkedTargets].sort(),
  byComponent,
  // Mapped test scripts are planning coverage, not a passing run.
  built:null,verified:null,integration:null,overall:null,
  explanation:'Draft requirements and linked test scripts are not approved scope or exact-commit passing receipts.'
 };
}

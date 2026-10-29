/** Evidence assessment is separate from work intent, disposition and implementation capability. */
export const FINDING_KINDS = {
 investigation:'Needs verification',coverage:'Possible coverage gap',improvement:'Improvement idea',
 impact:'Change-impact review',goal:'Owner goal',manual_report:'Manual report',
};
const CHECKS = {
 investigation:'Verify the observation against the current source and reproduce the relevant behavior with isolated test data. Record expected versus actual behavior. If no problem is reproduced, record that result without changing code.',
 coverage:'Search for equivalent existing tests, including parameterized checks. If coverage is missing, add the scoped regression checks and attach the exact-commit test results. Source markers alone do not prove execution.',
 improvement:'Check existing shared capabilities first. Confirm the benefit and scope before proposing a repair, upgrade or new build; an idea is not a confirmed missing feature.',
 impact:'Review the exact commit diff and affected dependencies, then run relevant isolated regression checks. Filename matches identify possible impacts, not defects or release approval.',
 goal:'Check existing capabilities and dependencies, then implement the reviewed goal and attach relevant regression evidence. This is an owner request, not a scanner-confirmed defect.',
 manual_report:'Reproduce the observed behavior in a safe environment, record the exact version and test result, then decide whether a repair is warranted. A reported issue is not a confirmed defect.',
};
const BASES = {
 inspector:['source_sample','Only the approved source and test-script sample was inspected. No runtime or accessibility result is established.'],
 master:['source_sample','Source markers and dated environment/schema snapshots are evidence to investigate, not proof of working or missing functionality.'],
 radar:['source_sample','A fixed rubric proposes opportunities from sampled source. It does not establish a missing capability or a current external comparison.'],
 ai:['scanner_metadata','AI reviewed bounded scanner metadata. Referenced filenames and model wording are not independent source inspection, runtime evidence or confirmed defects.'],
 impact:['path_list','The owner supplied file paths and source refs. This tool did not fetch or inspect the diff or execute tests.'],
};
export function scanFindingAssessment(type,item={}){
 const kind=type==='impact'?'impact':type==='radar'||type==='ai'?'improvement':item.findingType==='coverage_gap'?'coverage':'investigation';
 const [basis,limitation]=BASES[type]||['legacy_unknown','Evidence limits were not recorded for this saved finding. Reverify it against the current source.'];
 return {kind,basis,limitation,nextCheck:CHECKS[kind]};
}
export function ownerGoalAssessment(){return {kind:'goal',basis:'owner_brief',limitation:'The owner supplied this goal. Existing implementation and feasibility still require investigation.',nextCheck:CHECKS.goal};}
export function manualFindingAssessment(){return {kind:'manual_report',basis:'owner_observation',limitation:'This report was supplied during manual testing. The code version and runtime behavior must be independently checked; confirmation is an owner-recorded observation, not an automated test result.',nextCheck:CHECKS.manual_report};}
export function findingAssessment(job){
 return job.assessment||{kind:'investigation',basis:'legacy_unknown',limitation:'This older saved work item has no recorded evidence assessment. Its decisions are retained; verify the current source before implementation.',nextCheck:CHECKS.investigation};
}
export function validFindingAssessment(value){
 return value&&Object.hasOwn(FINDING_KINDS,value.kind)&&['source_sample','scanner_metadata','path_list','owner_brief','owner_observation','legacy_unknown'].includes(value.basis)&&
 typeof value.limitation==='string'&&value.limitation.trim().length>0&&value.limitation.length<=1000&&
 typeof value.nextCheck==='string'&&value.nextCheck.trim().length>0&&value.nextCheck.length<=3000;
}

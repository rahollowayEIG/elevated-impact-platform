// Read-only Live/Sandbox comparison evidence. This module contains no
// credentials or DB client and never visits a runtime URL. Two separately
// recorded snapshots are used, so the report MUST say it is not a live refresh.
const db = require("./eig-master-environment-baseline.json");
const deployments = require("./eig-master-deployment-baseline.json");

const MODES = Object.freeze(["live","sandbox","compare"]);
const ENV_MODULE_EXTRAS = Object.freeze({
 "event-builder": [
   "sandbox/first-write/01_sandbox_atomic_event_details.sql",
   "sandbox/first-write/04_sandbox_atomic_registration_details.sql",
   "tests/sandbox-event-builder-reads.test.mjs",
   "tests/sandbox-registration-details-save.test.mjs",
 ],
 registration:[
   "src/EieEventSetupSteps.jsx",
   "sandbox/first-write/04_sandbox_atomic_registration_details.sql",
   "tests/sandbox-registration-details-save.test.mjs",
 ],
 payments:["src/EieEventSetupSteps.jsx","sandbox/first-write/04_sandbox_atomic_registration_details.sql"],
 accounts:["src/sandbox/SandboxAccessGate.jsx","src/sandbox/SandboxPracticeRoles.jsx","src/sandbox/SandboxPersonaLogin.jsx","src/sandbox/sandboxSupabaseGate.mjs"],
 "event-packet":["tests/sandbox-event-packet-read-only.test.mjs","sandbox/grants/05_sandbox_event_packet_read_only.sql"],
 "event-budget":["tests/sandbox-budget-read-only.test.mjs","sandbox/grants/07_sandbox_budget_read_only.sql"],
});
function safeMode(mode) {
 if(!MODES.includes(mode))throw Error("Unsupported audit environment.");
 return mode;
}
function validSnapshots(){
 if(db.version!==1||db.capturedOn!==deployments.capturedOn||deployments.version!==1||
 !Array.isArray(db.environment?.live?.publicTables)||
 !Array.isArray(db.environment?.sandbox?.publicTables)||
 !Array.isArray(db.environment?.live?.publicFunctions)||
 !Array.isArray(db.environment?.sandbox?.publicFunctions)||
 !Array.isArray(deployments.githubComparison?.changedFiles)||
 !/^[0-9a-f]{40}$/.test(deployments.live?.commit||"")||
 !/^[0-9a-f]{40}$/.test(deployments.sandbox?.commit||""))
 throw Error("Approved environment baselines unavailable.");
}
function projectSnapshot(which,moduleTables){
 const info=db.environment[which],version=deployments[which];
 const all=info.publicTables;
 const index=new Map(all.map(x=>[x.table_name,x]));
 const relevant=moduleTables===null?all:moduleTables.map(name=>index.get(name)).filter(Boolean);
 return {
   label:version.label,vercelProject:version.vercelProject,
   gitRef:version.gitRef,deployedCommit:version.commit,
   deploymentHost:version.deployment,
   tables:all.length,functions:info.publicFunctions.length,
   rlsDisabled:all.filter(x=>!x.rls).map(x=>x.table_name),
   relevantTables:relevant.map(x=>({table:x.table_name,columns:x.col_count,policies:x.policy_count,
     indexes:x.index_count,rlsEnabled:x.rls})),
   missingRelevantTables:moduleTables===null?[]:moduleTables.filter(name=>!index.has(name)),
 };
}
function tableDifferences(names){
 const l=new Map(db.environment.live.publicTables.map(x=>[x.table_name,x]));
 const s=new Map(db.environment.sandbox.publicTables.map(x=>[x.table_name,x]));
 const chosen=names===null?[...new Set([...l.keys(),...s.keys()])]:names;
 const differences=[];
 for(const name of chosen){
   const a=l.get(name),b=s.get(name);
   if(!a||!b){
     differences.push({table:name,kind:"table_missing",presentIn:a?"live":b?"sandbox":"neither",
       liveColumnCount:a?.col_count??null,sandboxColumnCount:b?.col_count??null});
     continue;
   }
   const left=new Map(a.columns.map(x=>[x.name,x])),right=new Map(b.columns.map(x=>[x.name,x]));
   const liveOnly=[...left.keys()].filter(x=>!right.has(x));
   const sandboxOnly=[...right.keys()].filter(x=>!left.has(x));
   const altered=[...left.keys()].filter(x=>right.has(x)&&
     (left.get(x).type!==right.get(x).type||left.get(x).notNull!==right.get(x).notNull))
     .map(x=>({name:x,liveType:left.get(x).type,sandboxType:right.get(x).type,
       liveRequired:left.get(x).notNull,sandboxRequired:right.get(x).notNull}));
   const policyDifferent=a.policy_count!==b.policy_count||a.policy_hash!==b.policy_hash;
   const rlsDifferent=a.rls!==b.rls;
   const indexDifferent=a.index_count!==b.index_count;
   if(liveOnly.length||sandboxOnly.length||altered.length||policyDifferent||rlsDifferent||indexDifferent)
     differences.push({table:name,kind:"structure_diff",liveColumnCount:a.col_count,
       sandboxColumnCount:b.col_count,liveOnlyColumns:liveOnly,sandboxOnlyColumns:sandboxOnly,
       changedColumns:altered,rlsDifferent,liveRls:a.rls,sandboxRls:b.rls,
       policyDifferent,livePolicyCount:a.policy_count,sandboxPolicyCount:b.policy_count,
       indexDifferent,liveIndexCount:a.index_count,sandboxIndexCount:b.index_count});
 }
 return differences.sort((a,b)=>a.table.localeCompare(b.table));
}
function rpcDifferences(){
 const id=f=>f.function_name+"("+f.arguments+")";
 const l=new Map(db.environment.live.publicFunctions.map(f=>[id(f),f]));
 const s=new Map(db.environment.sandbox.publicFunctions.map(f=>[id(f),f]));
 return [...new Set([...l.keys(),...s.keys()])].sort().flatMap(name=>{
  const a=l.get(name),b=s.get(name);
  if(!a||!b)return [{signature:name,status:a?"live_only":"sandbox_only"}];
  if(a.definition_hash!==b.definition_hash||a.security_definer!==b.security_definer)
    return [{signature:name,status:"different_definition"}];
  return [];
 });
}
function moduleFiles(moduleId,modules){
 if(!moduleId)return null;
 const rule=modules.find(m=>m.id===moduleId);
 if(!rule)throw Error("Unknown module for environment comparison.");
 const files=new Set([...rule.source,...rule.ui,...rule.tests].map(x=>x[0]));
 for(const name of ENV_MODULE_EXTRAS[moduleId]||[])files.add(name);
 return files;
}
function buildEnvironmentAudit({mode="compare",moduleId=null,modules=[]}={}){
 safeMode(mode);validSnapshots();
 if(!Array.isArray(modules)||!modules.length)throw Error("Module catalog required.");
 const rule=moduleId===null?null:modules.find(m=>m.id===moduleId);
 if(moduleId!==null&&!rule)throw Error("Unknown approved module.");
 const tables=rule?rule.tables:null,onlyFiles=moduleFiles(moduleId,modules);
 const changed=deployments.githubComparison.changedFiles;
 const codeRelevant=onlyFiles?changed.filter(f=>onlyFiles.has(f.path)):changed;
 const auditedAll=tableDifferences(null);
 const selectedDiff=tableDifferences(tables);
 const allRpcs=rpcDifferences();
 return {
  version:1,selected:mode,scope:moduleId||"all",
  capturedOn:db.capturedOn,freshDatabaseQuery:false,freshDeploymentQuery:false,
  sourceInspection:"preview_reference_only",
  live:mode==="sandbox"?null:projectSnapshot("live",tables),
  sandbox:mode==="live"?null:projectSnapshot("sandbox",tables),
  compare:mode==="compare"?{
   source:{githubStatus:deployments.githubComparison.status,
     commitsAhead:deployments.githubComparison.aheadBy,
     commitsBehind:deployments.githubComparison.behindBy,
     totalChangedFiles:changed.length,
     relevantChangedFiles:codeRelevant.map(f=>({path:f.path,status:f.status,
       additions:f.additions,deletions:f.deletions})),
   },
   database:{totalDifferentTables:auditedAll.length,selectedDifferentTables:selectedDiff,
     totalDifferentFunctions:allRpcs.length,
     functionDifferences:allRpcs,
   },
  }:null,
  functionalTests:{live:"not_run",sandbox:"not_run"},
  safety:{readOnly:true,liveModified:false,sandboxModified:false,
    paymentsAttempted:false,automaticRepairsEnabled:false},
  notes:[
   "Both deployments and both databases were sampled independently on the recorded date; pressing Scan does not refresh either target.",
   "Green source/UI/test markers elsewhere in this report come from the protected Build Lab preview source, NOT from an authenticated browser visit to either target deployment.",
   "A changed file or security-policy hash is evidence to review, not proof of a defect or security vulnerability.",
   "No Live or Sandbox functional browser test has run as part of this Master Scanner. No edits, registration actions or financial transactions are enabled.",
  ],
 };
}
module.exports={MODES,buildEnvironmentAudit,tableDifferences,rpcDifferences};

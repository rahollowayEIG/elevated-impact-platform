// Read-only, opt-in evidence runner. It never targets a live application or writes to Supabase.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const targets=Object.freeze([
 {id:'registration-roster-numbering',module:'registration',file:'tests/roster-numbering.test.mjs',kind:'unit'},
 {id:'payments-calculations',module:'payments',file:'tests/team-payment-cart.test.mjs',kind:'unit'},
 {id:'accounts-recovery',module:'accounts',file:'tests/recovery-session.test.mjs',kind:'unit'},
]);
export function runRuntimeEvidence({cwd=process.cwd(),commit=process.env.GITHUB_SHA||null,now=()=>new Date().toISOString(),spawn=spawnSync}={}){
 const startedAt=now();
 const checks=targets.map(target=>{
  const t0=Date.now();
  const result=spawn(process.execPath,['--test',target.file],{cwd,encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024,env:{...process.env,CI:'true'}});
  return {...target,status:result.error||result.signal?'error':result.status===0?'passed':'failed',exitCode:Number.isInteger(result.status)?result.status:null,durationMs:Date.now()-t0,executed:true,verifiedBrowserBehavior:false};
 });
 return {kind:'eig_build_lab_executed_checks',version:1,source:'local_or_ci_node_unit_tests',commit,startedAt,finishedAt:now(),environment:'isolated_source_tests',scope:['registration','payments','accounts'],checks,
  limitations:['Test executions are unit checks and do not prove browser workflow, production or Sandbox behavior.','No real invitations, charges, accounts or customer data were used.','No secrets or raw test logs are exported.']};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const output=runRuntimeEvidence();
 const destination=resolve('artifacts/build-lab-executed-checks.json');
 mkdirSync(resolve('artifacts'),{recursive:true});
 writeFileSync(destination,JSON.stringify(output,null,2));
 console.log('Evidence file: '+destination+'; '+output.checks.filter(c=>c.status==='passed').length+'/'+output.checks.length+' checks passed');
 if(output.checks.some(c=>c.status!=='passed'))process.exitCode=1;
}

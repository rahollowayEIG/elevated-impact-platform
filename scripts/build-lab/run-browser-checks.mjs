// Isolated browser regression evidence. Never point these tests at production.
// Tests operate on repository fixtures with mocked network responses.
import {spawnSync,spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const checks=[
 {id:'accounts-security-ui',module:'accounts',file:'tests/account-security-browser.cjs',fixture:'local_vite_harness'},
 {id:'registration-event-inquiry-account',module:'registration',file:'tests/event-inquiry-browser.cjs',fixture:'local_vite_harness'}
];
export function summarizeBrowserResult(target,result,durationMs){
 return {...target,executed:true,verifiedBrowserBehavior:result.status===0&&!result.error&&!result.signal,
 status:result.error||result.signal?'error':result.status===0?'passed':'failed',exitCode:Number.isInteger(result.status)?result.status:null,durationMs};
}
export async function runBrowserEvidence({cwd=process.cwd(),commit=process.env.GITHUB_SHA||null,now=()=>new Date().toISOString()}={}){
 const startedAt=now();const results=[];
 for(const item of checks){
  let server=null;let outcome;
  try {
   if(item.id==='accounts-security-ui'){
    server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4198','--strictPort'],{cwd,stdio:'ignore',env:{...process.env,CI:'true'}});
    // The Playwright test waits for its own fixture; delay only until localhost responds.
    let listening=false;
    for(let attempt=0;attempt<70;attempt++){
     if(server.exitCode!==null)break;
     try{const r=await fetch('http://127.0.0.1:4198/tests/account-security.html',{signal:AbortSignal.timeout(500)});if(r.ok){listening=true;break;}}catch{}
     await new Promise(resolve=>setTimeout(resolve,200));
    }
    if(!listening)throw Error('Fixture server unavailable');
   }
   const begin=Date.now();
   const processResult=spawnSync(process.execPath,[item.file],{cwd,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,env:{...process.env,CI:'true'}});
   outcome=summarizeBrowserResult(item,processResult,Date.now()-begin);
  }catch{outcome={...item,executed:false,verifiedBrowserBehavior:false,status:'error',exitCode:null,durationMs:0};}
  finally{if(server&&server.exitCode===null){server.kill('SIGTERM');}}
  results.push(outcome);
 }
 return {kind:'eig_build_lab_executed_browser_checks',version:1,commit,startedAt,finishedAt:now(),environment:'local_fixture_only',checks:results,
  limitations:['Tests use synthetic browser fixtures, not deployed Live or Sandbox customer flows.','Accounts and registration checks do not prove roster claim, split payment or database persistence.','No raw browser logs, secrets or PII are exported.']};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const evidence=await runBrowserEvidence();mkdirSync(resolve('artifacts'),{recursive:true});writeFileSync(resolve('artifacts/build-lab-browser-checks.json'),JSON.stringify(evidence,null,2));
 console.log('Isolated browser checks: '+evidence.checks.filter(c=>c.status==='passed').length+'/'+evidence.checks.length+' passed');
 if(evidence.checks.some(c=>c.status!=='passed'))process.exitCode=1;
}

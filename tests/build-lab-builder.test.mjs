import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {prepareInceptionPilotBlueprint} from '../src/lib/buildLabInceptionPilot.mjs';
import {reviewManagerProposal,assignManagerProposal,approveManagerBlueprint} from '../src/lib/buildLabMissionOrchestrator.mjs';
import {requestBuilderCandidate} from '../src/lib/buildLabBuilderClient.mjs';
const require=createRequire(import.meta.url);
const {createBuilder,buildRequest}=require('../server/eig-build-lab-builder.cjs');
const {candidateFor,sealCandidate,openCandidate,verifySources,applyEdits}=require('../server/build-lab-builder-contract.cjs');
const {applyCandidate}=require('../scripts/build-lab-builder-worker.cjs');
const {readAllowlistedInceptionSource,scanInceptionSource,FILE_PATHS}=require('../server/eig-inception-source-scan.cjs');
const version='a'.repeat(40),owner='11111111-1111-4111-8111-111111111111',key='test-signing-key-'.repeat(3),now=1792639000000;
const sources=readAllowlistedInceptionSource(),report=scanInceptionSource(sources,version);
const css='src/components/inception-apex.css';
const edit={path:css,before:sources[css].slice(0,80),after:'/* bounded test fixture */\n'+sources[css].slice(0,80)};
const model={status:'candidate',summary:'A synthetic edit for worker contract verification only.',edits:[edit]};
function plan(){
 const entry={id:'builder-test',type:'inspector',scope:'inception',source:version,savedAt:new Date(now).toISOString(),snapshot:{report,reviews:{}}};
 let p=prepareInceptionPilotBlueprint(entry,'ia-form-focus');
 p=assignManagerProposal(p,'proposal-1','fixer');
 return approveManagerBlueprint(reviewManagerProposal(p,'proposal-1','accept'));
}
const envs={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/build-lab-orchestrator-20261020',EIG_BUILD_LAB_PREVIEW_BRANCH:'feature/build-lab-orchestrator-20261020',EIG_BUILD_LAB_ACCESS_ENABLED:'true',EIG_BUILD_LAB_OWNER_USER_ID:owner,EIG_BUILD_LAB_BUILDER_ENABLED:'true',VERCEL_GIT_COMMIT_SHA:version,OPENAI_API_KEY:'test-key',EIG_BUILD_LAB_BUILDER_SIGNING_KEY:key};
const request=body=>({method:'POST',headers:{origin:'https://preview.test',host:'preview.test',authorization:'Bearer fake-token'},body:body||{blueprint:plan(),shareSourceWithOpenAI:true}});
function response(){return {setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};}
function handler({values={},user=owner,memberships=[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'}}],provider=model,onRead=()=>{},onCall=()=>{}}={}){return createBuilder({env:k=>({...envs,...values})[k],now:()=>now,verifyUser:async()=>({id:user}),membershipsForUser:async()=>({data:memberships}),readSources:()=>{onRead();return sources;},http:async(url,options)=>{onCall(url,options);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(provider)}]}]})};}});}
const candidate=()=>candidateFor({proposal:model,sources,sourceVersion:version,findingId:'ia-form-focus',instruction:'Verify visible field focus.',now});
test('owner-reviewed source -> bounded provider call -> signed untested candidate -> isolated apply and rescan',async()=>{
 let calls=0;
 const res=response();await handler({onCall:(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.deepEqual(body.tools,[]);assert.equal(body.max_output_tokens,8000);assert.equal(Object.keys(JSON.parse(body.input[1].content).SOURCE).length,4);}})(request(),res);
 assert.equal(res.code,200);assert.equal(calls,1);assert.equal(res.body.result.testsRun,false);
 const c=openCandidate(res.body.result.bundle,key,now);
 assert.equal(c.sourceFingerprint,report.sourceFingerprint);
 const root=mkdtempSync(path.join(tmpdir(),'builder-worker-'));
 try{for(const p of FILE_PATHS){mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),sources[p]);}
  const scans=applyCandidate(c,root,version);
  assert.notEqual(scans.before.sourceFingerprint,scans.after.sourceFingerprint);
  assert.equal(readFileSync(path.join(root,css),'utf8').startsWith('/* bounded test fixture */'),true);
  assert.equal(readFileSync(path.join(root,'tests/inception-apex-browser.cjs'),'utf8'),sources['tests/inception-apex-browser.cjs']);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('wrong owner, inactive membership, expired access, wrong branch/origin/method fail before source or provider access',async()=>{
 for(const override of [{user:'22222222-2222-4222-8222-222222222222'},{memberships:[]},{memberships:[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'},access_ends_at:'2020-01-01'}]},{values:{VERCEL_ENV:'production'}},{values:{VERCEL_GIT_COMMIT_REF:'main'}}]){
  let touched=0;const res=response();await handler({...override,onRead:()=>touched++,onCall:()=>touched++})(request(),res);assert.equal(res.code,403);assert.equal(touched,0);
 }
 for(const change of [{method:'GET'},{headers:{origin:'https://evil.test',host:'preview.test',authorization:'Bearer fake'}}]){let touched=0;const res=response();await handler({onRead:()=>touched++})({...request(),...change},res);assert.ok([403,405].includes(res.code));assert.equal(touched,0);}
});
test('default-off, missing signing/provider configuration and missing consent cannot call provider',async()=>{
 for(const values of [{EIG_BUILD_LAB_BUILDER_ENABLED:undefined},{EIG_BUILD_LAB_BUILDER_SIGNING_KEY:''},{OPENAI_API_KEY:''}]){let calls=0;const res=response();await handler({values,onCall:()=>calls++})(request(),res);assert.equal(res.code,503);assert.equal(calls,0);}
 let calls=0;const res=response();await handler({onCall:()=>calls++})(request({blueprint:plan(),shareSourceWithOpenAI:false}),res);assert.equal(res.code,400);assert.equal(calls,0);
});
test('unapproved, stale, mismatched and research plans cannot start generation',async()=>{
 const variants=[];
 let p=plan();p.status='owner_review_required';variants.push(p);
 p=plan();p.pilot.sourceFingerprint='b'.repeat(64);variants.push(p);
 p=plan();p.pilot.sourceVersion='b'.repeat(40);variants.push(p);
 p=plan();p.proposals[0].assignedTo='researcher';variants.push(p);
 for(const blueprint of variants){let calls=0;const res=response();await handler({onCall:()=>calls++})(request({blueprint,shareSourceWithOpenAI:true}),res);assert.equal(res.code,409);assert.equal(calls,0);}
});
test('provider may block without fabricating a change or claiming tests passed',async()=>{
 const res=response();await handler({provider:{status:'blocked',summary:'Browser reproduction is needed before a source change.',edits:[]}})(request(),res);assert.equal(res.code,200);assert.equal(res.body.result.status,'blocked');assert.equal(res.body.result.bundle,undefined);
});
test('path traversal, test edits, ambiguous replacements, no-ops and oversized edits are refused',()=>{
 for(const edits of [[{...edit,path:'../../.env'}],[{...edit,path:'tests/inception-apex-browser.cjs'}],[{...edit,before:'not present'}],[{...edit,before:' '}],[{...edit,after:edit.before}],[{...edit,after:'x'.repeat(12001)}]])assert.throws(()=>applyEdits(sources,edits));
 assert.throws(()=>applyEdits({...sources,[css]:'same same'},[{path:css,before:'same',after:'other'}]),/exactly once/);
});
test('signature forgery, tampering, expiration and changed sources fail closed',()=>{
 const c=candidate(),sealed=sealCandidate(c,key);
 assert.throws(()=>openCandidate({...sealed,payload:sealed.payload+' '},key,now));
 assert.throws(()=>openCandidate(sealed,'other-key'.repeat(6),now));
 assert.throws(()=>openCandidate(sealed,key,now+1800000));
 assert.throws(()=>verifySources(c,{...sources,[css]:sources[css]+'\n'},version));
 assert.throws(()=>verifySources(c,sources,'b'.repeat(40)));
 assert.throws(()=>sealCandidate(c,'short'));
});
test('provider schema rejects unsupported paths instead of returning signed executable edits',async()=>{
 const res=response();await handler({provider:{...model,edits:[{...edit,path:'api/eig-build-lab-access.js'}]}})(request(),res);assert.equal(res.code,502);assert.equal(res.body.result,undefined);
});
test('worker rejects symlinks without writing outside the checkout',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'builder-worker-link-'));
 try{for(const p of FILE_PATHS){mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),sources[p]);}
  rmSync(path.join(root,css));symlinkSync(path.join(root,'tests/inception-apex-browser.cjs'),path.join(root,css));
  assert.throws(()=>applyCandidate(candidate(),root,version),/Regular source files/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('browser client requires consent/session and distinguishes blocked from untested candidate',async()=>{
 const client={auth:{getSession:async()=>({data:{session:{access_token:'fake'}}})}};
 await assert.rejects(()=>requestBuilderCandidate(client,plan(),false),/Confirm/);
 await assert.rejects(()=>requestBuilderCandidate({},plan(),true),/Sign in/);
 const result=await requestBuilderCandidate(client,plan(),true,async(url,options)=>{assert.equal(url,'/api/eig-build-lab-builder');assert.equal(options.cache,'no-store');return {ok:true,json:async()=>({ok:true,result:{status:'blocked',summary:'A browser reproduction is needed.'}})};});assert.equal(result.status,'blocked');
 await assert.rejects(()=>requestBuilderCandidate(client,plan(),true,async()=>({ok:true,json:async()=>({ok:true,result:{status:'unverified_candidate',summary:'Invented pass',testsRun:true}})})),/Invalid/);
});
test('revoked owner membership during generation prevents a signed handoff',async()=>{
 let checks=0;
 const h=createBuilder({env:k=>envs[k],now:()=>now,verifyUser:async()=>({id:owner}),membershipsForUser:async()=>({data:++checks===1?[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'}}]:[]}),readSources:()=>sources,http:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(model)}]}]})})});
 const res=response();await h(request(),res);assert.equal(res.code,403);assert.equal(res.body.result,undefined);
});
test('worker CLI validates a signed packet, applies it, and records failed/skipped verification honestly',async()=>{
 const {execFileSync}=await import('node:child_process');
 const root=mkdtempSync(path.join(tmpdir(),'builder-cli-'));
 const script=path.resolve('scripts/build-lab-builder-worker.cjs');
 try{
  for(const p of FILE_PATHS){mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),sources[p]);}
  execFileSync('git',['init','-q'],{cwd:root});
  execFileSync('git',['add','.'],{cwd:root});
  execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Synthetic source fixture'],{cwd:root});
  const fixtureVersion=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const c=candidateFor({proposal:model,sources,sourceVersion:fixtureVersion,findingId:'ia-form-focus',instruction:'Synthetic worker lifecycle fixture.',now:Date.now()});
  const output=path.join(root,'github-output');
  execFileSync(process.execPath,[script,'validate'],{cwd:root,env:{...process.env,BUILDER_CANDIDATE:JSON.stringify(sealCandidate(c,key)),BUILDER_SIGNING_KEY:key,GITHUB_OUTPUT:output}});
  assert.match(readFileSync(output,'utf8'),new RegExp('source_version='+fixtureVersion));
  execFileSync(process.execPath,[script,'apply'],{cwd:root});
  assert.match(readFileSync(path.join(root,'test-results/build-lab-builder/candidate.patch'),'utf8'),/bounded test fixture/);
  assert.throws(()=>execFileSync(process.execPath,[script,'report'],{cwd:root,env:{...process.env,BUILDER_TEST_STATUS:'failure',BUILDER_CHROMIUM_RESULT:'failure',BUILDER_FIREFOX_RESULT:'skipped',BUILDER_WEBKIT_RESULT:'skipped'},stdio:'pipe'}));
  const result=JSON.parse(readFileSync(path.join(root,'test-results/build-lab-builder/result.json'),'utf8'));
  assert.equal(result.status,'verification_failed');assert.equal(result.testsPassed,false);assert.equal(result.browserResults.firefox,'skipped');assert.equal(result.selectedFindingStillPresent,true);assert.equal(result.autoMerged,false);
 }finally{rmSync(root,{recursive:true,force:true});}
});

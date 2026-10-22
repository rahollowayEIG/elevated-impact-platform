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
const {candidateFor,attachSourceReview,sealCandidate,openCandidate,verifySources,applyEdits}=require('../server/build-lab-builder-contract.cjs');
const {applyCandidate}=require('../scripts/build-lab-builder-worker.cjs');
const {readAllowlistedInceptionSource,scanInceptionSource,FILE_PATHS}=require('../server/eig-inception-source-scan.cjs');
const version='a'.repeat(40),owner='11111111-1111-4111-8111-111111111111',key='test-signing-key-'.repeat(3),now=1792639000000;
const sources=readAllowlistedInceptionSource(),report=scanInceptionSource(sources,version);
const css='src/components/inception-apex.css';
const edit={path:css,before:'max-width: 1400px;',after:'max-width: 1399px;'};
const sourceReview={verdict:'pass',summary:'Synthetic source-review fixture; no real correctness claim.',requirements:[{requirement:'Exercise a bounded CSS change',evidence:'src/components/inception-apex.css changes max-width from 1400px to 1399px.',met:true}],unresolved:[]};
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
function handler({values={},user=owner,memberships=[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'}}],provider=model,review=sourceReview,log=()=>{},onRead=()=>{},onCall=()=>{}}={}){return createBuilder({log,env:k=>({...envs,...values})[k],now:()=>now,verifyUser:async()=>({id:user}),membershipsForUser:async()=>({data:memberships}),readSources:()=>{onRead();return sources;},http:async(url,options)=>{onCall(url,options);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(JSON.parse(options.body).text.format.name==='ia_builder_source_review'?review:provider)}]}]})};}});}
const candidate=()=>attachSourceReview(candidateFor({proposal:model,sources,sourceVersion:version,findingId:'ia-form-focus',instruction:'Verify visible field focus.',now}),sourceReview);
test('owner-reviewed source -> bounded provider call -> signed untested candidate -> isolated apply and rescan',async()=>{
 let calls=0;
 const res=response();await handler({onCall:(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.deepEqual(body.tools,[]);assert.ok([4000,8000].includes(body.max_output_tokens));assert.equal(Object.keys(JSON.parse(body.input[1].content).SOURCE).length,4);}})(request(),res);
 assert.equal(res.code,200);assert.equal(calls,2);assert.equal(res.body.result.testsRun,false);
 const c=openCandidate(res.body.result.bundle,key,now);
 assert.equal(c.sourceFingerprint,report.sourceFingerprint);
 const root=mkdtempSync(path.join(tmpdir(),'builder-worker-'));
 try{for(const p of FILE_PATHS){mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),sources[p]);}
  const scans=applyCandidate(c,root,version);
  assert.notEqual(scans.before.sourceFingerprint,scans.after.sourceFingerprint);
  assert.equal(scans.after.sourceVersion,'local-unversioned');
  assert.equal(readFileSync(path.join(root,css),'utf8').includes('max-width: 1399px;'),true);
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
  const c=attachSourceReview(candidateFor({proposal:model,sources,sourceVersion:fixtureVersion,findingId:'ia-form-focus',instruction:'Synthetic worker lifecycle fixture.',now:Date.now()}),sourceReview);
  const output=path.join(root,'github-output');
  execFileSync(process.execPath,[script,'validate'],{cwd:root,env:{...process.env,BUILDER_CANDIDATE:JSON.stringify(sealCandidate(c,key)),BUILDER_SIGNING_KEY:key,GITHUB_OUTPUT:output}});
  assert.match(readFileSync(output,'utf8'),new RegExp('source_version='+fixtureVersion));
  execFileSync(process.execPath,[script,'apply'],{cwd:root});
  assert.match(readFileSync(path.join(root,'test-results/build-lab-builder/candidate.patch'),'utf8'),/1399px/);
  assert.throws(()=>execFileSync(process.execPath,[script,'report'],{cwd:root,env:{...process.env,BUILDER_TEST_STATUS:'failure',BUILDER_CHROMIUM_RESULT:'failure',BUILDER_FIREFOX_RESULT:'skipped',BUILDER_WEBKIT_RESULT:'skipped'},stdio:'pipe'}));
  const result=JSON.parse(readFileSync(path.join(root,'test-results/build-lab-builder/result.json'),'utf8'));
  assert.equal(result.status,'verification_failed');assert.equal(result.testsPassed,false);assert.equal(result.browserResults.firefox,'skipped');assert.equal(result.selectedFindingStillPresent,true);assert.equal(result.autoMerged,false);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('the rejected native-confirm stub and unfinished placeholders cannot become signed candidates',()=>{
 const ia='src/components/InceptionApex.jsx';
 const call=sources[ia].match(/window\.confirm\([\s\S]*?\)/)[0];
 for(const after of ['// Stub: implement an accessible confirmation later.\n'+call,'/* TODO: replace native dialog */\n'+call,call.replace('window.confirm','window . confirm')]){
  const result=candidateFor({proposal:{status:'candidate',summary:'Claims to replace the dialog, but leaves native confirmation.',edits:[{path:ia,before:call,after}]},sources,sourceVersion:version,findingId:'ia-native-confirm',instruction:'Replace native confirmation with an accessible in-app dialog.',now});
  assert.equal(result.status,'blocked');assert.equal(result.sourceReview,undefined);assert.throws(()=>sealCandidate(result,key));
 }
 const stub={...model,edits:[{...edit,after:edit.after+' /* placeholder implementation */'}]};
 assert.equal(candidateFor({proposal:stub,sources,sourceVersion:version,findingId:'ia-form-focus',instruction:'A real change.',now}).status,'blocked');
});
test('separate reviewer rejection, unmet criteria and unresolved issues produce no signed bundle',async()=>{
 for(const review of [{...sourceReview,verdict:'reject',summary:'The change does not implement the requested behavior.'},{...sourceReview,requirements:[{...sourceReview.requirements[0],met:false}]},{...sourceReview,unresolved:['Cancellation behavior is not implemented.']}]){
  let calls=0;const res=response();await handler({review,onCall:()=>calls++})(request(),res);
  assert.equal(calls,2);assert.equal(res.code,200);assert.equal(res.body.result.status,'blocked');assert.equal(res.body.result.bundle,undefined);
 }
 for(const review of [{...sourceReview,requirements:[]},{...sourceReview,requirements:[{...sourceReview.requirements[0],evidence:''}]},{...sourceReview,verdict:'unknown'}]){
  const res=response();await handler({review})(request(),res);assert.equal(res.code,502);assert.equal(res.body.result,undefined);
 }
 const unsigned=candidateFor({proposal:model,sources,sourceVersion:version,findingId:'ia-form-focus',instruction:'Synthetic fixture.',now});
 assert.throws(()=>sealCandidate(unsigned,key),/source review/);
});
test('revised owner requirement survives accept, approval and both provider calls with one shared deadline',async()=>{
 const requirement='Replace the native browser confirmation with a complete accessible dialog; preserve cancel, continue and unsaved changes.';
 let blueprint=reviewManagerProposal(plan(),'proposal-1','revise',requirement);
 blueprint=approveManagerBlueprint(reviewManagerProposal(blueprint,'proposal-1','accept'));
 let calls=0,signal;
 const res=response();await handler({onCall:(url,options)=>{
  const body=JSON.parse(options.body),input=JSON.parse(body.input[1].content);
  calls++;assert.equal(input.ownerRequirement,requirement);assert.equal(body.store,false);assert.deepEqual(body.tools,[]);
  if(calls===1){signal=options.signal;assert.equal(input.PROPOSED_SOURCE,undefined);}
  else{assert.equal(options.signal,signal);assert.match(input.PROPOSED_SOURCE[css],/1399px/);assert.equal(input.summary,undefined);}
 }})(request({blueprint,shareSourceWithOpenAI:true}),res);
 assert.equal(res.code,200);assert.equal(calls,2);assert.equal(openCandidate(res.body.result.bundle,key,now).instruction,requirement);
 assert.deepEqual(res.body.result.sourceReview,sourceReview);
});
test('review provider failure and membership revocation after review fail closed',async()=>{
 for(const scenario of ['review-failure','revoked-after-review']){
  let calls=0,checks=0;
  const h=createBuilder({env:k=>envs[k],now:()=>now,verifyUser:async()=>({id:owner}),membershipsForUser:async()=>({data:++checks===3&&scenario==='revoked-after-review'?[]:[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'}}]}),readSources:()=>sources,http:async()=>{
   calls++;if(calls===2&&scenario==='review-failure')return {ok:false};
   return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(calls===1?model:sourceReview)}]}]})};
  }});
  const res=response();await h(request(),res);assert.equal(calls,2);assert.equal(res.code,scenario==='review-failure'?502:403);assert.equal(res.body.result,undefined);
 }
});

test('one approved IA item in a normal stacked blueprint can generate while held items remain untouched',async()=>{
 const {stackScanBlueprint,selectBuilderProposal}=await import('../src/lib/buildLabManagerBlueprint.mjs');
 const entry={id:'stacked-ia',type:'inspector',scope:'inception-apex',source:version,savedAt:new Date(now).toISOString(),snapshot:{report,reviews:{}}};
 let blueprint=stackScanBlueprint([entry]);
 const selectedId=blueprint.proposals.find(p=>p.sourceRefs[0].itemId==='ia-form-focus').id;
 for(const p of blueprint.proposals)blueprint=reviewManagerProposal(blueprint,p.id,p.id===selectedId?'revise':'hold',p.id===selectedId?'Investigate visible field focus without touching held work.':'');
 blueprint=assignManagerProposal(blueprint,selectedId,'fixer');
 // Ensure neither UI nor server accidentally selects the first proposal.
 blueprint.proposals.sort((a,b)=>Number(a.id===selectedId)-Number(b.id===selectedId));
 blueprint=approveManagerBlueprint(blueprint);
 assert.equal(blueprint.pilot,undefined);assert.ok(blueprint.proposals.length>1);
 assert.equal(selectBuilderProposal(blueprint).id,selectedId);
 let calls=0;const res=response();await handler({onCall:(url,options)=>{calls++;const input=JSON.parse(JSON.parse(options.body).input[1].content);assert.equal(input.finding.id,'ia-form-focus');assert.equal(input.ownerRequirement,'Investigate visible field focus without touching held work.');}})(request({blueprint,shareSourceWithOpenAI:true}),res);
 assert.equal(res.code,200);assert.equal(calls,2);assert.equal(openCandidate(res.body.result.bundle,key,now).findingId,'ia-form-focus');
 assert.equal(blueprint.proposals.filter(p=>p.decision==='hold').length,blueprint.proposals.length-1);
 for(const change of ['two-active','non-IA','mixed-id','stale','invented','preserved']){
  const bad=structuredClone(blueprint),p=bad.proposals.find(p=>p.id===selectedId);
  if(change==='two-active')bad.proposals.find(p=>p.id!==selectedId).decision='accept';
  if(change==='non-IA')p.sourceRefs[0].type='master';
  if(change==='mixed-id')p.sourceRefs.push({...p.sourceRefs[0],itemId:'ia-native-confirm'});
  if(change==='stale')p.sourceRefs[0].sourceVersion='b'.repeat(40);
  if(change==='invented')p.sourceRefs[0].itemId='invented';
  if(change==='preserved')p.sourceRefs[0].itemId=report.findings.find(f=>f.findingType==='preserve_existing').id;
  let touched=0;const denied=response();await handler({onCall:()=>touched++})(request({blueprint:bad,shareSourceWithOpenAI:true}),denied);
  assert.equal(denied.code,409,change);assert.equal(touched,0,change);
 }
});

test('failure diagnostics distinguish provider, deadline, output and edit-validation failures without logging private data',async()=>{
 const privateText='PRIVATE_SOURCE_PROVIDER_BODY_DO_NOT_LOG';
 const completed=value=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
 const cases=[
  ['provider_quota','generation_provider',()=>({ok:false,status:429,json:async()=>({error:{code:'insufficient_quota',message:privateText}})})],
  ['provider_rate_limit','generation_provider',()=>({ok:false,status:429,json:async()=>({error:{message:privateText}})})],
  ['provider_configuration','generation_provider',()=>({ok:false,status:401,json:async()=>({error:{message:privateText}})})],
  ['provider_unavailable','generation_provider',()=>({ok:false,status:503,json:async()=>({error:{message:privateText}})})],
  ['provider_network','generation_provider',()=>{throw Error(privateText);}],
  ['provider_timeout','generation_provider',()=>{const e=Error(privateText);e.name='TimeoutError';throw e;}],
  ['provider_timeout','generation_response',()=>({ok:true,json:async()=>{const e=Error(privateText);e.name='AbortError';throw e;}})],
  ['provider_output_limit','generation_response',()=>({ok:true,json:async()=>({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},privateText})})],
  ['provider_incomplete','generation_response',()=>({ok:true,json:async()=>({status:'incomplete',privateText})})],
  ['response_json','generation_response',()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:privateText}]}]})})],
  ['candidate_edit_count','candidate_validation',()=>completed({...model,edits:Array(5).fill(edit)})],
  ['candidate_edit_match','candidate_validation',()=>completed({...model,edits:[{...edit,before:privateText}]})],
  ['candidate_edit_scope','candidate_validation',()=>completed({...model,edits:[{...edit,path:'../../private.env'}]})],
  ['review_format','source_review_validation',()=>completed({...sourceReview,requirements:[]}),true],
  ['provider_output_limit','source_review_response',()=>({ok:true,json:async()=>({status:'incomplete',incomplete_details:{reason:'max_output_tokens'}})}),true],
 ];
 for(const [code,stage,upstream,reviewFailure] of cases){
  const events=[];let calls=0;
  const h=createBuilder({env:k=>envs[k],now:()=>now,verifyUser:async()=>({id:owner}),membershipsForUser:async()=>({data:[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'}}]}),readSources:()=>sources,log:e=>events.push(e),http:async()=>{calls++;return reviewFailure&&calls===1?completed(model):upstream();}});
  const res=response();await h(request(),res);
  assert.equal(res.code,502,code);assert.equal(res.body.code,code);assert.equal(res.body.stage,stage);assert.equal(res.body.result,undefined);
  assert.equal(calls,reviewFailure?2:1);assert.match(res.body.reference,/^[a-f0-9-]{36}$/);assert.match(res.body.message,/No files were changed/);
  assert.equal(events.length,1);assert.equal(events[0].reference,res.body.reference);
  const serialized=JSON.stringify({body:res.body,events});
  for(const value of [privateText,'fake-token','test-key',key,sources[css],owner])assert.equal(serialized.includes(value),false,code+' private diagnostics');
  assert.ok(Object.keys(events[0]).every(k=>['event','reference','stage','code','providerStatus'].includes(k)));
  const client={auth:{getSession:async()=>({data:{session:{access_token:'fake'}}})}};
  await assert.rejects(()=>requestBuilderCandidate(client,plan(),true,async()=>({ok:false,json:async()=>res.body})),e=>e.message===res.body.message);
 }
 const body=buildRequest(sources,report.findings[0],'Owner requirement');
 const input=JSON.parse(body.input[1].content);assert.equal(input.editLimits.maxEdits,4);assert.equal(input.editLimits.maxBeforeCharacters,12000);assert.equal(input.editLimits.maxAfterCharacters,12000);
});

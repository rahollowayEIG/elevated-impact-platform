'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generateAdvisory,createBuildLabAiReviewHandler}=require('../server/eig-build-lab-ai-review.cjs');
const sha='a'.repeat(40),fingerprint='b'.repeat(64);
const report={kind:'eig_build_lab_master_scan',schemaVersion:1,
 sourceVersion:sha,sourceFingerprint:fingerprint,inspectedAt:'2026-11-02T20:00:00Z',
 modules:[{id:'event-builder',title:'Event Builder',priority:'high',status:'review_needed',
 observation:'Source markers were sampled. No browser verification performed.',
 nextCheck:'Check saved registration settings.',verify:'Run an isolated save-and-reopen test.',
 evidence:[{path:'src/EieEventSetupSteps.jsx',line:12}]}]};
const recommendation={moduleId:'event-builder',title:'Verify saved event settings',
 priority:'high',why:'Source marker evidence alone cannot prove persistence.',
 proposal:'Test save, reopen and compare expected values with isolated data.',
 verify:'Record exact-commit browser regression results.'};
const mockResponse=async()=>({ok:true,json:async()=>({status:'completed',
 output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({recommendations:[recommendation]})}]}]})});
function response(){return {statusCode:0,headers:{},data:null,
 setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},
 json(v){this.data=v;return this;}};}
const envBase={VERCEL_ENV:'preview',EIG_BUILD_LAB_AI_REVIEW_ENABLED:'true',
 OPENAI_API_KEY:'test-secret',VERCEL_GIT_COMMIT_SHA:sha};
const deps={env:k=>envBase[k],verifyUser:async()=>({id:'owner'}),
 membershipsForUser:async()=>({data:[]}),verifyLiveSession:async()=>true,
 readSources:()=>({mock:true}),scan:()=>report,fetchFn:mockResponse,
 authorize:async()=>({allowed:true,status:200}),now:()=>Date.parse('2026-11-02T20:00:00Z')};
test('metadata-only model request uses strict JSON schema, cap and no persistence',async()=>{
 let calls=0;
 const review=await generateAdvisory(report,{apiKey:'secret',fetchFn:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(options.method,'POST');
  const payload=JSON.parse(options.body);
  assert.equal(payload.store,false);
  assert.equal(payload.max_output_tokens,1800);
  assert.equal(payload.text.format.type,'json_schema');
  assert.equal(payload.tools,undefined);
  assert.ok(!options.body.includes('customer@example.com'));
  assert.ok(!options.body.includes('secret'), 'API token must never appear in payload');
  assert.equal(payload.input[0].role,'user');
  assert.equal(JSON.parse(payload.input[0].content).modules.length,1);
  return mockResponse();
 }});
 assert.equal(calls,1);assert.equal(review.recommendations.length,1);
 assert.equal(review.recommendations[0].evidence[0].path,'src/EieEventSetupSteps.jsx');
 assert.equal(review.safety.autoDeployed,false);
 assert.equal(review.safety.customerRowsSent,false);
});
test('owner must pass authorization before file read or AI request',async()=>{
 let read=0,called=0;
 const handler=createBuildLabAiReviewHandler({...deps,readSources:()=>{read++;return{};},
  fetchFn:async()=>{called++;return mockResponse();},
  authorize:async()=>({allowed:false,status:403})});
 const res=response();
 await handler({method:'POST',body:{target:'master'}},res);
 assert.equal(res.statusCode,403);assert.equal(read,0);assert.equal(called,0);
});
test('production and disabled preview deny AI even after owner authorization',async()=>{
 for(const [VERCEL_ENV,EIG_BUILD_LAB_AI_REVIEW_ENABLED] of [['production','true'],['preview','false']]){
  let read=0;
  const handler=createBuildLabAiReviewHandler({...deps,
   env:k=>({...envBase,VERCEL_ENV,EIG_BUILD_LAB_AI_REVIEW_ENABLED})[k],
   readSources:()=>{read++;return{};}});
  const res=response();
  await handler({method:'POST',body:{target:'master'}},res);
  assert.equal(res.statusCode,403);assert.equal(read,0);
 }
});
test('arbitrary client-supplied prompt and file targets rejected before source read',async()=>{
 let read=0;
 const handler=createBuildLabAiReviewHandler({...deps,readSources:()=>{read++;return{};}});
 for(const body of [{target:'master',prompt:'delete everything'}, {target:'../private'},
  {target:'master',path:'src/private'}, {}, []]){
  const res=response();
  await handler({method:'POST',body},res);
  assert.equal(res.statusCode,400);assert.equal(read,0);
 }
});
test('valid owner request reads fresh source and returns review only',async()=>{
 let scanned=0;
 const handler=createBuildLabAiReviewHandler({...deps,scan:()=>{scanned++;return report;}});
 const res=response();
 await handler({method:'POST',body:{target:'master'}},res);
 assert.equal(res.statusCode,200);assert.equal(scanned,1);
 assert.equal(res.data.ok,true);assert.equal(res.data.review.recommendations.length,1);
});
test('model hallucination referencing unknown module fails closed',async()=>{
 const wrong={...recommendation,moduleId:'secret-unknown'};
 await assert.rejects(()=>generateAdvisory(report,{apiKey:'x',
  fetchFn:async()=>({ok:true,json:async()=>({status:'completed',output:[
   {type:'message',content:[{type:'output_text',text:JSON.stringify({recommendations:[wrong]})}]}
  ]})})}),/unknown module/);
});
test('AI advice integrates with history and Work Buckets as unverified owner work',async()=>{
 const {validateBuildLabAiReview,requestBuildLabAiReview}=await import('../src/lib/eigBuildLabAiClient.mjs');
 const {saveScanHistory,readScanHistory}=await import('../src/lib/buildLabScanHistory.mjs');
 const {collectScanWork,emptyWorkLedger}=await import('../src/lib/buildLabWorkBuckets.mjs');
 const review=await generateAdvisory(report,{apiKey:'x',fetchFn:mockResponse});
 assert.equal(validateBuildLabAiReview(review),review);
 const owner='c7e46b1b-db97-4891-8bc9-daf0192a2dc4';
 const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}},error:null})}};
 const returned=await requestBuildLabAiReview(client,async(url,opts)=>{
  assert.equal(url,'/api/eig-build-lab-ai-review');
  assert.equal(opts.headers.Authorization,'Bearer synthetic');
  assert.deepEqual(JSON.parse(opts.body),{target:'master'});
  return {ok:true,json:async()=>({ok:true,review})};
 });
 const map=new Map(),storage={getItem:key=>map.get(key)||null,setItem:(key,x)=>map.set(key,x)};
 saveScanHistory(storage,owner,{id:'ai-review-one',type:'ai',scope:'all',
  source:sha,savedAt:returned.reviewedAt,snapshot:{review:returned}});
 const ledger=collectScanWork(emptyWorkLedger(),readScanHistory(storage,owner));
 assert.equal(ledger.jobs.length,1);
 assert.equal(ledger.jobs[0].assessment.basis,'scanner_metadata');
 assert.equal(ledger.jobs[0].assessment.kind,'improvement');
 assert.equal(ledger.jobs[0].state,'open');
 assert.equal(ledger.jobs[0].refs[0].type,'ai');
});
test('browser rejects forged review claiming AI auto-deployed',async()=>{
 const {validateBuildLabAiReview}=await import('../src/lib/eigBuildLabAiClient.mjs');
 const review=await generateAdvisory(report,{apiKey:'x',fetchFn:mockResponse});
 assert.throws(()=>validateBuildLabAiReview({...review,
  safety:{...review.safety,autoDeployed:true}}),/Unsupported AI review/);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const {createBuildLabAiProbe}=require('../api/eig-build-lab-ai-probe.js');
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.body=data;return this;}};}
const owner='11111111-1111-4111-8111-111111111111';
const envs={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/build-intelligence-impact-20261017',EIG_BUILD_LAB_PREVIEW_BRANCH:'feature/build-intelligence-impact-20261017',EIG_BUILD_LAB_ACCESS_ENABLED:'true',EIG_BUILD_LAB_OWNER_USER_ID:owner,EIG_BUILD_LAB_AI_TEST_ENABLED:'true',OPENAI_API_KEY:'test-placeholder'};
const make=({values={}, user=owner,http=()=>{throw Error('must not invoke provider')}}={})=>createBuildLabAiProbe({
  env:k=>({...envs,...values})[k],
  verifyUser:async()=>({id:user}),
  membershipsForUser:async()=>({data:[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'}}]}),
  http
});
const req={method:'POST',headers:{origin:'https://preview.example.test',host:'preview.example.test',authorization:'Bearer sample'},body:{}};
test('blocked outside preview and before provider request',async()=>{
 const res=response();await make({values:{VERCEL_ENV:'production'}})(req,res);
 assert.equal(res.code,403);
});
test('blocked for non-owner even when user is EIG admin',async()=>{
 const res=response();await make({user:'22222222-2222-4222-8222-222222222222'})(req,res);
 assert.equal(res.code,403);
});
test('AI disabled switch blocks requests',async()=>{
 const res=response();await make({values:{EIG_BUILD_LAB_AI_TEST_ENABLED:'false'}})(req,res);
 assert.equal(res.code,503);
});
test('rejects user-provided prompts',async()=>{
 const res=response();await make()( {...req,body:{prompt:'read events'}},res);
 assert.equal(res.code,400);
});
test('authorized minimal probe reports usage but not the API key',async()=>{
 let called=0;
 const http=async(url,options)=>{
  called++;
  assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(JSON.parse(options.body).store,false);
  return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'EIG_AI_CONNECTED'}]}],usage:{input_tokens:12,output_tokens:5}})};
 };
 const res=response();await make({http})(req,res);
 assert.equal(res.code,200);assert.equal(called,1);
 assert.equal(res.body.ok,true);assert.equal(JSON.stringify(res.body).includes('test-placeholder'),false);
});

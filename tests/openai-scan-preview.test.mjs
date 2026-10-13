import test from "node:test";
import assert from "node:assert/strict";
import { buildOpenAIRequest, parseOpenAIExtraction, validateTextPreviewInput } from "../supabase/functions/ai-scan-preview/provider.mjs";
import { createAiScanPreviewHandler } from "../supabase/functions/ai-scan-preview/handler.mjs";
const session = "33333333-3333-4333-8333-333333333333";
const token = `header.${Buffer.from(JSON.stringify({session_id:session})).toString("base64url")}.mock`;
const text = "Bistro menu: House Burger $12.50. Garden Salad $9.00. Drinks include black coffee $3.00.";
function response(candidates = [{
  recordKey:"dish1",recordType:"menu_item",field:"price",value:"$12.50",
  evidence:{locator:"Menu text",excerpt:"House Burger $12.50"}
}]) {
 return {status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify({candidates})}]}],usage:{input_tokens:51,output_tokens:20}};
}
function fixture(overrides={}) {
 const state={authorized:true,fresh:true,member:true,enabled:true,key:"secret-fixture",response:response(),status:200,calls:0,...overrides};
 const admin={
  auth:{getUser:async()=>state.authorized?{data:{user:{id:"admin"}}}:{error:true}},
  rpc:async(name,args)=> {
   assert.equal(name,"platform_assert_active_admin");
   assert.equal(args.p_actor_session_id,session);
   return {error:state.fresh?null:true};
  },
  from(table){
   assert.equal(table,"organization_memberships");
   const q={select(){return q},eq(){return q},then(done){return Promise.resolve({
    error:null,data:state.member?[{role:"eig_admin",status:"active",organization:{slug:"elevated-impact-group"}}]:[]
   }).then(done)}};
   return q;
  },
 };
 const env=(name)=>name==="OPENAI_API_KEY"?state.key:name==="OPENAI_SCAN_PREVIEW_ENABLED"?(state.enabled?"true":"false"):undefined;
 const http=async(url,options)=>{
  state.calls++;
  assert.equal(url,"https://api.openai.com/v1/responses");
  assert.equal(JSON.parse(options.body).store,false);
  return new Response(JSON.stringify(state.response),{status:state.status});
 };
 const handler=createAiScanPreviewHandler({admin,env,http});
 const send=async(body={target:"restaurant_menu",text},tokenOverride=token,origin="https://elevated-impact-platform.vercel.app")=>{
  const req=new Request("https://scan.test/",{method:"POST",headers:{
   "Content-Type":"application/json","Origin":origin,
   ...(tokenOverride?{Authorization:`Bearer ${tokenOverride}`}:{})
  },body:JSON.stringify(body)});
  const r=await handler(req);
  return {status:r.status,body:await r.json()};
 };
 return {state,send,handler};
}
test("provider uses fixed model, structured JSON, no tools or retained responses",()=>{
 const r=buildOpenAIRequest({target:"restaurant_menu",text});
 assert.equal(r.model,"gpt-4.1-mini");
 assert.equal(r.store,false);
 assert.deepEqual(r.tools,[]);
 assert.equal(r.text.format.strict,true);
 assert.throws(()=>validateTextPreviewInput({target:"venue_map",text}),/not enabled/);
});
test("unauthorized callers cannot spend provider credits",async()=>{
 for(const o of [{authorized:false},{fresh:false},{member:false},{enabled:false},{key:""}]){
  const f=fixture(o),r=await f.send();
  assert.ok([401,403,503].includes(r.status));
  assert.equal(f.state.calls,0);
 }
 const f=fixture();
 assert.equal((await f.send(undefined,"")).status,401);
 assert.equal((await f.send(undefined,"not-a-jwt")).status,403);
 assert.equal((await f.send(undefined,token,"https://attacker.example")).status,403);
 assert.equal(f.state.calls,0);
});
test("preview extracts evidence and explicitly does not persist or publish",async()=>{
 const f=fixture(),r=await f.send();
 assert.equal(r.status,200);
 assert.equal(r.body.stage,"needs_review");
 assert.equal(r.body.candidates[0].field,"price");
 assert.equal(r.body.candidates[0].confidence,null);
 assert.equal(r.body.persisted,false);
 assert.equal(r.body.preview_only,true);
 assert.equal(r.body.publication,"none");
 assert.equal(f.state.calls,1);
 assert.doesNotMatch(JSON.stringify(r.body),/secret-fixture/);
});
test("reject unsupported fields, invented source evidence, large text and unsupported target",async()=>{
 for(const bad of [
  {recordKey:"dish1",recordType:"menu_item",field:"owner_id",value:"bogus",evidence:{locator:"text",excerpt:"House Burger $12.50"}},
  {recordKey:"dish1",recordType:"menu_item",field:"price",value:"$8",evidence:{locator:"text",excerpt:"not actually quoted"}},
 ]){
  const f=fixture({response:response([bad])});
  assert.equal((await f.send()).status,422);
 }
 const f=fixture();
 assert.equal((await f.send({target:"venue_map",text})).status,400);
 assert.equal((await f.send({target:"restaurant_menu",text:"a".repeat(10000)})).status,413);
 assert.equal(f.state.calls,0);
});
test("provider errors stay generic and successful empty result remains unapproved",async()=>{
 const f=fixture({status:429,response:{error:{message:"secret-fixture"}}});
 const r=await f.send();
 assert.equal(r.status,503);
 assert.doesNotMatch(JSON.stringify(r.body),/secret-fixture/);
 const empty=fixture({response:response([])});
 const q=await empty.send();
 assert.equal(q.status,200);
 assert.equal(q.body.stage,"no_evidence");
 assert.deepEqual(q.body.candidates,[]);
});

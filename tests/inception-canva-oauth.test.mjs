import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createCanvaOAuthHandler} from "../supabase/functions/inception-canva-oauth/handler.mjs";

const actor="11111111-1111-4111-8111-111111111111",session="33333333-3333-4333-8333-333333333333",org="22222222-2222-4222-8222-222222222222";
const bearer="head."+Buffer.from(JSON.stringify({session_id:session})).toString("base64url")+".signature";
const origin="https://app.example.org", callback="https://example.supabase.co/functions/v1/inception-canva-oauth/callback";
function make({enabled=true,authorized=true,fresh=true}={}){
 const state={rows:[],connections:[],calls:[],guard:fresh,auth:authorized,now:Date.parse("2026-10-14T12:00:00Z"),membership:true,tokenOK:true,scopes:"asset:read asset:write brandtemplate:content:read brandtemplate:meta:read design:content:read design:content:write design:meta:read profile:read"};
 const admin={
  auth:{getUser:async()=>state.auth?{data:{user:{id:actor}}}:{error:{message:"no"}}},
  rpc:async()=>state.guard?{data:null,error:null}:{error:{message:"revoked"}},
  from(table){
   let filters=[],op="select",value,usedSelect=false;
   const q={
    select(){usedSelect=true;return q},
    eq(k,v){filters.push(r=>r[k]===v);return q},
    is(k,v){filters.push(r=>r[k]===v);return q},
    gt(k,v){filters.push(r=>r[k]>v);return q},
    delete(){op="delete";return q},
    update(x){op="update";value=x;return q},
    insert(x){op="insert";value=x;return q},
    upsert(x){op="upsert";value=x;return q},
    then(resolve,reject){return Promise.resolve().then(()=>{
     const rows=table==="inception_canva_oauth_states"?state.rows:table==="inception_canva_connections"?state.connections:table==="organization_memberships"?state.membership?[{organization_id:org,role:"eig_admin",status:"active",organization:{slug:"elevated-impact-group"}}]:[]:[];
     const filtered=rows.filter(r=>filters.every(f=>f(r)));
     if(op==="delete")filtered.forEach(r=>rows.splice(rows.indexOf(r),1));
     if(op==="insert")rows.push(value);
     if(op==="update")filtered.forEach(r=>Object.assign(r,value));
     if(op==="upsert"){const prev=rows.find(r=>r.actor_user_id===value.actor_user_id);if(prev)Object.assign(prev,value);else rows.push(value);}
     return {data:op==="update"&&usedSelect?filtered:rows,error:null};
    }).then(resolve,reject);}
   };return q;
  }
 };
 const env=name=>({INCEPTION_CANVA_OAUTH_ENABLED:enabled?"true":"false",INCEPTION_CANVA_APP_ORIGIN:origin,INCEPTION_CANVA_REDIRECT_URI:callback,CANVA_CLIENT_ID:"client-fixture",CANVA_CLIENT_SECRET:"secret-fixture",CANVA_OAUTH_ENCRYPTION_KEY:Buffer.alloc(32,7).toString("base64url")})[name];
 const http=async(url,options={})=>{state.calls.push({url,options});if(url.includes("/oauth/token"))return state.tokenOK?Response.json({access_token:"private-access",refresh_token:"private-refresh",expires_in:3600,token_type:"Bearer",scope:state.scopes}):new Response(null,{status:401});if(url.includes("/users/me"))return Response.json({team_user:{user_id:"canva-fixture",team_id:"team-fixture"}});return new Response(null,{status:500});};
 const handle=createCanvaOAuthHandler({admin,env,crypt:webcrypto,http,now:()=>state.now});
 const post=(withOrigin=origin,withAuth=bearer)=>handle(new Request("https://fixture/functions/v1/inception-canva-oauth/start",{method:"POST",headers:{"Origin":withOrigin,...(withAuth?{"Authorization":"Bearer "+withAuth}:{})}}));
 const cb=(stateParam,code="fixture-code")=>handle(new Request("https://fixture/functions/v1/inception-canva-oauth/callback?state="+encodeURIComponent(stateParam)+"&code="+encodeURIComponent(code)));
 return {state,post,cb,handle};
}
test("disabled by default, rejects missing bearer, foreign origin, revoked EIG access",async()=>{
 const off=make({enabled:false});assert.equal((await off.post()).status,503);
 const f=make();assert.equal((await f.post("https://evil.test")).status,403);assert.equal((await f.post(origin,null)).status,401);
 f.state.guard=false;assert.equal((await f.post()).status,403);assert.equal(f.state.rows.length,0);
});
test("start produces PKCE S256 authorization with one stored state and no browser token",async()=>{
 const f=make();const r=await f.post();assert.equal(r.status,200);
 const data=await r.json();const url=new URL(data.authorization_url);
 assert.equal(url.hostname,"www.canva.com");assert.equal(url.searchParams.get("code_challenge_method"),"S256");
 assert.equal(url.searchParams.get("redirect_uri"),callback);
 const state=url.searchParams.get("state");assert.equal(state.length,43);
 assert.equal(f.state.rows.length,1);assert.notEqual(f.state.rows[0].state_hash,state);
 assert.equal(f.state.rows[0].code_verifier.length,43);
 assert.doesNotMatch(JSON.stringify(data),/secret-fixture|private-refresh|Bearer /);
});
test("callback exchanges once and stores encrypted refresh token only for original account",async()=>{
 const f=make();const start=await (await f.post()).json(),st=new URL(start.authorization_url).searchParams.get("state");
 const r=await f.cb(st);assert.equal(r.status,200);assert.match(await r.text(),/connected to InceptionApex/);
 assert.equal(f.state.connections.length,1);assert.equal(f.state.connections[0].actor_user_id,actor);
 assert.equal(f.state.connections[0].organization_id,org);
 assert.match(f.state.connections[0].encrypted_refresh_token,/^v1\./);
 assert.doesNotMatch(f.state.connections[0].encrypted_refresh_token,/private-refresh/);
 const replay=await f.cb(st);assert.equal(replay.status,400);assert.equal(f.state.calls.length,2);
});
test("expired, canceled, denied scopes and revoked sessions fail without saving credentials",async()=>{
 const expired=make();const a=await (await expired.post()).json(),s=new URL(a.authorization_url).searchParams.get("state");
 expired.state.now+=601000;assert.equal((await expired.cb(s)).status,400);
 const denied=make();const d=await (await denied.post()).json(),v=new URL(d.authorization_url).searchParams.get("state");
 denied.state.scopes="profile:read";assert.equal((await denied.cb(v)).status,403);assert.equal(denied.state.connections.length,0);
 const revoked=make();const k=await (await revoked.post()).json(),z=new URL(k.authorization_url).searchParams.get("state");
 revoked.state.guard=false;assert.equal((await revoked.cb(z)).status,500);assert.equal(revoked.state.calls.length,0);
 const canceled=make();const y=await (await canceled.post()).json(),c=new URL(y.authorization_url).searchParams.get("state");
 assert.equal((await canceled.cb(c,"")).status,400);assert.equal(canceled.state.calls.length,0);
});

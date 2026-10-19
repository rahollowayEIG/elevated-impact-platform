import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import {claimSharedLogin, isPendingSharedLogin} from '../src/sandbox/sandboxSharedLogin.mjs';

const require = createRequire(import.meta.url);
const claim = require('../api/sandbox-sso/claim.js').__test;

const origin='https://elevationpilot-sandbox.vercel.app';
const locationLike={origin,pathname:'/',search:'?sandbox_sso=complete'};
const nonce=randomBytes(32).toString('base64url');
const uuid='00000000-0000-4000-8000-000000000005';
const user={id:uuid,email:'approved@example.test',email_confirmed_at:'2026-10-19T12:00:00Z',is_anonymous:false};

test('browser claim is disabled unless exact sandbox origin and completion marker',async()=>{
 const calls=[];
 const client={auth:{async setSession(tokens){calls.push(tokens);return {data:{session:{user:{id:uuid}}},error:null}}}};
 const fetcher=async()=>({ok:true,async json(){return {access_token:'sandbox-access',refresh_token:'sandbox-refresh'}}});
 assert.equal(isPendingSharedLogin(locationLike),true);
 assert.equal(isPendingSharedLogin({...locationLike,origin:'https://evil.test'}),false);
 assert.equal(isPendingSharedLogin({...locationLike,pathname:'/elsewhere'}),false);
 assert.equal(isPendingSharedLogin({...locationLike,search:'?other=true'}),false);
 assert.deepEqual(await claimSharedLogin(client,{enabled:false,locationLike,fetcher}),{ok:false});
 assert.deepEqual(await claimSharedLogin(client,{enabled:true,locationLike:{...locationLike,origin:'https://evil.test'},fetcher}),{ok:false});
 assert.equal(calls.length,0);
 assert.deepEqual(await claimSharedLogin(client,{enabled:true,locationLike,fetcher}),{ok:true});
 assert.deepEqual(calls,[{access_token:'sandbox-access',refresh_token:'sandbox-refresh'}]);
});

test('browser claim does not set session when server rejects or returns wrong shape',async()=>{
 let assigned=0;
 const client={auth:{async setSession(){assigned++;return {data:{session:true}}}}};
 const reject=async()=>({ok:false,async json(){return {access_token:'a',refresh_token:'r'}}});
 assert.deepEqual(await claimSharedLogin(client,{enabled:true,locationLike,fetcher:reject}),{ok:false});
 const invalid=async()=>({ok:true,async json(){return {access_token:'a'}}});
 assert.deepEqual(await claimSharedLogin(client,{enabled:true,locationLike,fetcher:invalid}),{ok:false});
 assert.equal(assigned,0);
});

test('claim cookie and same-origin header checks block CSRF',()=>{
 assert.equal(claim.readHandoffCookie('other=x; __Host-eig_sandbox_handoff='+nonce),nonce);
 assert.equal(claim.readHandoffCookie('__Host-eig_sandbox_handoff='+nonce+'; __Host-eig_sandbox_handoff='+nonce),null);
 assert.equal(claim.readHandoffCookie('__Host-eig_sandbox_handoff=invalid'),null);
 const cfg={origin};
 const good={method:'POST',headers:{host:'elevationpilot-sandbox.vercel.app',origin,
  'x-eig-sandbox-claim':'1','sec-fetch-site':'same-origin','content-type':'application/json'}};
 assert.equal(claim.allowClaimRequest(good,cfg),true);
 for(const p of [
   {method:'GET'}, {headers:{...good.headers,origin:'https://evil.test'}},
   {headers:{...good.headers,host:'elevated-impact-platform.vercel.app'}},
   {headers:{...good.headers,'x-eig-sandbox-claim':undefined}},
   {headers:{...good.headers,'sec-fetch-site':'cross-site'}},
   {headers:{...good.headers,'content-type':'text/plain'}},
 ]) assert.equal(claim.allowClaimRequest({...good,...p},cfg),false);
});

function mocks({wrongLink=false,roleAllowed=true,changedEmail=false}={}) {
 const calls=[];
 const admin={
   async rpc(name,args){calls.push(['rpc',name,args]);return {data:{authorized:roleAllowed,sandbox_user_id:uuid,email:user.email},error:null}},
   auth:{admin:{
     async getUserById(id){calls.push(['getUserById',id]);return {data:{user},error:null}},
     async generateLink(args){calls.push(['generateLink',args]);return {data:{
       user:{...user,id:wrongLink?'00000000-0000-4000-8000-000000000099':uuid},
       properties:{hashed_token:'sandbox-one-time-hash'}
     },error:null}}
   }}
 };
 const auth={auth:{
   async verifyOtp(args){calls.push(['verifyOtp',args]);return {data:{
     user:changedEmail?{...user,email:'other@example.test'}:user,
     session:{access_token:'sandbox-access',refresh_token:'sandbox-refresh'}
   },error:null}},
   async getUser(access){calls.push(['getUser',access]);return {data:{user},error:null}}
 }};
 return {calls,admin,auth};
}

test('approved single-use claim receives only an independent Sandbox session',async()=>{
 const fixture=mocks();
 const result=await claim.exchangeHandoffForSession(nonce,fixture.admin,fixture.auth);
 assert.deepEqual(result,{access_token:'sandbox-access',refresh_token:'sandbox-refresh'});
 assert.equal(fixture.calls[0][1],'sandbox_consume_federated_handoff');
 assert.equal(fixture.calls[1][0],'getUserById');
 assert.deepEqual(fixture.calls[2],[ 'generateLink', {type:'magiclink',email:user.email} ]);
 assert.deepEqual(fixture.calls[3],[ 'verifyOtp',{type:'magiclink',token_hash:'sandbox-one-time-hash'} ]);
});

test('server refuses unapproved or mismatched Sandbox identities',async()=>{
 for(const opt of [{roleAllowed:false},{wrongLink:true},{changedEmail:true}]) {
   const fixture=mocks(opt);
   assert.equal(await claim.exchangeHandoffForSession(nonce,fixture.admin,fixture.auth),null);
 }
 const fixture=mocks();
 assert.equal(await claim.exchangeHandoffForSession('bad',fixture.admin,fixture.auth),null);
 assert.equal(fixture.calls.length,0);
});

test('service-role key and separate SDK sessions required, never public secret',()=>{
 assert.throws(()=>claim.sandboxClients({}),/missing/);
 assert.throws(()=>claim.sandboxClients({
    VITE_SUPABASE_URL:'https://aszixzrdayrivungodwq.supabase.co',
    SANDBOX_SERVICE_ROLE_KEY:'a-secret',
    VITE_SUPABASE_ANON_KEY:'a-public-key',
 }),/Sandbox-only Supabase destination required/);
});

test('login link is opt-in and no app path can skip the server permission gate',()=>{
 const gate=readFileSync('src/sandbox/SandboxAccessGate.jsx','utf8');
 assert.match(gate,/VITE_SANDBOX_SHARED_LOGIN_ENABLED === 'true'/);
 assert.match(gate,/isPendingSharedLogin\(window\.location\)/);
 assert.match(gate,/claimSharedLogin\(supabase/);
 assert.match(gate,/href="\/api\/sandbox-sso\/start"/);
 assert.match(gate,/checkSandboxAccess\(supabase\)/);
 assert.doesNotMatch(gate,/auth\.admin|golf-account-auth|signInWithPassword/);
});

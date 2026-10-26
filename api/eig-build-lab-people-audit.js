"use strict";
// Owner-guarded live audit using the caller's JWT and Supabase RLS, never a service-role key.
const {createClient}=require("@supabase/supabase-js");
const {buildLabPreviewAuthProviders}=require("../server/eig-build-lab-auth-client.cjs");
const {createPeopleAuditHandler}=require("../server/eig-people-audit-handler.cjs");
const {scanPeopleIntegrity}=require("../server/eig-people-reconciliation.cjs");
const env=name=>process.env[name];
module.exports=createPeopleAuditHandler({
 env,...buildLabPreviewAuthProviders(env),
 audit:async token=>{
  const url=env("VITE_SUPABASE_URL"),key=env("VITE_SUPABASE_ANON_KEY");
  if(!url||!key||!token)throw Error("Identity audit environment unavailable");
  // Never label Sandbox or an unknown project as the live EIG People database.
  const LIVE_PROJECT_HOST="aszixzrdayrivungodwq.supabase.co";
  let hostname;
  try { const u=new URL(url);if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/")throw Error("Unsupported target");hostname=u.hostname; }
  catch {throw Error("Live identity audit database identity unavailable");}
  if(hostname!==LIVE_PROJECT_HOST)throw Error("Live identity audit target mismatch");
  const client=createClient(url,key,{
   auth:{persistSession:false,autoRefreshToken:false},
   global:{headers:{Authorization:"Bearer "+token}}
  });
  return scanPeopleIntegrity(client);
 }
});

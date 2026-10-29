/**
 * Real local Supabase Auth + PostgREST + PostgreSQL integration test.
 * Runs ONLY from an unlinked, disposable Supabase CLI stack in GitHub Actions.
 * Never uses production or the approved EIG Sandbox.
 */
const assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');

const api=process.env.API_URL;
const anonKey=process.env.ANON_KEY;
const serviceKey=process.env.SERVICE_ROLE_KEY;
if(api!=='http://127.0.0.1:54321'||!anonKey||!serviceKey||
   anonKey===serviceKey||process.env.SUPABASE_ACCESS_TOKEN||
   process.env.SUPABASE_PROJECT_REF||process.env.VERCEL_ENV){
 throw Error('Refusing to test nonlocal or remotely linked Supabase credentials.');
}
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(api,serviceKey,options);
const publicClient=createClient(api,anonKey,options);
const expectDenied=(error,context)=>{
 assert.ok(error,context+' unexpectedly succeeded');
 assert.ok(['42501','PGRST301','PGRST302','401','403'].includes(String(error.code||''))||
   /permission denied|unauthorized|forbidden|not found|could not find/i.test(error.message||''),
   context+' denied for an unexpected reason: '+JSON.stringify({code:error.code,message:error.message}));
};
const KINDS=['scan_history','work_buckets','manager_blueprint'];
const payload=(id)=>({version:1,entries:[{id,type:'synthetic',savedAt:'2026-10-28T20:00:00Z'}]});
async function userFixture(n){
 const email='eig-build-lab-ci-'+n+'@example.invalid';
 const password='CI-Only-Not-A-Real-Password-2026!';
 const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(createError);
 assert.ok(created?.user?.id);
 const browser=createClient(api,anonKey,options);
 const {data:signed,error:signError}=await browser.auth.signInWithPassword({email,password});
 assert.ifError(signError);
 assert.equal(signed?.user?.id,created.user.id);
 assert.ok(signed.session?.access_token);
 const {data:verified,error:verificationError}=await admin.auth.getUser(signed.session.access_token);
 assert.ifError(verificationError);
 assert.equal(verified.user.id,created.user.id);
 return {id:created.user.id,browser,token:signed.session.access_token};
}
async function assertGrantDenial(client,owner){
 let q=await client.from('eig_build_lab_documents').select('revision,payload');
 expectDenied(q.error,'Current record select');
 q=await client.from('eig_build_lab_document_revisions').select('revision,payload');
 expectDenied(q.error,'Historical record select');
 q=await client.from('eig_build_lab_documents').insert({
  owner_user_id:owner,document_key:'scan_history',revision:1,payload:payload('spoofed')
 });
 expectDenied(q.error,'Direct record insert');
 q=await client.from('eig_build_lab_documents').update({revision:90})
  .eq('owner_user_id',owner).eq('document_key','scan_history');
 expectDenied(q.error,'Direct record update');
 q=await client.rpc('eig_build_lab_save_document',{
  p_owner_user_id:owner,p_document_key:'scan_history',p_expected_revision:0,p_payload:payload('spoofed')
 });
 expectDenied(q.error,'Save RPC');
}
async function rpc(owner,kind,expected,doc){
 const {data,error}=await admin.rpc('eig_build_lab_save_document',{
  p_owner_user_id:owner,p_document_key:kind,p_expected_revision:expected,p_payload:doc
 });
 assert.ifError(error);
 assert.ok(Array.isArray(data)&&data.length===1,'Expected exactly one RPC result');
 assert.equal(typeof data[0].saved,'boolean');
 return data[0];
}
async function main(){
 console.log('[1/7] Real local Supabase Auth: create two independent verified users');
 const owner=await userFixture('owner');
 const other=await userFixture('other');
 assert.notEqual(owner.id,other.id);
 console.log('[2/7] REST: anon and both signed-in users cannot read, insert, update or invoke RPC');
 for(const c of [publicClient,owner.browser,other.browser]){
  await assertGrantDenial(c,owner.id);
 }
 console.log('[3/7] REST: server service role can save and retrieve owner-scoped versioned records');
 let result=await rpc(owner.id,'scan_history',0,payload('v1'));
 assert.equal(result.saved,true);assert.equal(result.new_revision,1);
 result=await rpc(owner.id,'scan_history',1,payload('v2'));
 assert.equal(result.saved,true);assert.equal(result.new_revision,2);
 const {data:current,error:currentError}=await admin.from('eig_build_lab_documents')
  .select('revision,payload,updated_at').eq('owner_user_id',owner.id)
  .eq('document_key','scan_history').single();
 assert.ifError(currentError);
 assert.equal(current.revision,2);
 assert.equal(current.payload.entries[0].id,'v2');
 const {data:history,error:historyError}=await admin.from('eig_build_lab_document_revisions')
  .select('revision,payload').eq('owner_user_id',owner.id)
  .eq('document_key','scan_history').order('revision',{ascending:true});
 assert.ifError(historyError);
 assert.deepEqual(history.map(x=>x.revision),[1,2]);
 assert.deepEqual(history.map(x=>x.payload.entries[0].id),['v1','v2']);
 console.log('[4/7] REST: stale browser revisions cannot overwrite a newer cloud record');
 result=await rpc(owner.id,'scan_history',1,payload('stale'));
 assert.equal(result.saved,false);assert.equal(result.new_revision,2);
 const winner=await rpc(owner.id,'scan_history',2,payload('v3'));
 assert.equal(winner.saved,true);assert.equal(winner.new_revision,3);
 console.log('[5/7] REST: separate users and the three document keys do not cross-contaminate');
 const otherRecord=await rpc(other.id,'scan_history',0,payload('other'));
 assert.equal(otherRecord.saved,true);assert.equal(otherRecord.new_revision,1);
 const work=await rpc(owner.id,'work_buckets',0,{kind:'eig_work_buckets',version:1,jobs:[],batches:[]});
 assert.equal(work.new_revision,1);
 const manager=await rpc(owner.id,'manager_blueprint',0,{kind:'eig_build_lab_manager_blueprint',version:1,proposals:[],status:'draft'});
 assert.equal(manager.new_revision,1);
 const {data:rows,error:rowsError}=await admin.from('eig_build_lab_documents')
  .select('owner_user_id,document_key,revision');
 assert.ifError(rowsError);
 assert.equal(rows.length,4);
 assert.equal(rows.filter(x=>x.owner_user_id===owner.id).length,3);
 assert.equal(rows.find(x=>x.owner_user_id===other.id).revision,1);
 console.log('[6/7] REST: invalid keys, negative revisions and oversized payloads reject without writes');
 for(const [kind,revision,document] of [
  ['payments',0,{}],['scan_history',-1,{}],['manager_blueprint',0,{body:'x'.repeat(600100)}]
 ]){
  const {error}=await admin.rpc('eig_build_lab_save_document',{
   p_owner_user_id:owner.id,p_document_key:kind,
   p_expected_revision:revision,p_payload:document
  });
  assert.ok(error,'Invalid RPC request should reject: '+kind);
 }
 const {data:after,error:afterError}=await admin.from('eig_build_lab_document_revisions')
  .select('revision').eq('owner_user_id',owner.id).eq('document_key','scan_history');
 assert.ifError(afterError);assert.equal(after.length,3);
 console.log('[7/7] REST: normal user still cannot read even after service role saved records');
 await assertGrantDenial(owner.browser,owner.id);
 await assertGrantDenial(other.browser,owner.id);
 console.log('PASS: genuine local Supabase Auth and REST API: grants, RLS, revision writes, ownership and denial controls.');
}
main().catch(e=>{console.error('Local Supabase integration FAILED:',e?.message||e);process.exitCode=1;});

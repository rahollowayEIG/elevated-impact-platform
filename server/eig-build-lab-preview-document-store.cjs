'use strict';
// Separate, opt-in Build Lab PREVIEW storage adapter.
// The owner authenticates against approved Live auth, but records are written
// ONLY to a distinct, explicit preview Supabase database.
// NEVER re-use production or pink Sandbox service credentials.
const {createClient}=require('@supabase/supabase-js');

const BRANCH='release/build-lab-v1-owner-only-20261028';
const FORBIDDEN_PROJECTS=new Set([
 'aszixzrdayrivungodwq', // ElevationPilot production
 'publruuuyvpggogrrgwp', // Approved pink Sandbox
 'fyihtdhpkniuthsvxwla'  // EIG Ticketing
]);
const PROJECT_REF=/^[a-z]{20}$/;
const OWNER=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['scan_history','work_buckets','manager_blueprint']);

function createBuildLabPreviewDocumentStore(env=name=>process.env[name],makeClient=createClient){
 let client;
 function db(){
  const ref=env('EIG_BUILD_LAB_PREVIEW_STORAGE_PROJECT_REF');
  const url=env('EIG_BUILD_LAB_PREVIEW_STORAGE_URL');
  const secret=env('EIG_BUILD_LAB_PREVIEW_STORAGE_SERVICE_ROLE_KEY');
  const liveSecret=env('SUPABASE_SERVICE_ROLE_KEY');
  if(env('VERCEL_ENV')!=='preview'||
     env('VERCEL_GIT_COMMIT_REF')!==BRANCH||
     env('EIG_BUILD_LAB_PREVIEW_RECORDS_ENABLED')!=='true'||
     !PROJECT_REF.test(ref||'')||FORBIDDEN_PROJECTS.has(ref)||
     url!=='https://'+ref+'.supabase.co'||
     !secret||secret===liveSecret)
    throw Error('Isolated Build Lab preview storage is not configured.');
  if(!client)client=makeClient(url,secret,{
   auth:{persistSession:false,autoRefreshToken:false}
  });
  return client;
 }
 function assertKeys(owner,kind){
  if(!OWNER.test(owner||'')||!KINDS.has(kind))
   throw Error('Invalid Build Lab preview record scope.');
 }
 return {
  async read(owner,kind){
   assertKeys(owner,kind);
   const {data,error}=await db().from('eig_build_lab_documents')
    .select('revision,payload,updated_at')
    .eq('owner_user_id',owner).eq('document_key',kind).maybeSingle();
   if(error)throw Error('Build Lab preview record read unavailable.');
   return data?{revision:data.revision,payload:data.payload,updatedAt:data.updated_at}:null;
  },
  async save(owner,kind,expectedRevision,payload){
   assertKeys(owner,kind);
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
      expectedRevision>2147483646)
    throw Error('Invalid expected Build Lab preview revision.');
   const {data,error}=await db().rpc('eig_build_lab_save_document',{
    p_owner_user_id:owner,p_document_key:kind,
    p_expected_revision:expectedRevision,p_payload:payload
   });
   if(error||!Array.isArray(data)||data.length!==1)
    throw Error('Atomic Build Lab preview save unavailable.');
   const row=data[0];
   if(typeof row?.saved!=='boolean'||!Number.isSafeInteger(row.new_revision))
    throw Error('Atomic Build Lab preview save did not verify revision.');
   return {saved:row.saved,revision:row.new_revision,updatedAt:row.saved_at};
  }
 };
}
module.exports={createBuildLabPreviewDocumentStore};

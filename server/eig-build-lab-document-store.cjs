// Server-only Supabase adapter for EIG Build Lab record snapshots and revisions.
// Every call is preceded by exact-owner authentication in the API route.
// The service key is never passed into the browser or exported in any JSON.
const {createClient}=require('@supabase/supabase-js');
const LIVE_SUPABASE_URL='https://aszixzrdayrivungodwq.supabase.co';
const TABLE='eig_build_lab_documents';
const SAVE_RPC='eig_build_lab_save_document';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['scan_history','work_buckets','manager_blueprint']);

function createBuildLabDocumentStore(env=name=>process.env[name],makeClient=createClient){
 let client;
 function db(){
  const url=env('VITE_SUPABASE_URL'),secret=env('SUPABASE_SERVICE_ROLE_KEY');
  if(env('VERCEL_ENV')!=='production'||url!==LIVE_SUPABASE_URL||!secret)
   throw Error('Build Lab production record store is not configured.');
  if(!client)client=makeClient(url,secret,{
   auth:{persistSession:false,autoRefreshToken:false}
  });
  return client;
 }
 function assertKeys(owner,kind){
  if(!UUID.test(owner||'')||!KINDS.has(kind))throw Error('Invalid Build Lab record scope.');
 }
 return {
  async read(owner,kind){
   assertKeys(owner,kind);
   const {data,error}=await db().from(TABLE)
     .select('revision,payload,updated_at')
     .eq('owner_user_id',owner).eq('document_key',kind).maybeSingle();
   if(error)throw Error('Build Lab record read unavailable.');
   if(!data)return null;
   return {revision:data.revision,payload:data.payload,updatedAt:data.updated_at};
  },
  async save(owner,kind,expectedRevision,payload){
   assertKeys(owner,kind);
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
    throw Error('Invalid expected Build Lab revision.');
   const {data,error}=await db().rpc(SAVE_RPC,{
    p_owner_user_id:owner,p_document_key:kind,
    p_expected_revision:expectedRevision,p_payload:payload
   });
   if(error||!Array.isArray(data)||data.length!==1)
    throw Error('Atomic Build Lab record save unavailable.');
   const record=data[0];
   if(typeof record?.saved!=='boolean'||!Number.isSafeInteger(record.new_revision))
    throw Error('Atomic save did not return revision verification.');
   return {saved:record.saved,revision:record.new_revision,updatedAt:record.saved_at};
  }
 };
}
module.exports={createBuildLabDocumentStore};

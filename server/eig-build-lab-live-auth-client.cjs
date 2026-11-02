// Live-only Build Lab auth dependencies. Never expose the service-role key to the browser.
// Privileged RPC is used SOLELY to attest the session; scanner source reads
// never receive a privileged database client or a caller-chosen SQL operation.
const {createClient}=require('@supabase/supabase-js');
const {buildLabPreviewAuthProviders}=require('./eig-build-lab-auth-client.cjs');
const STANDARD_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIVE_SUPABASE_URL='https://aszixzrdayrivungodwq.supabase.co';
function verifiedSessionId(jwt){
 try{
  const segments=jwt.split('.');
  if(segments.length!==3||segments.some(x=>!x))return '';
  // Called only after Supabase Auth has independently verified the bearer.
  const payload=JSON.parse(Buffer.from(segments[1],'base64url').toString('utf8'));
  return STANDARD_UUID.test(payload?.session_id||'')?payload.session_id:'';
 }catch{return '';}
}
function buildLabLiveAuthProviders(env=name=>process.env[name]){
 const base=buildLabPreviewAuthProviders(env);
 return {...base,async verifyLiveSession(userId,token){
  const sessionId=verifiedSessionId(token);
  const url=env('VITE_SUPABASE_URL'),serverKey=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!STANDARD_UUID.test(userId||'')||!sessionId||url!==LIVE_SUPABASE_URL||!serverKey)
   throw Error('Live Build Lab active-session attestation unavailable.');
  const admin=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await admin.rpc('platform_assert_active_admin',{
   p_actor_id:userId,p_actor_session_id:sessionId
  });
  if(error)throw Error('Live admin session is not active.');
  return true;
 }};
}
module.exports={buildLabLiveAuthProviders,verifiedSessionId};

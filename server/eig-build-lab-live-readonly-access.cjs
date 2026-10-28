// Dedicated PRODUCTION, owner-only, read-only Build Lab authorization.
// Separate from the preview grant that protects AI generation and builder tools.
// This module is inert until server-side Live configuration is explicitly enabled.
const { response }=require('./eig-build-lab-preview-access.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIVE_ORIGIN='https://elevated-impact-platform.vercel.app';
const LIVE_HOST='elevated-impact-platform.vercel.app';

function currentAdmin(row,now){
 if(row?.role!=='eig_admin'||row?.status!=='active'||row.organization?.slug!=='elevated-impact-group')return false;
 const starts=row.access_starts_at?Date.parse(row.access_starts_at):-Infinity;
 const ends=row.access_ends_at?Date.parse(row.access_ends_at):Infinity;
 return !Number.isNaN(starts)&&!Number.isNaN(ends)&&starts<=now&&ends>now;
}

function liveReadOnlyEnabled(env){
 // Use fixed approved origin/branch, not user-supplied project IDs, aliases or targets.
 return env('VERCEL_ENV')==='production'&&
   env('VERCEL_GIT_COMMIT_REF')==='main'&&
   env('EIG_BUILD_LAB_LIVE_READONLY_ENABLED')==='true'&&
   UUID.test((env('EIG_BUILD_LAB_LIVE_OWNER_USER_ID')||'').trim());
}

async function authorizeBuildLabLiveReadOnlyOwner(req,{
 env,verifyUser,membershipsForUser,verifyLiveSession,now=Date.now
}={}){
 const headers=req?.headers||{};
 if(req?.method!=='POST')return {allowed:false,status:405};
 if(headers.origin!==LIVE_ORIGIN||headers.host!==LIVE_HOST)return {allowed:false,status:403};
 if(typeof env!=='function'||!liveReadOnlyEnabled(env))return {allowed:false,status:403};
 const auth=typeof headers.authorization==='string'&&/^Bearer\s+(\S+)$/i.exec(headers.authorization);
 if(!auth||auth[1].length>4096)return {allowed:false,status:401};
 // Fail closed unless all three independent checks are available.
 if(typeof verifyUser!=='function'||typeof membershipsForUser!=='function'||typeof verifyLiveSession!=='function')
   return {allowed:false,status:503};
 try{
  const user=await verifyUser(auth[1]);
  const owner=(env('EIG_BUILD_LAB_LIVE_OWNER_USER_ID')||'').trim().toLowerCase();
  if(!user?.id||String(user.id).toLowerCase()!==owner)return {allowed:false,status:403};
  // Verify the Supabase Auth server session AND the privileged active-session RPC.
  // Never accept a JWT claim by itself as proof of an active session.
  if(await verifyLiveSession(user.id,auth[1])!==true)return {allowed:false,status:403};
  const membership=await membershipsForUser(user.id,auth[1]);
  if(membership?.error||!(membership?.data||[]).some(row=>currentAdmin(row,now())))
   return {allowed:false,status:403};
  return {allowed:true,status:200,scope:'read_only'};
 }catch{return {allowed:false,status:403};}
}

function createBuildLabLiveReadOnlyAccessHandler(deps){
 return async (req,res)=>{
  const grant=await authorizeBuildLabLiveReadOnlyOwner(req,deps);
  return response(res,grant.status,grant.allowed?
   {allowed:true,access:'build_lab_live_readonly',scope:'read_only'}:{allowed:false});
 };
}
module.exports={LIVE_ORIGIN,authorizeBuildLabLiveReadOnlyOwner,createBuildLabLiveReadOnlyAccessHandler};

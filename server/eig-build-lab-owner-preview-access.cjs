'use strict';
// Preview authorization is deliberately separate from the production owner gate.
const {response}=require('./eig-build-lab-preview-access.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRANCH='release/build-lab-v1-owner-only-20261028';
async function authorizeBuildLabOwnerPreview(req,{env,verifyUser,membershipsForUser,verifyLiveSession,now=Date.now}={}){
 if(req?.method!=='POST')return {allowed:false,status:405};
 if(typeof env!=='function'||env('VERCEL_ENV')!=='preview'||env('VERCEL_GIT_COMMIT_REF')!==BRANCH||env('EIG_BUILD_LAB_OWNER_PREVIEW_ENABLED')!=='true')return {allowed:false,status:403};
 const owner=env('EIG_BUILD_LAB_LIVE_OWNER_USER_ID');
 const host=env('VERCEL_URL');
 if(!UUID.test(owner||'')||!host||!host.endsWith('.vercel.app')||req.headers?.host!==host||req.headers?.origin!=='https://'+host)return {allowed:false,status:403};
 const token=/^Bearer\s+(\S+)$/i.exec(req.headers?.authorization||'')?.[1];
 if(!token||token.length>4096)return {allowed:false,status:401};
 if(typeof verifyUser!=='function'||typeof membershipsForUser!=='function'||typeof verifyLiveSession!=='function')return {allowed:false,status:503};
 try{
  const user=await verifyUser(token);
  if(!user?.id||user.id.toLowerCase()!==owner.toLowerCase()||await verifyLiveSession(user.id,token)!==true)return {allowed:false,status:403};
  const membership=await membershipsForUser(user.id,token);
  const valid=(membership?.data||[]).some(x=>x.role==='eig_admin'&&x.status==='active'&&x.organization?.slug==='elevated-impact-group'&&(!x.access_starts_at||Date.parse(x.access_starts_at)<=now())&&(!x.access_ends_at||Date.parse(x.access_ends_at)>now()));
  return valid?{allowed:true,status:200,scope:'read_only'}:{allowed:false,status:403};
 }catch{return {allowed:false,status:403}}
}
function createPreviewAccessHandler(deps){return async(req,res)=>{const grant=await authorizeBuildLabOwnerPreview(req,deps);return response(res,grant.status,grant.allowed?{allowed:true,access:'build_lab_live_readonly',scope:'read_only'}:{allowed:false})}}
module.exports={authorizeBuildLabOwnerPreview,createPreviewAccessHandler};

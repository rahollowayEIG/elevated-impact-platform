'use strict';
// Dedicated protected source-only integrity handler.
// No caller-selected file, URL, DB connection, migration mutation or deletion.
const {response}=require('./eig-build-lab-preview-access.cjs');
function createIntegrityScanHandler({env,verifyUser,membershipsForUser,verifyLiveSession,
 authorize,readSources,scan,now=Date.now}){
 return async(req,res)=>{
  const grant=await authorize(req,{env,verifyUser,membershipsForUser,verifyLiveSession,now});
  if(!grant.allowed)return response(res,grant.status,{ok:false});
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||
     Object.keys(body).some(k=>k!=='target')||body.target!=='platform_integrity')
   return response(res,400,{ok:false,message:'Unsupported integrity scan target.'});
  try{
   const input=readSources();
   const report=scan(input,env('VERCEL_GIT_COMMIT_SHA')||'local-unversioned',new Date(now()).toISOString());
   return response(res,200,{ok:true,report});
  }catch(e){
   console.error('Platform integrity scan unavailable:',e?.name||'Error');
   return response(res,503,{ok:false,message:'Read-only Platform Integrity Scanner unavailable.'});
  }
 };
}
module.exports={createIntegrityScanHandler};

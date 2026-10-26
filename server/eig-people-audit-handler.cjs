"use strict";
const {authorizeBuildLabPreviewOwner,response}=require("./eig-build-lab-preview-access.cjs");
function createPeopleAuditHandler({env,verifyUser,membershipsForUser,audit,now=Date.now}){
 return async (req,res)=>{
  const grant=await authorizeBuildLabPreviewOwner(req,{env,verifyUser,membershipsForUser,now});
  if(!grant.allowed)return response(res,grant.status,{ok:false});
  const body=req.body;
  if(body&&(
   typeof body!=="object"||Array.isArray(body)||
   Object.keys(body).some(k=>k!=="scope")||
   (body.scope!==undefined&&body.scope!=="eie_golf_registrations")
  ))return response(res,400,{ok:false,message:"Unsupported identity audit scope."});
  try {
   const token=/^Bearer\s+(.+)$/i.exec(req.headers.authorization||"")?.[1];
   const result=await audit(token);
   return response(res,200,{ok:true,audit:result});
  } catch {
   // Incomplete/unauthorized reads must not be misreported as clean scans.
   return response(res,503,{ok:false,message:"Identity audit incomplete; no result was certified."});
  }
 };
}
module.exports={createPeopleAuditHandler};

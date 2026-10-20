// Dedicated Master Scanner endpoint. Reuse exactly the Build Lab owner gate.
// No caller-selected path, SQL, project ref or URL; no persistent or network writes.
const {authorizeBuildLabPreviewOwner,response}=require("./eig-build-lab-preview-access.cjs");
function createBuildLabMasterScanHandler({env,verifyUser,membershipsForUser,readSources,scan,now=Date.now}) {
  return async (req,res) => {
    const grant=await authorizeBuildLabPreviewOwner(req,{env,verifyUser,membershipsForUser,now});
    if(!grant.allowed) return response(res,grant.status,{ok:false});
    const body=req.body;
    if(body && (typeof body!=="object" || Array.isArray(body) ||
      Object.keys(body).some(k=>k!=="target") ||
      (body.target!==undefined && body.target!=="elevationpilot")))
      return response(res,400,{ok:false,message:"Unsupported Master Scanner target."});
    try {
      const source=await readSources();
      const version=env("VERCEL_GIT_COMMIT_SHA")||"local-unversioned";
      const report=await scan(source,version);
      return response(res,200,{ok:true,report});
    } catch {
      // Never return source/SQL contents or exception stack traces.
      return response(res,503,{ok:false,message:"Read-only Master Scanner unavailable. Check preview bundle."});
    }
  };
}
module.exports={createBuildLabMasterScanHandler};

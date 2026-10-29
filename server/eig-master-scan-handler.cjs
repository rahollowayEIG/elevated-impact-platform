// Dedicated Master Scanner endpoint. Reuse exactly the Build Lab owner gate.
// No caller-selected path, SQL, project ref or URL; no persistent or network writes.
const {authorizeBuildLabPreviewOwner,response}=require("./eig-build-lab-preview-access.cjs");
const {MODULES}=require("./eig-master-source-scan.cjs");
const {MODES}=require("./eig-master-environment-compare.cjs");
const MODE_SET=new Set(MODES);
const APPROVED_MODULE_IDS=new Set(MODULES.map(rule=>rule.id));
function createBuildLabMasterScanHandler({env,verifyUser,membershipsForUser,verifyLiveSession,readSources,scan,now=Date.now,authorize=authorizeBuildLabPreviewOwner}) {
  return async (req,res) => {
    const grant=await authorize(req,{env,verifyUser,membershipsForUser,verifyLiveSession,now});
    if(!grant.allowed) return response(res,grant.status,{ok:false});
    const body=req.body;
    if(body && (typeof body!=="object" || Array.isArray(body) ||
      Object.keys(body).some(k=>k!=="target"&&k!=="moduleId"&&k!=="environmentMode") ||
      (body.target!==undefined && body.target!=="elevationpilot") ||
      (body.moduleId!==undefined && !APPROVED_MODULE_IDS.has(body.moduleId)) ||
      (body.environmentMode!==undefined && !MODE_SET.has(body.environmentMode))))
      return response(res,400,{ok:false,message:"Unsupported Master Scanner target."});
    try {
      const source=await readSources();
      const version=env("VERCEL_GIT_COMMIT_SHA")||"local-unversioned";
      const report=await scan(source,version,undefined,body?.moduleId||null,body?.environmentMode||"compare");
      return response(res,200,{ok:true,report});
    } catch (error) {
      console.error('Build Lab master scan failed:',error?.name||'Error',String(error?.message||'unknown').slice(0,180));
      // Never return source/SQL contents or exception stack traces.
      return response(res,503,{ok:false,message:"Read-only Master Scanner unavailable. Check preview bundle."});
    }
  };
}
module.exports={createBuildLabMasterScanHandler};

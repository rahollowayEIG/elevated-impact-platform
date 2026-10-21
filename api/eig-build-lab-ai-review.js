// EIG Build Lab read-only AI review of source scanner metadata.
// Only protected Vercel branch preview, single owner, explicit button press.
const {createBuildLabAiReview}=require("../server/eig-build-lab-ai-review.cjs");
const {buildLabPreviewAuthProviders}=require("../server/eig-build-lab-auth-client.cjs");
const {readAllowlistedMasterSource,scanMasterSource}=require("../server/eig-master-source-scan.cjs");
module.exports=createBuildLabAiReview({
 env:name=>process.env[name],
 ...buildLabPreviewAuthProviders(name=>process.env[name]),
 readSources:readAllowlistedMasterSource,scan:scanMasterSource
});

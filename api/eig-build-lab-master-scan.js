const {buildLabPreviewAuthProviders}=require("../server/eig-build-lab-auth-client.cjs");
const {createBuildLabMasterScanHandler}=require("../server/eig-master-scan-handler.cjs");
const {readAllowlistedMasterSource,scanMasterSource}=require("../server/eig-master-source-scan.cjs");
const env=name=>process.env[name];
// Same owner-only, preview-only server guard as the existing Inception inspector.
module.exports=createBuildLabMasterScanHandler({
 env,...buildLabPreviewAuthProviders(env),
 readSources:readAllowlistedMasterSource,scan:scanMasterSource,
});

// Production read-only Master Scanner endpoint. No AI, repair, database writes or arbitrary targets.
const {authorizeBuildLabLiveReadOnlyOwner}=require('../server/eig-build-lab-live-readonly-access.cjs');
const {authorizeBuildLabOwnerPreview}=require('../server/eig-build-lab-owner-preview-access.cjs');
const {buildLabLiveAuthProviders}=require('../server/eig-build-lab-live-auth-client.cjs');
const {createBuildLabMasterScanHandler}=require('../server/eig-master-scan-handler.cjs');
const {readAllowlistedMasterSource,scanMasterSource}=require('../server/eig-master-source-scan.cjs');
const env=name=>process.env[name];
module.exports=createBuildLabMasterScanHandler({
 env,...buildLabLiveAuthProviders(env),
 authorize:env('VERCEL_ENV')==='preview'?authorizeBuildLabOwnerPreview:authorizeBuildLabLiveReadOnlyOwner,
 readSources:readAllowlistedMasterSource,scan:scanMasterSource
});

// Production read-only IA source-inspection endpoint. No AI generation or arbitrary file reads.
const {authorizeBuildLabLiveReadOnlyOwner}=require('../server/eig-build-lab-live-readonly-access.cjs');
const {buildLabLiveAuthProviders}=require('../server/eig-build-lab-live-auth-client.cjs');
const {createBuildLabInceptionScanHandler}=require('../server/eig-build-lab-scan-handler.cjs');
const {readAllowlistedInceptionSource,scanInceptionSource}=require('../server/eig-inception-source-scan.cjs');
const env=name=>process.env[name];
module.exports=createBuildLabInceptionScanHandler({
 env,...buildLabLiveAuthProviders(env),
 authorize:authorizeBuildLabLiveReadOnlyOwner,
 readSources:readAllowlistedInceptionSource,scan:scanInceptionSource
});

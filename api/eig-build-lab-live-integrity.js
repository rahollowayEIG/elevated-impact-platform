// Owner-only, read-only Rule 3 Platform Integrity Scanner.
// Reuses exact production/preview owner session gates, not a UI-only check.
const {authorizeBuildLabLiveReadOnlyOwner}=require('../server/eig-build-lab-live-readonly-access.cjs');
const {authorizeBuildLabOwnerPreview}=require('../server/eig-build-lab-owner-preview-access.cjs');
const {buildLabLiveAuthProviders}=require('../server/eig-build-lab-live-auth-client.cjs');
const {createIntegrityScanHandler}=require('../server/eig-build-lab-integrity-handler.cjs');
const {readApprovedIntegrityInputs,scanPlatformIntegrity}=require('../server/eig-build-lab-integrity-scan.cjs');
const env=name=>process.env[name];
module.exports=createIntegrityScanHandler({
 env,...buildLabLiveAuthProviders(env),
 authorize:env('VERCEL_ENV')==='preview'?authorizeBuildLabOwnerPreview:authorizeBuildLabLiveReadOnlyOwner,
 readSources:readApprovedIntegrityInputs,scan:scanPlatformIntegrity
});

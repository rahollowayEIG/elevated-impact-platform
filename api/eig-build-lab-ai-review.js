// Preview-only, owner-gated AI planning over server-generated Master Scan metadata.
// No client-selected source, code access, database writes or deployment tools.
const {authorizeBuildLabOwnerPreview}=require('../server/eig-build-lab-owner-preview-access.cjs');
const {buildLabLiveAuthProviders}=require('../server/eig-build-lab-live-auth-client.cjs');
const {createBuildLabAiReviewHandler}=require('../server/eig-build-lab-ai-review.cjs');
const {readAllowlistedMasterSource,scanMasterSource}=require('../server/eig-master-source-scan.cjs');
const {RELEASE_PATHS,RELEASE_MODULES,validateReleaseSourceScope}=require('../server/eig-build-lab-v1-source-scope.cjs');
const env=name=>process.env[name];
module.exports=createBuildLabAiReviewHandler({
 env,...buildLabLiveAuthProviders(env),authorize:authorizeBuildLabOwnerPreview,
 readSources:()=>{const state=validateReleaseSourceScope();
  if(state.missing.length||state.unscoped.length)throw Error('Approved source scope unavailable.');
  return readAllowlistedMasterSource(RELEASE_PATHS);},
 scan:(sources,version,inspectedAt)=>scanMasterSource(sources,version,inspectedAt,null,'live',
  {paths:RELEASE_PATHS,modules:RELEASE_MODULES})
});

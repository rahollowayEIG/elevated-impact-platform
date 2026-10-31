// Dedicated, disabled-by-default PREVIEW storage endpoint.
// Authenticates exact EIG owner using Live active-session attestation.
// Saves approved planning documents only to a separate Supabase TEST project.
// Never shares storage configuration or grants with the production API.
const {buildLabLiveAuthProviders}=require('../server/eig-build-lab-live-auth-client.cjs');
const {authorizeBuildLabOwnerPreview}=require('../server/eig-build-lab-owner-preview-access.cjs');
const {createBuildLabPreviewDocumentStore}=require('../server/eig-build-lab-preview-document-store.cjs');
const {createBuildLabDurableRecordsHandler}=require('../server/eig-build-lab-durable-records.cjs');
const env=name=>process.env[name];

module.exports=createBuildLabDurableRecordsHandler({
 env,...buildLabLiveAuthProviders(env),
 authorizeOwner:authorizeBuildLabOwnerPreview,
 recordsFlag:'EIG_BUILD_LAB_PREVIEW_RECORDS_ENABLED',
 store:createBuildLabPreviewDocumentStore(env)
});

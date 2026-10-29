// Build Lab owner-only, opt-in, versioned records. NO production rollout
// or database schema changes are initiated by this route.
const {buildLabLiveAuthProviders}=require('../server/eig-build-lab-live-auth-client.cjs');
const {createBuildLabDocumentStore}=require('../server/eig-build-lab-document-store.cjs');
const {createBuildLabDurableRecordsHandler}=require('../server/eig-build-lab-durable-records.cjs');
const env=name=>process.env[name];
module.exports=createBuildLabDurableRecordsHandler({
 env,...buildLabLiveAuthProviders(env),store:createBuildLabDocumentStore(env)
});

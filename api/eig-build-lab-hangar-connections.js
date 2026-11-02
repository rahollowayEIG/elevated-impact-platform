'use strict';
// Production owner-only read-only Hangar connection and adoption summary.
// No credential material or customer data is returned.
const {authorizeBuildLabLiveReadOnlyOwner}=
 require('../server/eig-build-lab-live-readonly-access.cjs');
const {buildLabLiveAuthProviders}=
 require('../server/eig-build-lab-live-auth-client.cjs');
const {createBuildLabHangarConnectionsHandler}=
 require('../server/eig-build-lab-hangar-connections.cjs');
const {readHangarConnectionSnapshot}=
 require('../server/eig-build-lab-hangar-db.cjs');
const env=name=>process.env[name];
module.exports=createBuildLabHangarConnectionsHandler({
 env,...buildLabLiveAuthProviders(env),
 authorize:authorizeBuildLabLiveReadOnlyOwner,
 loadSnapshot:()=>readHangarConnectionSnapshot(env)
});

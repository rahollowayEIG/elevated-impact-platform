// Separate, disabled-by-default PRODUCTION owner-only read-only status endpoint.
const {createBuildLabLiveReadOnlyAccessHandler}=require('../server/eig-build-lab-live-readonly-access.cjs');
const {buildLabLiveAuthProviders}=require('../server/eig-build-lab-live-auth-client.cjs');
const env=name=>process.env[name];
module.exports=createBuildLabLiveReadOnlyAccessHandler({env,...buildLabLiveAuthProviders(env)});

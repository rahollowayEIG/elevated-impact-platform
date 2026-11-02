// Strictly separate preview and production authorization. Both default disabled.
const {createBuildLabLiveReadOnlyAccessHandler}=require('../server/eig-build-lab-live-readonly-access.cjs');
const {createPreviewAccessHandler}=require('../server/eig-build-lab-owner-preview-access.cjs');
const {buildLabLiveAuthProviders}=require('../server/eig-build-lab-live-auth-client.cjs');
const env=name=>process.env[name];
const deps={env,...buildLabLiveAuthProviders(env)};
module.exports=env('VERCEL_ENV')==='preview'?createPreviewAccessHandler(deps):createBuildLabLiveReadOnlyAccessHandler(deps);

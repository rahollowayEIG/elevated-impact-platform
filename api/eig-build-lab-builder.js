const {createBuilder}=require('../server/eig-build-lab-builder.cjs');
const {buildLabPreviewAuthProviders}=require('../server/eig-build-lab-auth-client.cjs');
const {readAllowlistedInceptionSource}=require('../server/eig-inception-source-scan.cjs');
module.exports=createBuilder({env:name=>process.env[name],...buildLabPreviewAuthProviders(name=>process.env[name]),readSources:readAllowlistedInceptionSource});

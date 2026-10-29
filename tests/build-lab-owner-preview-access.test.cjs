'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {authorizeBuildLabOwnerPreview}=require('../server/eig-build-lab-owner-preview-access.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const host='elevated-impact-platform-preview.vercel.app';
const env=(key)=>({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'release/build-lab-v1-owner-only-20261028',EIG_BUILD_LAB_OWNER_PREVIEW_ENABLED:'true',EIG_BUILD_LAB_LIVE_OWNER_USER_ID:owner,VERCEL_URL:host})[key];
const request={method:'POST',headers:{host,origin:'https://'+host,authorization:'Bearer token'}};
const good={env,verifyUser:async()=>({id:owner}),verifyLiveSession:async()=>true,membershipsForUser:async()=>({data:[{role:'eig_admin',status:'active',organization:{slug:'elevated-impact-group'}}]})};
test('preview gate denies absent flag, wrong branch and host',async()=>{
 for(const [key,value] of [['EIG_BUILD_LAB_OWNER_PREVIEW_ENABLED','false'],['VERCEL_GIT_COMMIT_REF','main'],['VERCEL_ENV','production'],['VERCEL_URL','evil.example']]){
  const grant=await authorizeBuildLabOwnerPreview(request,{...good,env:k=>k===key?value:env(k)});
  assert.equal(grant.allowed,false,key);
 }
});
test('preview gate requires verified session, EIG membership and exact owner',async()=>{
 assert.equal((await authorizeBuildLabOwnerPreview(request,{...good,verifyLiveSession:async()=>false})).allowed,false);
 assert.equal((await authorizeBuildLabOwnerPreview(request,{...good,verifyUser:async()=>({id:'22222222-2222-4222-8222-222222222222'})})).allowed,false);
 assert.equal((await authorizeBuildLabOwnerPreview(request,{...good,membershipsForUser:async()=>({data:[]})})).allowed,false);
 assert.equal((await authorizeBuildLabOwnerPreview(request,good)).allowed,true);
});

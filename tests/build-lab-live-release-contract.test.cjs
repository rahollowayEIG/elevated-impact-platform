const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('production source scan routes receive fixed allowlisted artifacts, not arbitrary paths',()=>{
 const config=JSON.parse(read('vercel.json')).functions;
 for(const [live,preview] of [
  ['api/eig-build-lab-live-master-scan.js','api/eig-build-lab-master-scan.js'],
  ['api/eig-build-lab-live-scan.js','api/eig-build-lab-scan.js']
 ]){
  assert.equal(config[live]?.includeFiles,config[preview]?.includeFiles,
   'Live scanner must bundle the same reviewed source files as its preview counterpart');
  assert.match(read(live),/authorizeBuildLabLiveReadOnlyOwner/);
  assert.doesNotMatch(read(live),/Builder|AIReview|execution|writeFiles/);
 }
});

test('owner-only production workspace has History, Buckets and Fix Plan without preview builder',()=>{
 const src=read('src/components/BuildLabLiveOwnerWorkspace.jsx');
 assert.match(src,/BuildLabWorkBuckets/);
 assert.match(src,/BuildLabScanHistory/);
 assert.match(src,/BuildLabLivePlanReview/);
 assert.match(src,/saveScanHistory\(localStorage,ownerUserId,entry\)/);
 assert.match(src,/window\.dispatchEvent\(new Event\(HISTORY_EVENT\)\)/);
 assert.match(src,/requestLiveBuildLabScan/);
 assert.doesNotMatch(src.split('\\n').filter(line=>line.startsWith('import ')).join('\\n'),/BuildLabBuilder|BuildLabAiConnection|EigBuildLab/);
 const review=read('src/components/BuildLabLivePlanReview.jsx');
 assert.match(review,/reviewManagerProposal/);
 assert.match(review,/approveManagerBlueprint/);
 assert.match(review,/execution and deployment remain disconnected/i);
 assert.doesNotMatch(review.split('\\n').filter(line=>line.startsWith('import ')).join('\\n'),/BuildLabBuilder|BuildLabAiConnection|EigBuildLab/);
});

test('production owner-only access remains opt-in with independent server and UI gates',()=>{
 const server=read('server/eig-build-lab-live-readonly-access.cjs');
 const client=read('src/PlatformApp.jsx');
 assert.match(server,/EIG_BUILD_LAB_LIVE_READONLY_ENABLED/);
 assert.match(server,/EIG_BUILD_LAB_LIVE_OWNER_USER_ID/);
 assert.match(server,/VERCEL_ENV/);
 assert.match(client,/VITE_EIG_BUILD_LAB_LIVE_OWNER_UI_ENABLED/);
 assert.match(client,/requestLiveBuildLabAccess\(supabase\)/);
 const records=read('server/eig-build-lab-durable-records.cjs');
 assert.match(records,/EIG_BUILD_LAB_LIVE_RECORDS_ENABLED/);
});

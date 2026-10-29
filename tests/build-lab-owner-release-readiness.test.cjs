const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const required=[
 'api/eig-build-lab-live-access.js',
 'api/eig-build-lab-live-scan.js',
 'api/eig-build-lab-live-master-scan.js',
 'server/eig-build-lab-live-readonly-access.cjs',
 'server/eig-build-lab-live-auth-client.cjs'
];
test('owner release has protected server-side access and scan endpoints',()=>{
 const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
 assert.deepEqual(missing,[],'Owner login test must not be offered until these reviewed server files are packaged: '+missing.join(', '));
});
test('owner route must remain opt-in and verify access before navigation',()=>{
 const source=fs.readFileSync(path.join(root,'src/PlatformApp.jsx'),'utf8');
 assert.match(source,/VITE_EIG_BUILD_LAB_LIVE_OWNER_UI_ENABLED === 'true'/);
 assert.match(source,/requestLiveBuildLabAccess\(supabase\)/);
 assert.match(source,/adminView === 'build_lab_live' && liveBuildLabAllowed/);
 assert.doesNotMatch(source,/React\.lazy\(\(\) => import\('\.\/components\/EigBuildLab\.jsx'\)\)/);
});

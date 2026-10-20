import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync('public/build-lab.webmanifest','utf8'));
const html=readFileSync('index.html','utf8');
const app=readFileSync('src/PlatformApp.jsx','utf8');
test('online-only install manifest stays on platform origin',()=>{
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'/?buildlab=1');
 assert.equal(manifest.scope,'/');
 assert.ok(html.includes('href="/build-lab.webmanifest"'));
 assert.ok(!manifest.shortcuts?.length);
});
test('deep link calls protected owner access path and no offline service worker',()=>{
 assert.ok(app.includes("get('buildlab') !== '1'"));
 assert.ok(app.includes('if (!buildLabAllowed || !session?.user?.id) return;'));
 assert.ok(app.includes('void openBuildLab();'));
 assert.ok(app.includes('const allowed = await requestOwnerBuildLabAccess(supabase);'));
 assert.ok(!html.includes('serviceWorker.register'));
});

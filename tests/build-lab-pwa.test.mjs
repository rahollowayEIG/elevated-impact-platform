import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {desktopAppFromLaunch} from '../src/lib/desktopAppMode.mjs';
const manifest=JSON.parse(readFileSync('public/build-lab.webmanifest','utf8'));
const html=readFileSync('index.html','utf8');
const app=readFileSync('src/PlatformApp.jsx','utf8');
const entry=readFileSync('src/main.jsx','utf8');
test('online-only install manifest stays on platform origin',()=>{
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'/?buildlab=1');
 assert.equal(manifest.scope,'/');
 assert.ok(html.includes('href="/build-lab.webmanifest"'));
 assert.ok(!manifest.shortcuts?.length);
});
test('deep link calls protected owner access path and no offline service worker',()=>{
 assert.ok(app.includes('IS_INSTALLED_BUILD_LAB'));
 assert.ok(app.includes('if (!buildLabAllowed || !session?.user?.id) return;'));
 assert.ok(app.includes('void openBuildLab().then((opened) => {'));
 assert.ok(app.includes('const allowed = await requestOwnerBuildLabAccess(supabase);'));
 assert.ok(!html.includes('serviceWorker.register'));
});

test('desktop mode requires a real installed standalone window and explicit launch target',()=>{
 assert.equal(desktopAppFromLaunch({standalone:true,search:'?buildlab=1'}),'build_lab');
 assert.equal(desktopAppFromLaunch({standalone:true,search:'?buildlab=1&utm_source=test'}),'build_lab');
 assert.equal(desktopAppFromLaunch({standalone:false,search:'?buildlab=1'}),null);
 assert.equal(desktopAppFromLaunch({standalone:true,search:'?buildlab=0'}),null);
 assert.equal(desktopAppFromLaunch({standalone:true,search:'?other=1'}),null);
});
test('focused layout hides main navigation only inside authorized installed Build Lab',()=>{
 assert.ok(app.includes("compactBuildLab={IS_INSTALLED_BUILD_LAB && adminView === 'build_lab' && buildLabAllowed && isEigAdminWorkspace}"));
 assert.ok(app.includes('compactBuildLab ? <header className="platform-topbar bl-standalone-bar"'));
 assert.ok(app.includes('Open EIG Command Center'));
 assert.ok(app.includes('onSignOut'));
 assert.ok(entry.includes('{!focusedBuildLabWindow && <EIGAppHeader />}'));
 assert.ok(app.includes('buildLabLaunchStarted.current = true'));
 assert.ok(!app.includes("target.searchParams.delete('buildlab')"));
});

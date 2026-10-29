import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {desktopAppFromLaunch,shouldFocusBuildLab,buildLabLaunchStep} from '../src/lib/desktopAppMode.mjs';
const manifest=JSON.parse(readFileSync('public/build-lab.webmanifest','utf8'));
const html=readFileSync('index.html','utf8');
const app=readFileSync('src/PlatformApp.jsx','utf8');
const entry=readFileSync('src/main.jsx','utf8');
const component=readFileSync('src/components/EigBuildLab.jsx','utf8');
const css=readFileSync('src/styles.css','utf8');
test('online-only install manifest stays on platform origin',()=>{
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'/?buildlab=1');
 assert.equal(manifest.scope,'/');
 assert.ok(html.includes('href="/build-lab.webmanifest"'));
 assert.ok(!manifest.shortcuts?.length);
});
test('deep link calls protected owner access path and no offline service worker',()=>{
 assert.ok(app.includes('IS_INSTALLED_BUILD_LAB'));
 assert.ok(app.includes("if (step !== 'open_build_lab' || !buildLabAllowed) return;"));
 assert.ok(app.includes('buildLabLaunchStep({'));
 assert.ok(app.includes('openWorkspace(eigOrganizationId);'));
 assert.ok(app.includes('const allowed = await requestOwnerBuildLabAccess(supabase);'));
 assert.ok(app.includes('void openBuildLab().then((opened) => {'));
 assert.ok(app.includes('const allowed = await requestOwnerBuildLabAccess(supabase);'));
 assert.ok(!html.includes('serviceWorker.register'));
});

test('protected desktop launcher handles Chrome shortcut root and explicit URL',()=>{
 const previewEnabled = true;
 assert.equal(desktopAppFromLaunch({standalone:true,search:'',previewEnabled}),'build_lab');
 assert.equal(desktopAppFromLaunch({standalone:true,search:'?buildlab=1',previewEnabled}),'build_lab');
 assert.equal(desktopAppFromLaunch({standalone:false,search:'?buildlab=1',previewEnabled}),'build_lab');
 assert.equal(desktopAppFromLaunch({standalone:true,search:'?buildlab=0',previewEnabled}),null);
 assert.equal(desktopAppFromLaunch({standalone:true,search:'?app=event-builder',previewEnabled}),null);
 assert.equal(desktopAppFromLaunch({standalone:true,search:'?recovery=1',previewEnabled}),null);
 assert.equal(desktopAppFromLaunch({standalone:false,search:'',previewEnabled}),null);
 assert.equal(desktopAppFromLaunch({standalone:true,search:'',previewEnabled:false}),null);
});
test('shortcut launch switches to EIG only after verified owner and workspace readiness',()=>{
 const userId='11111111-1111-4111-8111-111111111111';
 const grant={allowed:true,userId};
 const base={requested:true,ready:true,userId,grant,eigOrganizationId:'eig',activeOrganizationId:'other',portalView:'workspace',adminView:'command'};
 assert.equal(buildLabLaunchStep(base),'enter_eig_workspace');
 assert.equal(buildLabLaunchStep({...base,activeOrganizationId:'eig'}),'open_build_lab');
 assert.equal(buildLabLaunchStep({...base,activeOrganizationId:'eig',adminView:'build_lab'}),'complete');
 assert.equal(buildLabLaunchStep({...base,activeOrganizationId:'eig',portalView:'airport'}),'enter_eig_workspace');
 for (const override of [
  {requested:false},{ready:false},{userId:''},{grant:null},
  {grant:{allowed:false,userId}},{grant:{allowed:true,userId:'another'}},
  {eigOrganizationId:''},
 ]) assert.equal(buildLabLaunchStep({...base,...override}),'wait');
});
test('focused layout hides main navigation only inside authorized installed Build Lab',()=>{
 assert.ok(app.includes("compactBuildLab={focusedBuildLab}"));
 assert.ok(app.includes("adminView === 'build_lab' && buildLabAllowed && isEigAdminWorkspace"));
 assert.ok(app.includes('onToggleFocus={toggleBuildLabFocus}'));
 assert.ok(component.includes('onClick={onToggleFocus}'));
 assert.ok(css.includes('body:has(.platform-standalone-build-lab) .eig-global-header { display: none; }'));
 assert.ok(app.includes('compactBuildLab ? <header className="platform-topbar bl-standalone-bar"'));
 assert.ok(app.includes('Open EIG Command Center'));
 assert.ok(app.includes('onSignOut'));
 assert.ok(entry.includes('{!focusedBuildLabWindow && <EIGAppHeader />}'));
 assert.ok(app.includes('buildLabLaunchStarted.current = true'));
 assert.ok(!app.includes("target.searchParams.delete('buildlab')"));
});

test('generic Chrome installed windows and manual focus preference both work',()=>{
 assert.equal(shouldFocusBuildLab({standalone:true}),true);
 assert.equal(shouldFocusBuildLab({standalone:false}),false);
 assert.equal(shouldFocusBuildLab({standalone:false,preference:true}),true);
 assert.equal(shouldFocusBuildLab({standalone:true,preference:false}),false);
 assert.ok(app.includes("window.localStorage.getItem('eig-build-lab-focus-v1')"));
 assert.ok(app.includes("window.localStorage.setItem('eig-build-lab-focus-v1'"));
 assert.ok(app.includes('IS_STANDALONE_WINDOW'));
});

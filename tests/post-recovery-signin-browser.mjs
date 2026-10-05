import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// The real recovery and switch UI talk only to synthetic responses. All other
// remote traffic is blocked. The final application document is a landing probe.
const ORIGIN = 'http://127.0.0.1:4175';
const HOST = 'recovery.example.test';
const KEY = 'sb-recovery-auth-token';
const TARGET = { id: '11111111-1111-4111-8111-111111111111', email: 'target@example.test', email_confirmed_at: '2026-01-01T00:00:00Z' };
const ADMIN = { id: '22222222-2222-4222-8222-222222222222', email: 'admin@example.test', email_confirmed_at: '2026-01-01T00:00:00Z' };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = (user, label) => encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+7200, test_label: label }) + '.c3ludGhldGlj';
const ADMIN_TOKEN = token(ADMIN, 'admin');
const RECOVERY_TOKEN = token(TARGET, 'recovery');
const NEW_TOKEN = token(TARGET, 'fresh-sign-in');
const adminSession = { access_token: ADMIN_TOKEN, refresh_token: 'synthetic-admin-refresh', user: ADMIN, expires_at: Math.floor(Date.now()/1000)+7200, expires_in: 7200, token_type: 'bearer' };
const VALID = '/?recovery=1&type=recovery&token_hash=synthetic-reset&recovery_email=target%40example.test';
const results = [];
await mkdir('test-results/post-recovery', { recursive: true });
const server = spawn('npm', ['run','preview','--','--host','127.0.0.1','--port','4175','--strictPort'], { stdio: ['ignore','ignore','inherit'] });
let browser;
async function ready() {
  for (let i=0;i<80;i++) { try { if ((await fetch(ORIGIN)).ok) return; } catch {} if (server.exitCode !== null) throw new Error('Preview exited'); await new Promise((r)=>setTimeout(r,250)); }
  throw new Error('Preview did not start');
}
async function setup(options = {}) {
  const context = await browser.newContext({ viewport: options.mobile ? { width:390,height:844 } : { width:1280,height:960 } });
  context.setDefaultTimeout(10000);
  await context.addInitScript(({ key, initial, seed }) => {
    if (!localStorage.getItem('synthetic-seeded')) {
      if (seed) localStorage.setItem(key, JSON.stringify(initial));
      localStorage.setItem('synthetic-seeded','yes');
    }
  }, { key:KEY, initial:adminSession, seed:options.seed !== false });
  const calls = []; const errors = [];
  await context.route('**/*', async (route) => {
    const req=route.request(); const url=new URL(req.url());
    if (url.origin === ORIGIN) {
      if (req.isNavigationRequest() && (url.pathname === '/session-probe' || (url.pathname === '/' && !url.search))) {
        return route.fulfill({ contentType:'text/html', body:'<!doctype html><html><body><h1>Application landing probe</h1></body></html>' });
      }
      return route.continue();
    }
    if (url.hostname !== HOST) return route.abort();
    const headers={ 'Access-Control-Allow-Origin':ORIGIN, 'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers':'apikey, authorization, content-type, x-client-info', 'Content-Type':'application/json' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status:204,headers });
    const body=req.postDataJSON(); const bearer=req.headers().authorization;
    calls.push({ path:url.pathname, search:url.search, method:req.method(), bearer, identifier:body?.identifier });
    if (url.pathname === '/auth/v1/verify') return route.fulfill({ status:200,headers,body:JSON.stringify({ access_token:RECOVERY_TOKEN,refresh_token:'synthetic-recovery-refresh',user:TARGET,token_type:'bearer',expires_in:7200 }) });
    if (url.pathname === '/auth/v1/logout') {
      if (bearer === 'Bearer '+ADMIN_TOKEN && options.signoutFailure) return route.fulfill({ status:500,headers,body:JSON.stringify({ message:'Synthetic logout failure' }) });
      return route.fulfill({ status:204,headers });
    }
    if (url.pathname === '/functions/v1/golf-account-auth') {
      assert.equal(body.action,'sign_in');
      if (options.delay) await new Promise((r)=>setTimeout(r,200));
      return route.fulfill({ status:200,headers,body:JSON.stringify(options.badPassword ? { error:'Invalid credentials' } : { access_token:NEW_TOKEN,refresh_token:'synthetic-new-refresh' }) });
    }
    if (url.pathname === '/auth/v1/user') {
      const user=bearer === 'Bearer '+ADMIN_TOKEN || (options.wrongIdentity && bearer === 'Bearer '+NEW_TOKEN) ? ADMIN : TARGET;
      return route.fulfill({ status:200,headers,body:JSON.stringify(user) });
    }
    return route.fulfill({ status:404,headers,body:'{}' });
  });
  const page=await context.newPage(); page.on('pageerror',(e)=>errors.push(e.message));
  return { context,page,calls,errors };
}
async function reset(t) {
  await t.page.goto(ORIGIN+VALID);
  await t.page.locator('#recovery-password').fill('Synthetic-new-password-123');
  await t.page.locator('#recovery-confirmation').fill('Synthetic-new-password-123');
  await t.page.getByRole('button',{name:'Set password for this account'}).click();
  await t.page.getByRole('heading',{name:'Password updated.',exact:true}).waitFor();
}
const switchButton=(t)=>t.page.getByRole('button',{name:'Sign in as '+TARGET.email,exact:true});
const signins=(t)=>t.calls.filter((c)=>c.path === '/functions/v1/golf-account-auth');
const stored=(t)=>t.page.evaluate((key)=>JSON.parse(localStorage.getItem(key)||'null'),KEY);
async function check(label,run) { try { await run(); results.push({label,passed:true}); console.log('PASS: '+label); } catch(e) { results.push({label,passed:false,error:e.message}); throw e; } }
try {
  await ready(); browser=await chromium.launch({headless:true});
  await check('Password reveal controls are independent, hidden by default and re-hide on window blur',async()=>{
    const t=await setup({seed:false});
    try {
      await t.page.goto(ORIGIN+VALID);
      const first=t.page.locator('#recovery-password'); const confirm=t.page.locator('#recovery-confirmation');
      await first.waitFor();
      assert.equal(await first.getAttribute('type'),'password'); assert.equal(await confirm.getAttribute('type'),'password');
      const showFirst=t.page.getByRole('button',{name:'Show new password',exact:true});
      const firstBox=await first.boundingBox(); const firstEyeBox=await showFirst.boundingBox();
      assert.ok(firstBox && firstEyeBox); assert.ok(firstEyeBox.x >= firstBox.x + firstBox.width - 72); assert.ok(firstEyeBox.y >= firstBox.y - 1 && firstEyeBox.y + firstEyeBox.height <= firstBox.y + firstBox.height + 1);
      await showFirst.click();
      assert.equal(await first.getAttribute('type'),'text'); assert.equal(await confirm.getAttribute('type'),'password');
      await t.page.getByRole('button',{name:'Hide new password',exact:true}).click();
      assert.equal(await first.getAttribute('type'),'password');
      await first.fill('Synthetic-new-password-123'); await confirm.fill('Synthetic-new-password-123');
      await t.page.getByRole('button',{name:'Set password for this account'}).click();
      await t.page.getByRole('heading',{name:'Password updated.',exact:true}).waitFor();
      await switchButton(t).click();
      const switched=t.page.locator('#post-recovery-password'); await switched.waitFor();
      assert.equal(await switched.getAttribute('type'),'password');
      const showSwitched=t.page.getByRole('button',{name:'Show newly created password',exact:true});
      const switchedBox=await switched.boundingBox(); const switchedEyeBox=await showSwitched.boundingBox();
      assert.ok(switchedBox && switchedEyeBox); assert.ok(switchedEyeBox.x >= switchedBox.x + switchedBox.width - 76); assert.ok(switchedEyeBox.y >= switchedBox.y - 1 && switchedEyeBox.y + switchedEyeBox.height <= switchedBox.y + switchedBox.height + 1);
      await showSwitched.click();
      assert.equal(await switched.getAttribute('type'),'text');
      await t.page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      await t.page.waitForFunction(()=>document.querySelector('#post-recovery-password')?.getAttribute('type')==='password');
      assert.deepEqual(t.errors,[]);
    } finally { await t.context.close(); }
  });
  await check('Completed reset preserves admin until consent, then authenticates only the target using a fresh password',async()=>{
    const t=await setup();
    try {
      await reset(t); assert.equal((await stored(t)).user.id,ADMIN.id); assert.equal(signins(t).length,0);
      assert.equal(await t.page.getByRole('link',{name:'Return to ElevationPilot'}).count(),0);
      await t.page.screenshot({path:'test-results/post-recovery/switch-warning-desktop.png',fullPage:true});
      await switchButton(t).click(); await t.page.locator('#post-recovery-password').waitFor();
      assert.equal(await stored(t),null); assert.equal(await t.page.locator('#post-recovery-password').inputValue(),'');
      assert.equal(await t.page.locator('#post-recovery-email').inputValue(),TARGET.email);
      assert.equal(await t.page.locator('#post-recovery-email').getAttribute('readonly'),'');
      await t.page.locator('#post-recovery-email').evaluate((node)=>{node.value='admin@example.test';});
      await t.page.locator('#post-recovery-password').fill('Synthetic-new-password-123');
      await t.page.getByRole('button',{name:'Sign in',exact:true}).click(); await t.page.waitForURL(ORIGIN+'/');
      assert.equal((await stored(t)).user.id,TARGET.id); assert.equal(signins(t).length,1); assert.equal(signins(t)[0].identifier,TARGET.email);
      assert.equal(t.calls.filter((c)=>c.path==='/auth/v1/logout' && c.bearer==='Bearer '+ADMIN_TOKEN).length,1);
      assert.ok(t.calls.filter((c)=>c.path==='/auth/v1/logout').every((c)=>c.search==='?scope=local'));
      assert.deepEqual(t.errors,[]);
    } finally { await t.context.close(); }
  });
  await check('No saved login still requires a password after reset',async()=>{
    const t=await setup({seed:false}); try { await reset(t); await switchButton(t).click(); await t.page.locator('#post-recovery-password').waitFor(); assert.equal(signins(t).length,0); assert.equal(await stored(t),null); assert.deepEqual(t.errors,[]); } finally { await t.context.close(); }
  });
  await check('Failed local logout cannot expose the new sign-in form or reopen an account',async()=>{
    const t=await setup({signoutFailure:true}); try { await reset(t); await switchButton(t).click(); await t.page.getByRole('alert').waitFor(); assert.match(await t.page.getByRole('alert').innerText(),/could not finish signing out/); assert.equal(await t.page.locator('#post-recovery-password').count(),0); assert.equal(signins(t).length,0); const remaining=await stored(t); assert.notEqual(remaining?.user?.id,TARGET.id); assert.notEqual(t.page.url(),ORIGIN+'/'); assert.deepEqual(t.errors,[]); } finally { await t.context.close(); }
  });
  await check('Rejected new password stays on target sign-in without reviving the previous session',async()=>{
    const t=await setup({badPassword:true}); try { await reset(t); await switchButton(t).click(); await t.page.locator('#post-recovery-password').fill('Incorrect-synthetic'); await t.page.getByRole('button',{name:'Sign in',exact:true}).click(); await t.page.getByRole('alert').waitFor(); assert.equal(await stored(t),null); assert.equal(await t.page.locator('#post-recovery-password').inputValue(),''); assert.equal(signins(t).length,1); assert.notEqual(t.page.url(),ORIGIN+'/'); assert.deepEqual(t.errors,[]); } finally { await t.context.close(); }
  });
  await check('A mismatched authenticated identity is blocked before installing its session',async()=>{
    const t=await setup({wrongIdentity:true}); try { await reset(t); await switchButton(t).click(); await t.page.locator('#post-recovery-password').fill('Synthetic-new-password-123'); await t.page.getByRole('button',{name:'Sign in',exact:true}).click(); await t.page.getByRole('alert').waitFor(); assert.match(await t.page.getByRole('alert').innerText(),/did not match/); assert.equal(await stored(t),null); assert.notEqual(t.page.url(),ORIGIN+'/'); assert.deepEqual(t.errors,[]); } finally { await t.context.close(); }
  });
  await check('Another tab signing in requires a new deliberate switch, not a silent overwrite',async()=>{
    const t=await setup(); try { await reset(t); await switchButton(t).click(); await t.page.locator('#post-recovery-password').waitFor(); const other=await t.context.newPage(); await other.goto(ORIGIN+'/session-probe'); await other.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:KEY,value:adminSession}); await t.page.locator('#post-recovery-password').fill('Synthetic-new-password-123'); await t.page.getByRole('button',{name:'Sign in',exact:true}).click(); await t.page.getByRole('alert').waitFor(); assert.match(await t.page.getByRole('alert').innerText(),/Another tab/); assert.equal(signins(t).length,0); assert.equal((await stored(t)).user.id,ADMIN.id); assert.deepEqual(t.errors,[]); } finally { await t.context.close(); }
  });
  await check('Double submission produces one normal sign-in request',async()=>{
    const t=await setup({delay:true}); try { await reset(t); await switchButton(t).click(); await t.page.locator('#post-recovery-password').fill('Synthetic-new-password-123'); await t.page.getByRole('button',{name:'Sign in',exact:true}).evaluate((button)=>{button.click();button.click();}); await t.page.waitForURL(ORIGIN+'/'); assert.equal(signins(t).length,1); assert.deepEqual(t.errors,[]); } finally { await t.context.close(); }
  });
  await check('Mobile completion and prefilled form fit without horizontal overflow',async()=>{
    const t=await setup({mobile:true}); try { await reset(t); assert.equal(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true); await switchButton(t).click(); await t.page.locator('#post-recovery-password').waitFor(); assert.equal(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true); await t.page.screenshot({path:'test-results/post-recovery/new-signin-mobile.png',fullPage:true}); assert.deepEqual(t.errors,[]); } finally { await t.context.close(); }
  });
} finally {
  await writeFile('test-results/post-recovery/results.json',JSON.stringify({synthetic:true,liveAccountsChanged:false,results},null,2));
  if(browser) await browser.close(); server.kill('SIGTERM');
}

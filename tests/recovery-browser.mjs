import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// These tests cannot contact a live Supabase project. Every remote request
// is either fulfilled with synthetic Auth data or blocked.
const ORIGIN = 'http://127.0.0.1:4173';
const AUTH_HOST = 'recovery.example.test';
const TARGET = { id: '11111111-1111-4111-8111-111111111111', email: 'target@example.test', email_confirmed_at: '2026-01-01T00:00:00Z' };
const ADMIN = { id: '22222222-2222-4222-8222-222222222222', email: 'admin@example.test' };
const TARGET_TOKEN = 'synthetic-target-bearer';
const STORAGE_KEY = 'sb-recovery-auth-token';
const ADMIN_SESSION = JSON.stringify({ access_token: 'synthetic-admin-bearer', refresh_token: 'synthetic-admin-refresh', user: ADMIN, expires_at: 4102444800 });
const VALID = '?recovery=1&recovery_email=target%40example.test&token_hash=synthetic-code&type=recovery';
const results = [];
await mkdir('test-results/recovery', { recursive: true });
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: ['ignore', 'ignore', 'inherit'] });
let browser;

async function ready() {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(ORIGIN)).ok) return; } catch {}
    if (server.exitCode !== null) throw new Error('Preview server exited early');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not start');
}

async function setup({ reject = false, mismatch = false, mobile = false, seed = true } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  if (seed) await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: ADMIN_SESSION });
  const calls = [];
  const scripts = [];
  const errors = [];
  let reads = 0;
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) {
      if (url.pathname.endsWith('.js')) scripts.push(url.pathname);
      return route.continue();
    }
    if (url.hostname !== AUTH_HOST) return route.abort();
    const headers = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type', 'Content-Type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    calls.push({ path: url.pathname, method: request.method(), authorization: request.headers().authorization, body: request.postDataJSON() });
    if (url.pathname === '/auth/v1/verify') {
      if (reject) return route.fulfill({ status: 400, headers, body: JSON.stringify({ error_code: 'otp_expired' }) });
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ access_token: TARGET_TOKEN, refresh_token: 'synthetic-target-refresh', user: TARGET, token_type: 'bearer', expires_in: 3600 }) });
    }
    if (url.pathname === '/auth/v1/user') {
      if (request.headers().authorization !== 'Bearer ' + TARGET_TOKEN) return route.fulfill({ status: 401, headers, body: '{}' });
      if (request.method() === 'GET') reads++;
      return route.fulfill({ status: 200, headers, body: JSON.stringify(mismatch && reads > 1 ? ADMIN : TARGET) });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers });
    return route.fulfill({ status: 404, headers, body: '{}' });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, calls, scripts, errors };
}

async function check(label, run) {
  try { await run(); results.push({ label, passed: true }); console.log('PASS: ' + label); }
  catch (error) { results.push({ label, passed: false, error: error.message }); throw error; }
}
const passwordWrites = (calls) => calls.filter((call) => call.path === '/auth/v1/user' && call.method === 'PUT');
const noPlatformInit = (scripts) => assert.equal(scripts.some((path) => /PlatformApp-/.test(path)), false);

try {
  await ready();
  browser = await chromium.launch({ headless: true });
  await check('Hint-only page cannot use the signed-in admin session', async () => {
    const t = await setup();
    try {
      await t.page.goto(ORIGIN + '/?recovery=1');
      await t.page.getByRole('heading', { name: 'This reset link cannot be used.' }).waitFor();
      assert.equal(await t.page.locator('input[type=password]').count(), 0);
      assert.equal(t.calls.length, 0);
      noPlatformInit(t.scripts);
      assert.equal(await t.page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), ADMIN_SESSION);
      assert.deepEqual(t.errors, []);
      await t.page.screenshot({ path: 'test-results/recovery/blocked-link-desktop.png', fullPage: true });
    } finally { await t.context.close(); }
  });
  await check('Banned link gives account-help message and no reset form', async () => {
    const t = await setup();
    try {
      await t.page.goto(ORIGIN + '/?recovery=1#error_code=user_banned');
      await t.page.getByRole('heading', { name: 'Account access needs review.' }).waitFor();
      assert.equal(await t.page.locator('input[type=password]').count(), 0);
      assert.equal(t.calls.length, 0);
      noPlatformInit(t.scripts);
      assert.deepEqual(t.errors, []);
    } finally { await t.context.close(); }
  });
  await check('Rejected token never falls back to the admin account', async () => {
    const t = await setup({ reject: true });
    try {
      await t.page.goto(ORIGIN + '/' + VALID);
      await t.page.getByRole('heading', { name: 'This reset link cannot be used.' }).waitFor();
      assert.equal(await t.page.locator('input[type=password]').count(), 0);
      assert.equal(passwordWrites(t.calls).length, 0);
      assert.equal(t.calls.filter((call) => call.path === '/auth/v1/verify').length, 1);
      noPlatformInit(t.scripts);
      assert.deepEqual(t.errors, []);
    } finally { await t.context.close(); }
  });
  await check('Valid reset changes only the verified target while admin is signed in', async () => {
    const t = await setup();
    try {
      await t.page.goto(ORIGIN + '/' + VALID);
      await t.page.locator('#recovery-password').waitFor();
      assert.equal(await t.page.locator('.eig-recovery-identity strong').innerText(), TARGET.email);
      assert.equal(new URL(t.page.url()).search, '?recovery=1');
      assert.equal(new URL(t.page.url()).hash, '');
      noPlatformInit(t.scripts);
      await t.page.screenshot({ path: 'test-results/recovery/verified-target-desktop.png', fullPage: true });
      await t.page.locator('#recovery-password').fill('Synthetic-only-password-123');
      await t.page.locator('#recovery-confirmation').fill('Synthetic-only-password-123');
      await t.page.getByRole('button', { name: 'Set password for this account' }).click();
      await t.page.getByRole('heading', { name: 'Password updated.' }).waitFor();
      assert.equal(passwordWrites(t.calls).length, 1);
      assert.equal(passwordWrites(t.calls)[0].authorization, 'Bearer ' + TARGET_TOKEN);
      assert.equal(t.calls.filter((call) => call.path === '/auth/v1/verify').length, 1);
      assert.equal(await t.page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), ADMIN_SESSION);
      assert.deepEqual(t.errors, []);
    } finally { await t.context.close(); }
  });
  await check('Identity mismatch during save blocks the password write', async () => {
    const t = await setup({ mismatch: true });
    try {
      await t.page.goto(ORIGIN + '/' + VALID);
      await t.page.locator('#recovery-password').fill('Synthetic-only-password-123');
      await t.page.locator('#recovery-confirmation').fill('Synthetic-only-password-123');
      await t.page.getByRole('button', { name: 'Set password for this account' }).click();
      await t.page.getByRole('heading', { name: 'This reset link cannot be used.' }).waitFor();
      assert.equal(passwordWrites(t.calls).length, 0);
      assert.deepEqual(t.errors, []);
    } finally { await t.context.close(); }
  });
  await check('Implicit recovery is isolated and readable at mobile width', async () => {
    const t = await setup({ mobile: true });
    try {
      await t.page.goto(ORIGIN + '/?recovery=1#access_token=' + TARGET_TOKEN + '&refresh_token=synthetic-refresh&type=recovery');
      await t.page.locator('#recovery-password').waitFor();
      assert.equal(await t.page.locator('.eig-recovery-identity strong').innerText(), TARGET.email);
      assert.equal(await t.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      assert.equal(t.calls.filter((call) => call.path === '/auth/v1/verify').length, 0);
      noPlatformInit(t.scripts);
      assert.deepEqual(t.errors, []);
      await t.page.screenshot({ path: 'test-results/recovery/verified-target-mobile.png', fullPage: true });
    } finally { await t.context.close(); }
  });
  await check('Normal sign-in still loads outside recovery', async () => {
    const t = await setup({ seed: false });
    try {
      await t.page.goto(ORIGIN + '/');
      await t.page.getByRole('heading', { name: 'One login. Every EIG workspace.' }).waitFor();
      assert.equal(t.scripts.some((path) => /PlatformApp-/.test(path)), true);
      assert.equal(await t.page.locator('.eig-recovery-card').count(), 0);
      assert.deepEqual(t.errors, []);
    } finally { await t.context.close(); }
  });
} finally {
  await writeFile('test-results/recovery/results.json', JSON.stringify({ synthetic: true, liveAccountsChanged: false, results }, null, 2));
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

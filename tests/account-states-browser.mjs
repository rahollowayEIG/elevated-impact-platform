import { chromium } from 'playwright';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({ server: { host: '127.0.0.1', port: 4199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const results = [];
await mkdir('test-results/account-states', { recursive: true });
const user = (active = false, unlocked = false, id = 'synthetic-target') => ({ id, email: id + '@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', banned_until: unlocked ? null : '2126-01-01T00:00:00Z', is_test_account: true, memberships: [], assignments: [], profile: { display_name: 'Avery Tester', username: 'avery_test', account_status: active ? 'active' : 'deactivated' } });
async function fixture(initial = user(), mode = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const data = { target: initial, writes: [], requests: [], unexpected: [] };
  page.on('pageerror', (error) => data.unexpected.push(error.message));
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'state.example.test' || url.pathname !== '/functions/v1/platform-invite') {
      data.unexpected.push(url.origin + url.pathname); return route.abort();
    }
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers, body: '{}' });
    const body = route.request().postDataJSON(); data.requests.push(body);
    if (body.action === 'admin_users') return route.fulfill({ status: 200, headers, body: JSON.stringify({ success: true, users: [data.target], invitations: [], identity_review: { unclaimed: [], merged: [] }, stats: { accounts: 1 } }) });
    assert.equal(body.action, 'admin_security'); data.writes.push(body);
    if (mode.delay) await new Promise((resolve) => setTimeout(resolve, 350));
    if (mode.fail) return route.fulfill({ status: 500, headers, body: JSON.stringify({ success: false, error: 'Synthetic save failure' }) });
    if (body.operation === 'deactivate_account') data.target.profile.account_status = 'deactivated';
    if (body.operation === 'reactivate_account') data.target.profile.account_status = 'active';
    if (body.operation === 'disable_account') data.target.banned_until = '2126-01-01T00:00:00Z';
    if (body.operation === 'unlock_account') data.target.banned_until = null;
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ success: true, user_id: data.target.id, operation: body.operation }) });
  });
  await page.goto('http://127.0.0.1:4199/tests/account-states.html');
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.locator('.eig-account-states').waitFor();
  return { page, context, data, mode };
}
async function check(name, run) { await run(); results.push(name); console.log('PASS:', name); }
const switchFor = (page, name) => page.getByRole('switch', { name, exact: true });
async function expectState(page, name, state) { await page.waitForFunction(({ name, state }) => [...document.querySelectorAll('[role="switch"]')].some((node) => document.getElementById(node.getAttribute('aria-labelledby'))?.textContent === name && node.getAttribute('aria-checked') === String(state)), { name, state }); }
async function change(page, name, action) { await switchFor(page, name).click(); await page.getByRole('dialog').getByRole('button', { name: action, exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'detached' }); }
try {
  await check('Both independent Off states are visible; Cancel writes nothing and restores keyboard focus', async () => {
    const { page, context, data } = await fixture();
    await expectState(page, 'Account active', false); await expectState(page, 'Sign-in unlocked', false);
    await switchFor(page, 'Account active').click(); await expectState(page, 'Account active', false);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(data.writes.length, 0); assert.equal(await switchFor(page, 'Account active').evaluate((node) => node === document.activeElement), true);
    assert.equal(data.unexpected.length, 0); await context.close();
  });
  await check('All four transitions save only the intended setting and display readback', async () => {
    const { page, context, data } = await fixture();
    await change(page, 'Account active', 'Reactivate account'); await expectState(page, 'Account active', true); await expectState(page, 'Sign-in unlocked', false);
    await change(page, 'Sign-in unlocked', 'Unlock sign-in'); await expectState(page, 'Sign-in unlocked', true);
    await change(page, 'Account active', 'Deactivate account'); await expectState(page, 'Account active', false); await expectState(page, 'Sign-in unlocked', true);
    await change(page, 'Sign-in unlocked', 'Lock sign-in'); await expectState(page, 'Sign-in unlocked', false);
    assert.deepEqual(data.writes.map((row) => row.operation), ['reactivate_account', 'unlock_account', 'deactivate_account', 'disable_account']);
    assert.ok(data.writes.every((row) => row.target_user_id === 'synthetic-target'));
    await page.locator('.eig-account-states').screenshot({ path: 'test-results/account-states/desktop.png' });
    assert.equal(data.unexpected.length, 0); await context.close();
  });
  await check('Failed save keeps the last confirmed state and requires refresh', async () => {
    const { page, context, data, mode } = await fixture(user(true, true), { fail: true });
    await change(page, 'Sign-in unlocked', 'Lock sign-in');
    await expectState(page, 'Sign-in unlocked', true); assert.equal(await switchFor(page, 'Sign-in unlocked').isDisabled(), true);
    await page.getByRole('alert').waitFor(); mode.fail = false;
    await page.getByRole('button', { name: 'Refresh states', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[role="switch"]').disabled);
    assert.equal(data.writes.length, 1); assert.equal(data.unexpected.length, 0); await context.close();
  });
  await check('Stale confirmation is rejected without a mutation', async () => {
    const { page, context, data } = await fixture(user(true, true));
    await switchFor(page, 'Sign-in unlocked').click(); data.target.profile.account_status = 'deactivated';
    await page.getByRole('dialog').getByRole('button', { name: 'Lock sign-in', exact: true }).click();
    await page.getByRole('alert').waitFor(); assert.equal(data.writes.length, 0);
    await expectState(page, 'Account active', false); assert.equal(data.unexpected.length, 0); await context.close();
  });
  await check('Repeated click during save cannot submit a second mutation', async () => {
    const { page, context, data } = await fixture(user(), { delay: true });
    await switchFor(page, 'Sign-in unlocked').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Unlock sign-in', exact: true }).evaluate((button) => { button.click(); button.click(); });
    await expectState(page, 'Sign-in unlocked', true); assert.equal(data.writes.length, 1);
    assert.equal(data.unexpected.length, 0); await context.close();
  });
  await check('Unknown states are not On/Off guesses; self account is protected', async () => {
    const unknown = user(); delete unknown.profile.account_status;
    const first = await fixture(unknown); assert.equal(await first.page.getByRole('switch', { name: 'Account active' }).count(), 0);
    assert.equal(await switchFor(first.page, 'Sign-in unlocked').isDisabled(), true); await first.context.close();
    const second = await fixture(user(true, true, 'synthetic-admin'));
    assert.equal(await switchFor(second.page, 'Account active').isDisabled(), true); assert.equal(await switchFor(second.page, 'Sign-in unlocked').isDisabled(), true);
    assert.equal(second.data.writes.length, 0); await second.context.close();
  });
  await check('Mobile panel and confirmation fit; keyboard Escape cancels', async () => {
    const { page, context, data } = await fixture(); await page.setViewportSize({ width: 390, height: 844 });
    const panel = page.locator('.eig-account-states'); await panel.scrollIntoViewIfNeeded();
    assert.equal(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true);
    await switchFor(page, 'Sign-in unlocked').focus(); await page.keyboard.press('Space');
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await dialog.evaluate((node) => node.getBoundingClientRect().right <= innerWidth), true);
    await page.screenshot({ path: 'test-results/account-states/mobile-confirmation.png' });
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); assert.equal(data.writes.length, 0);
    assert.equal(data.unexpected.length, 0); await context.close();
  });
  await writeFile('test-results/account-states/report.json', JSON.stringify({ passed: results.length, cases: results, syntheticOnly: true }, null, 2));
} finally { await browser.close(); await server.close(); }

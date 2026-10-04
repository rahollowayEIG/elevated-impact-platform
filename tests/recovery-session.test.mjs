import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecoveryEntry, cleanRecoveryUrl, createRecoveryApi, createRecoveryController } from '../src/auth/recovery-session.mjs';

const HOME = 'https://platform.example.test/';
const TARGET = { id: 'synthetic-target', email: 'target@example.test' };
const ADMIN = { id: 'synthetic-admin', email: 'admin@example.test' };
const TOKEN = 'synthetic-target-bearer';
const LINK = HOME + '?recovery=1&recovery_email=target%40example.test&token_hash=synthetic-one-use-code&type=recovery';
const password = 'synthetic-test-password-not-a-real-account';

function fixture(overrides = {}) {
  const calls = [];
  const api = {
    verify: async (hash) => { calls.push(['verify', hash]); return { access_token: TOKEN, user: TARGET }; },
    getUser: async (token) => { calls.push(['getUser', token]); return TARGET; },
    updatePassword: async (token, value) => { calls.push(['updatePassword', token, value]); return TARGET; },
    endSession: async (token) => { calls.push(['endSession', token]); },
    ...overrides,
  };
  const controller = createRecoveryController(parseRecoveryEntry(LINK), api);
  return { calls, api, controller };
}

test('ordinary Airport, event, login and invitation URLs keep the normal app', () => {
  for (const suffix of ['#airport', '#events/example', '', '?invite=1&token_hash=x&type=invite', '#access_token=x&refresh_token=y&type=magiclink']) {
    assert.equal(parseRecoveryEntry(HOME + suffix).kind, 'normal');
  }
});

test('legacy verification emails with recovery=1 do not acquire reset privileges', () => {
  const entry = parseRecoveryEntry(HOME + '?recovery=1&recovery_email=target%40example.test&token_hash=x&type=signup');
  assert.equal(entry.kind, 'normal');
  assert.equal(entry.normalizedUrl, '/?token_hash=x&type=signup');
});

test('admin recovery token hash is recognized; email hint is normalized', () => {
  const entry = parseRecoveryEntry(LINK.replace('target%40', 'TARGET%40'));
  assert.equal(entry.mode, 'token_hash');
  assert.equal(entry.expectedEmail, TARGET.email);
});

test('self-service implicit callback is recognized without retaining its refresh token', () => {
  const entry = parseRecoveryEntry(HOME + '?recovery=1#access_token=x&refresh_token=y&type=recovery');
  assert.equal(entry.mode, 'implicit');
  assert.equal(entry.accessToken, 'x');
  assert.equal(entry.refreshToken, undefined);
});

test('callback credentials and email hints are removed from browser history', () => {
  assert.equal(cleanRecoveryUrl(LINK + '#access_token=secret&refresh_token=secret'), '/?recovery=1');
});

test('recovery hint alone cannot authorize the existing account', async () => {
  const { api, calls } = fixture();
  const controller = createRecoveryController(parseRecoveryEntry(HOME + '?recovery=1'), api);
  await assert.rejects(controller.verify(), { code: 'invalid_link' });
  await assert.rejects(controller.savePassword(password));
  assert.deepEqual(calls, []);
});

test('disabled callback is blocked before any request, even with a logged-in account', async () => {
  const { api, calls } = fixture();
  const entry = parseRecoveryEntry(HOME + '?recovery=1#error=access_denied&error_description=User+is+banned');
  const controller = createRecoveryController(entry, api);
  await assert.rejects(controller.verify(), { code: 'account_disabled' });
  assert.equal(controller.getPhase(), 'blocked');
  assert.deepEqual(calls, []);
});

test('expired or reused callback never falls back to an existing login', async () => {
  const { api, calls } = fixture();
  const entry = parseRecoveryEntry(HOME + '?recovery=1#error_code=otp_expired');
  await assert.rejects(createRecoveryController(entry, api).verify(), { code: 'invalid_link' });
  assert.deepEqual(calls, []);
});

test('conflicting, duplicated, unknown and incomplete credentials fail closed', () => {
  for (const suffix of [
    '?recovery=1&token_hash=a&token_hash=b&type=recovery',
    '?recovery=1&token_hash=a&type=recovery#type=signup',
    '?recovery=1&token_hash=a&type=unknown',
    '?recovery=1&code=pkce-without-supported-verifier',
    '?recovery=1#access_token=x&type=recovery',
    '?recovery=1&token_hash=a&type=recovery#access_token=x&refresh_token=y&type=recovery',
  ]) assert.equal(parseRecoveryEntry(HOME + suffix).mode, 'invalid', suffix);
});

test('cross-account reset only uses the token-verified target and never browser storage', async () => {
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Recovery must never read the admin session'); } });
  try {
    const sharedSession = { user: ADMIN, access_token: 'synthetic-admin-bearer' };
    const snapshot = JSON.stringify(sharedSession);
    const { controller, calls } = fixture();
    assert.deepEqual(await controller.verify(), TARGET);
    assert.deepEqual(await controller.savePassword(password), TARGET);
    assert.equal(JSON.stringify(sharedSession), snapshot);
    assert.deepEqual(calls.filter(([name]) => name === 'updatePassword'), [['updatePassword', TOKEN, password]]);
    assert.ok(calls.filter(([name]) => name === 'getUser').every(([, token]) => token === TOKEN));
    assert.equal(controller.getPhase(), 'complete');
  } finally {
    if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
    else delete globalThis.localStorage;
  }
});

test('StrictMode or repeated verification redeems the link exactly once', async () => {
  const { controller, calls } = fixture();
  await Promise.all([controller.verify(), controller.verify(), controller.verify()]);
  assert.equal(calls.filter(([name]) => name === 'verify').length, 1);
});

test('invalid token response does not expose a password form or change an account', async () => {
  const { controller, calls } = fixture({ verify: async () => { throw new Error('Provider rejected token'); } });
  await assert.rejects(controller.verify());
  await assert.rejects(controller.savePassword(password));
  assert.equal(calls.filter(([name]) => name === 'updatePassword').length, 0);
});

test('verification response identity must match server-validated bearer identity', async () => {
  const { controller } = fixture({ getUser: async () => ADMIN });
  await assert.rejects(controller.verify(), { code: 'identity_mismatch' });
  assert.equal(controller.getPhase(), 'blocked');
});

test('untrusted email hint cannot select another account', async () => {
  const { api, calls } = fixture();
  const entry = parseRecoveryEntry(LINK.replace('target%40example.test', 'admin%40example.test'));
  const controller = createRecoveryController(entry, api);
  await assert.rejects(controller.verify(), { code: 'identity_mismatch' });
  await assert.rejects(controller.savePassword(password));
  assert.equal(calls.filter(([name]) => name === 'updatePassword').length, 0);
});

test('implicit recovery pins the identity returned by the Auth server', async () => {
  const { api, calls } = fixture();
  const controller = createRecoveryController(parseRecoveryEntry(HOME + '?recovery=1#access_token=' + TOKEN + '&refresh_token=x&type=recovery'), api);
  assert.deepEqual(await controller.verify(), TARGET);
  await controller.savePassword(password);
  assert.equal(calls.filter(([name]) => name === 'verify').length, 0);
  assert.equal(calls.find(([name]) => name === 'updatePassword')[1], TOKEN);
});

test('a changed or expired identity immediately before saving blocks the write', async () => {
  let reads = 0;
  const { controller, calls } = fixture({ getUser: async () => ++reads === 1 ? TARGET : ADMIN });
  await controller.verify();
  await assert.rejects(controller.savePassword(password), { code: 'identity_mismatch' });
  assert.equal(calls.filter(([name]) => name === 'updatePassword').length, 0);
});

test('disabled target returned by the server blocks recovery', async () => {
  const { controller } = fixture({ getUser: async () => ({ ...TARGET, banned_until: '2199-01-01T00:00:00Z' }) });
  await assert.rejects(controller.verify(), { code: 'account_disabled' });
});

test('a password cannot be changed before verification or after completion', async () => {
  const { controller, calls } = fixture();
  await assert.rejects(controller.savePassword(password));
  await controller.verify();
  await controller.savePassword(password);
  await assert.rejects(controller.savePassword(password));
  assert.equal(calls.filter(([name]) => name === 'updatePassword').length, 1);
});

test('concurrent saves cannot trigger a second password update', async () => {
  const { controller, calls } = fixture();
  await controller.verify();
  await Promise.allSettled([controller.savePassword(password), controller.savePassword(password)]);
  assert.equal(calls.filter(([name]) => name === 'updatePassword').length, 1);
});

test('weak local password validation does not call the server', async () => {
  const { controller, calls } = fixture();
  await controller.verify();
  await assert.rejects(controller.savePassword('short'), { code: 'password_rejected' });
  assert.equal(calls.filter(([name]) => name === 'updatePassword').length, 0);
  assert.equal(controller.getPhase(), 'ready');
});

test('HTTP adapter sends a password only with the explicitly pinned bearer', async () => {
  const requests = [];
  const api = createRecoveryApi({ supabaseUrl: 'https://auth.example.test', publicKey: 'synthetic-public-key', fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify(TARGET), { status: 200 });
  } });
  await api.updatePassword(TOKEN, password);
  const { url, options } = requests[0];
  assert.equal(url, 'https://auth.example.test/auth/v1/user');
  assert.equal(options.headers.Authorization, 'Bearer ' + TOKEN);
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
  assert.deepEqual(JSON.parse(options.body), { password });
});

test('HTTP verification is recovery-only and never includes the admin bearer', async () => {
  const api = createRecoveryApi({ supabaseUrl: 'https://auth.example.test', publicKey: 'synthetic-public-key', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://auth.example.test/auth/v1/verify');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { token_hash: 'synthetic-code', type: 'recovery' });
    return new Response(JSON.stringify({ access_token: TOKEN, user: TARGET }), { status: 200 });
  } });
  await api.verify('synthetic-code');
});

test('HTTP banned errors use a controlled message, never raw provider data', async () => {
  const api = createRecoveryApi({ supabaseUrl: 'https://auth.example.test', publicKey: 'synthetic-public-key', fetchImpl: async () => new Response(JSON.stringify({ error_code: 'user_banned', message: 'User is banned' }), { status: 403 }) });
  await assert.rejects(api.verify('x'), { code: 'account_disabled' });
});

test('network uncertainty after PUT is not reported as success and cannot auto-retry', async () => {
  const api = createRecoveryApi({ supabaseUrl: 'https://auth.example.test', publicKey: 'synthetic-public-key', fetchImpl: async () => { throw new Error('Network disconnected'); } });
  await assert.rejects(api.updatePassword(TOKEN, password), { code: 'save_unconfirmed' });
});

test('missing or insecure project configuration is rejected', () => {
  assert.throws(() => createRecoveryApi({ supabaseUrl: 'http://auth.example.test', publicKey: 'x' }), { code: 'configuration' });
  assert.throws(() => createRecoveryApi({ supabaseUrl: '', publicKey: '' }), { code: 'configuration' });
});

test('unexpected account in update response is not presented as successful', async () => {
  const { controller } = fixture({ updatePassword: async () => ADMIN });
  await controller.verify();
  await assert.rejects(controller.savePassword(password), { code: 'save_unconfirmed' });
  assert.equal(controller.getPhase(), 'blocked');
});

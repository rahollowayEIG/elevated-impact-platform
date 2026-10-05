import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostRecoverySignInController } from '../src/auth/post-recovery-signin.mjs';

const TARGET = { id: 'target-id', email: 'target@example.test' };
const ADMIN = { id: 'admin-id', email: 'admin@example.test' };
const session = (user, token = 'synthetic-admin-token') => ({ user, access_token: token, refresh_token: 'synthetic-refresh' });
function fixture(options = {}) {
  let saved = options.noSession ? null : session(ADMIN);
  let loadCount = 0;
  const calls = [];
  const client = {
    auth: {
      async signOut(settings) {
        calls.push(['signOut', settings]);
        if (options.signoutError) return { error: new Error('offline') };
        if (!options.keepsSession) saved = null;
        return { error: null };
      },
      async getSession() { return { data: { session: saved }, error: options.readError ? new Error('unavailable') : null }; },
      async getUser(token) {
        calls.push(['getUser', token]);
        return { data: { user: options.wrongIdentity ? ADMIN : TARGET }, error: null };
      },
      async setSession(tokens) {
        calls.push(['setSession', tokens]);
        if (options.installError) return { error: new Error('install failed') };
        saved = options.changedReadback ? session(ADMIN) : session(TARGET, tokens.access_token);
        return { data: { user: TARGET, session: saved }, error: null };
      },
    },
    functions: {
      async invoke(name, optionsArg) {
        calls.push(['invoke', name, optionsArg.body.identifier]);
        if (options.wait) await options.wait;
        if (options.rejectCredentials) return { data: { error: 'Invalid credentials' } };
        if (options.sessionDuringSignIn) saved = session(ADMIN);
        return { data: { access_token: 'synthetic-new-target-token', refresh_token: 'synthetic-new-refresh' }, error: null };
      },
    },
  };
  const targetInput = { ...TARGET };
  const controller = createPostRecoverySignInController(targetInput, async () => { loadCount++; return client; });
  return { controller, calls, client, targetInput, getSaved: () => saved, setSaved: (value) => { saved = value; }, getLoads: () => loadCount };
}

test('constructing the post-reset step does not sign anyone out or load the shared client', () => {
  const f = fixture(); assert.equal(f.getLoads(), 0); assert.deepEqual(f.calls, []); assert.equal(f.getSaved().user.id, ADMIN.id);
});
test('cannot authenticate before explicit account-switch consent', async () => {
  const f = fixture(); await assert.rejects(f.controller.signIn('synthetic-password'), { code: 'not_ready' }); assert.deepEqual(f.calls, []);
});
test('prepare signs out only locally and verifies the session is cleared', async () => {
  const f = fixture(); await f.controller.prepare(); assert.deepEqual(f.calls, [['signOut', { scope: 'local' }]]); assert.equal(f.getSaved(), null); assert.equal(f.controller.getPhase(), 'ready');
});
test('no existing login still requires new credentials, never auto-authenticates', async () => {
  const f = fixture({ noSession: true }); await f.controller.prepare(); assert.equal(f.controller.getPhase(), 'ready'); assert.equal(f.calls.filter(([name]) => name === 'invoke').length, 0);
});
test('repeated prepare shares one operation', async () => {
  const f = fixture(); await Promise.all([f.controller.prepare(), f.controller.prepare()]); assert.equal(f.getLoads(), 1); assert.equal(f.calls.length, 1);
});
for (const mode of ['signoutError', 'keepsSession', 'readError']) {
  test(mode + ' blocks fresh sign-in and does not report success', async () => {
    const f = fixture({ [mode]: true }); await assert.rejects(f.controller.prepare()); assert.equal(f.controller.getPhase(), 'blocked'); await assert.rejects(f.controller.signIn('synthetic-password')); assert.equal(f.calls.filter(([name]) => name === 'invoke').length, 0);
  });
}
test('exact target password sign-in uses the existing platform workflow and verifies before storage', async () => {
  const f = fixture(); await f.controller.prepare(); f.targetInput.email = ADMIN.email;
  const result = await f.controller.signIn('synthetic-new-password'); assert.deepEqual(result, TARGET);
  assert.deepEqual(f.calls.map(([name]) => name), ['signOut', 'invoke', 'getUser', 'setSession', 'getUser']);
  assert.deepEqual(f.calls[1], ['invoke', 'golf-account-auth', TARGET.email]); assert.equal(f.getSaved().user.id, TARGET.id); assert.equal(f.controller.getPhase(), 'complete');
});
test('empty password performs no sign-in request', async () => {
  const f = fixture(); await f.controller.prepare(); await assert.rejects(f.controller.signIn(''), { code: 'password_required' }); assert.equal(f.calls.length, 1);
});
test('wrong password does not revive the previous login', async () => {
  const f = fixture({ rejectCredentials: true }); await f.controller.prepare(); await assert.rejects(f.controller.signIn('incorrect'), { code: 'signin_failed' }); assert.equal(f.getSaved(), null); assert.equal(f.controller.getPhase(), 'ready'); assert.equal(f.calls.some(([name]) => name === 'setSession'), false);
});
test('mismatched auth identity is never installed', async () => {
  const f = fixture({ wrongIdentity: true }); await f.controller.prepare(); await assert.rejects(f.controller.signIn('synthetic'), { code: 'identity_mismatch' }); assert.equal(f.getSaved(), null); assert.equal(f.calls.some(([name]) => name === 'setSession'), false);
});
test('another tab signing in before submission stops without overwriting it', async () => {
  const f = fixture(); await f.controller.prepare(); f.setSaved(session(ADMIN)); await assert.rejects(f.controller.signIn('synthetic'), { code: 'session_changed' }); assert.equal(f.calls.length, 1); assert.equal(f.getSaved().user.id, ADMIN.id);
});
test('another tab signing in during the credential check also stops before storage', async () => {
  const f = fixture({ sessionDuringSignIn: true }); await f.controller.prepare(); await assert.rejects(f.controller.signIn('synthetic'), { code: 'session_changed' }); assert.equal(f.calls.some(([name]) => name === 'setSession'), false);
});
for (const mode of ['installError', 'changedReadback']) {
  test(mode + ' prevents a successful completion', async () => {
    const f = fixture({ [mode]: true }); await f.controller.prepare(); await assert.rejects(f.controller.signIn('synthetic')); assert.equal(f.controller.getPhase(), 'blocked');
  });
}
test('duplicate submit cannot authenticate twice', async () => {
  let release; const wait = new Promise((resolve) => { release = resolve; }); const f = fixture({ wait }); await f.controller.prepare();
  const first = f.controller.signIn('synthetic'); await assert.rejects(f.controller.signIn('synthetic'), { code: 'not_ready' }); release(); await first;
  assert.equal(f.calls.filter(([name]) => name === 'invoke').length, 1); await assert.rejects(f.controller.signIn('synthetic'), { code: 'not_ready' });
});
test('requires a completed recovery identity to construct the flow', () => {
  assert.throws(() => createPostRecoverySignInController(null, async () => null), { code: 'missing_identity' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SANDBOX_ACCESS_ROLES,
  normalizeSandboxEmail, isSandboxEmailCode,
  validateSandboxEntitlements, checkSandboxAccess,
  requestSandboxEmailCode, verifySandboxEmailCode,
} from '../src/sandbox/sandboxAccess.mjs';

const verifiedUser = Object.freeze({
  id: '00000000-0000-4000-8000-000000000055',
  email: 'pilot@example.test',
  email_confirmed_at: '2026-10-19T10:00:00.000Z',
});

function fakeClient({ user = verifiedUser, authError = null, payload = {
  authorized: true, active_role: 'pilot', roles: ['pilot','co_pilot','atc','passenger'],
  has_practice_event: true,
}, rpcError = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      async getUser() { calls.push('getUser'); return { data: { user }, error: authError }; },
      async signInWithOtp(args) { calls.push({ method: 'otp', args }); return { error: null }; },
      async verifyOtp(args) { calls.push({ method: 'verify', args }); return { data: { session: { access_token: 'sandbox-test-only' } }, error: null }; },
    },
    async rpc(name) { calls.push({ method: 'rpc', name }); return { data: payload, error: rpcError }; },
  };
}

test('only practice roles, never EIG Administrator, are recognized by the client', () => {
  assert.deepEqual(SANDBOX_ACCESS_ROLES, ['pilot','co_pilot','atc','passenger']);
  const result = validateSandboxEntitlements({
    authorized: true, active_role: 'pilot', roles: ['pilot','co_pilot','atc','passenger'],
    has_practice_event: true,
  });
  assert.equal(result.activeRole, 'pilot');
  assert.deepEqual(result.roles, SANDBOX_ACCESS_ROLES);
  for (const payload of [
    null,
    { authorized: false, active_role: 'pilot', roles: ['pilot'] },
    { authorized: true, active_role: 'pilot', roles: ['pilot','eig_admin'] },
    { authorized: true, active_role: 'eig_admin', roles: ['eig_admin'] },
    { authorized: true, active_role: 'atc', roles: ['pilot'] },
    { authorized: true, active_role: 'pilot', roles: [] },
  ]) assert.equal(validateSandboxEntitlements(payload), null);
});

test('never mounts a workspace if session, confirmation or server role grant is missing', async () => {
  assert.equal((await checkSandboxAccess(fakeClient({ user: null }))).kind, 'signed_out');
  assert.equal((await checkSandboxAccess(fakeClient({ user: { email: verifiedUser.email } }))).kind, 'denied');
  assert.equal((await checkSandboxAccess(fakeClient({ payload: { authorized: false, roles: [] } }))).kind, 'denied');
  assert.equal((await checkSandboxAccess(fakeClient({ payload: { authorized: true, roles: ['eig_admin'], active_role: 'eig_admin' } }))).kind, 'denied');
  assert.equal((await checkSandboxAccess(fakeClient({ rpcError: new Error('Service not ready') }))).kind, 'unavailable');
  assert.equal((await checkSandboxAccess(fakeClient({ authError: new Error('Expired') }))).kind, 'signed_out');
  assert.equal((await checkSandboxAccess(null)).kind, 'unavailable');
});

test('access grant checks identity through Auth and only then the sandbox-only RPC', async () => {
  const c = fakeClient();
  const result = await checkSandboxAccess(c);
  assert.deepEqual(c.calls, ['getUser', { method: 'rpc', name: 'sandbox_practice_role_status' }]);
  assert.equal(result.kind, 'authorized');
  assert.equal(result.access.activeRole, 'pilot');
  assert.equal(result.access.hasPracticeEvent, true);
  const unconfirmed = fakeClient({ user: { email: 'fake@example.test' } });
  await checkSandboxAccess(unconfirmed);
  assert.deepEqual(unconfirmed.calls, ['getUser']);
});

test('email code sign-in is opt-in and cannot create new Auth accounts', async () => {
  assert.equal(normalizeSandboxEmail('  PILOT@EXAMPLE.test  '), 'pilot@example.test');
  assert.equal(normalizeSandboxEmail('bad address'), '');
  assert.equal(isSandboxEmailCode('083471'), true);
  assert.equal(isSandboxEmailCode('83741'), false);
  assert.equal(isSandboxEmailCode('1234567'), false);
  const c = fakeClient();
  assert.equal((await requestSandboxEmailCode(c,'pilot@example.test',false)).ok, false);
  assert.equal((await requestSandboxEmailCode(c,'invalid',true)).ok, false);
  assert.deepEqual(c.calls, []);
  assert.equal((await requestSandboxEmailCode(c,' PILOT@EXAMPLE.test ',true)).ok, true);
  assert.deepEqual(c.calls[0], {
    method: 'otp',
    args: { email: 'pilot@example.test', options: { shouldCreateUser: false } },
  });
});

test('verified six-digit code uses sandbox SDK, not Live sessions or an URL', async () => {
  const c = fakeClient();
  assert.equal((await verifySandboxEmailCode(c,'pilot@example.test','12345',true)).ok,false);
  assert.equal((await verifySandboxEmailCode(c,'pilot@example.test','123456',false)).ok,false);
  assert.equal(c.calls.length,0);
  assert.equal((await verifySandboxEmailCode(c,'pilot@example.test','123456',true)).ok,true);
  assert.deepEqual(c.calls[0], {
    method: 'verify',
    args: { email: 'pilot@example.test', token: '123456', type: 'email' }
  });
});

test('sandbox UI gates ALL app routes and keeps dangerous workflows locked by default', () => {
  const root = readFileSync('src/main.jsx','utf8');
  const gate = readFileSync('src/sandbox/SandboxAccessGate.jsx','utf8');
  assert.match(root, /import SandboxAccessGate from '\.\/sandbox\/SandboxAccessGate\.jsx'/);
  assert.match(root, /IS_SANDBOX \? \(\s*<SandboxAccessGate>/);
  assert.match(root, /SANDBOX_WORKSPACE_ENABLED \? <ElevatedImpactPhaseOneFrontend \/> : <SandboxWorkspaceStaging \/>/);
  assert.match(root, /VITE_SANDBOX_WORKSPACE_ENABLED === 'true'/);
  assert.match(root, /<SandboxPracticeRoles \/>[\s\S]*<\/SandboxAccessGate>/);
  assert.match(gate, /VITE_SANDBOX_EMAIL_CODE_ENABLED === 'true'/);
  assert.match(gate, /checkSandboxAccess\(supabase\)/);
  assert.match(gate, /if \(gate\.kind === 'authorized'\) return <>\{children\}<\/>;/);
  assert.doesNotMatch(gate, /signInWithPassword|signUp\(|setSession\(|auth\.admin|window\.location\.assign/);
  assert.doesNotMatch(root, /<SandboxPersonaLogin \/>/);
  assert.doesNotMatch(gate, /aszixzrdayrivungodwq|golf-account-auth|service_role/i);
});

test('email-code paths are disabled until isolated Auth email template is verified', () => {
  const docs = readFileSync('docs/SANDBOX_APPROVED_ACCESS_BOOTSTRAP.md','utf8');
  assert.match(docs,/shouldCreateUser: false/);
  assert.match(docs,/\{\{ \.Token \}\}/);
  assert.match(docs,/VITE_SANDBOX_EMAIL_CODE_ENABLED/);
  assert.match(docs,/VITE_SANDBOX_WORKSPACE_ENABLED/);
  assert.match(docs,/Live.*(not changed|unchanged|untouched)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const target = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const source = stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/platform-invite/index.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, ''));

function fixture({ denied = false, invalidUser = false, entries = [] } = {}) {
  const calls = [];
  let handler;
  const admin = {
    auth: { getUser: async () => ({ data: { user: invalidUser ? null : { id: actor } } }) },
    rpc: async (name, args) => {
      calls.push({ name, args: structuredClone(args) });
      if (denied || (name === 'platform_revoke_account_sessions' && args.p_target_id === actor)) return { error: { code: '42501' } };
      return { data: name === 'platform_revoke_account_sessions' ? { user_id: args.p_target_id, sessions_revoked: 2 } : null };
    },
    from: (table) => {
      calls.push({ table });
      const query = {};
      for (const method of ['select', 'eq', 'order']) query[method] = (...args) => { calls.push({ table, method, args }); return query; };
      query.limit = async (count) => { calls.push({ table, method: 'limit', args: [count] }); return { data: entries }; };
      query.in = async () => ({ data: [{ id: actor, display_name: '', first_name: '', last_name: '', username: 'admin_handle' }] });
      return query;
    },
  };
  vm.runInNewContext(source, {
    Request, Response, console, atob, crypto,
    createClient: (_url, _key, options) => { if (options.global) calls.push({ actorHeader: options.global.headers['x-eig-actor-id'] }); return admin; },
    Deno: { env: { get: (key) => key === 'SUPABASE_URL' ? 'https://example.test' : 'synthetic-key' }, serve: (value) => { handler = value; } },
  });
  return {
    calls,
    invoke: async (body, claims = { session_id: session }) => {
      const token = `synthetic.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.synthetic`;
      const response = await handler(new Request('https://example.test/platform-invite', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

test('history validates the active session, scopes the target, limits rows and labels actors', async () => {
  const entries = Array.from({ length: 101 }, (_, i) => ({ id: String(i), target_user_id: target, actor_user_id: actor, action: 'sessions_revoked' }));
  const f = fixture({ entries });
  const result = await f.invoke({ action: 'admin_account_history', target_user_id: target });
  assert.equal(result.status, 200);
  assert.equal(result.body.entries.length, 100);
  assert.equal(result.body.has_more, true);
  assert.equal(result.body.entries[0].actor_label, '@admin_handle');
  assert.deepEqual(f.calls.find((x) => x.name === 'platform_assert_active_admin').args, { p_actor_id: actor, p_actor_session_id: session });
  assert.ok(f.calls.some((x) => x.method === 'eq' && x.args[0] === 'target_user_id' && x.args[1] === target));
  assert.ok(f.calls.some((x) => x.method === 'limit' && x.args[0] === 101));
});

test('history denial never reads audit rows', async () => {
  const f = fixture({ denied: true });
  assert.equal((await f.invoke({ action: 'admin_account_history', target_user_id: target })).status, 403);
  assert.equal(f.calls.some((x) => x.table), false);
});

test('invalid Auth user and missing session never reach privileged RPCs', async () => {
  const f = fixture({ invalidUser: true });
  assert.equal((await f.invoke({ action: 'admin_account_history', target_user_id: target })).status, 401);
  assert.equal(f.calls.length, 0);
  const missingSession = fixture();
  assert.equal((await missingSession.invoke({ action: 'admin_account_history', target_user_id: target }, {})).status, 400);
  assert.equal(missingSession.calls.some((x) => x.name), false);
});

test('session revocation forwards only the authenticated actor and exact confirmed target', async () => {
  const f = fixture();
  const result = await f.invoke({ action: 'admin_session_signout', target_user_id: target, confirmation: target, reason: ' Test action ', request_id: requestId, actor_user_id: target });
  assert.equal(result.status, 200);
  assert.equal(result.body.user_id, target);
  assert.equal(result.body.sessions_revoked, 2);
  assert.deepEqual(f.calls.find((x) => x.name === 'platform_revoke_account_sessions').args, {
    p_actor_id: actor, p_actor_session_id: session, p_target_id: target, p_request_id: requestId, p_reason: 'Test action',
  });
  assert.equal(f.calls.find((x) => x.actorHeader).actorHeader, actor);
});

test('wrong confirmation and blank reason make no revocation request; RPC denial stays denied', async () => {
  for (const invalid of [{ confirmation: actor }, { reason: ' ' }]) {
    const f = fixture();
    assert.equal((await f.invoke({ action: 'admin_session_signout', target_user_id: target, confirmation: target, reason: 'Test action', request_id: requestId, ...invalid })).status, 400);
    assert.equal(f.calls.some((x) => x.name === 'platform_revoke_account_sessions'), false);
  }
  const self = fixture();
  assert.equal((await self.invoke({ action: 'admin_session_signout', target_user_id: actor, confirmation: actor, reason: 'Test action', request_id: requestId })).status, 403);
});

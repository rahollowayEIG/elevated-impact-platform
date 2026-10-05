import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionVerifier } from '../src/lib/sessionValidity.mjs';

const session = { access_token: 'synthetic-current-token', user: { id: 'current-person' } };
function fixture(result = { data: { user: session.user }, error: null }) {
  const state = { current: session, invalid: 0, reads: 0, signouts: [] };
  const auth = {
    getUser: async (token) => { assert.equal(token, session.access_token); state.reads++; return result; },
    getSession: async () => ({ data: { session: state.current }, error: null }),
    signOut: async (options) => { state.signouts.push(options); return { error: null }; },
  };
  const guard = createSessionVerifier({ auth, session, isCurrent: () => state.current?.access_token === session.access_token, onInvalid: () => { state.invalid++; } });
  return { state, auth, guard };
}

test('a valid existing session remains signed in', async () => {
  const f = fixture(); await f.guard.check();
  assert.equal(f.state.reads, 1); assert.equal(f.state.invalid, 0); assert.deepEqual(f.state.signouts, []);
});

test('confirmed revoked or unauthorized sessions clear this browser once, using local scope', async () => {
  for (const error of [{ code: 'session_not_found', status: 403 }, { status: 401 }, { code: 'refresh_token_not_found', status: 400 }]) {
    const f = fixture({ data: { user: null }, error });
    await f.guard.check(); await f.guard.check();
    assert.equal(f.state.invalid, 1); assert.deepEqual(f.state.signouts, [{ scope: 'local' }]);
  }
});

test('network failures, rate limits and server errors never sign out a valid account', async () => {
  for (const error of [{ status: 0 }, { status: 429 }, { status: 500 }]) {
    const f = fixture({ data: { user: null }, error }); await f.guard.check();
    assert.equal(f.state.invalid, 0); assert.deepEqual(f.state.signouts, []);
  }
  const f = fixture(); f.auth.getUser = async () => { throw new Error('offline'); };
  await f.guard.check(); assert.equal(f.state.invalid, 0);
  f.auth.getUser = async () => ({ data: { user: null }, error: { code: 'session_not_found', status: 403 } });
  await f.guard.check(); assert.equal(f.state.invalid, 1);
});

test('a newly refreshed token is never cleared by the previous token check', async () => {
  const f = fixture({ data: { user: null }, error: { status: 401 } });
  f.auth.getSession = async () => ({ data: { session: { ...session, access_token: 'synthetic-new-token' } } });
  await f.guard.check(); assert.equal(f.state.invalid, 0); assert.deepEqual(f.state.signouts, []);
});

test('a check disposed during a request cannot clear a later sign-in', async () => {
  const f = fixture(); let finish;
  f.auth.getUser = () => new Promise((resolve) => { finish = resolve; });
  const check = f.guard.check(); f.guard.stop(); f.state.current = { access_token: 'different-person-token', user: { id: 'different-person' } };
  finish({ data: { user: null }, error: { status: 403 } }); await check;
  assert.equal(f.state.invalid, 0); assert.deepEqual(f.state.signouts, []);
});

test('focus and timer checks cannot issue overlapping Auth calls', async () => {
  const f = fixture(); let finish;
  f.auth.getUser = () => { f.state.reads++; return new Promise((resolve) => { finish = resolve; }); };
  const first = f.guard.check(); await f.guard.check(); assert.equal(f.state.reads, 1);
  finish({ data: { user: session.user }, error: null }); await first;
  assert.equal(f.state.invalid, 0);
});

test('an unexpected Auth identity fails closed for the still-current session', async () => {
  const f = fixture({ data: { user: { id: 'unexpected-person' } }, error: null });
  await f.guard.check(); assert.equal(f.state.invalid, 1); assert.deepEqual(f.state.signouts, [{ scope: 'local' }]);
});

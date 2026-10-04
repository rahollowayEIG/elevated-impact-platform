import test from 'node:test';
import assert from 'node:assert/strict';
import { accountState, stateTransition, stateNote, changeAccountState } from '../src/components/account-state.mjs';
const makeUser = (active = true, unlocked = true) => ({ id: 'test-person', email: 'test@example.test', profile: { account_status: active ? 'active' : 'deactivated' }, banned_until: unlocked ? null : '2126-01-01T00:00:00Z' });
for (const active of [true, false]) for (const unlocked of [true, false]) {
  test(`independent states: active=${active}, unlocked=${unlocked}`, () => {
    const user = makeUser(active, unlocked);
    assert.deepEqual(accountState(user), { active, unlocked });
    assert.equal(stateTransition(user, active ? 'deactivate_account' : 'reactivate_account').to, !active);
    assert.equal(stateTransition(user, unlocked ? 'disable_account' : 'unlock_account').to, !unlocked);
    assert.ok(stateNote(user));
  });
}
test('missing profile or lock data is unknown, never fabricated Active/Unlocked', () => {
  assert.deepEqual(accountState({}), { active: null, unlocked: null });
  assert.equal(accountState({ banned_until: 'invalid' }).unlocked, null);
  assert.throws(() => stateTransition({ id: 'x' }, 'reactivate_account'));
});
test('expired locks are unlocked', () => assert.equal(accountState({ banned_until: '2000-01-01Z' }).unlocked, true));
test('already-applied and invalid operations are rejected', () => {
  assert.throws(() => stateTransition(makeUser(), 'reactivate_account'));
  assert.throws(() => stateTransition(makeUser(), 'remove_test'));
});
function fakeApi(initial, options = {}) {
  let saved = structuredClone(initial), writes = [], reads = 0;
  return { writes, request: async (body) => {
    if (body.action === 'admin_users') {
      reads++;
      if (options.readFailure && reads > 1) throw new Error('Readback offline');
      return { success: true, users: [structuredClone(saved)] };
    }
    writes.push(body);
    if (options.writeFailure) throw new Error('Request failed');
    if (!options.ignoreWrite) {
      if (body.operation === 'deactivate_account') saved.profile.account_status = 'deactivated';
      if (body.operation === 'reactivate_account') saved.profile.account_status = 'active';
      if (body.operation === 'disable_account') saved.banned_until = '2126-01-01Z';
      if (body.operation === 'unlock_account') saved.banned_until = null;
    }
    return { success: true, user_id: options.wrongTarget ? 'wrong-person' : saved.id, operation: body.operation };
  }};
}
for (const [operation, initial] of [['deactivate_account', makeUser()], ['reactivate_account', makeUser(false, false)], ['disable_account', makeUser()], ['unlock_account', makeUser(false, false)]]) {
  test(`${operation} saves exact target and leaves the other state unchanged`, async () => {
    const api = fakeApi(initial); const action = stateTransition(initial, operation);
    const after = await changeAccountState({ request: api.request, actorId: 'admin', target: initial, operation });
    assert.equal(api.writes.length, 1); assert.equal(api.writes[0].target_user_id, initial.id);
    assert.equal(accountState(after)[action.axis], action.to);
  });
}
test('self changes are rejected before any request', async () => {
  const api = fakeApi(makeUser());
  await assert.rejects(changeAccountState({ request: api.request, actorId: 'test-person', target: makeUser(), operation: 'disable_account' }));
  assert.equal(api.writes.length, 0);
});
test('stale confirmation re-reads state and makes no write', async () => {
  const api = fakeApi(makeUser(false));
  await assert.rejects(changeAccountState({ request: api.request, actorId: 'admin', target: makeUser(), operation: 'disable_account' }), /changed since/);
  assert.equal(api.writes.length, 0);
});
for (const option of ['readFailure', 'writeFailure', 'ignoreWrite', 'wrongTarget']) {
  test(`${option} never claims success or auto-retries`, async () => {
    const api = fakeApi(makeUser(), { [option]: true });
    await assert.rejects(changeAccountState({ request: api.request, actorId: 'admin', target: makeUser(), operation: 'disable_account' }), (error) => error.refreshRequired === true);
    assert.equal(api.writes.length, 1);
  });
}

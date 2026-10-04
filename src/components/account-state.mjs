// Account lifecycle and Auth locks are independent. Missing data is not Active.
export function accountState(user, now = Date.now()) {
  const status = user?.profile?.account_status;
  const active = status === 'active' ? true : status === 'deactivated' ? false : null;
  let unlocked = null;
  if (user && Object.hasOwn(user, 'banned_until')) {
    if (user.banned_until === null || user.banned_until === '') unlocked = true;
    else {
      const until = Date.parse(user.banned_until);
      if (Number.isFinite(until)) unlocked = until <= now;
    }
  }
  return { active, unlocked };
}

export const ACCOUNT_ACTIONS = Object.freeze({
  deactivate_account: { axis: 'active', from: true, to: false, label: 'Deactivate account', before: 'Active', after: 'Inactive', detail: 'Change the administrative account status to Inactive. This does not set or remove a sign-in security lock.' },
  reactivate_account: { axis: 'active', from: false, to: true, label: 'Reactivate account', before: 'Inactive', after: 'Active', detail: 'Change the administrative account status to Active. Any separate sign-in lock and scoped access restrictions remain.' },
  disable_account: { axis: 'unlocked', from: true, to: false, label: 'Lock sign-in', before: 'Unlocked', after: 'Locked', detail: 'Apply the sign-in security restriction. This is not account deletion or a change to platform status. Do not treat it as immediate sign-out of every existing session.' },
  unlock_account: { axis: 'unlocked', from: false, to: true, label: 'Unlock sign-in', before: 'Locked', after: 'Unlocked', detail: 'Remove the sign-in security restriction. Platform status, email verification and role permissions do not change.' },
});

export function stateTransition(user, operation) {
  const action = ACCOUNT_ACTIONS[operation];
  if (!action || !user?.id) throw new Error('Choose a valid account-state action.');
  const state = accountState(user);
  if (state[action.axis] === null) throw new Error('Account state is unavailable. Refresh before changing it.');
  if (state[action.axis] !== action.from) throw new Error('This action no longer matches the account state. Refresh and review it.');
  return action;
}

export function stateNote(user) {
  const state = accountState(user);
  if (state.active === null || state.unlocked === null) return 'A status is unavailable. Refresh the account before making changes.';
  if (!state.unlocked) return state.active
    ? 'Platform status is Active, but sign-in is Locked. Reactivation does not remove this lock. Unlock sign-in before testing password recovery.'
    : 'The account is Inactive and sign-in is Locked. These are two separate settings; changing one will not change the other.';
  return state.active
    ? 'Platform status is Active and sign-in is Unlocked. Verification, roles and access dates still apply.'
    : 'Platform status is Inactive, but the separate sign-in lock is off. Inactive status is not proof that sign-in has been blocked.';
}

export async function readAccountSnapshot(request, targetId, onSnapshot) {
  const directory = await request({ action: 'admin_users' });
  const user = directory?.users?.find((item) => item.id === targetId);
  if (!directory?.success || !user) throw new Error('The selected account could not be refreshed. No new action was started.');
  onSnapshot?.(directory);
  return user;
}

// Never flip based only on a successful write response. Read back the same ID.
export async function changeAccountState({ request, actorId, target, operation, onSnapshot }) {
  if (!actorId || !target?.id || actorId === target.id) throw new Error('Use another authorized administrator to change your own account state.');
  const action = stateTransition(target, operation);
  const fresh = await readAccountSnapshot(request, target.id, onSnapshot);
  const before = accountState(fresh);
  const expected = accountState(target);
  if (before.active === null || before.unlocked === null || before.active !== expected.active || before.unlocked !== expected.unlocked) {
    throw new Error('This account changed since the confirmation opened. Review the refreshed states and try again.');
  }
  stateTransition(fresh, operation);
  try {
    const result = await request({ action: 'admin_security', target_user_id: target.id, operation });
    if (!result?.success || result.user_id !== target.id || result.operation !== operation) throw new Error('The update did not confirm the selected account.');
    const afterUser = await readAccountSnapshot(request, target.id, onSnapshot);
    const after = accountState(afterUser);
    const otherAxis = action.axis === 'active' ? 'unlocked' : 'active';
    if (after[action.axis] !== action.to || after[otherAxis] !== before[otherAxis]) throw new Error('The saved state could not be confirmed, or another setting changed.');
    return afterUser;
  } catch (error) {
    const failure = new Error(`${error.message || 'The request failed.'} Refresh the account states before another change. Do not assume the update failed or retry automatically.`);
    failure.refreshRequired = true;
    throw failure;
  }
}

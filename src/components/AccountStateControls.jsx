import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { accountState, stateNote, ACCOUNT_ACTIONS, changeAccountState, readAccountSnapshot } from './account-state.mjs';
import './state-controls.css';

// Controlled, positive-polarity switch. A click requests a change; it does not
// fabricate a saved state. Unknown is displayed separately, never as Off.
export function StateSwitch({ label, checked, onText, offText, description, disabled, onRequest }) {
  const id = useId();
  return <div className="eig-state-control">
    <div className="eig-state-copy">
      <strong id={id + '-label'}>{label}</strong>
      <span className="eig-state-value">{checked === null ? 'Unavailable' : checked ? onText : offText}</span>
      <small id={id + '-description'}>{description}</small>
    </div>
    {checked === null ? <span className="eig-state-unknown">Unknown</span> : <button type="button"
      className="eig-state-switch" role="switch" aria-checked={checked}
      aria-labelledby={id + '-label'} aria-describedby={id + '-description'}
      aria-haspopup="dialog" disabled={disabled} onClick={() => onRequest(!checked)}>
      <span className="eig-switch-track" aria-hidden="true"><span /></span>
      <span className="eig-switch-word" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
    </button>}
  </div>;
}

export function AccountStateBadges({ user }) {
  const state = accountState(user);
  return <div className="eig-account-badges">
    <span className={state.active === true ? 'state-on' : 'state-off'}>Platform: {state.active === null ? 'Unknown' : state.active ? 'Active' : 'Inactive'}</span>
    <span className={state.unlocked === true ? 'state-on' : 'state-off'}>Sign-in: {state.unlocked === null ? 'Unknown' : state.unlocked ? 'Unlocked' : 'Locked'}</span>
    <span className={user?.email_confirmed_at ? 'state-on' : 'state-off'}>Email: {user?.email_confirmed_at ? 'Verified' : 'Unverified'}</span>
  </div>;
}

function StateConfirmation({ pending, busy, onCancel, onConfirm }) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const action = ACCOUNT_ACTIONS[pending.operation];
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement;
    node.showModal();
    cancel.current?.focus();
    return () => {
      node.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="eig-state-dialog" aria-labelledby={titleId}
    aria-describedby={titleId + '-detail'} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <p className="eig-state-risk">Level 3 / Significant account change</p>
    <h2 id={titleId}>{action.label}?</h2>
    <div className="eig-state-subject"><strong>{pending.user.profile?.display_name || 'Selected account'}</strong><span>{pending.user.email || pending.user.id}</span></div>
    <p className="eig-state-transition">{action.before} <span aria-hidden="true">→</span> {action.after}</p>
    <p id={titleId + '-detail'}>{action.detail}</p>
    <p className="eig-state-email-note">This control does not send an email or reset a password.</p>
    <div className="eig-state-dialog-actions">
      <button ref={cancel} type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      <button className="eig-state-confirm" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Saving and checking...' : action.label}</button>
    </div>
  </dialog>, document.body);
}

export default function AccountStateControls({ user, currentUserId, invoke, onSnapshot }) {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const state = accountState(user);
  const self = !currentUserId || user?.id === currentUserId;
  const disabled = busy || refreshRequired || self || state.active === null || state.unlocked === null;
  async function request(body) {
    const { data, error: invokeError } = await invoke(body);
    if (invokeError || data?.error || !data?.success) throw new Error(data?.error || invokeError?.message || 'The account request failed.');
    return data;
  }
  function snapshot(data) { if (mounted.current) onSnapshot(data); }
  function open(operation) {
    if (disabled || inFlight.current) return;
    setError(''); setNotice(''); setPending({ user, operation });
  }
  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await readAccountSnapshot(request, user.id, snapshot);
      if (mounted.current) { setRefreshRequired(false); setNotice('Account states refreshed from the server.'); }
    } catch (err) {
      if (mounted.current) { setRefreshRequired(true); setError(err.message); }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function confirm() {
    if (!pending || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      await changeAccountState({ request, actorId: currentUserId, target: pending.user, operation: pending.operation, onSnapshot: snapshot });
      if (mounted.current) {
        const action = ACCOUNT_ACTIONS[pending.operation];
        setNotice(`${action.axis === 'active' ? 'Platform status' : 'Sign-in access'} saved and confirmed: ${action.after}. The other setting was not changed.`);
        setRefreshRequired(false);
      }
    } catch (err) {
      if (mounted.current) { setRefreshRequired(Boolean(err.refreshRequired)); setError(err.message); }
    } finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); setPending(null); }
    }
  }
  return <section className="eig-account-states" aria-label="Account states" aria-busy={busy}>
    <div className="eig-state-heading"><div><h3>Account states</h3><p>Current saved states. Each switch changes only its own setting.</p></div><button type="button" className="eig-state-refresh" disabled={busy} onClick={refresh}>Refresh states</button></div>
    <div className="eig-state-controls">
      <StateSwitch label="Account active" checked={state.active} onText="Active" offText="Inactive" disabled={disabled}
        description="Administrative platform status. This is separate from the sign-in security lock."
        onRequest={(next) => open(next ? 'reactivate_account' : 'deactivate_account')} />
      <StateSwitch label="Sign-in unlocked" checked={state.unlocked} onText="Unlocked" offText="Locked" disabled={disabled}
        description="Security restriction only. Unlocked does not override verification, roles or access dates."
        onRequest={(next) => open(next ? 'unlock_account' : 'disable_account')} />
    </div>
    <p className="eig-state-combined-note">{stateNote(user)}</p>
    {self && <p className="eig-state-combined-note">Your own account-state controls are protected. Another authorized administrator must make these changes.</p>}
    {refreshRequired && <p className="eig-state-combined-note">Displayed values are the last confirmed snapshot. Refresh before another change.</p>}
    {error && <p className="eig-state-error" role="alert">{error}</p>}
    {notice && <p className="eig-state-notice" role="status">{notice}</p>}
    {pending && <StateConfirmation pending={pending} busy={busy} onCancel={() => setPending(null)} onConfirm={confirm} />}
  </section>;
}

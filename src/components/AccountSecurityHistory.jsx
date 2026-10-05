import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { accountDisplayName } from '../lib/accountDisplayName.mjs';
import './account-security-history.css';

function SignoutConfirmation({ user, busy, onCancel, onConfirm }) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const title = useId();
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    cancel.current?.focus();
    return () => { dialog.current?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className="eig-state-dialog" aria-labelledby={title}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <p className="eig-state-risk">Level 3 / Significant security action</p>
    <h2 id={title}>Sign out all sessions?</h2>
    <div className="eig-state-subject"><strong>{accountDisplayName(user)}</strong><span>{user.profile?.username ? '@' + user.profile.username : 'No username yet'}</span><span>{user.email || 'No email'}</span><small>Account ID: {user.id}</small></div>
    <p>Revoke this account’s current sessions on every device. Existing access tokens may work until they expire. This action does not block future sign-ins; existing account restrictions still apply.</p>
    <p>Account status, sign-in lock, password, verification, roles and event registrations stay unchanged. This action sends no email.</p>
    <label className="security-reason">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} disabled={busy} /></label>
    <label className="security-ack"><input type="checkbox" checked={checked} disabled={busy} onChange={(event) => setChecked(event.target.checked)} />I checked the username, email and account ID.</label>
    <div className="eig-state-dialog-actions"><button ref={cancel} type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="eig-state-confirm" type="button" disabled={busy || !checked || !reason.trim()} onClick={() => onConfirm(reason.trim())}>{busy ? 'Revoking sessions…' : 'Sign Out All Sessions'}</button></div>
  </dialog>, document.body);
}

export default function AccountSecurityHistory({ user, currentUserId, invoke }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', direction: 'desc' });
  const [hasMore, setHasMore] = useState(false);
  const mounted = useRef(true);
  const flight = useRef(false);
  const generation = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);
  async function request(body) {
    const { data, error: invokeError } = await invoke(body);
    if (invokeError || data?.error || !data?.success) throw new Error(data?.error || invokeError?.message || 'The account request failed.');
    return data;
  }
  async function load() {
    const current = ++generation.current;
    setLoading(true); setError('');
    try {
      const data = await request({ action: 'admin_account_history', target_user_id: user.id });
      if (mounted.current && current === generation.current) { setRows(data.entries || []); setHasMore(Boolean(data.has_more)); }
    } catch (err) { if (mounted.current && current === generation.current) setError(err.message); }
    finally { if (mounted.current && current === generation.current) setLoading(false); }
  }
  useEffect(() => { load(); }, [user.id, user.banned_until, user.profile?.account_status]);
  async function confirm(reason) {
    if (flight.current || !currentUserId || user.id === currentUserId) return;
    flight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const data = await request({ action: 'admin_session_signout', target_user_id: user.id,
        confirmation: user.id, reason, request_id: crypto.randomUUID() });
      if (data.user_id !== user.id || !Number.isInteger(data.sessions_revoked) || data.sessions_revoked < 0) throw new Error('The server did not confirm the selected account.');
      if (mounted.current) { setNotice(`Revoked ${data.sessions_revoked} session(s). Existing access tokens can work until expiry; future sign-ins follow existing restrictions.`); await load(); }
    } catch (err) {
      if (mounted.current) { setUncertain(true); setError(err.message + ' Check account history before trying another action; this request will not be retried automatically.'); }
    } finally { flight.current = false; if (mounted.current) { setBusy(false); setPending(false); } }
  }
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.action, row.actor_label, row.actor_user_id, row.reason, row.outcome, JSON.stringify(row.before_state), JSON.stringify(row.after_state)].filter(Boolean).join(' ').toLowerCase().includes(search))
      .map((row, index) => ({ ...row, index })).sort((a, b) => {
        const comparison = String(a[sort.key] || '').localeCompare(String(b[sort.key] || ''), undefined, { numeric: true, sensitivity: 'base' });
        return (sort.direction === 'asc' ? comparison : -comparison) || a.index - b.index;
      });
  }, [rows, query, sort]);
  function heading(key, label) {
    return <th aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => setSort((previous) => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))}>{label}{sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>;
  }
  return <section id="account-security-history" className="eig-security-history" aria-label="Account security and history" aria-busy={busy || loading}>
    <div className="security-history-heading"><h4>Account Security &amp; History</h4><button type="button" className="platform-secondary-button" disabled={busy || loading} onClick={load}>Refresh History</button></div>
    <button id="account-signout-button" type="button" className="platform-secondary-button" disabled={busy || uncertain || !currentUserId || currentUserId === user.id} onClick={() => setPending(true)}>Sign Out All Sessions</button>
    {currentUserId === user.id && <p>Your own sessions are protected here. Use normal sign-out or ask another EIG administrator.</p>}
    {notice && <p role="status" className="eig-state-notice">{notice}</p>}
    {error && <p role="alert" className="eig-state-error">{error}</p>}
    {uncertain && <p>Review the history, then leave and reopen this account to enable another request.</p>}
    <div className="security-history-search"><label>Search account history<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Action, administrator, reason or state" /></label><span>{visible.length} matches{hasMore ? ' in latest 100 entries' : ''}</span><button type="button" onClick={() => setQuery('')} disabled={!query}>Clear</button></div>
    <p>History begins when this feature is enabled. Earlier changes are not reconstructed.</p>
    <div className="security-history-scroll"><table><thead><tr>{heading('created_at', 'When')}{heading('action', 'Action')}{heading('actor_label', 'Changed By')}<th>Details</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time></td><td>{row.action.replaceAll('_', ' ')}<small>{row.outcome}</small></td><td>{row.actor_label}<small>{row.actor_user_id || 'System / legacy action'}</small></td><td>{row.reason && <p>{row.reason}</p>}{row.before_state && <small>Before: {JSON.stringify(row.before_state)}</small>}{row.after_state && <small>After: {JSON.stringify(row.after_state)}</small>}</td></tr>)}</tbody></table></div>
    {!loading && !visible.length && <p>{query ? 'No history matches this search.' : 'No recorded account changes yet.'}</p>}
    {pending && <SignoutConfirmation user={user} busy={busy} onCancel={() => setPending(false)} onConfirm={confirm} />}
  </section>;
}

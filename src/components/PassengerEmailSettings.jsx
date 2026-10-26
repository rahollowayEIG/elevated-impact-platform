import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Sandbox-only acceptance build. The protected API currently exists only in
// ElevationPilot-Sandbox and must never be invoked against live production.
export const CAN_MANAGE_PASSENGER_EMAILS =
  import.meta.env.VITE_EP_PERSON_EMAIL_MANAGEMENT_ENABLED === 'true' &&
  import.meta.env.VITE_SANDBOX_WORKSPACE_ENABLED === 'true' &&
  import.meta.env.VITE_SUPABASE_URL === 'https://publruuuyvpggogrrgwp.supabase.co';

export default function PassengerEmailSettings() {
  const [rows, setRows] = useState([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const call = useCallback(async (action, fields = {}) => {
    if (!CAN_MANAGE_PASSENGER_EMAILS || !supabase) throw Error('Email management is unavailable in this environment.');
    const { data, error: transport } = await supabase.functions.invoke('golf-account-emails', {
      body: { action, ...fields },
    });
    if (transport) throw Error(data?.error || transport.message || 'Could not reach email settings.');
    if (!data?.success) throw Error(data?.error || 'Email settings could not be updated.');
    return data;
  }, []);

  const refresh = useCallback(async () => {
    const data = await call('list');
    setRows(data.emails || []);
    setLoginEmail(data.login_email || '');
  }, [call]);

  useEffect(() => {
    let active = true;
    call('list').then((data) => {
      if (!active) return;
      setRows(data.emails || []);
      setLoginEmail(data.login_email || '');
    }).catch((e) => {
      if (active) setError(e.message || 'Unable to load email preferences.');
    });
    return () => { active = false; };
  }, [call]);

  async function act(action, values, success) {
    setBusy(action);
    setError('');
    setNotice('');
    try {
      await call(action, values);
      if (action === 'request_verification') {
        setPendingEmail(String(values.email || '').trim().toLowerCase());
        setCode('');
        setNewEmail('');
        setNotice('Verification code sent to the additional email.');
      } else {
        await refresh();
        if (action === 'verify') { setPendingEmail(''); setCode(''); }
        setNotice(action === 'verify' ? 'Email verified.' :
          action === 'set_default' ? 'Default contact email updated.' : 'Email deactivated. Its history remains.');
      }
      success?.();
    } catch (e) { setError(e.message || 'Unable to update email preferences.'); }
    finally { setBusy(''); }
  }

  if (!CAN_MANAGE_PASSENGER_EMAILS) return null;

  return <section className="platform-section-card" aria-label="Email addresses" data-testid="passenger-email-settings">
    <div className="platform-section-heading">
      <div>
        <p className="platform-eyebrow">Contact Preferences · Sandbox</p>
        <h2>My Email Addresses</h2>
        <p>Keep multiple email addresses on one ElevationPilot identity. Choose one verified contact email as the default. Your login email remains separate.</p>
      </div>
    </div>
    {error && <div className="platform-error banner" role="alert">{error}</div>}
    {notice && <div className="platform-success" role="status">{notice}</div>}
    <div style={{display:'grid',gap:12,marginTop:16}}>
      {rows.filter(row => row.active).map((row) => (
        <div key={row.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,.12)'}}>
          <div style={{minWidth:0,overflowWrap:'anywhere'}}>
            <strong>{row.email}</strong>
            <div style={{fontSize:12,opacity:.8,marginTop:5}}>
              {row.verified ? 'Verified' : 'Unverified'}
              {row.is_default ? ' · Default contact' : ''}
              {String(row.email).toLowerCase() === loginEmail.toLowerCase() ? ' · Login email' : ''}
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {row.verified && !row.is_default && <button className="platform-secondary-button" type="button" disabled={!!busy} onClick={() => act('set_default', { contact_id: row.id })}>Set as default</button>}
            {!row.verified && <button className="platform-secondary-button" type="button" disabled={!!busy} onClick={() => act('request_verification', { email: row.email })}>Verify</button>}
            {!row.is_default && String(row.email).toLowerCase() !== loginEmail.toLowerCase() && <button className="platform-secondary-button" type="button" disabled={!!busy} onClick={() => {
              if (window.confirm('Deactivate this email? Its history will be kept.')) act('deactivate', { contact_id: row.id });
            }}>Deactivate</button>}
          </div>
        </div>
      ))}
      {!rows.length && !error && <p>Loading your email addresses…</p>}
    </div>
    <form onSubmit={(e) => { e.preventDefault(); act('request_verification', { email: newEmail }); }} style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',marginTop:22}}>
      <label style={{flex:'1 1 240px'}}>Add an email
        <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="another@example.com" autoComplete="email" />
      </label>
      <button type="submit" className="platform-primary-button" disabled={!!busy}>Send verification code</button>
    </form>
    {pendingEmail && <form onSubmit={(e) => { e.preventDefault(); act('verify', { email: pendingEmail, code }); }} style={{marginTop:18}}>
      <label>Enter the six-digit code sent to {pendingEmail}
        <input type="text" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} autoComplete="one-time-code" />
      </label>
      <button type="submit" className="platform-primary-button" disabled={!!busy} style={{marginTop:12}}>Verify email</button>
    </form>}
    <p style={{fontSize:12,opacity:.8,marginTop:16}}>Sandbox note: verification emails are currently disabled. Adding an email will show a delivery-unavailable message until controlled email testing is enabled.</p>
  </section>;
}

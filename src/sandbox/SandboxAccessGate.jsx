import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  checkSandboxAccess, normalizeSandboxEmail, isSandboxEmailCode,
  requestSandboxEmailCode, verifySandboxEmailCode,
} from './sandboxAccess.mjs';

// Both are disabled by default. Only the Sandbox Vercel project may enable
// email-code invitations after the isolated Auth template and tester allowlist
// have been reviewed. Live ignores this entire component.
const EMAIL_CODE_ENABLED = import.meta.env.VITE_SANDBOX_EMAIL_CODE_ENABLED === 'true';

const panel = {
  maxWidth: 470, margin: '56px auto', padding: '28px',
  border: '2px solid #f5a5d5', borderRadius: 18, background: '#fff',
  boxShadow: '0 12px 36px rgba(37,12,44,.15)', color: '#27122b',
  fontFamily: 'system-ui, sans-serif'
};
const action = {
  border: 0, borderRadius: 8, padding: '12px 16px',
  background: '#c41877', color: 'white', fontWeight: 750,
  cursor: 'pointer', width: '100%'
};
const field = {
  display: 'block', width: '100%', marginTop: 6,
  padding: 12, borderRadius: 8, border: '1px solid #b779a2',
  background: 'white', color: '#321632', boxSizing: 'border-box'
};

function PracticePanel({ heading, children }) {
  return (
    <main style={{ minHeight: 'calc(100vh - 120px)', padding: '10px 18px' }}>
      <section style={panel} aria-label="Protected ElevationPilot Sandbox">
        <p style={{ color: '#9b175f', fontSize: 12, fontWeight: 850, letterSpacing: 2 }}>ELEVATIONPILOT • SANDBOX</p>
        <h1 style={{ fontSize: 26, margin: '8px 0 14px' }}>{heading}</h1>
        {children}
        <p style={{ marginTop: 22, fontSize: 12, color: '#6b5164' }}>
          Practice access is separate from Live. Never enter a Live password here.
        </p>
      </section>
    </main>
  );
}

/** Guards EVERY sandbox application route before the actual app mounts. */
export default function SandboxAccessGate({ children }) {
  const [gate, setGate] = useState({ kind: 'checking' });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function updateAccess() {
      const current = ++sequence;
      const result = await checkSandboxAccess(supabase);
      if (active && sequence === current) setGate(result);
    }

    void updateAccess();
    if (!supabase) return () => { active = false; };
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        ++sequence;
        if (active) setGate({ kind: 'signed_out' });
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Do not await Supabase SDK calls inside the synchronous Auth event.
        Promise.resolve().then(() => { if (active) void updateAccess(); });
      }
    });
    return () => {
      active = false;
      data?.subscription?.unsubscribe?.();
    };
  }, [refreshIndex]);

  async function requestCode(event) {
    event.preventDefault();
    if (busy || !EMAIL_CODE_ENABLED) return;
    const normalized = normalizeSandboxEmail(email);
    if (!normalized) { setNotice('Enter a valid email address.'); return; }
    setBusy(true);
    setNotice('');
    const result = await requestSandboxEmailCode(supabase, normalized, EMAIL_CODE_ENABLED);
    setBusy(false);
    if (!result.ok) {
      setNotice('Unable to send a practice code. Ask EIG to approve this Sandbox email and check the email-code setup.');
      return;
    }
    setEmail(normalized);
    setCodeRequested(true);
    setNotice('If this address is approved, a Sandbox login code has been sent. Check your inbox.');
  }

  async function confirmCode(event) {
    event.preventDefault();
    if (busy || !EMAIL_CODE_ENABLED || !isSandboxEmailCode(code)) return;
    setBusy(true);
    setNotice('');
    const result = await verifySandboxEmailCode(supabase, email, code, EMAIL_CODE_ENABLED);
    setCode('');
    setBusy(false);
    if (!result.ok) {
      setNotice('The code was invalid or expired. Request a new code if necessary.');
      return;
    }
    setRefreshIndex(value => value + 1);
  }

  async function signOut() {
    setBusy(true);
    try {
      await supabase?.auth?.signOut();
      setNotice('');
      setCode('');
      setCodeRequested(false);
      setGate({ kind: 'signed_out' });
      setRefreshIndex(value => value + 1);
    } catch {
      setNotice('Could not sign out of the Sandbox. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (gate.kind === 'checking') {
    return <PracticePanel heading="Checking practice access…"><p role="status">Verifying your isolated Sandbox session.</p></PracticePanel>;
  }
  if (gate.kind === 'authorized') return <>{children}</>;

  if (gate.kind === 'denied') {
    return <PracticePanel heading="Practice access is not approved">
      <p>Your Sandbox identity was verified, but your company has not authorized this practice workspace.</p>
      <p>Ask your Pilot or EIG to enroll you with an approved training role. EIG Administrator is not available in customer Sandboxes.</p>
      {gate.email && <p style={{ overflowWrap: 'anywhere' }}><strong>Signed in as:</strong> {gate.email}</p>}
      <button type="button" style={action} disabled={busy} onClick={signOut}>Sign out of Sandbox</button>
      {notice && <p role="alert">{notice}</p>}
    </PracticePanel>;
  }
  if (gate.kind === 'unavailable') {
    return <PracticePanel heading="Sandbox access is locked">
      <p role="alert">The isolated authentication or authorization service could not be verified. No application workspace has been opened.</p>
      <button type="button" style={action} disabled={busy} onClick={() => setRefreshIndex(v => v + 1)}>Retry secure check</button>
      <p style={{ fontSize: 13 }}>This is a safety stop, not a Live account problem.</p>
    </PracticePanel>;
  }

  return <PracticePanel heading="Enter your practice workspace">
    <p>This is a separate Sandbox session for approved testers. Your Live credentials and information are never copied here.</p>
    {!EMAIL_CODE_ENABLED
      ? <p role="status"><strong>Invitations aren't enabled yet.</strong> We're preparing the secure login and the isolated practice data. Nothing needs to be entered here today.</p>
      : <>
        {!codeRequested ? (
          <form onSubmit={requestCode} style={{ display: 'grid', gap: 14 }}>
            <label>Approved tester email
              <input style={field} type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" placeholder="you@company.com" required maxLength={254} />
            </label>
            <button type="submit" style={action} disabled={busy || !normalizeSandboxEmail(email)}>{busy ? 'Requesting…' : 'Email my practice code'}</button>
          </form>
        ) : (
          <form onSubmit={confirmCode} style={{ display: 'grid', gap: 14 }}>
            <p>Code requested for <strong>{email}</strong>.</p>
            <label>Six-digit Sandbox email code
              <input style={field} inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" required />
            </label>
            <button type="submit" style={action} disabled={busy || !isSandboxEmailCode(code)}>{busy ? 'Verifying…' : 'Verify Sandbox code'}</button>
            <button type="button" disabled={busy} onClick={() => { setCodeRequested(false); setCode(''); setNotice(''); }}
              style={{ border: '1px solid #b779a2', borderRadius: 8, background: 'white', color: '#641d4c', padding: 9 }}>Use another email or request a new code</button>
          </form>
        )}
        {notice && <p role="status">{notice}</p>}
      </>
    }
  </PracticePanel>;
}

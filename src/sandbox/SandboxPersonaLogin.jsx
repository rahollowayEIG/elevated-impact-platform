import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { SANDBOX_DEMO_PERSONAS } from './demoPersonas.mjs';

// This is a real Auth sign-in control. Merely choosing a role never grants
// permissions, changes claims, or bypasses a password.
export default function SandboxPersonaLogin() {
  const [opened, setOpened] = useState(false);
  const [personaCode, setPersonaCode] = useState('pilot');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const persona = SANDBOX_DEMO_PERSONAS.find(p => p.code === personaCode);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserEmail(data?.user?.email || null);
    }).catch(() => {});
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserEmail(session?.user?.email || null);
    });
    return () => { active = false; subscription?.subscription?.unsubscribe?.(); };
  }, []);

  async function signIn(event) {
    event.preventDefault();
    if (!persona || !password || !supabase) {
      setStatus('Choose a fictional role and enter its temporary sandbox password.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: persona.email, password,
      });
      setPassword('');
      if (error || data?.user?.email?.toLowerCase() !== persona.email.toLowerCase()) {
        if (data?.session) await supabase.auth.signOut();
        setStatus('Sign-in unavailable. Provision the fictional test accounts first, then use their private passwords.');
        return;
      }
      // Reload ONLY the protected sandbox origin. The platform chooses the
      // landing page from the real Supabase-authenticated account and roles.
      window.location.assign(window.location.origin + '/');
    } catch {
      setPassword('');
      setStatus('Sandbox sign-in failed; no production login was attempted.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setPassword('');
      window.location.assign(window.location.origin + '/');
    } catch {
      setStatus('Could not sign out of the sandbox. Please try again.');
      setBusy(false);
    }
  }

  return (
    <aside aria-label="Sandbox test accounts" style={{
      position: 'fixed', right: 14, bottom: 14, zIndex: 2147483000,
      width: opened ? 'min(360px, calc(100vw - 28px))' : 'auto',
      borderRadius: 12, background: '#1D245D', color: '#FFFFFF',
      boxShadow: '0 8px 28px rgba(0,0,0,.35)', fontFamily: 'system-ui, sans-serif',
    }}>
      <button type="button" onClick={() => setOpened(v => !v)} aria-expanded={opened}
        style={{ border: 0, borderRadius: 12, background: '#D81C22', color: '#fff',
          padding: '11px 17px', cursor: 'pointer', fontWeight: 700, width: '100%', textAlign: 'left' }}>
        {opened ? 'Close practice accounts' : '✈ Sandbox practice accounts'}
      </button>
      {opened && (
        <div style={{ padding: 15, display: 'grid', gap: 11, fontSize: 13 }}>
          <strong style={{ fontSize: 15 }}>Practice mode only</strong>
          <div>Choose an account, then sign in with its separately issued test password. Choosing a role alone never grants access.</div>
          {userEmail && <div style={{ overflowWrap: 'anywhere' }}>Current sandbox login: <strong>{userEmail}</strong></div>}
          <form onSubmit={signIn} style={{ display: 'grid', gap: 9 }}>
            <label htmlFor="sandbox-persona-select">Test account</label>
            <select id="sandbox-persona-select" value={personaCode}
              onChange={event => { setPersonaCode(event.target.value); setPassword(''); setStatus(''); }}
              style={{ borderRadius: 6, padding: 10, color: '#15204F', background: 'white' }}>
              {SANDBOX_DEMO_PERSONAS.map(p => <option key={p.code} value={p.code}>{p.name} • {p.role}</option>)}
            </select>
            <div style={{ fontSize: 12 }}>Scope: {persona?.scope}<br/>Fictional email: {persona?.email}</div>
            <label htmlFor="sandbox-persona-password">Temporary test password</label>
            <input id="sandbox-persona-password" type="password" autoComplete="off"
              value={password} onChange={event => setPassword(event.target.value)}
              placeholder="From private sandbox credential file"
              style={{ borderRadius: 6, padding: 10, color: '#15204F', background: 'white' }}/>
            <button type="submit" disabled={busy || !password} style={{
              border: 0, borderRadius: 6, padding: 11, background: '#D81C22',
              color: 'white', cursor: busy ? 'wait' : 'pointer', fontWeight: 700,
              opacity: busy || !password ? .6 : 1,
            }}>{busy ? 'Working…' : 'Sign in as this fictional account'}</button>
          </form>
          {userEmail && <button type="button" disabled={busy} onClick={signOut}
            style={{ background: 'transparent', color: 'white', border: '1px solid #fff',
              borderRadius: 6, padding: 9, cursor: 'pointer' }}>Sign out of sandbox</button>}
          {status && <p role="status" style={{ margin: 0, color: '#FFE3E3' }}>{status}</p>}
          <small>Sandbox-only authentication. No live users, messages, or payment systems.</small>
        </div>
      )}
    </aside>
  );
}

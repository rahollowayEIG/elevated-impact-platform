import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';

const LABELS = Object.freeze({
  pilot: 'Pilot',
  co_pilot: 'Co-Pilot',
  atc: 'ATC Coordinator',
  passenger: 'Passenger'
});

/**
 * Sandbox-only presentation for a SINGLE authenticated tester.
 * Selecting a role never impersonates another user or alters permissions
 * locally. The server verifies the current Auth identity and permitted
 * fictional organization before changing practice memberships.
 *
 * No production auth tokens or passwords are handled here.
 */
export default function SandboxPracticeRoles() {
  const [opened, setOpened] = useState(false);
  const [email, setEmail] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const triggerRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus('');
    if (!supabase) {
      setStatus('Sandbox connection is not configured.');
      setCapabilities(null);
      setEmail(null);
      setLoading(false);
      return;
    }
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        setEmail(null);
        setCapabilities(null);
        setSelected('');
        return;
      }
      setEmail(userData.user.email || 'Sandbox tester');
      // Status RPC returns role *entitlements* for this authenticated tester;
      // a hardcoded list is never treated as proof of permission.
      const { data, error } = await supabase.rpc('sandbox_practice_role_status');
      if (error) {
        setStatus('Sandbox role service is not ready. Practice access remains locked.');
        setCapabilities(null);
        setSelected('');
        return;
      }
      if (!data?.authorized || !Array.isArray(data?.roles)) {
        setStatus('Your account has not yet been approved for sandbox role testing.');
        setCapabilities(null);
        setSelected('');
        return;
      }
      const allowed = data.roles.filter(role => Object.hasOwn(LABELS, role));
      if (!allowed.includes(data.active_role)) {
        setStatus('Sandbox role permissions are inconsistent. Ask EIG to check access.');
        setCapabilities(null);
        return;
      }
      setCapabilities({ active_role: data.active_role, roles: allowed, has_practice_event: !!data.has_practice_event });
      setSelected(data.active_role);
    } catch {
      setStatus('Unable to verify sandbox test access.');
      setCapabilities(null);
      setSelected('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // Ignore INITIAL_SESSION and refresh events: neither changes the
      // already-verified role entitlement or requires a forced logout.
      if (event === 'SIGNED_OUT') {
        setEmail(null);
        setCapabilities(null);
        setSelected('');
        setStatus('Sandbox session ended. Sign in through your approved tester access.');
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Avoid calling the Supabase SDK synchronously in an Auth callback.
        Promise.resolve().then(refresh);
      }
    });
    return () => data?.subscription?.unsubscribe?.();
  }, [refresh]);

  async function activateRole() {
    if (!supabase || !capabilities?.roles.includes(selected) || busy || selected === capabilities.active_role) return;
    setBusy(true);
    setStatus('');
    try {
      const { data, error } = await supabase.rpc('sandbox_switch_practice_role', { p_role: selected });
      if (error || !data?.authorized || data?.active_role !== selected) {
        setStatus(error?.message || 'The sandbox rejected the requested practice role.');
        return;
      }
      // Redirect to the SAME protected origin so the platform reloads its
      // normal Supabase RLS-based role state. Never open a production URL.
      window.location.assign(window.location.origin + '/');
    } catch {
      setStatus('Could not switch roles safely. Existing permissions were not changed.');
    } finally {
      setBusy(false);
    }
  }

  // This is the SAME server-authorized selector, only moved from the
  // bottom-right corner into the Sandbox header. Never mount on Live.
  const headerSlot = document.getElementById('sandbox-practice-controls-slot');
  if (!headerSlot) return null;

  return createPortal(
    <aside aria-label="Sandbox practice role selector"
      className="eig-sandbox-practice-switch"
      onKeyDown={event => {
        if (event.key === 'Escape' && opened) {
          event.stopPropagation();
          setOpened(false);
          triggerRef.current?.focus();
        }
      }}>
      <button type="button" ref={triggerRef}
        className="eig-sandbox-practice-trigger"
        onClick={() => setOpened(value => !value)}
        aria-expanded={opened} aria-controls="sandbox-practice-role-panel">
        {opened ? 'Close roles ▲' : 'Switch role ▼'}
      </button>
      {opened && (
        <div id="sandbox-practice-role-panel"
          className="eig-sandbox-practice-panel"
          style={{ padding: 16, display: 'grid', gap: 11, fontSize: 13 }}>
          <strong style={{ fontSize: 12, letterSpacing: '.12em', color: '#ffbadc' }}>SANDBOX • TRAINING</strong>
          <strong style={{ fontSize: 16 }}>Practice workspace</strong>
          <div>One tester login, multiple approved roles. Nothing here changes your Live permissions.</div>
          {loading ? <div role="status">Checking practice access…</div> : email
            ? <div>Sandbox account: <strong style={{ overflowWrap: 'anywhere' }}>{email}</strong></div>
            : <div role="status">No approved sandbox session found. The shared ElevationPilot sign-in connection is still being configured. Do not enter your Live password in a sandbox form.</div>}
          {capabilities && (
            <>
              <label htmlFor="sandbox-practice-role">Test as</label>
              <select id="sandbox-practice-role" value={selected} disabled={busy}
                onChange={event => setSelected(event.target.value)}
                style={{ background: '#fff', color: '#381234', borderRadius: 7, padding: 10, width: '100%' }}>
                {capabilities.roles.map(role => <option key={role} value={role}>{LABELS[role]}</option>)}
              </select>
              {selected === 'atc' && !capabilities.has_practice_event &&
                <p style={{ margin: 0 }}>Create a draft practice event as Pilot before switching to ATC.</p>}
              <button type="button" onClick={activateRole}
                disabled={busy || !selected || selected === capabilities.active_role ||
                  (selected === 'atc' && !capabilities.has_practice_event)}
                style={{
                  padding: 11, border: 0, borderRadius: 7,
                  background: '#e63392', color: '#fff', fontWeight: 800,
                  opacity: busy || selected === capabilities.active_role ? .5 : 1
                }}>
                {busy ? 'Switching…' : selected === capabilities.active_role ? 'Current practice role' : 'Switch Practice Role'}
              </button>
            </>
          )}
          <button type="button" disabled={busy || loading} onClick={refresh}
            style={{ padding: 9, border: '1px solid #ffc6e3', borderRadius: 7, color: 'white', background: 'transparent' }}>
            Refresh Access
          </button>
          {status && <p role="alert" style={{ color: '#ffe2f2', margin: 0 }}>{status}</p>}
          <small>Sandbox role permissions are granted only by the isolated sandbox server. No practice action can change Live.</small>
        </div>
      )}
    </aside>,
    headerSlot
  );
}

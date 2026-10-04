import React, { lazy, Suspense, useEffect, useState } from 'react';
import RecoveryScreen from './auth/RecoveryScreen.jsx';
import { parseRecoveryEntry, cleanRecoveryUrl, createRecoveryApi, createRecoveryController } from './auth/recovery-session.mjs';

// Do not statically import the platform here. Its normal Supabase client must
// not initialize, consume a callback, or supply a session to password recovery.
const PlatformApp = lazy(() => import('./PlatformApp.jsx'));
let entrySequence = 0;

function captureEntry() {
  if (typeof window === 'undefined') return { kind: 'normal' };
  const href = window.location.href;
  const entry = parseRecoveryEntry(href);
  if (entry.kind === 'normal') {
    if (entry.normalizedUrl) window.history.replaceState({}, '', entry.normalizedUrl);
    return { kind: 'normal' };
  }
  window.history.replaceState({}, '', cleanRecoveryUrl(href));
  const id = ++entrySequence;
  try {
    const api = createRecoveryApi({
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      publicKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    });
    return { kind: 'recovery', id, controller: createRecoveryController(entry, api) };
  } catch (error) {
    return { kind: 'recovery', id, error };
  }
}

// Capture and scrub once, before rendering or initializing the normal app.
const initialEntry = captureEntry();

export default function App() {
  const [entry, setEntry] = useState(initialEntry);
  useEffect(() => {
    const changed = () => setEntry(captureEntry());
    window.addEventListener('hashchange', changed);
    window.addEventListener('popstate', changed);
    return () => {
      window.removeEventListener('hashchange', changed);
      window.removeEventListener('popstate', changed);
    };
  }, []);
  if (entry.kind === 'recovery') return <RecoveryScreen key={entry.id} controller={entry.controller} initialError={entry.error} />;
  return <Suspense fallback={<div className="platform-auth-screen" role="status"><div className="platform-login-card compact"><h1>Opening ElevationPilot...</h1></div></div>}><PlatformApp /></Suspense>;
}

import React, { lazy, Suspense, useEffect, useState } from 'react';
import RecoveryScreen from './auth/RecoveryScreen.jsx';
import { parseRecoveryEntry, cleanRecoveryUrl, createRecoveryApi, createRecoveryController } from './auth/recovery-session.mjs';

// Do not initialize the shared Supabase client on a recovery entry.
const PlatformApp = lazy(() => import('./PlatformApp.jsx'));
let entrySequence = 0;
let handledHref = '';

function captureEntry() {
  if (typeof window === 'undefined') return { kind: 'normal' };
  const href = window.location.href;
  const entry = parseRecoveryEntry(href);
  if (entry.kind === 'normal') {
    if (entry.normalizedUrl) window.history.replaceState({}, '', entry.normalizedUrl);
    handledHref = window.location.href;
    return { kind: 'normal' };
  }
  window.history.replaceState({}, '', cleanRecoveryUrl(href));
  handledHref = window.location.href;
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

const initialEntry = captureEntry();

export default function App() {
  const [entry, setEntry] = useState(initialEntry);
  useEffect(() => {
    const changed = () => {
      // A history traversal can emit both popstate and hashchange. Do not
      // replace a verified controller with a second, already-scrubbed entry.
      if (window.location.href === handledHref) return;
      const next = captureEntry();
      setEntry((current) => current.kind === 'normal' && next.kind === 'normal' ? current : next);
    };
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

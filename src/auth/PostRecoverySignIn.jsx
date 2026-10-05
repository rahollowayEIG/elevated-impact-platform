import React, { useEffect, useRef, useState } from 'react';
import { createPostRecoverySignInController } from './post-recovery-signin.mjs';
import PasswordField from '../components/PasswordField.jsx';
import './post-recovery-signin.css';

// Mounted only after the isolated recovery controller confirms completion.
// Do not move this dynamic import to module scope: recovery stays isolated.
const loadClient = async () => (await import('../lib/supabase.js')).supabase;

export default function PostRecoverySignIn({ identity }) {
  const [controller] = useState(() => createPostRecoverySignInController(identity, loadClient));
  const [phase, setPhase] = useState('new');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const heading = useRef(null);
  const input = useRef(null);
  const busy = useRef(false);

  useEffect(() => {
    if (phase === 'ready') input.current?.focus();
    else if (phase !== 'new') heading.current?.focus();
  }, [phase]);

  async function prepare() {
    if (busy.current) return;
    busy.current = true;
    setError(''); setPassword(''); setPhase('preparing');
    try { await controller.prepare(); setPhase('ready'); }
    catch (problem) { setError(problem.message); setPhase('blocked'); }
    finally { busy.current = false; }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy.current || phase !== 'ready') return;
    busy.current = true;
    setError(''); setPhase('signing_in');
    const enteredPassword = password;
    setPassword('');
    try {
      await controller.signIn(enteredPassword);
      setPhase('complete');
      // No tokens, passwords, or email hints are placed in the URL.
      window.location.replace('/');
    } catch (problem) {
      setError(problem.message);
      setPhase(controller.getPhase() === 'ready' ? 'ready' : 'blocked');
    } finally { busy.current = false; }
  }

  const formVisible = phase === 'ready' || phase === 'signing_in';
  return <section className="eig-post-recovery" aria-labelledby="post-recovery-title" aria-busy={phase === 'preparing' || phase === 'signing_in'}>
    <h2 id="post-recovery-title" ref={heading} tabIndex={-1}>{phase === 'preparing' ? 'Signing out this browser...' : formVisible ? 'Sign in with your new password' : phase === 'complete' ? 'Opening your account...' : 'Continue with this account'}</h2>
    {error && <p className="platform-error" role="alert">{error}</p>}
    {(phase === 'new' || phase === 'blocked') && <>
      <p className="platform-login-copy" id="post-recovery-warning">Continuing signs out the current ElevationPilot account in this browser. Other tabs sharing this browser session may also be signed out. This step does not sign out other devices.</p>
      <p className="platform-login-copy">You will then enter the new password for <strong>{identity.email}</strong>.</p>
      <button className="platform-primary-button eig-post-recovery-button" type="button" aria-describedby="post-recovery-warning" onClick={prepare}>Sign in as {identity.email}</button>
    </>}
    {phase === 'preparing' && <p className="platform-login-copy" role="status">Preparing a fresh sign-in. No account will open automatically.</p>}
    {formVisible && <form className="platform-login-form" onSubmit={submit}>
      <label htmlFor="post-recovery-email">Account email<input id="post-recovery-email" name="username" type="email" value={identity.email} readOnly autoComplete="username" /></label>
      <PasswordField label="Newly created password" id="post-recovery-password" inputRef={input} name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={phase !== 'ready'} />
      <p className="platform-login-copy">This sign-in is only for the email shown above. Your password reset did not sign you in.</p>
      <button className="platform-primary-button" type="submit" disabled={phase !== 'ready'}>{phase === 'signing_in' ? 'Checking sign-in...' : 'Sign in'}</button>
    </form>}
  </section>;
}

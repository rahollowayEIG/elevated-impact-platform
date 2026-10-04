import React, { useEffect, useRef, useState } from 'react';
import './recovery.css';

export default function RecoveryScreen({ controller, initialError }) {
  const [phase, setPhase] = useState(initialError ? 'blocked' : 'verifying');
  const [identity, setIdentity] = useState(null);
  const [error, setError] = useState(initialError || null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    if (!controller) return;
    let current = true;
    controller.verify().then((user) => {
      if (current) { setIdentity(user); setPhase('ready'); }
    }).catch((problem) => {
      if (current) { setError(problem); setPhase('blocked'); }
    });
    return () => { current = false; };
  }, [controller]);
  useEffect(() => { titleRef.current?.focus(); }, [phase]);

  async function submit(event) {
    event.preventDefault();
    if (phase !== 'ready') return;
    setError(null);
    if (password !== confirmation) { setError({ message: 'The passwords do not match.' }); return; }
    setPhase('saving');
    try {
      const user = await controller.savePassword(password);
      setIdentity(user);
      setPassword('');
      setConfirmation('');
      setPhase('complete');
    } catch (problem) {
      setPassword('');
      setConfirmation('');
      setError(problem);
      setPhase(controller.getPhase() === 'ready' ? 'ready' : 'blocked');
    }
  }

  const formVisible = phase === 'ready' || phase === 'saving';
  const title = phase === 'verifying' ? 'Checking your reset link...'
    : phase === 'complete' ? 'Password updated.'
      : formVisible ? 'Choose a new password.'
        : error?.code === 'account_disabled' ? 'Account access needs review.' : 'This reset link cannot be used.';

  return <main className="platform-auth-screen eig-recovery">
    <section className="platform-login-card eig-recovery-card" aria-labelledby="recovery-title" aria-busy={phase === 'verifying' || phase === 'saving'}>
      <div className="platform-logo-mark" aria-hidden="true">EIG</div>
      <p className="platform-eyebrow">ElevationPilot Account Recovery</p>
      <h1 id="recovery-title" ref={titleRef} tabIndex={-1}>{title}</h1>
      {phase === 'verifying' && <p className="platform-login-copy" role="status">Verifying the account represented by the email link. An existing signed-in account will not be used.</p>}
      {formVisible && <>
        <div className="eig-recovery-identity"><span>Verified account being reset</span><strong>{identity.email}</strong></div>
        <p className="platform-login-copy">Only this account's password will change. Resetting a password does not reactivate or unlock an account.</p>
        <form className="platform-login-form" onSubmit={submit}>
          <label htmlFor="recovery-password">New password<input id="recovery-password" name="new-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} required disabled={phase === 'saving'} /></label>
          <label htmlFor="recovery-confirmation">Confirm new password<input id="recovery-confirmation" name="confirm-new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" autoComplete="new-password" minLength={8} required disabled={phase === 'saving'} /></label>
          {error && <p className="platform-error" role="alert">{error.message}</p>}
          <button className="platform-primary-button" type="submit" disabled={phase === 'saving'}>{phase === 'saving' ? 'Saving password...' : 'Set password for this account'}</button>
        </form>
      </>}
      {phase === 'blocked' && <>
        <p className="platform-error" role="alert">{error?.message || 'A valid password-reset link is required. Return to sign in and request a new reset email.'}</p>
        <p className="platform-login-copy">This page will not use another account's existing sign-in session. It will not automatically send another reset email.</p>
        <a className="eig-recovery-support" href="mailto:info@elevatedimpactgroup.net?subject=ElevationPilot%20account%20recovery%20help">Contact EIG for account help</a>
      </>}
      {phase === 'complete' && <div className="eig-recovery-success" role="status"><strong>{identity.email}</strong><p>The account service confirmed the new password. This page no longer holds an active recovery credential.</p></div>}
      {phase !== 'verifying' && phase !== 'saving' && <a className="platform-secondary-button eig-recovery-back" href="/">Return to ElevationPilot</a>}
    </section>
  </main>;
}

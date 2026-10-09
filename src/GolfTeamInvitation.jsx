import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import PasswordField from './components/PasswordField.jsx';

const normalEmail = (value) => String(value || '').trim().toLowerCase();
const fullName = (row) => [row?.first_name, row?.last_name].filter(Boolean).join(' ') || 'Golfer';

async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message || 'The request could not be completed.';
    try {
      const details = await error.context?.json();
      message = details?.error || message;
    } catch {
      // Preserve the original network error.
    }
    throw new Error(message);
  }
  if (!data || data.error || !data.success) {
    throw new Error(data?.error || 'The request could not be completed.');
  }
  return data;
}

/**
 * Event-scoped Passenger boarding flow for an ALREADY-RESERVED team slot.
 * The token only previews/selects the invited registration. Email ownership
 * is proven by an authenticated session, never by the invitation link alone.
 *
 * This is intentionally separate from the platform admin-role invitation
 * wizard and never creates a second golf registration or charges a card.
 */
export default function GolfTeamInvitation({ token }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState('choose');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    callFunction('golf-team-member', { action: 'preview', token })
      .then((data) => {
        if (!mounted) return;
        setPreview(data);
        setFirstName(String(data.invitee?.first_name || ''));
        setLastName(String(data.invitee?.last_name || ''));
        setEmail(normalEmail(data.invitee?.email));
      })
      .catch((caught) => { if (mounted) setError(caught.message || 'Unable to open this team invitation.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUser(data?.session?.user || null);
        setAuthReady(true);
      }
    }).catch(() => {
      if (mounted) setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user || null);
        setAuthReady(true);
      }
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const invitedEmail = normalEmail(preview?.invitee?.email);
  const matchingAccount = user && normalEmail(user.email) === invitedEmail;
  const differentAccount = user && normalEmail(user.email) !== invitedEmail;
  const returnUrl = preview?.event?.id
    ? '/?airport=1&event_id=' + encodeURIComponent(preview.event.id)
    : '/?airport=1';

  function showMode(nextMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setSignupToken('');
  }

  async function claim(sessionUser = user) {
    if (!sessionUser || !preview?.event?.id) throw new Error('Sign in with the invited email to claim this team spot.');
    if (normalEmail(sessionUser.email) !== invitedEmail) {
      throw new Error('This invitation was sent to ' + invitedEmail + '. Switch to that Passenger account before continuing.');
    }
    await callFunction('golf-team-claim', { token });
    // The existing team, entry number, fee, and captain rights are linked by
    // the claim service. Returning to Airport must not resubmit registration.
    window.location.assign(returnUrl);
  }

  async function confirmSignedIn() {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await claim(); }
    catch (caught) { setError(caught.message || 'Unable to connect your registration.'); }
    finally { setBusy(false); }
  }

  async function switchPassenger() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await supabase.auth.signOut();
      setUser(null);
      showMode('signin');
    } catch (caught) {
      setError(caught.message || 'Could not switch accounts.');
    } finally {
      setBusy(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await callFunction('golf-account-auth', {
        action: 'sign_in', identifier: invitedEmail, password,
      });
      if (!data.access_token || !data.refresh_token) throw new Error('Unable to sign in with that email and password.');
      const { data: session, error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError || !session?.user) throw new Error(sessionError?.message || 'Unable to open your Passenger account.');
      await claim(session.user);
    } catch (caught) {
      setError(caught.message || 'Unable to sign in or claim your registration.');
    } finally {
      setBusy(false);
    }
  }

  async function requestCode(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const handle = username.trim().replace(/^@/, '').toLowerCase();
    if (!firstName.trim() || !lastName.trim()) return setError('Enter your first and last name.');
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(handle)) {
      return setError('Username must be 3-30 characters, using letters, numbers, dots, dashes, or underscores.');
    }
    if (password.length < 8) return setError('Create a password with at least 8 characters.');
    if (password !== confirmPassword) return setError('The passwords do not match.');
    setBusy(true);
    try {
      await callFunction('golf-account-auth', {
        action: 'request_signup_code', email: invitedEmail, username: handle,
      });
      setSignupToken(crypto.randomUUID());
      setMode('verify');
      setNotice('We sent a six-digit verification code to ' + invitedEmail + '. It expires in 10 minutes.');
    } catch (caught) {
      setError(caught.message || 'Unable to send verification code.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndJoin(event) {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      return setError('Enter the six-digit verification code from your email.');
    }
    setBusy(true);
    setError('');
    try {
      const result = await callFunction('golf-account-auth', {
        action: 'verify_signup_code',
        email: invitedEmail,
        code: verificationCode.trim(),
        username: username.trim().replace(/^@/, '').toLowerCase(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        signup_token: signupToken || crypto.randomUUID(),
      });
      if (!result.user_id) throw new Error('We could not confirm the new Passenger account.');
      const signedIn = await callFunction('golf-account-auth', {
        action: 'sign_in', identifier: invitedEmail, password,
      });
      if (!signedIn.access_token || !signedIn.refresh_token) throw new Error('Account created. Sign in to connect your team.');
      const { data: session, error: sessionError } = await supabase.auth.setSession({
        access_token: signedIn.access_token,
        refresh_token: signedIn.refresh_token,
      });
      if (sessionError || !session?.user) throw new Error('Account created. Please sign in to connect your team.');
      await claim(session.user);
    } catch (caught) {
      const message = caught.message || 'Unable to verify your account.';
      setError(message);
      if (/account created|already exists|already registered/i.test(message)) {
        setMode('signin');
        setNotice('Your account is ready. Sign in with the password you just created to finish claiming this team spot.');
      }
    } finally {
      setBusy(false);
    }
  }

  const infoLine = (label, value) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', padding: '10px 0', borderBottom: '1px solid #e6e8ed' }}>
    <span style={{ fontWeight: 700, color: '#70727A' }}>{label}</span>
    <strong style={{ color: '#1D245D' }}>{value || 'Not provided'}</strong>
  </div>;
  const isCaptain = preview && fullName(preview.captain) === fullName(preview.invitee);
  const roleLabel = isCaptain ? 'Captain' : 'Golfer';

  return <div className="platform-auth-screen" style={{ padding: '30px 14px' }}>
    <main className="platform-login-card" style={{ width: 'min(700px, 100%)', maxWidth: 700 }}>
      <div className="platform-logo-mark">EIG</div>
      <p className="platform-eyebrow">ElevationPilot · Airport Boarding</p>
      <h1>{loading ? 'Opening your invitation...' : preview ? 'Your team is waiting.' : 'Invitation needs attention.'}</h1>
      <p className="platform-login-copy">
        {preview
          ? 'Your golfer spot is already reserved. Sign in or create your Passenger account once to connect it, then manage your registration in Airport.'
          : 'We are verifying your invitation and team assignment.'}
      </p>
      {error && <div role="alert" className="platform-error" style={{ marginBottom: 15 }}>{error}</div>}
      {notice && <div role="status" className="message" style={{ marginBottom: 15 }}>{notice}</div>}
      {preview && <>
        <section aria-label="Your reserved registration" style={{ border: '1px solid #e6e8ed', borderRadius: 10, padding: '5px 18px', margin: '16px 0 22px', background: '#f8f9fb' }}>
          {infoLine('Event', preview.event?.name)}
          {infoLine('Team / Entry #', '#' + preview.team?.entry_number)}
          {infoLine('Your role', roleLabel)}
          {infoLine('Captain', fullName(preview.captain))}
          {infoLine('Your spot', fullName(preview.invitee))}
          {infoLine('Invited email', invitedEmail)}
        </section>

        {preview.completed && !user && <p className="platform-login-copy">This invitation was already accepted. Sign in with the invited account to open your Flight.</p>}

        {!authReady
          ? <p role="status" className="platform-login-copy">Checking your Passenger account...</p>
          : differentAccount
            ? <div className="platform-login-form">
                <div className="platform-error">You're signed in as {user.email}. This invitation is for {invitedEmail}.</div>
                <button type="button" className="platform-primary-button" disabled={busy} onClick={switchPassenger}>Switch to invited account</button>
              </div>
            : matchingAccount
              ? <div className="platform-login-form">
                  <p className="platform-login-copy">Signed in as <strong>{user.email}</strong>. Connect this reserved golfer spot to your existing account.</p>
                  <button type="button" className="platform-primary-button" disabled={busy} onClick={confirmSignedIn}>
                    {busy ? 'Connecting your Flight...' : 'Confirm My Team Spot & Open Airport'}
                  </button>
                </div>
              : mode === 'signin'
                ? <form className="platform-login-form" onSubmit={signIn}>
                    <h3>Sign in to your Passenger account</h3>
                    <label>Invited email<input type="email" value={invitedEmail} disabled autoComplete="email" /></label>
                    <PasswordField label="Your existing password" value={password} onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password" disabled={busy} required />
                    <button type="submit" className="platform-primary-button" disabled={busy || !password}>
                      {busy ? 'Signing in...' : 'Sign In & Claim My Team Spot'}
                    </button>
                    <button type="button" className="platform-secondary-button" onClick={() => showMode('choose')} disabled={busy}>Back</button>
                    <p className="platform-login-copy">Forgot your password? Use <a href="/?recovery=1">Elevat​ionPilot account recovery</a>, then reopen this invitation.</p>
                  </form>
                : mode === 'create'
                  ? <form className="platform-login-form" onSubmit={requestCode}>
                      <h3>Create your Passenger account</h3>
                      <div className="form-grid two">
                        <label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required disabled={busy} /></label>
                        <label>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required disabled={busy} /></label>
                      </div>
                      <label>Invited email<input type="email" value={invitedEmail} disabled autoComplete="email" /></label>
                      <label>Choose @username<input value={username} onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                        autoComplete="username" required disabled={busy} /></label>
                      <div className="form-grid two">
                        <PasswordField label="Create password" value={password} onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password" required minLength={8} disabled={busy} />
                        <PasswordField label="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password" required minLength={8} disabled={busy} />
                      </div>
                      <button type="submit" className="platform-primary-button" disabled={busy}>{busy ? 'Sending code...' : 'Send My Six-Digit Code'}</button>
                      <button type="button" className="platform-secondary-button" disabled={busy} onClick={() => showMode('choose')}>Back</button>
                      <p className="platform-login-copy">You will not be asked to register or pay again just to claim your spot.</p>
                    </form>
                  : mode === 'verify'
                    ? <form className="platform-login-form" onSubmit={verifyAndJoin}>
                        <h3>Verify your email</h3>
                        <p className="platform-login-copy">Enter the six-digit code sent to <strong>{invitedEmail}</strong>. Your chosen password is saved only when verification succeeds.</p>
                        <label>Six-digit email code<input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}"
                          value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          disabled={busy} required /></label>
                        <button type="submit" className="platform-primary-button" disabled={busy || verificationCode.length !== 6}>
                          {busy ? 'Verifying & Boarding...' : 'Verify & Open My Flight'}
                        </button>
                        <button type="button" className="platform-secondary-button" disabled={busy} onClick={() => showMode('create')}>Back to Account Details</button>
                      </form>
                    : <div className="platform-login-form">
                        <button type="button" className="platform-primary-button" disabled={loading || busy}
                          onClick={() => showMode('create')}>Create Passenger Account · Six-Digit Email Code</button>
                        <button type="button" className="platform-secondary-button" disabled={loading || busy}
                          onClick={() => showMode('signin')}>I Already Have an Account</button>
                      </div>}
      </>}
      <p className="platform-login-copy" style={{ marginTop: 20, fontSize: 13 }}>
        Need help? Contact your event organizer. Your Team / Entry # and payment arrangements won't change when you claim your registration.
      </p>
    </main>
  </div>;
}

import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

function currency(value, code = 'USD') {
  const amount = Number(value || 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { style: 'currency', currency: String(code || 'USD').toUpperCase() })
    : '$0.00';
}

export default function PublicEventRegistrationPanel({ event, registrationOffers = [], paymentSettings = null }) {
  const settings = event?.field_settings || {};
  const customFields = Array.isArray(settings.custom_fields) ? settings.custom_fields : [];
  const divisions = Array.isArray(settings.division_details)
    ? settings.division_details.map((item) => item?.name).filter(Boolean)
    : Array.isArray(event?.divisions) ? event.divisions.filter(Boolean) : [];

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountMode, setAccountMode] = useState('signin');
  const [showAccount, setShowAccount] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [registration, setRegistration] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(registrationOffers.find((offer) => offer.is_default)?.id || registrationOffers[0]?.id || '');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    division: '',
    membership_status: 'Member',
    ghin_number: '',
    custom_fields: {},
  });

  useEffect(() => {
    setSelectedOfferId((current) => current || registrationOffers.find((offer) => offer.is_default)?.id || registrationOffers[0]?.id || '');
  }, [registrationOffers]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session || null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession || null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !event?.event_key) return;
    let active = true;
    async function loadPassengerRegistration() {
      try {
        const [defaultsResult, registrationResult] = await Promise.all([
          supabase.functions.invoke('golf-registration-flow', { body: { action: 'profile_defaults' } }),
          supabase.functions.invoke('golf-registration-flow', { body: { action: 'my_registration', event_key: event.event_key } }),
        ]);

        if (!active) return;
        if (defaultsResult.data?.values) {
          const values = defaultsResult.data.values;
          setForm((current) => ({
            ...current,
            first_name: current.first_name || values['First name'] || '',
            last_name: current.last_name || values['Last name'] || '',
            email: session.user.email || current.email || values['Email'] || '',
            phone: current.phone || values['Phone'] || '',
            date_of_birth: current.date_of_birth || values['Date of Birth'] || '',
            gender: current.gender || values['Gender'] || '',
            ghin_number: current.ghin_number || values['GHIN #'] || '',
          }));
        }

        const existing = registrationResult.data?.registration || null;
        if (existing) {
          setRegistration(existing);
          setForm((current) => ({
            ...current,
            first_name: existing.first_name || current.first_name,
            last_name: existing.last_name || current.last_name,
            email: existing.email || session.user.email || current.email,
            phone: existing.phone || current.phone,
            membership_status: existing.membership_status || current.membership_status,
          }));
        } else {
          setForm((current) => ({ ...current, email: session.user.email || current.email }));
        }
      } catch {
        // Keep the form usable even if profile defaults are unavailable.
      }
    }
    loadPassengerRegistration();
    return () => { active = false; };
  }, [session?.user?.id, event?.event_key]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') setMessage('Payment received. Your event registration is complete.');
    if (params.get('payment') === 'cancelled') setMessage('Online payment was canceled. Your registration is still saved.');
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
  }

  function updateCustom(fieldId, value) {
    setForm((current) => ({
      ...current,
      custom_fields: { ...(current.custom_fields || {}), [fieldId]: value },
    }));
    setMessage('');
  }

  function registrationValues() {
    const values = {
      'First name': form.first_name.trim(),
      'Last name': form.last_name.trim(),
      'Email': form.email.trim(),
      'Phone': form.phone.trim(),
      'Date of Birth': form.date_of_birth || '',
      'Gender': form.gender || '',
      'Division': form.division || '',
      'Member status': form.membership_status || 'Member',
      'GHIN #': form.ghin_number.trim(),
    };
    customFields.forEach((field) => { values[field.label] = form.custom_fields?.[field.id] ?? ''; });
    return values;
  }

  function validateRegistrationForm() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || !form.phone.trim()) {
      return 'First name, last name, email, and phone are required.';
    }
    const requiredStandard = [
      ['dob', form.date_of_birth, 'Date of Birth'],
      ['gender', form.gender, 'Gender'],
      ['division', form.division, 'Division'],
      ['membership', form.membership_status, 'Club Membership Status'],
      ['ghin', form.ghin_number, 'GHIN #'],
    ];
    for (const [key, value, label] of requiredStandard) {
      if (settings[key] === 'required' && !String(value || '').trim()) return label + ' is required.';
    }
    for (const field of customFields) {
      if (!field?.required) continue;
      const value = form.custom_fields?.[field.id];
      const missing = field.type === 'checkbox' ? value !== true : !String(value ?? '').trim();
      if (missing) return field.label + ' is required.';
    }
    return '';
  }

  async function saveRegistration(signupContext = null) {
    const validation = validateRegistrationForm();
    if (validation) throw new Error(validation);
    const body = {
      action: 'create_pending',
      registration: {
        event_key: event.event_key,
        offer_id: selectedOfferId || null,
        values: registrationValues(),
      },
      ...(signupContext || {}),
    };
    const { data, error } = await supabase.functions.invoke('golf-registration-flow', { body });
    if (error || data?.error || !data?.registration) {
      throw new Error(data?.error || error?.message || 'Unable to save your registration.');
    }
    setRegistration(data.registration);
    return data.registration;
  }

  async function submitRegistration(eventSubmit) {
    eventSubmit.preventDefault();
    setMessage('');
    if (!session?.user) {
      setShowAccount(true);
      setAccountMode('create');
      return;
    }
    setBusy(true);
    try {
      const saved = await saveRegistration();
      setMessage('Registration saved at ' + currency(saved.price, paymentSettings?.currency) + '. Choose how you want to pay.');
    } catch (error) {
      setMessage(error.message || 'Unable to save registration.');
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    if (!identifier.trim() || !password) { setMessage('Enter your email or @username and password.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('golf-account-auth', {
        body: { action: 'sign_in', identifier: identifier.trim(), password },
      });
      if (error || data?.error || !data?.access_token || !data?.refresh_token) {
        throw new Error(data?.error || error?.message || 'Unable to sign in.');
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError || !sessionData?.user) throw sessionError || new Error('Unable to sign in.');
      setSession(sessionData.session || null);
      setForm((current) => ({ ...current, email: sessionData.user.email || current.email }));
      setShowAccount(false);
      setPassword('');
      setMessage('Signed in. Review your registration and continue.');
    } catch (error) {
      setMessage(error.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    const validation = validateRegistrationForm();
    if (validation) { setMessage(validation); return; }
    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(cleanUsername)) {
      setMessage('Choose an @username with 3-30 letters, numbers, dots, dashes, or underscores.');
      return;
    }
    if (password.length < 8) { setMessage('Create a password with at least 8 characters.'); return; }
    if (password !== confirmPassword) { setMessage('The passwords do not match.'); return; }

    setBusy(true);
    setMessage('');
    try {
      const { data: availability, error: availabilityError } = await supabase.functions.invoke('golf-account-auth', {
        body: { action: 'username_available', username: cleanUsername },
      });
      if (availabilityError || availability?.error || !availability?.available) {
        throw new Error(availability?.error || availabilityError?.message || 'That @username is not available.');
      }

      const signupToken = crypto.randomUUID();
      const redirectTo = window.location.origin + window.location.pathname + '?event=' + encodeURIComponent(event.public_slug || '');
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            username: cleanUsername,
            display_name: cleanUsername,
            pending_registration_token: signupToken,
          },
        },
      });
      if (error || !data?.user) throw error || new Error('Account was not created.');

      const saved = await saveRegistration({ user_id: data.user.id, signup_token: signupToken });
      setRegistration(saved);
      if (!data.session) {
        setShowAccount(false);
        setMessage('Passenger account created and your roster spot is saved. Check your email to verify the account, then return here to pay.');
        return;
      }
      setSession(data.session);
      setShowAccount(false);
      setMessage('Passenger account created. Choose how you want to pay.');
    } catch (error) {
      setMessage(error.message || 'Unable to create your Passenger account.');
    } finally {
      setBusy(false);
    }
  }

  async function startPayment(method) {
    if (!registration?.id) return;
    setBusy(true);
    setMessage('');
    try {
      const { data: selected, error: selectError } = await supabase.functions.invoke('golf-registration-flow', {
        body: { action: 'select_payment', registration_id: registration.id, payment_method: method },
      });
      if (selectError || selected?.error || !selected?.registration) {
        throw new Error(selected?.error || selectError?.message || 'Unable to save your payment choice.');
      }
      setRegistration(selected.registration);
      if (method === 'online') {
        const { data: checkout, error: checkoutError } = await supabase.functions.invoke('create-golf-checkout-session', {
          body: { registration_id: registration.id },
        });
        if (checkoutError || checkout?.error || !checkout?.url) {
          throw new Error(checkout?.error || checkoutError?.message || 'Unable to start secure checkout.');
        }
        window.location.assign(checkout.url);
        return;
      }
      setMessage('Registration saved. Your balance is marked for clubhouse payment.');
    } catch (error) {
      setMessage(error.message || 'Unable to continue payment.');
    } finally {
      setBusy(false);
    }
  }

  const selectedOffer = registrationOffers.find((offer) => offer.id === selectedOfferId) || registrationOffers[0] || null;
  const registrationComplete = ['paid', 'comp'].includes(registration?.payment_status);
  const allowOnline = paymentSettings?.allow_online === true;
  const allowClubhouse = paymentSettings?.allow_clubhouse === true;

  return <div style={{ display: 'grid', gap: 18 }}>
    {!authReady && <div style={{ color: '#70727A' }}>Checking Passenger account...</div>}

    {!!registrationOffers.length && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
      {registrationOffers.map((offer) => {
        const active = selectedOfferId === offer.id;
        return <button key={offer.id} type='button' onClick={() => setSelectedOfferId(offer.id)} style={{ textAlign: 'left', padding: 20, borderRadius: 14, border: active ? '2px solid #D81C22' : '1px solid #dde3ec', background: '#fff', cursor: 'pointer' }}>
          <small style={{ color: '#D81C22', fontWeight: 900, textTransform: 'uppercase' }}>{offer.charge_by ? 'Per ' + offer.charge_by : 'Registration'}</small>
          <strong style={{ display: 'block', color: '#1D245D', fontSize: 22, marginTop: 6 }}>{offer.name}</strong>
          {offer.description && <span style={{ display: 'block', color: '#70727A', marginTop: 6 }}>{offer.description}</span>}
          <b style={{ display: 'block', color: '#1D245D', fontSize: 28, marginTop: 12 }}>{currency(offer.price, paymentSettings?.currency)}</b>
        </button>;
      })}
    </div>}

    {registrationComplete ? <div style={{ padding: 20, borderRadius: 14, background: '#e9f8ef', border: '1px solid #9bd3ad', color: '#135c2c' }}>
      <strong>Registration complete.</strong>
      <div>{registration.payment_status === 'comp' ? 'Your registration is complimentary.' : 'Payment has been received.'}</div>
    </div> : <>
      <form onSubmit={submitRegistration} style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          <label>First name *<input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} /></label>
          <label>Last name *<input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} /></label>
          <label>Email *<input type='email' value={form.email} onChange={(e) => update('email', e.target.value)} disabled={Boolean(session?.user)} /></label>
          <label>Phone *<input type='tel' value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label>
          {settings.dob !== 'hidden' && <label>Date of Birth{settings.dob === 'required' ? ' *' : ''}<input type='date' value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} /></label>}
          {settings.gender !== 'hidden' && <label>Gender{settings.gender === 'required' ? ' *' : ''}<input value={form.gender} onChange={(e) => update('gender', e.target.value)} /></label>}
          {settings.division !== 'hidden' && <label>Division{settings.division === 'required' ? ' *' : ''}{divisions.length ? <select value={form.division} onChange={(e) => update('division', e.target.value)}><option value=''>Choose</option>{divisions.map((division) => <option key={division} value={division}>{division}</option>)}</select> : <input value={form.division} onChange={(e) => update('division', e.target.value)} />}</label>}
          {settings.membership !== 'hidden' && <label>Club Membership Status{settings.membership === 'required' ? ' *' : ''}<select value={form.membership_status} onChange={(e) => update('membership_status', e.target.value)}><option>Member</option><option>Non-Member</option></select></label>}
          {settings.ghin !== 'hidden' && <label>GHIN #{settings.ghin === 'required' ? ' *' : ''}<input value={form.ghin_number} onChange={(e) => update('ghin_number', e.target.value)} /></label>}
          {customFields.map((field) => field.type === 'checkbox'
            ? <label key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type='checkbox' style={{ width: 'auto' }} checked={form.custom_fields?.[field.id] === true} onChange={(e) => updateCustom(field.id, e.target.checked)} />{field.label}{field.required ? ' *' : ''}</label>
            : field.type === 'select'
              ? <label key={field.id}>{field.label}{field.required ? ' *' : ''}<select value={form.custom_fields?.[field.id] || ''} onChange={(e) => updateCustom(field.id, e.target.value)}><option value=''>Choose</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              : <label key={field.id}>{field.label}{field.required ? ' *' : ''}<input value={form.custom_fields?.[field.id] || ''} onChange={(e) => updateCustom(field.id, e.target.value)} /></label>
          )}
        </div>

        {!session?.user && <div style={{ padding: 16, borderRadius: 12, background: '#fff7f7', border: '1px solid #efc2c4' }}>
          <strong style={{ color: '#1D245D' }}>Passenger account required</strong>
          <p style={{ color: '#70727A', marginBottom: 10 }}>Your EIG Passenger account keeps this registration, payment, and future event history together.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type='button' style={{ border: 0, borderRadius: 9, padding: '10px 14px', background: '#1D245D', color: '#fff', fontWeight: 900 }} onClick={() => { setAccountMode('signin'); setShowAccount(true); }}>Sign In</button>
            <button type='button' style={{ border: 0, borderRadius: 9, padding: '10px 14px', background: '#D81C22', color: '#fff', fontWeight: 900 }} onClick={() => { setAccountMode('create'); setShowAccount(true); }}>Create Passenger Account</button>
          </div>
        </div>}
        {session?.user && <div style={{ padding: 14, borderRadius: 12, background: '#eef3ff', color: '#1D245D' }}>Signed in as <strong>{session.user.email}</strong></div>}
        <button type='submit' disabled={busy || !selectedOffer} style={{ border: 0, borderRadius: 10, padding: '13px 18px', background: '#D81C22', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>{busy ? 'Saving...' : registration?.id ? 'Update Registration & Continue' : 'Save Registration & Continue'}</button>
      </form>

      {registration?.id && <div style={{ padding: 20, borderRadius: 14, border: '1px solid #dde3ec', background: '#fff' }}>
        <div style={{ color: '#D81C22', fontWeight: 900, textTransform: 'uppercase', fontSize: 12 }}>Balance</div>
        <h3 style={{ color: '#1D245D', fontSize: 28, margin: '6px 0 8px' }}>{currency(registration.price, paymentSettings?.currency)}</h3>
        <p style={{ color: '#70727A' }}>This amount is the registration price snapshot saved to your roster entry. Later event price changes will not rewrite it.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {allowOnline && <button type='button' disabled={busy} onClick={() => startPayment('online')} style={{ border: 0, borderRadius: 9, padding: '11px 16px', background: '#D81C22', color: '#fff', fontWeight: 900 }}>Pay Online</button>}
          {allowClubhouse && <button type='button' disabled={busy} onClick={() => startPayment('clubhouse')} style={{ border: '1px solid #1D245D', borderRadius: 9, padding: '11px 16px', background: '#fff', color: '#1D245D', fontWeight: 900 }}>Pay at Clubhouse</button>}
        </div>
        {!allowOnline && !allowClubhouse && <div style={{ color: '#8e1c12' }}>Payment options are not configured for this event yet.</div>}
      </div>}
    </>}

    {message && <div style={{ padding: 14, borderRadius: 12, background: '#f4f6fa', color: '#1D245D', fontWeight: 700 }}>{message}</div>}

    {showAccount && <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(5,12,28,.78)', display: 'grid', placeItems: 'center', padding: 18 }}>
      <div style={{ width: 'min(520px,100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', color: '#17213f', borderRadius: 18, padding: 24, boxShadow: '0 30px 90px rgba(0,0,0,.36)' }}>
        <div style={{ color: '#D81C22', fontWeight: 900, textTransform: 'uppercase', fontSize: 12 }}>EIG Passenger</div>
        <h2 style={{ color: '#1D245D' }}>{accountMode === 'create' ? 'Create your Passenger account' : 'Sign in to continue'}</h2>
        {accountMode === 'signin' ? <>
          <label>Email or @username<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></label>
          <label>Password<input type='password' value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        </> : <>
          <p style={{ color: '#70727A' }}>Your registration email will become the account email: <strong>{form.email || 'enter it in the registration form first'}</strong>.</p>
          <label>Choose @username<input value={username} onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))} /></label>
          <label>Create password<input type='password' value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label>Confirm password<input type='password' value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
        </>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
          <button type='button' disabled={busy} onClick={accountMode === 'create' ? createAccount : signIn} style={{ border: 0, borderRadius: 9, padding: '11px 16px', background: '#D81C22', color: '#fff', fontWeight: 900 }}>{busy ? 'Please wait...' : accountMode === 'create' ? 'Create Account & Save Registration' : 'Sign In'}</button>
          <button type='button' disabled={busy} onClick={() => setShowAccount(false)} style={{ border: '1px solid #c7c8cc', borderRadius: 9, padding: '11px 16px', background: '#fff', color: '#1D245D', fontWeight: 900 }}>Cancel</button>
        </div>
        <button type='button' disabled={busy} onClick={() => { setAccountMode(accountMode === 'create' ? 'signin' : 'create'); setPassword(''); setConfirmPassword(''); }} style={{ marginTop: 14, border: 0, background: 'transparent', color: '#1D245D', fontWeight: 800, cursor: 'pointer' }}>{accountMode === 'create' ? 'Already have an account? Sign in' : 'Need an account? Create one'}</button>
      </div>
    </div>}
  </div>;
}

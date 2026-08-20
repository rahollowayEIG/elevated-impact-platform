import React, { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

const EIG_SLUG = 'elevated-impact-group';
const GOLF_REGISTRATION_URL = 'https://golf-event-registrations-eig.vercel.app';

function LoadingScreen({ message = 'Loading EIG Platform...' }) {
  return (
    <div className="platform-auth-screen">
      <div className="platform-login-card compact">
        <div className="platform-logo-mark">EIG</div>
        <h1>{message}</h1>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setBusy(false);
  }

  return (
    <div className="platform-auth-screen">
      <div className="platform-login-card">
        <div className="platform-logo-mark">EIG</div>
        <p className="platform-eyebrow">Elevated Impact Group</p>
        <h1>One login. Every EIG workspace.</h1>
        <p className="platform-login-copy">
          Sign in to access the organizations, products, events, and tools assigned to your account.
        </p>
        <form onSubmit={submit} className="platform-login-form">
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
          </label>
          {error && <div className="platform-error">{error}</div>}
          <button className="platform-primary-button" disabled={busy} type="submit">
            {busy ? 'Signing in...' : 'Sign in to EIG'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PublicInquiryPage({ slug }) {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    contact_full_name: '',
    group_name: '',
    contact_phone: '',
    contact_email: '',
    preferred_date: '',
    alternate_date: '',
    second_alternate_date: '',
    unavailable_date_notes: '',
    estimated_participants: '',
    preferred_start_type: 'Not Sure',
    preferred_start_time: '',
    event_type: 'Charity / Fundraiser',
    golf_format: 'Not Sure',
    food_needed: 'Not Sure',
    special_requests: '',
  });

  useEffect(() => {
    let cancelled = false;
    async function loadVenue() {
      setLoading(true);
      const { data, error: venueError } = await supabase
        .from('organizations')
        .select('id,name,slug,organization_type,status')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle();
      if (!cancelled) {
        if (venueError) setError(venueError.message);
        setOrganization(data || null);
        setLoading(false);
      }
    }
    loadVenue();
    return () => { cancelled = true; };
  }, [slug]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!organization?.id) return;
    if (!form.preferred_date) {
      setError('Please select a first-choice date.');
      return;
    }
    setBusy(true);
    const { error: insertError } = await supabase.from('event_requests').insert({
      organization_id: organization.id,
      status: 'submitted',
      event_type: form.event_type,
      preferred_date: form.preferred_date || null,
      alternate_date: form.alternate_date || null,
      second_alternate_date: form.second_alternate_date || null,
      estimated_participants: form.estimated_participants ? Number(form.estimated_participants) : null,
      contact_full_name: form.contact_full_name,
      group_name: form.group_name,
      contact_phone: form.contact_phone,
      contact_email: form.contact_email,
      unavailable_date_notes: form.unavailable_date_notes,
      preferred_start_type: form.preferred_start_type,
      preferred_start_time: form.preferred_start_time || null,
      golf_format: form.golf_format,
      food_needed: form.food_needed === 'Yes' ? true : form.food_needed === 'No' ? false : null,
      special_requests: form.special_requests,
      requested_details: {
        source: 'public_inquiry',
        first_choice_date: form.preferred_date || null,
        second_choice_date: form.alternate_date || null,
        third_choice_date: form.second_alternate_date || null,
        food_needed: form.food_needed,
      },
    });
    if (insertError) setError(insertError.message);
    else setSubmitted(true);
    setBusy(false);
  }

  if (loading) return <LoadingScreen message="Loading outing inquiry..." />;

  if (!organization) {
    return (
      <div className="platform-auth-screen">
        <div className="platform-login-card">
          <div className="platform-logo-mark">EIG</div>
          <h1>Venue not found.</h1>
          <p>This inquiry link is not connected to an active EIG venue.</p>
          {error && <div className="platform-error">{error}</div>}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="inquiry-public-shell">
        <div className="inquiry-public-card success-card">
          <div className="platform-logo-mark">EIG</div>
          <p className="platform-eyebrow">{organization.name}</p>
          <h1>Your outing request was submitted.</h1>
          <p>The venue will review your requested dates and outing details and follow up with you. Your selected dates are requests until the venue confirms one.</p>
          <button className="platform-secondary-button" onClick={() => window.location.reload()}>Submit another request</button>
        </div>
      </div>
    );
  }

  return (
    <div className="inquiry-public-shell">
      <div className="inquiry-public-card">
        <div className="inquiry-public-header">
          <div className="platform-logo-mark">EIG</div>
          <div>
            <p className="platform-eyebrow">Golf Outing Inquiry</p>
            <h1>{organization.name}</h1>
            <p>Tell us the basics. The venue will review availability and confirm the event before detailed planning begins.</p>
          </div>
        </div>

        <form className="inquiry-form" onSubmit={submit}>
          <section className="form-section">
            <div className="form-section-title">
              <span>1</span>
              <div><h2>Contact Information</h2><p>Who should the venue contact about this outing?</p></div>
            </div>
            <div className="form-grid two">
              <label>Full Name<input value={form.contact_full_name} onChange={(e) => update('contact_full_name', e.target.value)} required /></label>
              <label>Organization / Group Name<input value={form.group_name} onChange={(e) => update('group_name', e.target.value)} /></label>
              <label>Phone Number<input type="tel" value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} required /></label>
              <label>Email Address<input type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} required /></label>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title">
              <span>2</span>
              <div><h2>Preferred Dates</h2><p>Choose your first choice and up to two alternate dates.</p></div>
            </div>
            <div className="availability-note"><strong>Available to request</strong><span>Dates shown here are requests until the venue reviews and confirms one. Google Calendar availability can be connected to filter these choices automatically.</span></div>
            <div className="form-grid three">
              <label>1st Choice Date<input type="date" value={form.preferred_date} onChange={(e) => update('preferred_date', e.target.value)} required /></label>
              <label>2nd Choice Date<input type="date" value={form.alternate_date} onChange={(e) => update('alternate_date', e.target.value)} /></label>
              <label>3rd Choice Date<input type="date" value={form.second_alternate_date} onChange={(e) => update('second_alternate_date', e.target.value)} /></label>
            </div>
            <label className="full-label">Didn't see the date you wanted?
              <textarea rows="3" value={form.unavailable_date_notes} onChange={(e) => update('unavailable_date_notes', e.target.value)} placeholder="Share any specific date or date range you were hoping for so the venue can double-check its calendar." />
            </label>
          </section>

          <section className="form-section">
            <div className="form-section-title">
              <span>3</span>
              <div><h2>Outing Details</h2><p>Just enough information for the venue to review the request.</p></div>
            </div>
            <div className="form-grid two">
              <label>Estimated Number of Players<input type="number" min="1" value={form.estimated_participants} onChange={(e) => update('estimated_participants', e.target.value)} placeholder="72" required /></label>
              <label>Type of Event<select value={form.event_type} onChange={(e) => update('event_type', e.target.value)}><option>Charity / Fundraiser</option><option>Corporate</option><option>Association / Organization</option><option>Social</option><option>Club / Member Event</option><option>Other</option></select></label>
              <label>Preferred Start Type<select value={form.preferred_start_type} onChange={(e) => update('preferred_start_type', e.target.value)}><option>Shotgun</option><option>Tee Times</option><option>Not Sure</option></select></label>
              <label>Preferred Start Time<input type="time" value={form.preferred_start_time} onChange={(e) => update('preferred_start_time', e.target.value)} /></label>
              <label>Golf Format<select value={form.golf_format} onChange={(e) => update('golf_format', e.target.value)}><option>Not Sure</option><option>Scramble</option><option>Best Ball</option><option>Shamble</option><option>Stroke Play</option><option>Match Play</option><option>Stableford</option><option>Alternate Shot</option><option>Chapman / Pinehurst</option><option>Individual</option><option>Team</option><option>Custom Format</option></select></label>
              <label>Food / Banquet Needed?<select value={form.food_needed} onChange={(e) => update('food_needed', e.target.value)}><option>Not Sure</option><option>Yes</option><option>No</option></select></label>
            </div>
            <label className="full-label">Special Requests / Notes<textarea rows="4" value={form.special_requests} onChange={(e) => update('special_requests', e.target.value)} placeholder="Anything else the venue should know at this stage?" /></label>
          </section>

          {error && <div className="platform-error">{error}</div>}
          <div className="form-submit-row">
            <p>Submitting this form does not reserve or confirm a date.</p>
            <button className="platform-primary-button" disabled={busy} type="submit">{busy ? 'Submitting...' : 'Submit Outing Request'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkspaceSwitcher({ memberships, activeOrganizationId, onSelect }) {
  return (
    <select className="platform-workspace-select" value={activeOrganizationId || ''} onChange={(e) => onSelect(e.target.value)} aria-label="Choose workspace">
      {memberships.map((membership) => (
        <option key={membership.organization_id} value={membership.organization_id}>{membership.organization?.name || 'Workspace'}</option>
      ))}
    </select>
  );
}

function PlatformShell({ user, memberships, activeOrganizationId, setActiveOrganizationId, children, onSignOut }) {
  const active = memberships.find((m) => m.organization_id === activeOrganizationId);
  return (
    <div className="platform-shell">
      <header className="platform-topbar">
        <div className="platform-brand-wrap"><div className="platform-logo-mark small">EIG</div><div><strong>Elevated Impact Group</strong><span>{active?.organization?.name || 'Platform'}</span></div></div>
        <div className="platform-topbar-actions">
          <WorkspaceSwitcher memberships={memberships} activeOrganizationId={activeOrganizationId} onSelect={setActiveOrganizationId} />
          <div className="platform-user-block"><span>{user?.email}</span><button onClick={onSignOut}>Sign out</button></div>
        </div>
      </header>
      <main className="platform-main-content">{children}</main>
    </div>
  );
}

function StatCard({ label, value, detail }) {
  return <div className="platform-stat-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function EigAdminDashboard({ organizations, products, onOpenOrganization, onCreateOrganization, loading }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('EIG Test Organization');
  const [organizationType, setOrganizationType] = useState('business');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactEmail, setPrimaryContactEmail] = useState('');
  const [isTest, setIsTest] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const clients = organizations.filter((org) => org.slug !== EIG_SLUG);
  const activeProducts = products.filter((product) => product.status === 'active').length;

  async function submitOrganization(event) {
    event.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await onCreateOrganization({ name, organizationType, primaryContactName, primaryContactEmail, isTest });
      setShowCreate(false);
      setName('');
      setOrganizationType('business');
      setPrimaryContactName('');
      setPrimaryContactEmail('');
      setIsTest(false);
    } catch (error) {
      setCreateError(error.message || 'Unable to create organization.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="platform-page">
      <section className="platform-hero"><div><p className="platform-eyebrow">EIG Master Workspace</p><h1>Platform Control Center</h1><p>Manage client organizations, product access, and the growing EIG ecosystem from one place.</p></div><div className="platform-role-pill">EIG Admin</div></section>
      <section className="platform-stats-grid"><StatCard label="Client Organizations" value={clients.length} detail="Organizations managed by EIG" /><StatCard label="Products in Catalog" value={products.length} detail={`${activeProducts} currently active`} /><StatCard label="Platform Status" value="Live" detail="Shared authentication + entitlements" /></section>
      <section className="platform-section-card">
        <div className="platform-section-heading">
          <div><p className="platform-eyebrow">Clients</p><h2>Organizations</h2></div>
          <button className="platform-secondary-button" onClick={() => setShowCreate((current) => !current)}>{showCreate ? 'Cancel' : '+ Add Organization'}</button>
        </div>
        {showCreate && (
          <form className="platform-login-form" onSubmit={submitOrganization}>
            <label>Organization name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Organization name" /></label>
            <label>Organization type<select className="platform-workspace-select" value={organizationType} onChange={(e) => setOrganizationType(e.target.value)}><option value="business">Business</option><option value="golf_course">Golf Course</option><option value="venue">Venue</option><option value="nonprofit">Nonprofit</option></select></label>
            <label>Primary company contact<input value={primaryContactName} onChange={(e) => setPrimaryContactName(e.target.value)} placeholder="Contact name" /></label>
            <label>Primary contact email<input value={primaryContactEmail} onChange={(e) => setPrimaryContactEmail(e.target.value)} type="email" required placeholder="name@company.com" /></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} style={{ width: 'auto' }} />Mark as test/demo organization</label>
            <p className="platform-login-copy" style={{ margin: 0 }}>EIG creates the workspace and onboarding record. The company contact will later receive a secure invitation to finish the Organization Profile and become the first Organization Admin.</p>
            {createError && <div className="platform-error">{createError}</div>}
            <button className="platform-primary-button" disabled={creating || !name.trim() || !primaryContactEmail.trim()} type="submit">{creating ? 'Creating onboarding...' : 'Create Organization Onboarding'}</button>
          </form>
        )}
        {loading ? <p>Loading organizations...</p> : <div className="platform-org-grid">{clients.map((org) => <button key={org.id} className="platform-org-card" onClick={() => onOpenOrganization(org.id)}><div className="platform-org-icon">{org.name?.slice(0, 2).toUpperCase()}</div><div><strong>{org.name}{org.is_test ? ' · TEST' : ''}</strong><span>{org.organization_type?.replaceAll('_', ' ') || 'Organization'}</span></div><b>Open →</b></button>)}{!clients.length && <p>No client organizations found yet.</p>}</div>}
      </section>
    </div>
  );
}

function ProductCard({ product, enabled, onLaunch }) {
  const comingSoon = product.status === 'coming_soon';
  return (
    <div className={`platform-product-card ${enabled ? 'enabled' : ''}`}>
      <div className="platform-product-topline"><span>{product.category || 'EIG Product'}</span><span className={`platform-status-pill ${enabled ? 'enabled' : comingSoon ? 'soon' : ''}`}>{enabled ? 'Enabled' : comingSoon ? 'Coming Soon' : 'Not Enabled'}</span></div>
      <h3>{product.name}</h3><p>{product.description}</p>
      {enabled && product.product_key === 'golf_event_registration' && <button className="platform-primary-button inline" onClick={onLaunch}>Open Golf Event Registration</button>}
    </div>
  );
}

function VenueConfirmationForm({ request, onClose, onSaved }) {
  const dateOptions = [request.preferred_date, request.alternate_date, request.second_alternate_date].filter(Boolean);
  const [form, setForm] = useState({
    status: request.status || 'submitted',
    confirmed_date: request.confirmed_date || request.preferred_date || '',
    confirmed_start_type: request.confirmed_start_type || request.preferred_start_type || '',
    confirmed_start_time: request.confirmed_start_time || request.preferred_start_time || '',
    confirmed_capacity: request.confirmed_capacity || request.estimated_participants || '',
    confirmed_package: request.confirmed_package || '',
    venue_response: request.venue_response || '',
    venue_internal_notes: request.venue_internal_notes || '',
    deposit_amount: request.deposit_amount ?? '',
    lock_date: request.locked_fields?.includes('confirmed_date') ?? true,
    lock_start: request.locked_fields?.includes('confirmed_start') ?? true,
    lock_capacity: request.locked_fields?.includes('confirmed_capacity') ?? true,
    lock_package: request.locked_fields?.includes('confirmed_package') ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!request.hold_expires_at || request.status !== 'hold') return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [request.hold_expires_at, request.status]);

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  function lockedFields() {
    return [form.lock_date && 'confirmed_date', form.lock_start && 'confirmed_start', form.lock_capacity && 'confirmed_capacity', form.lock_package && 'confirmed_package'].filter(Boolean);
  }

  function commonPayload() {
    return {
      confirmed_date: form.confirmed_date || null,
      confirmed_start_type: form.confirmed_start_type || null,
      confirmed_start_time: form.confirmed_start_time || null,
      confirmed_capacity: form.confirmed_capacity ? Number(form.confirmed_capacity) : null,
      confirmed_package: form.confirmed_package || null,
      venue_response: form.venue_response || null,
      venue_internal_notes: form.venue_internal_notes || null,
      deposit_amount: form.deposit_amount === '' ? null : Number(form.deposit_amount),
      locked_fields: lockedFields(),
      venue_reviewed_at: new Date().toISOString(),
    };
  }

  async function updateRequest(payload) {
    setBusy(true); setError('');
    const { error: updateError } = await supabase.from('event_requests').update(payload).eq('id', request.id);
    if (updateError) setError(updateError.message); else onSaved();
    setBusy(false);
  }

  async function save(nextStatus = form.status) { await updateRequest({ ...commonPayload(), status: nextStatus }); }

  async function placeHold() {
    if (!form.confirmed_date) { setError('Choose the date the venue is placing on hold.'); return; }
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 24 * 60 * 60 * 1000);
    const depositAmount = form.deposit_amount === '' ? null : Number(form.deposit_amount);
    const depositRequired = depositAmount !== null && depositAmount > 0;
    await updateRequest({ ...commonPayload(), status: 'hold', hold_started_at: startedAt.toISOString(), hold_expires_at: expiresAt.toISOString(), hold_released_at: null, contract_status: request.contract_status === 'signed' ? 'signed' : 'not_sent', deposit_status: request.deposit_status === 'paid' || request.deposit_status === 'waived' ? request.deposit_status : depositRequired ? 'pending' : 'not_required', deposit_due_at: depositRequired ? expiresAt.toISOString() : null, calendar_status: request.calendar_status || 'not_created' });
  }

  async function extendHold() {
    const currentExpiration = request.hold_expires_at ? new Date(request.hold_expires_at) : new Date();
    const base = currentExpiration.getTime() > Date.now() ? currentExpiration : new Date();
    const nextExpiration = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    await updateRequest({ ...commonPayload(), status: 'hold', hold_extended_at: new Date().toISOString(), hold_expires_at: nextExpiration.toISOString(), deposit_due_at: request.deposit_status === 'pending' ? nextExpiration.toISOString() : request.deposit_due_at });
  }

  async function releaseHold() { await updateRequest({ ...commonPayload(), status: 'hold_expired', hold_released_at: new Date().toISOString(), calendar_status: request.calendar_status === 'hold' ? 'released' : request.calendar_status }); }

  function formatCountdown(expiresAt) {
    if (!expiresAt) return '';
    const remaining = new Date(expiresAt).getTime() - nowMs;
    if (remaining <= 0) return 'Hold time has expired';
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s remaining`;
  }

  const holdIsActive = request.status === 'hold' && request.hold_expires_at;

  return (
    <div className="review-panel">
      <div className="review-panel-heading"><div><p className="platform-eyebrow">Venue Review</p><h2>{request.group_name || request.contact_full_name || 'Outing Request'}</h2></div><button className="platform-secondary-button" onClick={onClose}>Close</button></div>
      {holdIsActive && <div style={{ marginBottom: 22, padding: 18, borderRadius: 14, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.06)' }}><p className="platform-eyebrow" style={{ marginBottom: 6 }}>24-Hour Venue Hold</p><h3 style={{ margin: 0 }}>{formatCountdown(request.hold_expires_at)}</h3><p style={{ margin: '8px 0 0', opacity: .8 }}>Held until {new Date(request.hold_expires_at).toLocaleString()}. The event is not finally confirmed until the contract and deposit requirements are complete.</p><div className="review-actions" style={{ marginTop: 14 }}><button className="platform-secondary-button" disabled={busy} onClick={extendHold}>Extend Another 24 Hours</button><button className="platform-secondary-button danger-outline" disabled={busy} onClick={releaseHold}>Release Hold</button></div></div>}
      <div className="review-summary-grid"><div><span>Contact</span><strong>{request.contact_full_name || '—'}</strong><small>{request.contact_email}<br />{request.contact_phone}</small></div><div><span>Players</span><strong>{request.estimated_participants || '—'}</strong><small>{request.event_type || 'Golf Outing'}</small></div><div><span>Start</span><strong>{request.preferred_start_type || 'Not Sure'}</strong><small>{request.preferred_start_time || 'Time not specified'}</small></div><div><span>Golf Format</span><strong>{request.golf_format || 'Not Sure'}</strong><small>{request.food_needed === true ? 'Food / banquet requested' : request.food_needed === false ? 'No food requested' : 'Food needs not decided'}</small></div></div>
      <div className="review-date-choices"><h3>Requested Dates</h3><div>{dateOptions.map((date, index) => <button key={date} type="button" className={form.confirmed_date === date ? 'selected' : ''} onClick={() => update('confirmed_date', date)}><span>Choice {index + 1}</span><strong>{new Date(`${date}T12:00:00`).toLocaleDateString()}</strong></button>)}</div>{request.unavailable_date_notes && <p><strong>Date not shown note:</strong> {request.unavailable_date_notes}</p>}</div>
      <div className="form-grid two review-fields"><label>Held / Proposed Date<input type="date" value={form.confirmed_date} onChange={(e) => update('confirmed_date', e.target.value)} /></label><label>Confirmed Start Type<select value={form.confirmed_start_type} onChange={(e) => update('confirmed_start_type', e.target.value)}><option value="">Select</option><option>Shotgun</option><option>Tee Times</option><option>Not Sure</option></select></label><label>Confirmed Start Time<input type="time" value={form.confirmed_start_time || ''} onChange={(e) => update('confirmed_start_time', e.target.value)} /></label><label>Confirmed Capacity<input type="number" min="1" value={form.confirmed_capacity} onChange={(e) => update('confirmed_capacity', e.target.value)} /></label><label>Deposit Amount<input type="number" min="0" step="0.01" value={form.deposit_amount} onChange={(e) => update('deposit_amount', e.target.value)} placeholder="0.00" /></label><label>Deposit Status<input value={request.deposit_status?.replaceAll('_', ' ') || 'not required'} disabled /></label><label className="full-span">Venue Package / Pricing Summary<input value={form.confirmed_package} onChange={(e) => update('confirmed_package', e.target.value)} placeholder="Example: Golf + cart + lunch package" /></label><label className="full-span">Message to Organizer<textarea rows="4" value={form.venue_response} onChange={(e) => update('venue_response', e.target.value)} placeholder="Hold details, pricing, questions, or alternate plan..." /></label><label className="full-span">Internal Venue Notes<textarea rows="3" value={form.venue_internal_notes} onChange={(e) => update('venue_internal_notes', e.target.value)} placeholder="Private notes not intended for the organizer." /></label></div>
      <div className="locked-fields-box"><div><h3>Lock venue-confirmed fields for organizer</h3><p>The organizer receives these values prefilled. Locked items require the venue to approve a change.</p></div><label><input type="checkbox" checked={form.lock_date} onChange={(e) => update('lock_date', e.target.checked)} /> Date</label><label><input type="checkbox" checked={form.lock_start} onChange={(e) => update('lock_start', e.target.checked)} /> Start type / time</label><label><input type="checkbox" checked={form.lock_capacity} onChange={(e) => update('lock_capacity', e.target.checked)} /> Capacity</label><label><input type="checkbox" checked={form.lock_package} onChange={(e) => update('lock_package', e.target.checked)} /> Venue package / pricing</label></div>
      {error && <div className="platform-error">{error}</div>}
      <div className="review-actions"><button className="platform-secondary-button" disabled={busy} onClick={() => save('needs_response')}>Ask a Question</button><button className="platform-secondary-button" disabled={busy} onClick={() => save('tentative')}>Mark Tentative</button><button className="platform-secondary-button danger-outline" disabled={busy} onClick={() => save('declined')}>Decline</button>{!holdIsActive && <button className="platform-primary-button" disabled={busy || !form.confirmed_date} onClick={placeHold}>{busy ? 'Saving...' : 'Confirm Terms + Place 24-Hour Hold'}</button>}</div>
    </div>
  );
}

function EventRequestsSection({ organization, requests, loading, onReload }) {
  const [selected, setSelected] = useState(null);
  const inquiryUrl = `${window.location.origin}${window.location.pathname}#inquiry/${organization.slug}`;
  function copyInquiryLink() { navigator.clipboard?.writeText(inquiryUrl); }
  if (selected) return <VenueConfirmationForm request={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); onReload(); }} />;
  return (
    <section className="platform-section-card">
      <div className="platform-section-heading"><div><p className="platform-eyebrow">Venue Workflow</p><h2>Outing Inquiries</h2></div><div className="section-actions"><button className="platform-secondary-button" onClick={() => window.open(inquiryUrl, '_blank')}>Open Inquiry Page</button><button className="platform-secondary-button" onClick={copyInquiryLink}>Copy Inquiry Link</button></div></div>
      <div className="inquiry-link-box"><div><strong>Public inquiry link</strong><span>{inquiryUrl}</span></div><small>Use this on the venue website, in email, or anywhere someone wants to request an outing.</small></div>
      {loading ? <p>Loading inquiries...</p> : <div className="request-list">{requests.map((request) => <button key={request.id} className="request-row" onClick={() => setSelected(request)}><div><strong>{request.group_name || request.contact_full_name || 'New Outing Inquiry'}</strong><span>{request.contact_full_name} · {request.contact_email}</span></div><div><strong>{request.preferred_date ? new Date(`${request.preferred_date}T12:00:00`).toLocaleDateString() : 'No date'}</strong><span>{request.estimated_participants ? `${request.estimated_participants} players` : 'Player count pending'}</span></div><div><span className={`request-status ${request.status}`}>{request.status?.replaceAll('_', ' ')}</span>{request.status === 'hold' && request.hold_expires_at && <small>Hold until {new Date(request.hold_expires_at).toLocaleString()}</small>}<b>Review →</b></div></button>)}{!requests.length && <div className="empty-state"><strong>No outing inquiries yet.</strong><span>Share the public inquiry link to start collecting requests.</span></div>}</div>}
    </section>
  );
}

function OrganizationDashboard({ organization, role, products, entitlements, eventRequests, loadingRequests, onReloadRequests, onLaunchGolfRegistration }) {
  const enabledIds = useMemo(() => new Set(entitlements.filter((e) => ['active', 'trial'].includes(e.status)).map((e) => e.product_id)), [entitlements]);
  const enabledCount = enabledIds.size;
  const canReviewRequests = ['organization_admin', 'organization_staff'].includes(role);
  return (
    <div className="platform-page">
      <section className="platform-hero organization"><div><p className="platform-eyebrow">Organization Workspace</p><h1>{organization?.name || 'Organization'}</h1><p>Manage venue inquiries, EIG products, events, network, billing, and future services from one workspace.</p></div><div className="platform-role-pill">{role?.replaceAll('_', ' ') || 'member'}</div></section>
      <section className="platform-stats-grid"><StatCard label="Enabled Products" value={enabledCount} detail="Purchased or assigned by EIG" /><StatCard label="Open Inquiries" value={eventRequests.filter((r) => !['confirmed', 'declined', 'cancelled'].includes(r.status)).length} detail="Awaiting venue workflow" /><StatCard label="Workspace" value={organization?.is_test ? 'Test' : 'Active'} detail="One login across enabled products" /></section>
      {canReviewRequests && <EventRequestsSection organization={organization} requests={eventRequests} loading={loadingRequests} onReload={onReloadRequests} />}
      <section className="platform-section-card"><div className="platform-section-heading"><div><p className="platform-eyebrow">Your EIG Products</p><h2>Products & Tools</h2></div></div><div className="platform-product-grid">{products.map((product) => <ProductCard key={product.id} product={product} enabled={enabledIds.has(product.id)} onLaunch={onLaunchGolfRegistration} />)}</div></section>
    </div>
  );
}

export default function App() {
  const publicMatch = window.location.hash.match(/^#inquiry\/([^/?#]+)/);
  if (publicMatch && isSupabaseConfigured) return <PublicInquiryPage slug={decodeURIComponent(publicMatch[1])} />;

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState('');
  const [products, setProducts] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [eventRequests, setEventRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [dataError, setDataError] = useState('');

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      if (!nextSession) { setMemberships([]); setActiveOrganizationId(''); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session?.user?.id) loadMemberships(session.user.id); }, [session?.user?.id]);
  useEffect(() => { if (activeOrganizationId) loadWorkspaceData(activeOrganizationId); }, [activeOrganizationId]);

  async function loadMemberships(userId, preferredOrganizationId = '') {
    setLoadingData(true); setDataError('');
    const { data, error } = await supabase.from('organization_memberships').select('organization_id, role, status, organization:organizations(id,name,slug,organization_type,status,is_test,onboarding_status)').eq('user_id', userId).eq('status', 'active');
    if (error) { setDataError(error.message); setMemberships([]); setLoadingData(false); return; }
    const ordered = [...(data || [])].sort((a, b) => { if (a.organization?.slug === EIG_SLUG) return -1; if (b.organization?.slug === EIG_SLUG) return 1; return (a.organization?.name || '').localeCompare(b.organization?.name || ''); });
    setMemberships(ordered); setActiveOrganizationId((current) => preferredOrganizationId || current || ordered[0]?.organization_id || ''); setLoadingData(false);
  }

  async function loadEventRequests(organizationId) {
    setLoadingRequests(true);
    const { data, error } = await supabase.from('event_requests').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
    if (error) setDataError(error.message);
    setEventRequests(data || []);
    setLoadingRequests(false);
  }

  async function loadWorkspaceData(organizationId) {
    setLoadingData(true); setDataError('');
    const activeMembership = memberships.find((m) => m.organization_id === organizationId);
    const isEig = activeMembership?.organization?.slug === EIG_SLUG && activeMembership?.role === 'eig_admin';
    const [{ data: productRows, error: productError }, { data: entitlementRows, error: entitlementError }] = await Promise.all([
      supabase.from('products').select('*').neq('status', 'retired').order('sort_order'),
      supabase.from('organization_product_entitlements').select('*').eq('organization_id', organizationId),
    ]);
    if (productError || entitlementError) setDataError(productError?.message || entitlementError?.message || 'Unable to load workspace data.');
    setProducts(productRows || []); setEntitlements(entitlementRows || []);
    if (isEig) {
      const { data: orgRows, error: orgError } = await supabase.from('organizations').select('*').order('name');
      if (orgError) setDataError(orgError.message);
      setOrganizations(orgRows || []); setEventRequests([]);
    } else {
      setOrganizations([]);
      if (['organization_admin', 'organization_staff'].includes(activeMembership?.role)) await loadEventRequests(organizationId);
      else setEventRequests([]);
    }
    setLoadingData(false);
  }

  async function createOrganization({ name, organizationType, primaryContactName, primaryContactEmail, isTest }) {
    setDataError('');
    const { data, error } = await supabase.rpc('create_organization_workspace', {
      p_name: name.trim(),
      p_organization_type: organizationType,
      p_is_test: isTest,
      p_primary_contact_name: primaryContactName.trim() || null,
      p_primary_contact_email: primaryContactEmail.trim(),
    });
    if (error) throw error;
    if (!data?.id) throw new Error('Organization was created but no workspace was returned.');
    await loadMemberships(session.user.id, data.id);
    return data;
  }

  async function signOut() { await supabase.auth.signOut(); }

  if (!isSupabaseConfigured) return <div className="platform-auth-screen"><div className="platform-login-card"><div className="platform-logo-mark">EIG</div><h1>Supabase environment variables are missing.</h1><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.</p></div></div>;
  if (!authReady) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  if (loadingData && !memberships.length) return <LoadingScreen message="Opening your workspaces..." />;
  if (!memberships.length) return <div className="platform-auth-screen"><div className="platform-login-card"><div className="platform-logo-mark">EIG</div><h1>No active workspace found.</h1><p>Your login is valid, but it does not currently have an active EIG organization membership.</p>{dataError && <div className="platform-error">{dataError}</div>}<button className="platform-secondary-button" onClick={signOut}>Sign out</button></div></div>;

  const activeMembership = memberships.find((m) => m.organization_id === activeOrganizationId) || memberships[0];
  const activeOrganization = activeMembership?.organization;
  const isEigAdminWorkspace = activeOrganization?.slug === EIG_SLUG && activeMembership?.role === 'eig_admin';

  return (
    <PlatformShell user={session.user} memberships={memberships} activeOrganizationId={activeOrganizationId} setActiveOrganizationId={setActiveOrganizationId} onSignOut={signOut}>
      {dataError && <div className="platform-error banner">{dataError}</div>}
      {isEigAdminWorkspace ? (
        <EigAdminDashboard organizations={organizations} products={products} loading={loadingData} onOpenOrganization={setActiveOrganizationId} onCreateOrganization={createOrganization} />
      ) : (
        <OrganizationDashboard
          organization={activeOrganization}
          role={activeMembership?.role}
          products={products}
          entitlements={entitlements}
          eventRequests={eventRequests}
          loadingRequests={loadingRequests}
          onReloadRequests={() => loadEventRequests(activeOrganizationId)}
          onLaunchGolfRegistration={() => { window.location.href = GOLF_REGISTRATION_URL; }}
        />
      )}
    </PlatformShell>
  );
}

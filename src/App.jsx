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
        <p className="platform-login-copy">Sign in to access the organizations, products, events, and tools assigned to your account.</p>
        <form onSubmit={submit} className="platform-login-form">
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
          <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
          {error && <div className="platform-error">{error}</div>}
          <button className="platform-primary-button" disabled={busy} type="submit">{busy ? 'Signing in...' : 'Sign in to EIG'}</button>
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
    contact_full_name: '', group_name: '', contact_phone: '', contact_email: '', preferred_date: '', alternate_date: '', second_alternate_date: '', unavailable_date_notes: '', estimated_participants: '', preferred_start_type: 'Not Sure', preferred_start_time: '', event_type: 'Charity / Fundraiser', golf_format: 'Not Sure', food_needed: 'Not Sure', special_requests: '',
  });

  useEffect(() => {
    let cancelled = false;
    async function loadVenue() {
      setLoading(true);
      const { data, error: venueError } = await supabase.from('organizations').select('id,name,slug,organization_type,status').eq('slug', slug).eq('status', 'active').maybeSingle();
      if (!cancelled) { if (venueError) setError(venueError.message); setOrganization(data || null); setLoading(false); }
    }
    loadVenue();
    return () => { cancelled = true; };
  }, [slug]);

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function submit(event) {
    event.preventDefault(); setError('');
    if (!organization?.id) return;
    if (!form.preferred_date) { setError('Please select a first-choice date.'); return; }
    setBusy(true);
    const { error: insertError } = await supabase.from('event_requests').insert({
      organization_id: organization.id, status: 'submitted', event_type: form.event_type, preferred_date: form.preferred_date || null, alternate_date: form.alternate_date || null, second_alternate_date: form.second_alternate_date || null, estimated_participants: form.estimated_participants ? Number(form.estimated_participants) : null, contact_full_name: form.contact_full_name, group_name: form.group_name, contact_phone: form.contact_phone, contact_email: form.contact_email, unavailable_date_notes: form.unavailable_date_notes, preferred_start_type: form.preferred_start_type, preferred_start_time: form.preferred_start_time || null, golf_format: form.golf_format, food_needed: form.food_needed === 'Yes' ? true : form.food_needed === 'No' ? false : null, special_requests: form.special_requests,
      requested_details: { source: 'public_inquiry', first_choice_date: form.preferred_date || null, second_choice_date: form.alternate_date || null, third_choice_date: form.second_alternate_date || null, food_needed: form.food_needed },
    });
    if (insertError) setError(insertError.message); else setSubmitted(true);
    setBusy(false);
  }

  if (loading) return <LoadingScreen message="Loading outing inquiry..." />;
  if (!organization) return <div className="platform-auth-screen"><div className="platform-login-card"><div className="platform-logo-mark">EIG</div><h1>Venue not found.</h1><p>This inquiry link is not connected to an active EIG venue.</p>{error && <div className="platform-error">{error}</div>}</div></div>;
  if (submitted) return <div className="inquiry-public-shell"><div className="inquiry-public-card success-card"><div className="platform-logo-mark">EIG</div><p className="platform-eyebrow">{organization.name}</p><h1>Your outing request was submitted.</h1><p>The venue will review your requested dates and outing details and follow up with you. Your selected dates are requests until the venue confirms one.</p><button className="platform-secondary-button" onClick={() => window.location.reload()}>Submit another request</button></div></div>;

  return (
    <div className="inquiry-public-shell"><div className="inquiry-public-card">
      <div className="inquiry-public-header"><div className="platform-logo-mark">EIG</div><div><p className="platform-eyebrow">Golf Outing Inquiry</p><h1>{organization.name}</h1><p>Tell us the basics. The venue will review availability and confirm the event before detailed planning begins.</p></div></div>
      <form className="inquiry-form" onSubmit={submit}>
        <section className="form-section"><div className="form-section-title"><span>1</span><div><h2>Contact Information</h2><p>Who should the venue contact about this outing?</p></div></div><div className="form-grid two"><label>Full Name<input value={form.contact_full_name} onChange={(e) => update('contact_full_name', e.target.value)} required /></label><label>Organization / Group Name<input value={form.group_name} onChange={(e) => update('group_name', e.target.value)} /></label><label>Phone Number<input type="tel" value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} required /></label><label>Email Address<input type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} required /></label></div></section>
        <section className="form-section"><div className="form-section-title"><span>2</span><div><h2>Preferred Dates</h2><p>Choose your first choice and up to two alternate dates.</p></div></div><div className="availability-note"><strong>Available to request</strong><span>Dates shown here are requests until the venue reviews and confirms one. Google Calendar availability can be connected to filter these choices automatically.</span></div><div className="form-grid three"><label>1st Choice Date<input type="date" value={form.preferred_date} onChange={(e) => update('preferred_date', e.target.value)} required /></label><label>2nd Choice Date<input type="date" value={form.alternate_date} onChange={(e) => update('alternate_date', e.target.value)} /></label><label>3rd Choice Date<input type="date" value={form.second_alternate_date} onChange={(e) => update('second_alternate_date', e.target.value)} /></label></div><label className="full-label">Didn't see the date you wanted?<textarea rows="3" value={form.unavailable_date_notes} onChange={(e) => update('unavailable_date_notes', e.target.value)} placeholder="Share any specific date or date range you were hoping for so the venue can double-check its calendar." /></label></section>
        <section className="form-section"><div className="form-section-title"><span>3</span><div><h2>Outing Details</h2><p>Just enough information for the venue to review the request.</p></div></div><div className="form-grid two"><label>Estimated Number of Players<input type="number" min="1" value={form.estimated_participants} onChange={(e) => update('estimated_participants', e.target.value)} placeholder="72" required /></label><label>Type of Event<select value={form.event_type} onChange={(e) => update('event_type', e.target.value)}><option>Charity / Fundraiser</option><option>Corporate</option><option>Association / Organization</option><option>Social</option><option>Club / Member Event</option><option>Other</option></select></label><label>Preferred Start Type<select value={form.preferred_start_type} onChange={(e) => update('preferred_start_type', e.target.value)}><option>Shotgun</option><option>Tee Times</option><option>Not Sure</option></select></label><label>Preferred Start Time<input type="time" value={form.preferred_start_time} onChange={(e) => update('preferred_start_time', e.target.value)} /></label><label>Golf Format<select value={form.golf_format} onChange={(e) => update('golf_format', e.target.value)}><option>Not Sure</option><option>Scramble</option><option>Best Ball</option><option>Shamble</option><option>Stroke Play</option><option>Match Play</option><option>Stableford</option><option>Alternate Shot</option><option>Chapman / Pinehurst</option><option>Individual</option><option>Team</option><option>Custom Format</option></select></label><label>Food / Banquet Needed?<select value={form.food_needed} onChange={(e) => update('food_needed', e.target.value)}><option>Not Sure</option><option>Yes</option><option>No</option></select></label></div><label className="full-label">Special Requests / Notes<textarea rows="4" value={form.special_requests} onChange={(e) => update('special_requests', e.target.value)} placeholder="Anything else the venue should know at this stage?" /></label></section>
        {error && <div className="platform-error">{error}</div>}
        <div className="form-submit-row"><p>Submitting this form does not reserve or confirm a date.</p><button className="platform-primary-button" disabled={busy} type="submit">{busy ? 'Submitting...' : 'Submit Outing Request'}</button></div>
      </form>
    </div></div>
  );
}

function WorkspaceSwitcher({ memberships, activeOrganizationId, onSelect }) {
  return <select className="platform-workspace-select" value={activeOrganizationId || ''} onChange={(e) => onSelect(e.target.value)} aria-label="Choose workspace">{memberships.map((membership) => <option key={membership.organization_id} value={membership.organization_id}>{membership.organization?.name || 'Workspace'}</option>)}</select>;
}

function PlatformShell({ user, memberships, activeOrganizationId, setActiveOrganizationId, children, onSignOut }) {
  const active = memberships.find((m) => m.organization_id === activeOrganizationId);
  return <div className="platform-shell"><header className="platform-topbar"><div className="platform-brand-wrap"><div className="platform-logo-mark small">EIG</div><div><strong>Elevated Impact Group</strong><span>{active?.organization?.name || 'Platform'}</span></div></div><div className="platform-topbar-actions"><WorkspaceSwitcher memberships={memberships} activeOrganizationId={activeOrganizationId} onSelect={setActiveOrganizationId} /><div className="platform-user-block"><span>{user?.email}</span><button onClick={onSignOut}>Sign out</button></div></div></header><main className="platform-main-content">{children}</main></div>;
}

function StatCard({ label, value, detail }) { return <div className="platform-stat-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>; }

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
    event.preventDefault(); setCreateError(''); setCreating(true);
    try { await onCreateOrganization({ name, organizationType, primaryContactName, primaryContactEmail, isTest }); setShowCreate(false); setName(''); setOrganizationType('business'); setPrimaryContactName(''); setPrimaryContactEmail(''); setIsTest(false); }
    catch (error) { setCreateError(error.message || 'Unable to create organization.'); }
    finally { setCreating(false); }
  }

  return <div className="platform-page"><section className="platform-hero"><div><p className="platform-eyebrow">EIG Master Workspace</p><h1>Platform Control Center</h1><p>Manage client organizations, product access, and the growing EIG ecosystem from one place.</p></div><div className="platform-role-pill">EIG Admin</div></section><section className="platform-stats-grid"><StatCard label="Client Organizations" value={clients.length} detail="Organizations managed by EIG" /><StatCard label="Products in Catalog" value={products.length} detail={`${activeProducts} currently active`} /><StatCard label="Platform Status" value="Live" detail="Shared authentication + entitlements" /></section><section className="platform-section-card"><div className="platform-section-heading"><div><p className="platform-eyebrow">Clients</p><h2>Organizations</h2></div><button className="platform-secondary-button" onClick={() => setShowCreate((current) => !current)}>{showCreate ? 'Cancel' : '+ Add Organization'}</button></div>{showCreate && <form className="platform-login-form" onSubmit={submitOrganization}><label>Organization name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Organization name" /></label><label>Organization type<select className="platform-workspace-select" value={organizationType} onChange={(e) => setOrganizationType(e.target.value)}><option value="business">Business</option><option value="golf_course">Golf Course</option><option value="venue">Venue</option><option value="nonprofit">Nonprofit</option></select></label><label>Primary company contact<input value={primaryContactName} onChange={(e) => setPrimaryContactName(e.target.value)} placeholder="Contact name" /></label><label>Primary contact email<input value={primaryContactEmail} onChange={(e) => setPrimaryContactEmail(e.target.value)} type="email" required placeholder="name@company.com" /></label><label style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} style={{ width: 'auto' }} />Mark as test/demo organization</label><p className="platform-login-copy" style={{ margin: 0 }}>EIG creates the workspace and onboarding record. The company contact will later receive a secure invitation to finish the Organization Profile and become the first Organization Admin.</p>{createError && <div className="platform-error">{createError}</div>}<button className="platform-primary-button" disabled={creating || !name.trim() || !primaryContactEmail.trim()} type="submit">{creating ? 'Creating onboarding...' : 'Create Organization Onboarding'}</button></form>}{loading ? <p>Loading organizations...</p> : <div className="platform-org-grid">{clients.map((org) => <button key={org.id} className="platform-org-card" onClick={() => onOpenOrganization(org.id)}><div className="platform-org-icon">{org.name?.slice(0, 2).toUpperCase()}</div><div><strong>{org.name}{org.is_test ? ' · TEST' : ''}</strong><span>{org.organization_type?.replaceAll('_', ' ') || 'Organization'}</span></div><b>Open →</b></button>)}{!clients.length && <p>No client organizations found yet.</p>}</div>}</section></div>;
}

function ProductCard({ product, enabled, onLaunch }) {
  const comingSoon = product.status === 'coming_soon';
  return <div className={`platform-product-card ${enabled ? 'enabled' : ''}`}><div className="platform-product-topline"><span>{product.category || 'EIG Product'}</span><span className={`platform-status-pill ${enabled ? 'enabled' : comingSoon ? 'soon' : ''}`}>{enabled ? 'Enabled' : comingSoon ? 'Coming Soon' : 'Not Enabled'}</span></div><h3>{product.product_key === 'golf_event_registration' ? 'EIE · Events' : product.name}</h3><p>{product.product_key === 'golf_event_registration' ? 'Create, publish, register, collect payments, manage rosters, communicate, and prepare Golf Genius exports.' : product.description}</p>{enabled && product.product_key === 'golf_event_registration' && <button className="platform-primary-button inline" onClick={onLaunch}>Open EIE</button>}</div>;
}

function VenueConfirmationForm({ request, onClose, onSaved }) {
  const dateOptions = [request.preferred_date, request.alternate_date, request.second_alternate_date].filter(Boolean);
  const [form, setForm] = useState({ status: request.status || 'submitted', confirmed_date: request.confirmed_date || request.preferred_date || '', confirmed_start_type: request.confirmed_start_type || request.preferred_start_type || '', confirmed_start_time: request.confirmed_start_time || request.preferred_start_time || '', confirmed_capacity: request.confirmed_capacity || request.estimated_participants || '', confirmed_package: request.confirmed_package || '', venue_response: request.venue_response || '', venue_internal_notes: request.venue_internal_notes || '', deposit_amount: request.deposit_amount ?? '', lock_date: request.locked_fields?.includes('confirmed_date') ?? true, lock_start: request.locked_fields?.includes('confirmed_start') ?? true, lock_capacity: request.locked_fields?.includes('confirmed_capacity') ?? true, lock_package: request.locked_fields?.includes('confirmed_package') ?? true });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => { if (!request.hold_expires_at || request.status !== 'hold') return undefined; const timer = window.setInterval(() => setNowMs(Date.now()), 1000); return () => window.clearInterval(timer); }, [request.hold_expires_at, request.status]);
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function lockedFields() { return [form.lock_date && 'confirmed_date', form.lock_start && 'confirmed_start', form.lock_capacity && 'confirmed_capacity', form.lock_package && 'confirmed_package'].filter(Boolean); }
  function commonPayload() { return { confirmed_date: form.confirmed_date || null, confirmed_start_type: form.confirmed_start_type || null, confirmed_start_time: form.confirmed_start_time || null, confirmed_capacity: form.confirmed_capacity ? Number(form.confirmed_capacity) : null, confirmed_package: form.confirmed_package || null, venue_response: form.venue_response || null, venue_internal_notes: form.venue_internal_notes || null, deposit_amount: form.deposit_amount === '' ? null : Number(form.deposit_amount), locked_fields: lockedFields(), venue_reviewed_at: new Date().toISOString() }; }
  async function updateRequest(payload) { setBusy(true); setError(''); const { error: updateError } = await supabase.from('event_requests').update(payload).eq('id', request.id); if (updateError) setError(updateError.message); else onSaved(); setBusy(false); }
  async function save(nextStatus = form.status) { await updateRequest({ ...commonPayload(), status: nextStatus }); }
  async function placeHold() { if (!form.confirmed_date) { setError('Choose the date the venue is placing on hold.'); return; } const startedAt = new Date(); const expiresAt = new Date(startedAt.getTime() + 24 * 60 * 60 * 1000); const depositAmount = form.deposit_amount === '' ? null : Number(form.deposit_amount); const depositRequired = depositAmount !== null && depositAmount > 0; await updateRequest({ ...commonPayload(), status: 'hold', hold_started_at: startedAt.toISOString(), hold_expires_at: expiresAt.toISOString(), hold_released_at: null, contract_status: request.contract_status === 'signed' ? 'signed' : 'not_sent', deposit_status: request.deposit_status === 'paid' || request.deposit_status === 'waived' ? request.deposit_status : depositRequired ? 'pending' : 'not_required', deposit_due_at: depositRequired ? expiresAt.toISOString() : null, calendar_status: request.calendar_status || 'not_created' }); }
  async function extendHold() { const currentExpiration = request.hold_expires_at ? new Date(request.hold_expires_at) : new Date(); const base = currentExpiration.getTime() > Date.now() ? currentExpiration : new Date(); const nextExpiration = new Date(base.getTime() + 24 * 60 * 60 * 1000); await updateRequest({ ...commonPayload(), status: 'hold', hold_extended_at: new Date().toISOString(), hold_expires_at: nextExpiration.toISOString(), deposit_due_at: request.deposit_status === 'pending' ? nextExpiration.toISOString() : request.deposit_due_at }); }
  async function releaseHold() { await updateRequest({ ...commonPayload(), status: 'hold_expired', hold_released_at: new Date().toISOString(), calendar_status: request.calendar_status === 'hold' ? 'released' : request.calendar_status }); }
  function formatCountdown(expiresAt) { if (!expiresAt) return ''; const remaining = new Date(expiresAt).getTime() - nowMs; if (remaining <= 0) return 'Hold time has expired'; const totalSeconds = Math.floor(remaining / 1000); const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; return `${hours}h ${minutes}m ${seconds}s remaining`; }
  const holdIsActive = request.status === 'hold' && request.hold_expires_at;
  return <div className="review-panel"><div className="review-panel-heading"><div><p className="platform-eyebrow">Venue Review</p><h2>{request.group_name || request.contact_full_name || 'Outing Request'}</h2></div><button className="platform-secondary-button" onClick={onClose}>Close</button></div>{holdIsActive && <div style={{ marginBottom: 22, padding: 18, borderRadius: 14, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.06)' }}><p className="platform-eyebrow" style={{ marginBottom: 6 }}>24-Hour Venue Hold</p><h3 style={{ margin: 0 }}>{formatCountdown(request.hold_expires_at)}</h3><p style={{ margin: '8px 0 0', opacity: .8 }}>Held until {new Date(request.hold_expires_at).toLocaleString()}. The event is not finally confirmed until the contract and deposit requirements are complete.</p><div className="review-actions" style={{ marginTop: 14 }}><button className="platform-secondary-button" disabled={busy} onClick={extendHold}>Extend Another 24 Hours</button><button className="platform-secondary-button danger-outline" disabled={busy} onClick={releaseHold}>Release Hold</button></div></div>}<div className="review-summary-grid"><div><span>Contact</span><strong>{request.contact_full_name || '—'}</strong><small>{request.contact_email}<br />{request.contact_phone}</small></div><div><span>Players</span><strong>{request.estimated_participants || '—'}</strong><small>{request.event_type || 'Golf Outing'}</small></div><div><span>Start</span><strong>{request.preferred_start_type || 'Not Sure'}</strong><small>{request.preferred_start_time || 'Time not specified'}</small></div><div><span>Golf Format</span><strong>{request.golf_format || 'Not Sure'}</strong><small>{request.food_needed === true ? 'Food / banquet requested' : request.food_needed === false ? 'No food requested' : 'Food needs not decided'}</small></div></div><div className="review-date-choices"><h3>Requested Dates</h3><div>{dateOptions.map((date, index) => <button key={date} type="button" className={form.confirmed_date === date ? 'selected' : ''} onClick={() => update('confirmed_date', date)}><span>Choice {index + 1}</span><strong>{new Date(`${date}T12:00:00`).toLocaleDateString()}</strong></button>)}</div>{request.unavailable_date_notes && <p><strong>Date not shown note:</strong> {request.unavailable_date_notes}</p>}</div><div className="form-grid two review-fields"><label>Held / Proposed Date<input type="date" value={form.confirmed_date} onChange={(e) => update('confirmed_date', e.target.value)} /></label><label>Confirmed Start Type<select value={form.confirmed_start_type} onChange={(e) => update('confirmed_start_type', e.target.value)}><option value="">Select</option><option>Shotgun</option><option>Tee Times</option><option>Not Sure</option></select></label><label>Confirmed Start Time<input type="time" value={form.confirmed_start_time || ''} onChange={(e) => update('confirmed_start_time', e.target.value)} /></label><label>Confirmed Capacity<input type="number" min="1" value={form.confirmed_capacity} onChange={(e) => update('confirmed_capacity', e.target.value)} /></label><label>Deposit Amount<input type="number" min="0" step="0.01" value={form.deposit_amount} onChange={(e) => update('deposit_amount', e.target.value)} placeholder="0.00" /></label><label>Deposit Status<input value={request.deposit_status?.replaceAll('_', ' ') || 'not required'} disabled /></label><label className="full-span">Venue Package / Pricing Summary<input value={form.confirmed_package} onChange={(e) => update('confirmed_package', e.target.value)} placeholder="Example: Golf + cart + lunch package" /></label><label className="full-span">Message to Organizer<textarea rows="4" value={form.venue_response} onChange={(e) => update('venue_response', e.target.value)} placeholder="Hold details, pricing, questions, or alternate plan..." /></label><label className="full-span">Internal Venue Notes<textarea rows="3" value={form.venue_internal_notes} onChange={(e) => update('venue_internal_notes', e.target.value)} placeholder="Private notes not intended for the organizer." /></label></div><div className="locked-fields-box"><div><h3>Lock venue-confirmed fields for organizer</h3><p>The organizer receives these values prefilled. Locked items require the venue to approve a change.</p></div><label><input type="checkbox" checked={form.lock_date} onChange={(e) => update('lock_date', e.target.checked)} /> Date</label><label><input type="checkbox" checked={form.lock_start} onChange={(e) => update('lock_start', e.target.checked)} /> Start type / time</label><label><input type="checkbox" checked={form.lock_capacity} onChange={(e) => update('lock_capacity', e.target.checked)} /> Capacity</label><label><input type="checkbox" checked={form.lock_package} onChange={(e) => update('lock_package', e.target.checked)} /> Venue package / pricing</label></div>{error && <div className="platform-error">{error}</div>}<div className="review-actions"><button className="platform-secondary-button" disabled={busy} onClick={() => save('needs_response')}>Ask a Question</button><button className="platform-secondary-button" disabled={busy} onClick={() => save('tentative')}>Mark Tentative</button><button className="platform-secondary-button danger-outline" disabled={busy} onClick={() => save('declined')}>Decline</button>{!holdIsActive && <button className="platform-primary-button" disabled={busy || !form.confirmed_date} onClick={placeHold}>{busy ? 'Saving...' : 'Confirm Terms + Place 24-Hour Hold'}</button>}</div></div>;
}

function EventRequestsSection({ organization, requests, loading, onReload }) {
  const [selected, setSelected] = useState(null);
  const inquiryUrl = `${window.location.origin}${window.location.pathname}#inquiry/${organization.slug}`;
  function copyInquiryLink() { navigator.clipboard?.writeText(inquiryUrl); }
  if (selected) return <VenueConfirmationForm request={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); onReload(); }} />;
  return <section className="platform-section-card"><div className="platform-section-heading"><div><p className="platform-eyebrow">Venue Workflow</p><h2>Outing Inquiries</h2></div><div className="section-actions"><button className="platform-secondary-button" onClick={() => window.open(inquiryUrl, '_blank')}>Open Inquiry Page</button><button className="platform-secondary-button" onClick={copyInquiryLink}>Copy Inquiry Link</button></div></div><div className="inquiry-link-box"><div><strong>Public inquiry link</strong><span>{inquiryUrl}</span></div><small>Use this on the venue website, in email, or anywhere someone wants to request an outing.</small></div>{loading ? <p>Loading inquiries...</p> : <div className="request-list">{requests.map((request) => <button key={request.id} className="request-row" onClick={() => setSelected(request)}><div><strong>{request.group_name || request.contact_full_name || 'New Outing Inquiry'}</strong><span>{request.contact_full_name} · {request.contact_email}</span></div><div><strong>{request.preferred_date ? new Date(`${request.preferred_date}T12:00:00`).toLocaleDateString() : 'No date'}</strong><span>{request.estimated_participants ? `${request.estimated_participants} players` : 'Player count pending'}</span></div><div><span className={`request-status ${request.status}`}>{request.status?.replaceAll('_', ' ')}</span>{request.status === 'hold' && request.hold_expires_at && <small>Hold until {new Date(request.hold_expires_at).toLocaleString()}</small>}<b>Review →</b></div></button>)}{!requests.length && <div className="empty-state"><strong>No outing inquiries yet.</strong><span>Share the public inquiry link to start collecting requests.</span></div>}</div>}</section>;
}

const SETUP_LABELS = {
  company_info: 'Company Info', business_info: 'Business Info', contacts: 'Contacts', locations: 'Locations', venues: 'Venues', calendar: 'Calendar', ecommerce: 'Ecommerce', billing_payments: 'Billing & Payments', agreement: 'Agreement', users: 'Users',
};
const SETUP_KEYS = Object.keys(SETUP_LABELS);

function OrganizationProfileSection({ organization, profile, role, onSave }) {
  const canEdit = ['eig_admin', 'organization_admin'].includes(role);
  const sections = profile?.setup_sections || {};
  const completeCount = SETUP_KEYS.filter((key) => sections[key] === 'complete').length;
  const progress = Math.round((completeCount / SETUP_KEYS.length) * 100);
  const firstOpenStep = SETUP_KEYS.find((key) => sections[key] !== 'complete') || SETUP_KEYS[0];
  const [activeSection, setActiveSection] = useState(firstOpenStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: organization?.name || '', legal_name: profile?.legal_name || '', website_url: profile?.website_url || '', phone: profile?.phone || '', timezone: profile?.timezone || '', primary_contact_name: profile?.primary_contact_name || '', primary_contact_email: profile?.primary_contact_email || '' });

  useEffect(() => {
    setForm({ name: organization?.name || '', legal_name: profile?.legal_name || '', website_url: profile?.website_url || '', phone: profile?.phone || '', timezone: profile?.timezone || '', primary_contact_name: profile?.primary_contact_name || '', primary_contact_email: profile?.primary_contact_email || '' });
  }, [organization?.id, organization?.name, profile?.updated_at]);

  useEffect(() => {
    setActiveSection(SETUP_KEYS.find((key) => (profile?.setup_sections || {})[key] !== 'complete') || SETUP_KEYS[0]);
  }, [organization?.id]);

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function nextSection() {
    const currentIndex = SETUP_KEYS.indexOf(activeSection);
    setActiveSection(SETUP_KEYS[Math.min(currentIndex + 1, SETUP_KEYS.length - 1)]);
  }
  async function saveAndContinue(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave(form); nextSection(); }
    catch (saveError) { setError(saveError.message || 'Unable to save organization profile.'); }
    finally { setBusy(false); }
  }

  const statusStyle = (status) => ({ display: 'inline-block', padding: '5px 9px', borderRadius: 999, fontSize: 12, fontWeight: 800, textTransform: 'capitalize', background: status === 'complete' ? 'rgba(63,185,80,.16)' : status === 'in_progress' ? 'rgba(88,166,255,.16)' : 'rgba(255,255,255,.08)' });
  const cardStyle = (key) => ({ width: '100%', textAlign: 'left', color: 'inherit', padding: 13, border: activeSection === key ? '1px solid rgba(88,166,255,.8)' : '1px solid rgba(255,255,255,.09)', borderRadius: 12, background: activeSection === key ? 'rgba(88,166,255,.11)' : 'rgba(255,255,255,.02)', cursor: 'pointer' });

  function renderActiveSection() {
    if (!canEdit) return <p className="platform-login-copy">You can view this organization profile. An Organization Admin or EIG Admin can update setup details.</p>;

    if (activeSection === 'company_info') return <form className="platform-login-form" onSubmit={saveAndContinue}><div><p className="platform-eyebrow">Step 1</p><h3>Company Info</h3><p>Start with the identity that should appear across EIG workspaces and customer-facing tools.</p></div><div className="form-grid two"><label>Organization display name<input value={form.name} onChange={(e) => update('name', e.target.value)} required /></label><label>Legal business name<input value={form.legal_name} onChange={(e) => update('legal_name', e.target.value)} /></label></div>{error && <div className="platform-error">{error}</div>}<div className="review-actions"><button className="platform-primary-button" disabled={busy} type="submit">{busy ? 'Saving...' : 'Save & Continue'}</button></div></form>;

    if (activeSection === 'business_info') return <form className="platform-login-form" onSubmit={saveAndContinue}><div><p className="platform-eyebrow">Step 2</p><h3>Business Info</h3><p>These shared details will feed calendars, events, ecommerce, billing, and other enabled EIG technology.</p></div><div className="form-grid two"><label>Website<input type="url" value={form.website_url} onChange={(e) => update('website_url', e.target.value)} placeholder="https://" /></label><label>Phone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label><label>Timezone<input value={form.timezone} onChange={(e) => update('timezone', e.target.value)} placeholder="America/New_York" /></label></div>{error && <div className="platform-error">{error}</div>}<div className="review-actions"><button className="platform-secondary-button" type="button" onClick={() => setActiveSection('company_info')}>Back</button><button className="platform-primary-button" disabled={busy} type="submit">{busy ? 'Saving...' : 'Save & Continue'}</button></div></form>;

    if (activeSection === 'contacts') return <form className="platform-login-form" onSubmit={saveAndContinue}><div><p className="platform-eyebrow">Step 3</p><h3>Primary Contact</h3><p>This is the main company contact for onboarding and organization administration.</p></div><div className="form-grid two"><label>Primary contact name<input value={form.primary_contact_name} onChange={(e) => update('primary_contact_name', e.target.value)} /></label><label>Primary contact email<input type="email" value={form.primary_contact_email} onChange={(e) => update('primary_contact_email', e.target.value)} required /></label></div>{error && <div className="platform-error">{error}</div>}<div className="review-actions"><button className="platform-secondary-button" type="button" onClick={() => setActiveSection('business_info')}>Back</button><button className="platform-primary-button" disabled={busy} type="submit">{busy ? 'Saving...' : 'Save & Continue'}</button></div></form>;

    const currentIndex = SETUP_KEYS.indexOf(activeSection);
    const previousKey = SETUP_KEYS[Math.max(currentIndex - 1, 0)];
    const nextKey = SETUP_KEYS[Math.min(currentIndex + 1, SETUP_KEYS.length - 1)];
    return <div style={{ padding: 4 }}><p className="platform-eyebrow">Step {currentIndex + 1}</p><h3>{SETUP_LABELS[activeSection]}</h3><p>This section is now part of the guided onboarding flow. Its dedicated setup tools will be built in the next milestone without blocking you from working on any other section.</p><div className="review-actions" style={{ marginTop: 18 }}><button className="platform-secondary-button" onClick={() => setActiveSection(previousKey)}>Back</button>{activeSection !== SETUP_KEYS[SETUP_KEYS.length - 1] && <button className="platform-primary-button" onClick={() => setActiveSection(nextKey)}>Continue</button>}</div></div>;
  }

  return <section className="platform-section-card">
    <div className="platform-section-heading"><div><p className="platform-eyebrow">Organization Setup</p><h2>Profile & Setup Progress</h2></div><div className="platform-role-pill">{SETUP_LABELS[activeSection]}</div></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,.7fr) 2fr', gap: 18, marginBottom: 22 }}>
      <div style={{ padding: 18, border: '1px solid rgba(255,255,255,.1)', borderRadius: 14 }}><span style={{ opacity: .7 }}>Setup Progress</span><div style={{ fontSize: 36, fontWeight: 900, marginTop: 6 }}>{progress}%</div><small>{completeCount} of {SETUP_KEYS.length} sections complete</small><p style={{ margin: '12px 0 0', opacity: .72 }}>Use Save & Continue for the guided flow, or click any setup block.</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>{SETUP_KEYS.map((key) => <button key={key} type="button" style={cardStyle(key)} onClick={() => setActiveSection(key)}><strong style={{ display: 'block', marginBottom: 8 }}>{SETUP_LABELS[key]}</strong><span style={statusStyle(sections[key] || 'incomplete')}>{(sections[key] || 'incomplete').replaceAll('_', ' ')}</span>{activeSection === key && <small style={{ display: 'block', marginTop: 7, opacity: .75 }}>Active</small>}</button>)}</div>
    </div>
    <div style={{ padding: 20, border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, background: 'rgba(0,0,0,.12)' }}>{renderActiveSection()}</div>
  </section>;
}


function EieEventDirectory({ organization, events, loading, onReload, onBack }) {
  const emptyItem = () => ({
    name: 'Registration',
    description: '',
    item_type: 'registration',
    price: '',
    charge_by: 'player',
    required: true,
    available_start: '',
    available_end: '',
  });

  const draftStorageKey = organization?.id ? `eie-quick-registration-draft:${organization.id}` : '';
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [createdEvent, setCreatedEvent] = useState(null);
  const [form, setForm] = useState({
    name: '',
    course: organization?.name || '',
    event_start: '',
    event_end: '',
    registration_format: 'team',
    team_size: 4,
    max_golfers: '',
    registration_deadline: '',
    allow_online: true,
    allow_clubhouse: true,
    allow_split_team_payments: true,
    convenience_fee_type: 'percent',
    convenience_fee_value: '3',
    clubhouse_hold_days: '3',
    allow_card_guarantee: true,
    auto_charge_at_hold_expiry: true,
    google_calendar_sync_enabled: false,
    items: [emptyItem()],
  });

  useEffect(() => {
    setForm((current) => ({ ...current, course: current.course || organization?.name || '' }));
  }, [organization?.id]);

  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      const rawDraft = window.localStorage.getItem(draftStorageKey);
      if (!rawDraft) return;
      const savedDraft = JSON.parse(rawDraft);
      if (!savedDraft?.form) return;
      const hasProgress = Boolean(
        savedDraft.form.name ||
        savedDraft.form.event_start ||
        savedDraft.form.registration_deadline ||
        savedDraft.form.items?.some((item) => item.price || (item.name && item.name !== 'Registration'))
      );
      if (!hasProgress) return;
      setForm((current) => ({
        ...current,
        ...savedDraft.form,
        course: savedDraft.form.course || organization?.name || current.course,
        items: Array.isArray(savedDraft.form.items) && savedDraft.form.items.length ? savedDraft.form.items : [emptyItem()],
      }));
      setShowNew(true);
      setNotice('Recovered your saved Quick Registration draft.');
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey || !showNew) return undefined;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({
        form,
        saved_at: new Date().toISOString(),
      }));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftStorageKey, form, showNew]);

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  }
  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, {
        name: '',
        description: '',
        item_type: 'add_on',
        price: '',
        charge_by: current.registration_format === 'team' ? 'team' : 'player',
        required: false,
        available_start: '',
        available_end: '',
      }],
    }));
  }
  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function discardDraft() {
    if (draftStorageKey) window.localStorage.removeItem(draftStorageKey);
    setForm((current) => ({
      ...current,
      name: '',
      course: organization?.name || '',
      event_start: '',
      event_end: '',
      registration_format: 'team',
      team_size: 4,
      max_golfers: '',
      registration_deadline: '',
      allow_online: true,
      allow_clubhouse: true,
      allow_split_team_payments: true,
      convenience_fee_type: 'percent',
      convenience_fee_value: '3',
      clubhouse_hold_days: '3',
      allow_card_guarantee: true,
      auto_charge_at_hold_expiry: true,
      google_calendar_sync_enabled: false,
      items: [emptyItem()],
    }));
    setNotice('');
    setShowNew(false);
  }

  async function createEvent(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setCreatedEvent(null);
    try {
      const cleanItems = form.items.map((item) => ({
        ...item,
        name: item.name.trim(),
        description: item.description.trim(),
        price: Number(item.price || 0),
      }));
      if (!cleanItems.some((item) => item.item_type === 'registration')) {
        throw new Error('Add at least one Registration pricing item.');
      }

      const { data, error } = await supabase.rpc('create_eie_quick_registration_event', {
        p_organization_id: organization.id,
        p_name: form.name.trim(),
        p_course: form.course.trim(),
        p_event_start: form.event_start,
        p_event_end: form.event_end || null,
        p_registration_format: form.registration_format,
        p_team_size: form.registration_format === 'team' ? Number(form.team_size || 4) : 1,
        p_max_golfers: form.max_golfers ? Number(form.max_golfers) : null,
        p_registration_deadline: form.registration_deadline || null,
        p_items: cleanItems,
        p_allow_online: form.allow_online,
        p_allow_clubhouse: form.allow_clubhouse,
        p_allow_split_team_payments: form.registration_format === 'team' ? form.allow_split_team_payments : false,
        p_convenience_fee_type: form.convenience_fee_type,
        p_convenience_fee_value: Number(form.convenience_fee_value || 0),
        p_clubhouse_hold_days: Number(form.clubhouse_hold_days || 3),
        p_allow_card_guarantee: form.allow_card_guarantee,
        p_auto_charge_at_deadline: form.auto_charge_at_hold_expiry,
        p_google_calendar_sync_enabled: form.google_calendar_sync_enabled,
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Unable to create the EIE event.');

      if (draftStorageKey) window.localStorage.removeItem(draftStorageKey);
      setCreatedEvent(data);
      setNotice('Quick Registration created. Next step: build the Public Hub.');
      setShowNew(false);
      setForm((current) => ({
        ...current,
        name: '',
        event_start: '',
        event_end: '',
        max_golfers: '',
        registration_deadline: '',
        items: [emptyItem()],
      }));
      await onReload();
    } catch (createError) {
      setNotice(createError.message || 'Unable to create event.');
    } finally {
      setBusy(false);
    }
  }

  function eventDateLabel(event) {
    const dates = Array.isArray(event.event_dates) ? event.event_dates : [];
    if (!dates.length) return 'Date not set';
    const first = new Date(`${dates[0]}T12:00:00`).toLocaleDateString();
    const last = dates[1] ? new Date(`${dates[1]}T12:00:00`).toLocaleDateString() : '';
    return last ? `${first} – ${last}` : first;
  }

  const upcoming = events.filter((event) => {
    const date = Array.isArray(event.event_dates) ? event.event_dates[0] : null;
    return !date || date >= new Date().toISOString().slice(0, 10);
  });
  const past = events.filter((event) => {
    const date = Array.isArray(event.event_dates) ? event.event_dates[0] : null;
    return date && date < new Date().toISOString().slice(0, 10);
  });

  return <div className="platform-page">
    <section className="platform-hero organization">
      <div>
        <p className="platform-eyebrow">{organization?.name} Hangar · Cockpit</p>
        <h1>EIE · Events</h1>
        <p>Create and operate events inside the active Hangar. Quick Registration gets registration live first, then the Hub and advanced event tools build around the same Master Event.</p>
      </div>
      <div className="review-actions">
        <button className="platform-secondary-button" onClick={onBack}>← Cockpit</button>
        <button className="platform-primary-button" onClick={() => setShowNew((current) => !current)}>{showNew ? 'Close Quick Registration' : '+ New Event'}</button>
      </div>
    </section>

    {notice && <div className={notice.startsWith('Quick Registration created') ? 'platform-success' : 'platform-error banner'}>{notice}</div>}

    {createdEvent && <section className="platform-section-card">
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">Registration Ready</p><h2>Next: Build the Public Hub</h2></div>
        <div className="platform-role-pill">Draft</div>
      </div>
      <p className="platform-login-copy">The Master Event, EIE registration setup, pricing items, payment rules, and required participant fields are created. The next workflow will collect the public-facing event details for the Hub.</p>
      <div className="review-actions">
        <button className="platform-secondary-button" onClick={() => setCreatedEvent(null)}>Back to Events</button>
        <button className="platform-primary-button" type="button" onClick={() => setNotice('Hub walkthrough is the next EIE build step. Registration is safely saved as a draft.')}>Build Public Hub →</button>
      </div>
    </section>}

    {showNew && <section className="platform-section-card">
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">Quick Registration</p><h2>Set Up Registration First</h2><p>Use this path when you already know what you want to charge. Event details, catering, sponsorships, budget, and other tools can be completed after registration exists.</p></div>
        <div className="platform-role-pill">Draft</div>
      </div>

      <form className="platform-login-form" onSubmit={createEvent}>
        <div className="availability-note" style={{ marginBottom: 18 }}><strong>Auto-save is on</strong><span>Your in-progress Quick Registration is saved automatically in this browser so you can continue after a refresh, browser close, or computer restart.</span></div>
        <div style={{ marginBottom: 18 }}>
          <p className="platform-eyebrow">1 · Event Basics</p>
          <div className="form-grid two">
            <label>Event name<input value={form.name} onChange={(e) => update('name', e.target.value)} required placeholder="Fall Charity Scramble" /></label>
            <label>Course / venue<input value={form.course} onChange={(e) => update('course', e.target.value)} required /></label>
            <label>Event date<input type="date" value={form.event_start} onChange={(e) => update('event_start', e.target.value)} required /></label>
            <label>End date, if multi-day<input type="date" value={form.event_end} onChange={(e) => update('event_end', e.target.value)} /></label>
            <label>Registration structure<select value={form.registration_format} onChange={(e) => update('registration_format', e.target.value)}><option value="team">Team</option><option value="individual">Individual</option></select></label>
            {form.registration_format === 'team' && <label>Players per team<input type="number" min="2" max="12" value={form.team_size} onChange={(e) => update('team_size', e.target.value)} /></label>}
            <label>Maximum participants<input type="number" min="1" value={form.max_golfers} onChange={(e) => update('max_golfers', e.target.value)} placeholder="144" /></label>
            <label>Registration deadline<input type="date" value={form.registration_deadline} onChange={(e) => update('registration_deadline', e.target.value)} /></label>
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <div className="platform-section-heading">
            <div><p className="platform-eyebrow">2 · Pricing & Items</p><h3 style={{ margin: 0 }}>Build the event checkout</h3><p className="platform-login-copy">Start with registration. Add as many items as needed for early-bird rates, mulligans, challenge packages, guest meals, or other event charges.</p></div>
            <button className="platform-secondary-button" type="button" onClick={addItem}>+ Add Item</button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {form.items.map((item, index) => <div key={index} style={{ padding: 16, border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, background: 'rgba(255,255,255,.025)' }}>
              <div className="form-grid two">
                <label>Item name<input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} required placeholder="Registration" /></label>
                <label>Item type<select value={item.item_type} onChange={(e) => updateItem(index, 'item_type', e.target.value)}><option value="registration">Registration</option><option value="add_on">Add-On</option><option value="package">Package</option><option value="donation">Donation</option><option value="other">Other</option></select></label>
                <label>Price<input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} placeholder="0.00" required /></label>
                <label>Charge by<select value={item.charge_by} onChange={(e) => updateItem(index, 'charge_by', e.target.value)}><option value="player">Player</option><option value="team">Team</option><option value="order">Order</option><option value="flat">Flat</option></select></label>
                <label>Available from<input type="date" value={item.available_start} onChange={(e) => updateItem(index, 'available_start', e.target.value)} /></label>
                <label>Available until<input type="date" value={item.available_end} onChange={(e) => updateItem(index, 'available_end', e.target.value)} /></label>
              </div>
              <label style={{ marginTop: 10 }}>Description<input value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Optional public description" /></label>
              <div className="review-actions" style={{ marginTop: 10, justifyContent: 'space-between' }}>
                <label style={{ display:'flex',alignItems:'center',gap:10, margin: 0 }}><input style={{width:'auto'}} type="checkbox" checked={item.required} onChange={(e) => updateItem(index, 'required', e.target.checked)} />Required item</label>
                {form.items.length > 1 && <button className="platform-secondary-button" type="button" onClick={() => removeItem(index)}>Remove</button>}
              </div>
            </div>)}
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <p className="platform-eyebrow">3 · Payments</p>
          <div className="form-grid two">
            <label>Convenience fee<select value={form.convenience_fee_type} onChange={(e) => update('convenience_fee_type', e.target.value)}><option value="percent">Percent</option><option value="flat">Flat amount</option><option value="none">None</option></select></label>
            {form.convenience_fee_type !== 'none' && <label>Fee value<input type="number" min="0" step="0.01" value={form.convenience_fee_value} onChange={(e) => update('convenience_fee_value', e.target.value)} /></label>}
            <label>Clubhouse hold days<input type="number" min="1" max="365" value={form.clubhouse_hold_days} onChange={(e) => update('clubhouse_hold_days', e.target.value)} /></label>
          </div>
          <div className="form-grid two" style={{ marginTop: 12 }}>
            <label style={{ display:'flex',alignItems:'center',gap:10 }}><input style={{width:'auto'}} type="checkbox" checked={form.allow_online} onChange={(e) => update('allow_online', e.target.checked)} />Allow online payment</label>
            <label style={{ display:'flex',alignItems:'center',gap:10 }}><input style={{width:'auto'}} type="checkbox" checked={form.allow_clubhouse} onChange={(e) => update('allow_clubhouse', e.target.checked)} />Allow clubhouse payment</label>
            {form.registration_format === 'team' && <label style={{ display:'flex',alignItems:'center',gap:10 }}><input style={{width:'auto'}} type="checkbox" checked={form.allow_split_team_payments} onChange={(e) => update('allow_split_team_payments', e.target.checked)} />Allow captains to choose split team payment</label>}
            <label style={{ display:'flex',alignItems:'center',gap:10 }}><input style={{width:'auto'}} type="checkbox" checked={form.allow_card_guarantee} onChange={(e) => update('allow_card_guarantee', e.target.checked)} />Allow card guarantee</label>
            <label style={{ display:'flex',alignItems:'center',gap:10 }}><input style={{width:'auto'}} type="checkbox" checked={form.auto_charge_at_hold_expiry} onChange={(e) => update('auto_charge_at_hold_expiry', e.target.checked)} />Charge guaranteed card when the payment hold expires if the balance is unpaid</label>
          </div>
          {form.registration_format === 'team' && form.allow_split_team_payments && <div className="availability-note" style={{ marginTop: 12 }}><strong>Split-payment rule</strong><span>The captain can choose to pay the full team amount or split it. A split-payment team remains pending until the entire team balance is paid. When the payment hold expires, unpaid teams are released unless a card guarantee is on file; guaranteed balances are charged at hold expiration, with the recovery window used only if that charge fails.</span></div>}
        </div>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <p className="platform-eyebrow">4 · Participant Information</p>
          <div className="availability-note"><strong>Required by default</strong><span>First name, last name, email, and phone are created automatically. Additional fields can be configured from Registration Setup after the draft is created.</span></div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <p className="platform-eyebrow">5 · Google Workspace</p>
          <label style={{ display:'flex',alignItems:'center',gap:10 }}><input style={{width:'auto'}} type="checkbox" checked={form.google_calendar_sync_enabled} onChange={(e) => update('google_calendar_sync_enabled', e.target.checked)} />Sync this event to the Hangar's Google Calendar after save</label>
          <p className="platform-login-copy">Drive folders, roster Sheets, and the Hub will attach to this same Master Event. EIE remains the source of truth.</p>
        </div>

        <div className="review-actions" style={{ marginTop: 18 }}>
          <button className="platform-secondary-button danger-outline" type="button" onClick={discardDraft}>Discard Draft</button>
          <button className="platform-secondary-button" type="button" onClick={() => setShowNew(false)}>Save & Close</button>
          <button className="platform-primary-button" disabled={busy} type="submit">{busy ? 'Creating Registration...' : 'Save Quick Registration'}</button>
        </div>
      </form>
    </section>}

    <section className="platform-section-card">
      <div className="platform-section-heading"><div><p className="platform-eyebrow">Event Directory</p><h2>Upcoming & Active</h2></div><span>{upcoming.length} event{upcoming.length === 1 ? '' : 's'}</span></div>
      {loading ? <p>Loading EIE events...</p> : <div className="request-list">
        {upcoming.map((event) => <div key={event.id} className="request-row" style={{ cursor:'default' }}>
          <div><strong>{event.name}</strong><span>{event.course || organization?.name}</span></div>
          <div><strong>{eventDateLabel(event)}</strong><span>{event.field_settings?.registration_format === 'team' ? `${event.field_settings?.team_size || 4}-player team` : 'Individual'} registration</span></div>
          <div><span className={`request-status ${event.status}`}>{event.status}</span><small>{event.google_calendar_sync_enabled ? `Calendar: ${event.google_calendar_sync_status?.replaceAll('_',' ') || 'pending'}` : 'Calendar sync off'}</small><b>Setup →</b></div>
        </div>)}
        {!upcoming.length && <div className="empty-state"><strong>No upcoming EIE events yet.</strong><span>Use + New Event to create the first Quick Registration from ground zero.</span></div>}
      </div>}
    </section>

    {past.length > 0 && <section className="platform-section-card">
      <div className="platform-section-heading"><div><p className="platform-eyebrow">Archive</p><h2>Past Events</h2></div><span>{past.length}</span></div>
      <div className="request-list">{past.map((event) => <div key={event.id} className="request-row" style={{ cursor:'default' }}><div><strong>{event.name}</strong><span>{event.course || organization?.name}</span></div><div><strong>{eventDateLabel(event)}</strong><span>{event.public_slug || event.event_key}</span></div><div><span className={`request-status ${event.status}`}>{event.status}</span></div></div>)}</div>
    </section>}
  </div>;
}


function OrganizationDashboard({ organization, profile, role, products, entitlements, eventRequests, loadingRequests, onReloadRequests, onLaunchGolfRegistration, onSaveProfile }) {
  const enabledIds = useMemo(() => new Set(entitlements.filter((e) => ['active', 'trial'].includes(e.status)).map((e) => e.product_id)), [entitlements]);
  const enabledCount = enabledIds.size;
  const canReviewRequests = ['organization_admin', 'organization_staff'].includes(role);
  return <div className="platform-page"><section className="platform-hero organization"><div><p className="platform-eyebrow">{organization?.is_test ? 'Test Hangar' : 'ElevationPilot · Hangar'}</p><h1>{organization?.name || 'Organization'} Cockpit</h1><p>Operate this Hangar's events, apps, communications, venue workflow, billing, and shared business tools from one Cockpit.</p></div><div className="platform-role-pill">{role?.replaceAll('_', ' ') || 'member'}</div></section><section className="platform-stats-grid"><StatCard label="Enabled Apps" value={enabledCount} detail="Entitled to this Hangar" /><StatCard label="Setup Status" value={(organization?.onboarding_status || 'profile_incomplete').replaceAll('_', ' ')} detail="Shared Hangar profile" /><StatCard label="Cockpit" value={organization?.is_test ? 'Test' : 'Active'} detail="One login across enabled apps" /></section><OrganizationProfileSection organization={organization} profile={profile} role={role} onSave={onSaveProfile} />{canReviewRequests && <EventRequestsSection organization={organization} requests={eventRequests} loading={loadingRequests} onReload={onReloadRequests} />}<section className="platform-section-card"><div className="platform-section-heading"><div><p className="platform-eyebrow">Cockpit Apps</p><h2>Apps & Tools</h2></div></div><div className="platform-product-grid">{products.map((product) => <ProductCard key={product.id} product={product} enabled={enabledIds.has(product.id)} onLaunch={onLaunchGolfRegistration} />)}</div></section></div>;
}

export default function App() {
  const publicMatch = window.location.hash.match(/^#inquiry\/([^/?#]+)/);
  if (publicMatch && isSupabaseConfigured) return <PublicInquiryPage slug={decodeURIComponent(publicMatch[1])} />;

  const [session, setSession] = useState(null); const [authReady, setAuthReady] = useState(false); const [memberships, setMemberships] = useState([]); const [activeOrganizationId, setActiveOrganizationId] = useState(''); const [products, setProducts] = useState([]); const [entitlements, setEntitlements] = useState([]); const [organizations, setOrganizations] = useState([]); const [organizationProfile, setOrganizationProfile] = useState(null); const [eventRequests, setEventRequests] = useState([]); const [eieEvents, setEieEvents] = useState([]); const [loadingEieEvents, setLoadingEieEvents] = useState(false); const [cockpitApp, setCockpitApp] = useState(''); const [loadingData, setLoadingData] = useState(false); const [loadingRequests, setLoadingRequests] = useState(false); const [dataError, setDataError] = useState('');

  useEffect(() => { if (!supabase) { setAuthReady(true); return; } supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setAuthReady(true); }); const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession || null); if (!nextSession) { setMemberships([]); setActiveOrganizationId(''); setOrganizationProfile(null); } }); return () => listener.subscription.unsubscribe(); }, []);
  useEffect(() => { if (session?.user?.id) loadMemberships(session.user.id); }, [session?.user?.id]);
  useEffect(() => { if (activeOrganizationId) { setCockpitApp(''); setEieEvents([]); loadWorkspaceData(activeOrganizationId); } }, [activeOrganizationId]);

  async function loadMemberships(userId, preferredOrganizationId = '') {
    setLoadingData(true); setDataError('');
    const { data, error } = await supabase.from('organization_memberships').select('organization_id, role, status, organization:organizations(id,name,slug,organization_type,status,is_test,onboarding_status)').eq('user_id', userId).eq('status', 'active');
    if (error) { setDataError(error.message); setMemberships([]); setLoadingData(false); return; }
    const ordered = [...(data || [])].sort((a, b) => { if (a.organization?.slug === EIG_SLUG) return -1; if (b.organization?.slug === EIG_SLUG) return 1; return (a.organization?.name || '').localeCompare(b.organization?.name || ''); });
    setMemberships(ordered); setActiveOrganizationId((current) => preferredOrganizationId || current || ordered[0]?.organization_id || ''); setLoadingData(false);
  }

  async function loadEventRequests(organizationId) { setLoadingRequests(true); const { data, error } = await supabase.from('event_requests').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }); if (error) setDataError(error.message); setEventRequests(data || []); setLoadingRequests(false); }

  async function loadEieEvents(organizationId) {
    if (!organizationId) return;
    setLoadingEieEvents(true);
    const { data, error } = await supabase.from('golf_registration_events').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
    if (error) setDataError(error.message); else setEieEvents(data || []);
    setLoadingEieEvents(false);
  }

  async function loadWorkspaceData(organizationId) {
    setLoadingData(true); setDataError('');
    const activeMembership = memberships.find((m) => m.organization_id === organizationId);
    const isEig = activeMembership?.organization?.slug === EIG_SLUG && activeMembership?.role === 'eig_admin';
    const [{ data: productRows, error: productError }, { data: entitlementRows, error: entitlementError }, { data: profileRow, error: profileError }] = await Promise.all([
      supabase.from('products').select('*').neq('status', 'retired').order('sort_order'),
      supabase.from('organization_product_entitlements').select('*').eq('organization_id', organizationId),
      supabase.from('organization_profiles').select('*').eq('organization_id', organizationId).maybeSingle(),
    ]);
    if (productError || entitlementError || profileError) setDataError(productError?.message || entitlementError?.message || profileError?.message || 'Unable to load workspace data.');
    setProducts(productRows || []); setEntitlements(entitlementRows || []); setOrganizationProfile(profileRow || null);
    if (isEig) { const { data: orgRows, error: orgError } = await supabase.from('organizations').select('*').order('name'); if (orgError) setDataError(orgError.message); setOrganizations(orgRows || []); setEventRequests([]); }
    else { setOrganizations([]); if (['organization_admin', 'organization_staff'].includes(activeMembership?.role)) await loadEventRequests(organizationId); else setEventRequests([]); }
    setLoadingData(false);
  }

  async function createOrganization({ name, organizationType, primaryContactName, primaryContactEmail, isTest }) {
    setDataError('');
    const { data, error } = await supabase.rpc('create_organization_workspace', { p_name: name.trim(), p_organization_type: organizationType, p_is_test: isTest, p_primary_contact_name: primaryContactName.trim() || null, p_primary_contact_email: primaryContactEmail.trim() });
    if (error) throw error; if (!data?.id) throw new Error('Organization was created but no workspace was returned.'); await loadMemberships(session.user.id, data.id); return data;
  }

  async function saveOrganizationProfile(form) {
    const currentSections = organizationProfile?.setup_sections || {};
    const companyInfoStatus = form.name.trim() && form.legal_name.trim() ? 'complete' : form.name.trim() ? 'in_progress' : 'incomplete';
    const businessValues = [form.website_url, form.phone, form.timezone].map((value) => value.trim());
    const businessInfoStatus = businessValues.every(Boolean) ? 'complete' : businessValues.some(Boolean) ? 'in_progress' : 'incomplete';
    const contactStatus = form.primary_contact_name.trim() && form.primary_contact_email.trim() ? 'complete' : form.primary_contact_email.trim() ? 'in_progress' : 'incomplete';
    const nextSections = { ...currentSections, company_info: companyInfoStatus, business_info: businessInfoStatus, contacts: contactStatus };
    const allComplete = SETUP_KEYS.every((key) => nextSections[key] === 'complete');
    const nextOnboardingStatus = allComplete ? 'ready' : 'profile_incomplete';

    const { error: profileError } = await supabase.from('organization_profiles').upsert({ organization_id: activeOrganizationId, primary_contact_name: form.primary_contact_name.trim() || null, primary_contact_email: form.primary_contact_email.trim().toLowerCase(), legal_name: form.legal_name.trim() || null, website_url: form.website_url.trim() || null, phone: form.phone.trim() || null, timezone: form.timezone.trim() || null, setup_sections: nextSections }, { onConflict: 'organization_id' });
    if (profileError) throw profileError;
    const { error: orgError } = await supabase.from('organizations').update({ name: form.name.trim(), onboarding_status: nextOnboardingStatus }).eq('id', activeOrganizationId);
    if (orgError) throw orgError;
    await loadMemberships(session.user.id, activeOrganizationId);
    await loadWorkspaceData(activeOrganizationId);
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

  return <PlatformShell user={session.user} memberships={memberships} activeOrganizationId={activeOrganizationId} setActiveOrganizationId={setActiveOrganizationId} onSignOut={signOut}>{dataError && <div className="platform-error banner">{dataError}</div>}{isEigAdminWorkspace ? <EigAdminDashboard organizations={organizations} products={products} loading={loadingData} onOpenOrganization={setActiveOrganizationId} onCreateOrganization={createOrganization} /> : cockpitApp === 'eie' ? <EieEventDirectory organization={activeOrganization} events={eieEvents} loading={loadingEieEvents} onReload={() => loadEieEvents(activeOrganizationId)} onBack={() => setCockpitApp('')} /> : <OrganizationDashboard organization={activeOrganization} profile={organizationProfile} role={activeMembership?.role} products={products} entitlements={entitlements} eventRequests={eventRequests} loadingRequests={loadingRequests} onReloadRequests={() => loadEventRequests(activeOrganizationId)} onLaunchGolfRegistration={async () => { setCockpitApp('eie'); await loadEieEvents(activeOrganizationId); }} onSaveProfile={saveOrganizationProfile} />}</PlatformShell>;
}

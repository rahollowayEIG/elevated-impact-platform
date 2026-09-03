import React, { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

const EIG_SLUG = 'elevated-impact-group';
const GOLF_REGISTRATION_URL = 'https://golf-event-registrations-eig.vercel.app';

function LoadingScreen({ message = 'Loading ElevationPilot...' }) {
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
        <h1>One login. Every ElevationPilot workspace.</h1>
        <p className="platform-login-copy">Sign in to ElevationPilot to access the Hangars, events, products, and tools assigned to your account.</p>
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

function GlobalSquawkDrawer({ organization, messages, currentRole, onMarkRead, onReview, actionError, onClose }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const unreadCount = messages.filter((message) => !message.read).length;
  const filteredMessages = messages.filter((message) => {
    if (activeFilter === 'unread') return !message.read;
    if (activeFilter === 'restricted') return message.restricted;
    return true;
  });
  const canReview = ['eig_admin', 'organization_admin'].includes(currentRole);
  return <div className="global-squawk-layer" role="dialog" aria-modal="true" aria-label="Squawk Box">
    <button className="global-squawk-backdrop" aria-label="Close Squawk Box" onClick={onClose} />
    <aside className="global-squawk-drawer">
      <div className="global-squawk-heading"><div><p className="platform-eyebrow">ElevationPilot Communications</p><h2>Squawk Box</h2><span>{organization?.name || 'All permitted workspaces'}</span></div><button className="global-squawk-close" onClick={onClose} aria-label="Close Squawk Box">×</button></div>
      <div className="global-squawk-filters"><button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>All Permitted</button><button className={activeFilter === 'unread' ? 'active' : ''} onClick={() => setActiveFilter('unread')}>Unread {unreadCount ? `(${unreadCount})` : ''}</button><button className={activeFilter === 'restricted' ? 'active' : ''} onClick={() => setActiveFilter('restricted')}>Restricted</button></div>
      {actionError && <div className="platform-error global-squawk-action-error">{actionError}</div>}
      {filteredMessages.length ? <div className="global-squawk-list">{filteredMessages.map((message) => <article key={message.id} className={`global-squawk-message ${message.restricted ? 'restricted' : ''}`}><div className="global-squawk-message-top"><span>{message.contextLabel}</span>{message.reviewed ? <b className="reviewed">{message.reviewedLabel}</b> : !message.read && <b>Unread</b>}</div><h3>{message.restricted ? `${message.requiredRole} Message — Restricted` : message.subject}</h3><p>{message.restricted ? `${message.requiredRole} or another authorized user must review this message.` : message.preview}</p><div className="global-squawk-message-footer"><small>{message.sentAt}</small><div className="global-squawk-message-actions">{!message.read && !message.restricted && <button onClick={() => onMarkRead(message.id)}>Mark Read</button>}{message.requiresReview && !message.reviewed && canReview && <button className="review" onClick={() => onReview(message.id)}>Review as {currentRole === 'eig_admin' ? 'EIG' : 'Pilot'}</button>}{message.requiresReview && !message.reviewed && !canReview && <span>Pilot review required</span>}</div></div></article>)}</div> : <div className="global-squawk-empty"><div className="global-squawk-radio">SB</div><h3>{messages.length ? 'No matching Squawks' : 'No Squawks yet'}</h3><p>{messages.length ? 'Choose another filter to see your permitted messages.' : 'Readable and restricted message notices for this Hangar and its assigned events will appear here.'}</p></div>}
      <div className="global-squawk-permission-note"><strong>Permission aware</strong><span>Messages outside this Hangar or your assigned events stay hidden. Restricted items reveal only their safe context and required role.</span></div>
    </aside>
  </div>;
}

function PlatformShell({ user, memberships, activeOrganizationId, setActiveOrganizationId, children, onSignOut }) {
  const active = memberships.find((m) => m.organization_id === activeOrganizationId);
  const [squawkOpen, setSquawkOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [squawkRefresh, setSquawkRefresh] = useState(0);
  const [squawkActionError, setSquawkActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadSquawks() {
      if (!activeOrganizationId) { setMessages([]); return; }
      const { data: threads, error: threadError } = await supabase.from('squawk_threads').select('id,organization_id,event_id,context_type,context_label').eq('organization_id', activeOrganizationId);
      if (cancelled || threadError || !threads?.length) { if (!cancelled) setMessages([]); return; }
      const threadMap = new Map(threads.map((thread) => [thread.id, thread]));
      const { data: messageRows, error: messageError } = await supabase.from('squawk_messages').select('id,thread_id,message_kind,visibility,required_roles,safe_label,requires_review,status,sent_at,created_at,reviewed_at,squawk_message_content(subject,body),squawk_message_receipts(user_id,read_at),squawk_message_reviews(reviewed_at,reviewer_role,reviewed_by)').in('thread_id', threads.map((thread) => thread.id)).in('status', ['queued','sent','partially_sent','failed']).order('created_at', { ascending: false }).limit(100);
      if (cancelled || messageError) { if (!cancelled) setMessages([]); return; }
      setMessages((messageRows || []).map((message) => {
        const thread = threadMap.get(message.thread_id);
        const content = Array.isArray(message.squawk_message_content) ? message.squawk_message_content[0] : message.squawk_message_content;
        const ownReceipt = (message.squawk_message_receipts || []).find((receipt) => receipt.user_id === user?.id);
        const review = Array.isArray(message.squawk_message_reviews) ? message.squawk_message_reviews[0] : message.squawk_message_reviews;
        const restricted = !content;
        const reviewed = Boolean(review?.reviewed_at || message.reviewed_at);
        return { id: message.id, contextLabel: thread?.context_label || 'ElevationPilot', subject: content?.subject || message.safe_label, preview: content?.body?.slice(0, 180) || '', restricted, requiredRole: message.required_roles?.length ? message.required_roles.map((role) => role.replaceAll('_', ' ')).join(' / ') : 'Authorized', requiresReview: message.requires_review, read: Boolean(ownReceipt?.read_at || reviewed), reviewed, reviewedLabel: review?.reviewer_role === 'eig_admin' ? 'Reviewed by EIG' : 'Reviewed by Pilot', sentAt: new Date(message.sent_at || message.created_at).toLocaleString() };
      }));
    }
    loadSquawks();
    return () => { cancelled = true; };
  }, [activeOrganizationId, user?.id, squawkOpen, squawkRefresh]);

  async function markSquawkRead(messageId, reviewedAt = null) {
    setSquawkActionError('');
    const now = new Date().toISOString();
    const receipt = { message_id: messageId, user_id: user.id, read_at: now };
    if (reviewedAt) receipt.reviewed_at = reviewedAt;
    const { error } = await supabase.from('squawk_message_receipts').upsert(receipt, { onConflict: 'message_id,user_id' });
    if (error) { setSquawkActionError('That Squawk could not be updated. Please try again.'); return false; }
    setSquawkRefresh((value) => value + 1);
    return true;
  }

  async function reviewSquawk(messageId) {
    setSquawkActionError('');
    const reviewedAt = new Date().toISOString();
    const reviewerRole = active?.role === 'eig_admin' ? 'eig_admin' : 'organization_admin';
    const { error } = await supabase.from('squawk_message_reviews').insert({ message_id: messageId, reviewed_by: user.id, reviewer_role: reviewerRole, reviewed_at: reviewedAt });
    if (error && error.code !== '23505') { setSquawkActionError('The Pilot review could not be recorded. Please try again.'); return; }
    await markSquawkRead(messageId, reviewedAt);
  }
  const unreadCount = messages.filter((message) => !message.read).length;
  return <div className="platform-shell"><header className="platform-topbar"><div className="platform-brand-wrap"><div className="platform-logo-mark small">EIG</div><div><strong>Elevated Impact Group</strong><span>{active?.organization?.name || 'Platform'}</span></div></div><div className="platform-topbar-actions"><WorkspaceSwitcher memberships={memberships} activeOrganizationId={activeOrganizationId} onSelect={setActiveOrganizationId} /><button className="global-squawk-trigger" onClick={() => setSquawkOpen(true)} aria-label={`Open Squawk Box${unreadCount ? `, ${unreadCount} unread` : ''}`}><span className="global-squawk-trigger-icon">SB</span><span className="global-squawk-trigger-label">Squawk Box</span>{unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}</button><div className="platform-user-block"><span>{user?.email}</span><button onClick={onSignOut}>Sign out</button></div></div></header><main className="platform-main-content">{children}</main>{squawkOpen && <GlobalSquawkDrawer organization={active?.organization} messages={messages} currentRole={active?.role} onMarkRead={markSquawkRead} onReview={reviewSquawk} actionError={squawkActionError} onClose={() => setSquawkOpen(false)} />}</div>;
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
  return <div className={`platform-product-card ${enabled ? 'enabled' : ''}`}><div className="platform-product-topline"><span>{product.category || 'EIG Product'}</span><span className={`platform-status-pill ${enabled ? 'enabled' : comingSoon ? 'soon' : ''}`}>{enabled ? 'Enabled' : comingSoon ? 'Coming Soon' : 'Not Enabled'}</span></div><h3>{product.name}</h3><p>{product.description}</p>{enabled && product.product_key === 'golf_event_registration' && <button className="platform-primary-button inline" onClick={onLaunch}>Open Golf Event Registration</button>}</div>;
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

function CockpitLaunchCard({ eyebrow, title, description, actionLabel, onAction, status = 'Available' }) {
  return <div className="cockpit-launch-card"><div className="platform-product-topline"><span>{eyebrow}</span><span className={`platform-status-pill ${status === 'Available' ? 'enabled' : 'soon'}`}>{status}</span></div><h3>{title}</h3><p>{description}</p>{onAction && <button className="platform-primary-button inline" onClick={onAction}>{actionLabel}</button>}</div>;
}

const SQUAWK_TEMPLATES = {
  payment_reminder: { subject: 'Registration payment reminder', message: 'Hi {{first_name}}, your registration balance for {{event_name}} is still open. Use the secure payment link below to complete payment.\n\n{{payment_link}}' },
  invoice: { subject: 'Invoice for {{event_name}}', message: 'Hi {{first_name}}, your invoice for {{event_name}} is ready. You can review it and submit payment using the link below.\n\n{{invoice_link}}' },
  registration_confirmation: { subject: 'You are registered for {{event_name}}', message: 'Hi {{first_name}}, your registration for {{event_name}} is confirmed. We will keep you updated here as the event gets closer.' },
  event_update: { subject: 'Update for {{event_name}}', message: 'Hi {{first_name}}, we have an update for {{event_name}}:\n\n' },
};

function SquawkBox({ organization, golfEvents, onClose }) {
  const [workspaceTab, setWorkspaceTab] = useState('compose');
  const [channel, setChannel] = useState('email');
  const [audience, setAudience] = useState('passengers_open_balance');
  const [eventId, setEventId] = useState(golfEvents[0]?.id || '');
  const [templateKey, setTemplateKey] = useState('payment_reminder');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState(SQUAWK_TEMPLATES.payment_reminder.subject);
  const [message, setMessage] = useState(SQUAWK_TEMPLATES.payment_reminder.message);
  const [smsMessage, setSmsMessage] = useState('{{event_name}} reminder: Your registration balance is open. Pay securely: {{payment_link}}. Reply STOP to opt out.');
  const [saved, setSaved] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [recipientPreferences, setRecipientPreferences] = useState(new Map());
  const [selectedRecipientIds, setSelectedRecipientIds] = useState(new Set());
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [connections, setConnections] = useState([]);
  const [history, setHistory] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sendResult, setSendResult] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      if (!organization?.id) return;
      setWorkspaceLoading(true);
      const [templateResult, connectionResult, threadResult] = await Promise.all([
        supabase.from('squawk_templates').select('id,name,description,message_kind,channel_options,subject_template,body_template,email_template,sms_template,merge_fields,audience_key,is_system').eq('is_active', true).or(`organization_id.is.null,organization_id.eq.${organization.id}`).order('is_system', { ascending: false }).order('name'),
        supabase.from('squawk_channel_connections').select('channel,provider,connection_status,compliance_status,sender_label,sender_masked,last_verified_at').eq('organization_id', organization.id),
        supabase.from('squawk_threads').select('id,context_label,event_id').eq('organization_id', organization.id),
      ]);
      if (cancelled) return;
      setTemplates(templateResult.data || []);
      setConnections(connectionResult.data || []);
      if (!threadResult.error && threadResult.data?.length) {
        const threadMap = new Map(threadResult.data.map((thread) => [thread.id, thread]));
        const { data: rows } = await supabase.from('squawk_messages').select('id,thread_id,created_by,message_kind,audience_key,channels,status,sent_at,created_at,updated_at,squawk_message_content(subject,body,email_body,sms_body),squawk_message_recipients(id,channel,delivery_status)').in('thread_id', threadResult.data.map((thread) => thread.id)).order('updated_at', { ascending: false }).limit(100);
        if (!cancelled) setHistory((rows || []).map((row) => {
          const content = Array.isArray(row.squawk_message_content) ? row.squawk_message_content[0] : row.squawk_message_content;
          return { ...row, contextLabel: threadMap.get(row.thread_id)?.context_label || 'ElevationPilot', subject: content?.subject || 'Restricted Squawk', body: content?.body || '', recipientCount: row.squawk_message_recipients?.length || 0 };
        }));
      } else setHistory([]);
      setWorkspaceLoading(false);
    }
    loadWorkspace();
    return () => { cancelled = true; };
  }, [organization?.id, refreshKey]);

  useEffect(() => {
    if (templateId || !templates.length) return;
    const initialTemplate = templates.find((template) => template.message_kind === 'payment_reminder') || templates[0];
    setTemplateId(initialTemplate.id);
    setTemplateKey(initialTemplate.message_kind);
    setSubject(initialTemplate.subject_template || '');
    setMessage(initialTemplate.email_template || initialTemplate.body_template);
    setSmsMessage(initialTemplate.sms_template || initialTemplate.body_template);
    if (initialTemplate.audience_key) setAudience(initialTemplate.audience_key);
  }, [templates, templateId]);

  useEffect(() => {
    let cancelled = false;
    async function loadRecipients() {
      if (!eventId) { setRecipients([]); setSelectedRecipientIds(new Set()); return; }
      setLoadingRecipients(true); setRecipientError('');
      const { data, error } = await supabase.from('golf_registrations').select('id,event_id,event_name,first_name,last_name,email,phone,price,amount_paid,payment_status').eq('event_id', eventId).order('last_name').order('first_name');
      if (cancelled) return;
      if (error) { setRecipientError(error.message); setRecipients([]); setRecipientPreferences(new Map()); setSelectedRecipientIds(new Set()); }
      else {
        const rows = data || [];
        setRecipients(rows);
        if (rows.length) {
          const { data: preferenceRows } = await supabase.from('squawk_recipient_preferences').select('registration_id,email_status,sms_status,do_not_contact').eq('organization_id', organization.id).in('registration_id', rows.map((recipient) => recipient.id));
          if (!cancelled) setRecipientPreferences(new Map((preferenceRows || []).map((preference) => [preference.registration_id, preference])));
        } else setRecipientPreferences(new Map());
      }
      setLoadingRecipients(false);
    }
    loadRecipients();
    return () => { cancelled = true; };
  }, [eventId, organization?.id]);

  const eligibleRecipients = useMemo(() => recipients.filter((recipient) => {
    const hasOpenBalance = Number(recipient.amount_paid || 0) < Number(recipient.price || 0) || recipient.payment_status !== 'paid';
    if (audience === 'passengers_open_balance' && !hasOpenBalance) return false;
    if (audience !== 'passengers_open_balance' && audience !== 'all_passengers') return false;
    if (recipientPreferences.get(recipient.id)?.do_not_contact) return false;
    if (channel === 'email') return Boolean(recipient.email);
    if (channel === 'sms') return Boolean(recipient.phone);
    if (channel === 'in_app') return false;
    return Boolean(recipient.email || recipient.phone);
  }), [recipients, recipientPreferences, audience, channel]);

  useEffect(() => { setSelectedRecipientIds(new Set(eligibleRecipients.map((recipient) => recipient.id))); }, [eventId, audience, channel, recipients.length]);
  function toggleRecipient(id) { setSaved(false); setSelectedRecipientIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleAllRecipients() { setSaved(false); setSelectedRecipientIds((current) => current.size === eligibleRecipients.length ? new Set() : new Set(eligibleRecipients.map((recipient) => recipient.id))); }

  function applyTemplate(key) {
    const databaseTemplate = templates.find((item) => item.id === key);
    if (databaseTemplate) {
      setTemplateId(databaseTemplate.id); setTemplateKey(databaseTemplate.message_kind); setSubject(databaseTemplate.subject_template || ''); setMessage(databaseTemplate.email_template || databaseTemplate.body_template); setSmsMessage(databaseTemplate.sms_template || databaseTemplate.body_template); if (databaseTemplate.audience_key) setAudience(databaseTemplate.audience_key);
    } else {
      const template = SQUAWK_TEMPLATES[key] || SQUAWK_TEMPLATES.event_update;
      setTemplateId(''); setTemplateKey(key); setSubject(template.subject); setMessage(template.message); setSmsMessage(template.message);
    }
    setSaved(false); setSavedDraftId(''); setSaveError('');
  }

  function maskEmail(email) {
    const [name, domain] = String(email || '').split('@');
    return name && domain ? `${name.slice(0, 2)}***@${domain}` : null;
  }

  function maskPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `***-***-${digits.slice(-4)}` : null;
  }

  async function saveDraft() {
    setSaveError(''); setSendResult(''); setSaved(false); setSaving(true);
    const selected = eligibleRecipients.filter((recipient) => selectedRecipientIds.has(recipient.id));
    const channels = channel === 'both' ? ['email', 'sms'] : [channel];
    const recipientRows = selected.flatMap((recipient) => channels.flatMap((deliveryChannel) => {
      if (deliveryChannel === 'email' && recipient.email) return [{ registration_id: recipient.id, recipient_type: 'passenger', channel: 'email', destination_masked: maskEmail(recipient.email) }];
      if (deliveryChannel === 'sms' && recipient.phone) return [{ registration_id: recipient.id, recipient_type: 'passenger', channel: 'sms', destination_masked: maskPhone(recipient.phone) }];
      return [];
    }));
    const selectedEvent = golfEvents.find((event) => event.id === eventId);
    const { data, error } = await supabase.rpc('create_squawk_draft', {
      p_organization_id: organization.id,
      p_event_id: eventId || null,
      p_context_label: selectedEvent?.name || `${organization.name} Cockpit`,
      p_message_kind: templateKey || 'message',
      p_visibility: 'all_relevant',
      p_required_roles: [],
      p_safe_label: subject || 'Squawk Box message',
      p_requires_review: ['invoice', 'payment_reminder'].includes(templateKey),
      p_subject: subject || null,
      p_body: message,
      p_email_body: message,
      p_sms_body: smsMessage,
      p_audience_key: audience,
      p_channels: channels,
      p_template_id: templateId || null,
      p_recipients: recipientRows,
    });
    if (error) { setSaveError(error.message || 'The Squawk draft could not be saved.'); setSaving(false); return null; }
    else { setSaved(true); setSavedDraftId(data); setRefreshKey((value) => value + 1); }
    setSaving(false);
    return data;
  }

  async function sendEmailSquawk() {
    setSaveError(''); setSendResult(''); setSending(true);
    try {
      const draftId = saved && savedDraftId ? savedDraftId : await saveDraft();
      if (!draftId) return;
      const { data, error } = await supabase.functions.invoke('send-squawk-email', { body: { message_id: draftId } });
      if (error) {
        let details = null;
        try { details = await error.context?.json(); } catch {}
        throw new Error(details?.error || error.message || 'The email could not be sent.');
      }
      if (!data?.success) throw new Error(data?.error || 'The email could not be sent.');
      setSendResult(`${data.sent_count} email${data.sent_count === 1 ? '' : 's'} sent successfully.`);
      setSaved(false); setSavedDraftId(''); setRefreshKey((value) => value + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The email could not be sent.');
    } finally {
      setSending(false);
    }
  }

  const draftMessages = history.filter((item) => item.status === 'draft' && item.body);
  const sentMessages = history.filter((item) => !['draft', 'cancelled', 'archived'].includes(item.status));
  const emailConnection = connections.find((item) => item.channel === 'email');
  const smsConnection = connections.find((item) => item.channel === 'sms');
  const smsConsentMissing = eligibleRecipients.filter((recipient) => selectedRecipientIds.has(recipient.id) && !['transactional_only', 'subscribed'].includes(recipientPreferences.get(recipient.id)?.sms_status)).length;
  const selectedEvent = golfEvents.find((event) => event.id === eventId);

  return <section className="platform-section-card squawk-box">
    <div className="platform-section-heading"><div><p className="platform-eyebrow">Cockpit Communications</p><h2>Squawk Box</h2><p>Prepare email and text messages in the correct Hangar and event context.</p></div><button className="platform-secondary-button" onClick={onClose}>Back to Cockpit</button></div>
    <div className="squawk-notice"><strong>Foundation mode:</strong> drafts, recipients, permissions, templates and delivery tracking are live. External sending stays locked until Resend and Twilio are verified.</div>
    <div className="squawk-workspace-tabs" role="tablist" aria-label="Squawk Box workspace"><button className={workspaceTab === 'compose' ? 'active' : ''} onClick={() => setWorkspaceTab('compose')}>Compose</button><button className={workspaceTab === 'drafts' ? 'active' : ''} onClick={() => setWorkspaceTab('drafts')}>Drafts <span>{draftMessages.length}</span></button><button className={workspaceTab === 'sent' ? 'active' : ''} onClick={() => setWorkspaceTab('sent')}>Sent <span>{sentMessages.length}</span></button><button className={workspaceTab === 'templates' ? 'active' : ''} onClick={() => setWorkspaceTab('templates')}>Templates <span>{templates.length}</span></button></div>
    {workspaceTab === 'compose' ? <div className="squawk-layout">
      <div className="squawk-composer">
        <div className="form-grid two">
          <label>Event context<select value={eventId} onChange={(e) => { setEventId(e.target.value); setSaved(false); }}><option value="">Select an event</option>{golfEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
          <label>Audience<select value={audience} onChange={(e) => { setAudience(e.target.value); setSaved(false); }}><option value="passengers_open_balance">Passengers with open balances</option><option value="all_passengers">All registered passengers</option><option value="atc_crew">ATC and Crew</option><option value="sponsors">Sponsors</option><option value="volunteers">Volunteers</option></select></label>
          <label>Channel<select value={channel} onChange={(e) => { setChannel(e.target.value); setSaved(false); }}><option value="email">Email</option><option value="sms">Text message</option><option value="both">Email + text</option><option value="in_app">In-app Squawk</option></select></label>
          <label>Message template<select value={templateId || templateKey} onChange={(e) => applyTemplate(e.target.value)}>{templates.length ? templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>) : <><option value="payment_reminder">Registration payment reminder</option><option value="invoice">Invoice and payment link</option><option value="registration_confirmation">Registration confirmation</option><option value="event_update">Event update</option></>}</select></label>
        </div>
        {channel !== 'sms' && <label>Subject<input value={subject} onChange={(e) => { setSubject(e.target.value); setSaved(false); }} /></label>}
        {channel !== 'sms' && <label>{channel === 'in_app' ? 'In-app message' : 'Email message'}<textarea rows="8" value={message} onChange={(e) => { setMessage(e.target.value); setSaved(false); }} /></label>}
        {['sms', 'both'].includes(channel) && <label>Text message <span className="squawk-character-count">{smsMessage.length} characters · {Math.max(1, Math.ceil(smsMessage.length / 160))} SMS segment(s)</span><textarea rows="5" value={smsMessage} onChange={(e) => { setSmsMessage(e.target.value); setSaved(false); }} /></label>}
        <div className="squawk-token-list"><span>Available merge fields:</span><code>{'{{first_name}}'}</code><code>{'{{event_name}}'}</code><code>{'{{payment_link}}'}</code><code>{'{{invoice_link}}'}</code></div>
        {['sms', 'both'].includes(channel) && smsConsentMissing > 0 && <div className="squawk-consent-warning"><strong>{smsConsentMissing} selected recipient(s) need SMS consent recorded.</strong><span>The draft can be saved, but those texts will remain blocked from delivery.</span></div>}
        <div className="squawk-recipient-panel">
          <div className="squawk-recipient-heading"><div><p className="platform-eyebrow">Recipient Preview</p><h3>{selectedRecipientIds.size} of {eligibleRecipients.length} selected</h3></div><button className="platform-secondary-button" type="button" onClick={toggleAllRecipients} disabled={!eligibleRecipients.length}>{selectedRecipientIds.size === eligibleRecipients.length && eligibleRecipients.length ? 'Clear All' : 'Select All'}</button></div>
          {loadingRecipients ? <p className="platform-login-copy">Loading authorized Registration recipients...</p> : recipientError ? <div className="platform-error">{recipientError}</div> : !eventId ? <p className="platform-login-copy">Select an event to preview recipients.</p> : !eligibleRecipients.length ? <p className="platform-login-copy">No recipients match this audience and channel. Additional audience connectors will populate as ATC, sponsor and volunteer records are assigned.</p> : <div className="squawk-recipient-list">{eligibleRecipients.map((recipient) => { const balance = Math.max(Number(recipient.price || 0) - Number(recipient.amount_paid || 0), 0); const preference = recipientPreferences.get(recipient.id); return <label key={recipient.id} className="squawk-recipient-row"><input type="checkbox" checked={selectedRecipientIds.has(recipient.id)} onChange={() => toggleRecipient(recipient.id)} /><span><strong>{recipient.first_name} {recipient.last_name}</strong><small>{recipient.email || 'No email'} · {recipient.phone || 'No phone'}</small><small className={['transactional_only', 'subscribed'].includes(preference?.sms_status) ? 'consent ready' : 'consent'}>SMS: {preference?.sms_status?.replaceAll('_', ' ') || 'consent not recorded'}</small></span><span className={balance > 0 ? 'balance open' : 'balance paid'}>{balance > 0 ? `$${balance.toFixed(2)} due` : 'Paid'}</span></label>; })}</div>}
        </div>
        {saveError && <div className="platform-error">{saveError}</div>}
        {sendResult && <div className="squawk-notice">{sendResult}</div>}
        <div className="review-actions"><button className="platform-secondary-button" onClick={saveDraft} disabled={saving || sending || !eventId || !message.trim()}>{saving ? 'Saving...' : 'Save Draft'}</button><button className="platform-primary-button" onClick={sendEmailSquawk} disabled={saving || sending || channel !== 'email' || emailConnection?.connection_status !== 'connected' || !eventId || !message.trim() || selectedRecipientIds.size === 0} title={emailConnection?.connection_status === 'connected' ? 'Send this email to the selected Registration recipients' : 'Connect and verify Resend before sending'}>{sending ? 'Sending...' : 'Send Email'}</button>{saved && <span className="squawk-saved">Draft saved securely · {savedDraftId.slice(0, 8)}</span>}</div>
      </div>
      <aside className="squawk-side">
        <p className="platform-eyebrow">Delivery Check</p><h3>Before takeoff</h3>
        <ul><li className={eventId ? 'ready' : ''}>Event selected</li><li className={recipients.length ? 'ready' : ''}>Registration recipients connected</li><li className={emailConnection?.connection_status === 'connected' ? 'ready' : ''}>Resend email: {emailConnection?.connection_status?.replaceAll('_', ' ') || 'setup required'}</li><li className={smsConnection?.connection_status === 'connected' && smsConnection?.compliance_status === 'approved' ? 'ready' : ''}>Twilio SMS: {smsConnection?.compliance_status?.replaceAll('_', ' ') || 'registration required'}</li><li>Payment and invoice links verified at send time</li></ul>
        <div className="squawk-history"><p className="platform-eyebrow">Current Context</p><strong>{selectedEvent?.name || 'No event selected'}</strong><p>{selectedRecipientIds.size} recipient(s) selected. Each channel creates its own delivery record and status trail.</p></div>
      </aside>
    </div> : <div className="squawk-library-panel">{workspaceLoading ? <p className="platform-login-copy">Loading Squawk Box records...</p> : workspaceTab === 'templates' ? <div className="squawk-template-grid">{templates.map((template) => <button key={template.id} className="squawk-template-card" onClick={() => { applyTemplate(template.id); setWorkspaceTab('compose'); }}><span>{template.is_system ? 'EIG System Template' : 'Hangar Template'}</span><strong>{template.name}</strong><p>{template.description}</p><small>{template.channel_options.join(' + ')}</small></button>)}</div> : <div className="squawk-record-list">{(workspaceTab === 'drafts' ? draftMessages : sentMessages).length ? (workspaceTab === 'drafts' ? draftMessages : sentMessages).map((item) => <article key={item.id} className="squawk-record-row"><div><span>{item.contextLabel} · {item.channels?.join(' + ')}</span><h3>{item.subject}</h3><p>{item.body.slice(0, 150)}{item.body.length > 150 ? '…' : ''}</p></div><div><b className={`squawk-record-status ${item.status}`}>{item.status.replaceAll('_', ' ')}</b><small>{item.recipientCount} delivery record(s)</small><small>{new Date(item.sent_at || item.updated_at || item.created_at).toLocaleString()}</small></div></article>) : <div className="empty-state"><strong>No {workspaceTab} Squawks yet.</strong><span>Saved drafts and completed delivery records will appear here.</span></div>}</div>}</div>}
  </section>;
}

function OrganizationDashboard({ organization, profile, role, products, entitlements, eventRequests, golfEvents, loadingRequests, onReloadRequests, onLaunchGolfRegistration, onSaveProfile }) {
  const [workspaceView, setWorkspaceView] = useState('hangar');
  const [cockpitTool, setCockpitTool] = useState('home');
  const enabledIds = useMemo(() => new Set(entitlements.filter((e) => ['active', 'trial'].includes(e.status)).map((e) => e.product_id)), [entitlements]);
  const enabledCount = enabledIds.size;
  const canReviewRequests = ['organization_admin', 'organization_staff'].includes(role);
  const roleLabel = role === 'organization_admin' ? 'Pilot' : role === 'organization_staff' ? 'Co-Pilot / Crew' : role?.replaceAll('_', ' ') || 'member';

  return <div className="platform-page">
    <section className="platform-hero organization"><div><p className="platform-eyebrow">{organization?.is_test ? 'Test Hangar' : 'Organization Hangar'}</p><h1>{organization?.name || 'Organization'}</h1><p>{workspaceView === 'hangar' ? 'Review the organization, setup, permissions and readiness before entering its operational workspace.' : 'Operate events, apps, communications and assigned work from the organization Cockpit.'}</p></div><div className="platform-role-pill">{roleLabel}</div></section>

    <div className="hangar-cockpit-switch" role="tablist" aria-label="Organization workspace view">
      <button className={workspaceView === 'hangar' ? 'active' : ''} role="tab" aria-selected={workspaceView === 'hangar'} onClick={() => setWorkspaceView('hangar')}><span>Hangar Overview</span><small>Organization information and readiness</small></button>
      <button className={workspaceView === 'cockpit' ? 'active' : ''} role="tab" aria-selected={workspaceView === 'cockpit'} onClick={() => setWorkspaceView('cockpit')}><span>Enter Cockpit</span><small>Events, apps and operations</small></button>
    </div>

    {workspaceView === 'hangar' ? <>
      <section className="platform-stats-grid"><StatCard label="Enabled Products" value={enabledCount} detail="Purchased or assigned by EIG" /><StatCard label="Setup Status" value={(organization?.onboarding_status || 'profile_incomplete').replaceAll('_', ' ')} detail="Shared organization onboarding" /><StatCard label="Hangar" value={organization?.is_test ? 'Test' : 'Active'} detail="Organization information and access" /></section>
      <OrganizationProfileSection organization={organization} profile={profile} role={role} onSave={onSaveProfile} />
      <section className="platform-section-card"><div className="platform-section-heading"><div><p className="platform-eyebrow">Assigned Capabilities</p><h2>Apps & Readiness</h2></div><button className="platform-primary-button inline" onClick={() => setWorkspaceView('cockpit')}>Enter Cockpit</button></div><p className="platform-login-copy">EIG controls which apps are assigned to this Hangar. Enter the Cockpit to operate enabled apps and event tools.</p><div className="platform-product-grid compact-products">{products.map((product) => <ProductCard key={product.id} product={product} enabled={enabledIds.has(product.id)} />)}</div></section>
    </> : cockpitTool === 'squawk' ? <SquawkBox organization={organization} golfEvents={golfEvents} onClose={() => setCockpitTool('home')} /> : <>
      <section className="platform-stats-grid"><StatCard label="Operating As" value={roleLabel} detail={organization?.name} /><StatCard label="Active Inquiries" value={eventRequests.filter((request) => !['declined', 'cancelled'].includes(request.status)).length} detail="Venue and event workflow" /><StatCard label="Squawk Box" value="Draft Ready" detail="Email, text, invoice and payment messages" /></section>
      <section className="platform-section-card cockpit-welcome"><div><p className="platform-eyebrow">Cockpit</p><h2>{organization?.name} Operations</h2><p>Choose an event tool or review the work currently moving through this Hangar. Event Registration opens the existing event system and Coordinator Hub.</p></div></section>
      <section className="cockpit-launch-grid">
        <CockpitLaunchCard eyebrow="Events" title="Golf Event Registration" description="Open registration, rosters, the current Coordinator Hub and its connected public Event Hub." actionLabel="Open Event Registration" onAction={onLaunchGolfRegistration} />
        <CockpitLaunchCard eyebrow="Communications" title="Squawk Box" description="Prepare email, text, invoice and payment messages for ATC, Crew, Passengers, sponsors and volunteers." actionLabel="Open Squawk Box" onAction={() => setCockpitTool('squawk')} status="Preview" />
        <CockpitLaunchCard eyebrow="Operations" title="Tasks & Alerts" description="See missing setup, upcoming deadlines, approvals and event items that need attention." status="Coming Soon" />
      </section>
      <section className="platform-section-card"><div className="platform-section-heading"><div><p className="platform-eyebrow">Flight Board</p><h2>Events</h2></div><button className="platform-secondary-button" onClick={onLaunchGolfRegistration}>Open Registration</button></div>{golfEvents.length ? <div className="cockpit-event-list">{golfEvents.map((event) => <div key={event.id} className="cockpit-event-row"><div><span className={`request-status ${event.status}`}>{event.status}</span><h3>{event.name}</h3><p>{event.course || organization?.name} · {(event.event_dates || []).join(' and ')}</p></div><div className="section-actions"><button className="platform-secondary-button" onClick={() => setCockpitTool('squawk')}>Open Squawk Box</button><button className="platform-primary-button" onClick={onLaunchGolfRegistration}>Enter ATC Center</button></div></div>)}</div> : <div className="empty-state"><strong>No Registration events are assigned to this Hangar yet.</strong><span>Create or assign an event from Event Registration.</span></div>}</section>
      {canReviewRequests && <EventRequestsSection organization={organization} requests={eventRequests} loading={loadingRequests} onReload={onReloadRequests} />}
      <section className="platform-section-card"><div className="platform-section-heading"><div><p className="platform-eyebrow">Cockpit</p><h2>Apps & Tools</h2></div></div><div className="platform-product-grid">{products.map((product) => <ProductCard key={product.id} product={product} enabled={enabledIds.has(product.id)} onLaunch={onLaunchGolfRegistration} />)}</div></section>
    </>}
  </div>;
}

export default function App() {
  const publicMatch = window.location.hash.match(/^#inquiry\/([^/?#]+)/);
  if (publicMatch && isSupabaseConfigured) return <PublicInquiryPage slug={decodeURIComponent(publicMatch[1])} />;

  const [session, setSession] = useState(null); const [authReady, setAuthReady] = useState(false); const [memberships, setMemberships] = useState([]); const [activeOrganizationId, setActiveOrganizationId] = useState(''); const [products, setProducts] = useState([]); const [entitlements, setEntitlements] = useState([]); const [organizations, setOrganizations] = useState([]); const [organizationProfile, setOrganizationProfile] = useState(null); const [eventRequests, setEventRequests] = useState([]); const [golfEvents, setGolfEvents] = useState([]); const [loadingData, setLoadingData] = useState(false); const [loadingRequests, setLoadingRequests] = useState(false); const [dataError, setDataError] = useState('');

  useEffect(() => { if (!supabase) { setAuthReady(true); return; } supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setAuthReady(true); }); const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession || null); if (!nextSession) { setMemberships([]); setActiveOrganizationId(''); setOrganizationProfile(null); } }); return () => listener.subscription.unsubscribe(); }, []);
  useEffect(() => { if (session?.user?.id) loadMemberships(session.user.id); }, [session?.user?.id]);
  useEffect(() => { if (activeOrganizationId) loadWorkspaceData(activeOrganizationId); }, [activeOrganizationId]);

  async function loadMemberships(userId, preferredOrganizationId = '') {
    setLoadingData(true); setDataError('');
    const { data, error } = await supabase.from('organization_memberships').select('organization_id, role, status, organization:organizations(id,name,slug,organization_type,status,is_test,onboarding_status)').eq('user_id', userId).eq('status', 'active');
    if (error) { setDataError(error.message); setMemberships([]); setLoadingData(false); return; }
    const ordered = [...(data || [])].sort((a, b) => { if (a.organization?.slug === EIG_SLUG) return -1; if (b.organization?.slug === EIG_SLUG) return 1; return (a.organization?.name || '').localeCompare(b.organization?.name || ''); });
    setMemberships(ordered); setActiveOrganizationId((current) => preferredOrganizationId || current || ordered[0]?.organization_id || ''); setLoadingData(false);
  }

  async function loadEventRequests(organizationId) { setLoadingRequests(true); const { data, error } = await supabase.from('event_requests').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }); if (error) setDataError(error.message); setEventRequests(data || []); setLoadingRequests(false); }

  async function loadWorkspaceData(organizationId) {
    setLoadingData(true); setDataError('');
    const activeMembership = memberships.find((m) => m.organization_id === organizationId);
    const isEig = activeMembership?.organization?.slug === EIG_SLUG && activeMembership?.role === 'eig_admin';
    const [{ data: productRows, error: productError }, { data: entitlementRows, error: entitlementError }, { data: profileRow, error: profileError }, { data: golfEventRows, error: golfEventError }] = await Promise.all([
      supabase.from('products').select('*').neq('status', 'retired').order('sort_order'),
      supabase.from('organization_product_entitlements').select('*').eq('organization_id', organizationId),
      supabase.from('organization_profiles').select('*').eq('organization_id', organizationId).maybeSingle(),
      supabase.from('golf_registration_events').select('id,organization_id,event_key,name,course,event_dates,status').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    ]);
    if (productError || entitlementError || profileError || golfEventError) setDataError(productError?.message || entitlementError?.message || profileError?.message || golfEventError?.message || 'Unable to load workspace data.');
    setProducts(productRows || []); setEntitlements(entitlementRows || []); setOrganizationProfile(profileRow || null); setGolfEvents(golfEventRows || []);
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

  return <PlatformShell user={session.user} memberships={memberships} activeOrganizationId={activeOrganizationId} setActiveOrganizationId={setActiveOrganizationId} onSignOut={signOut}>{dataError && <div className="platform-error banner">{dataError}</div>}{isEigAdminWorkspace ? <EigAdminDashboard organizations={organizations} products={products} loading={loadingData} onOpenOrganization={setActiveOrganizationId} onCreateOrganization={createOrganization} /> : <OrganizationDashboard organization={activeOrganization} profile={organizationProfile} role={activeMembership?.role} products={products} entitlements={entitlements} eventRequests={eventRequests} golfEvents={golfEvents} loadingRequests={loadingRequests} onReloadRequests={() => loadEventRequests(activeOrganizationId)} onLaunchGolfRegistration={() => { window.location.href = GOLF_REGISTRATION_URL; }} onSaveProfile={saveOrganizationProfile} />}</PlatformShell>;
}

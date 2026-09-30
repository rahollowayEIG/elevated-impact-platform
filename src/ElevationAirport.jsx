import React from 'react';
import { useSquawk } from './SquawkCenter';
import { supabase } from './lib/supabase';

function formatDate(dateValue) {
  if (!dateValue) return 'Date TBD';
  try {
    return new Date(dateValue + 'T12:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateValue;
  }
}

function roleLabel(role) {
  const labels = {
    eig_admin: 'EIG Command',
    organization_admin: 'Pilot',
    organization_staff: 'Co-Pilot',
    event_coordinator: 'ATC',
    event_staff: 'Crew',
    atc: 'ATC',
    coordinator: 'ATC',
    passenger: 'Passenger',
  };
  return labels[role] || String(role || 'Passenger').replaceAll('_', ' ');
}

export function AirportPage({
  profile,
  user,
  flights = [],
  memberships = [],
  loading = false,
  onBoard,
  onOpenWorkspace,
  onOpenProfile,
}) {
  const { unreadCount, openInbox } = useSquawk();
  const displayName = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.email?.split('@')?.[0] || 'Passenger';
  const username = profile?.username ? '@' + profile.username : '';
  const upcomingFlights = [...flights].sort((a, b) => String(a.eventDates?.[0] || '9999-12-31').localeCompare(String(b.eventDates?.[0] || '9999-12-31')));
  const actionFlights = upcomingFlights.filter((flight) => {
    const status = String(flight.registration?.payment_status || '').toLowerCase();
    return flight.registration && !['paid','comp'].includes(status);
  });
  const completedFlights = upcomingFlights.filter((flight) => {
    const status = String(flight.registration?.payment_status || '').toLowerCase();
    return flight.registration && ['paid','comp'].includes(status);
  });
  const profileFields = [profile?.first_name, profile?.last_name, user?.email, profile?.username];
  const profileProgress = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);

  return <div className="airport-page">
    <section className="airport-hero">
      <div><p className="platform-eyebrow">ElevationPilot Airport</p><h1>Welcome, {displayName}.</h1><p>Your personal home for Flights, registration actions, Boarding Passes, Hangars, Squawk Box, profile, results, and everything tied to your EIG identity.</p>{username && <span className="airport-username">{username}</span>}</div>
      <div className="airport-status"><span>Passenger Profile</span><strong>{profileProgress}%</strong><small>{username || 'account ready'}</small></div>
    </section>

    <section className="airport-summary-grid">
      <div className="airport-summary-card"><span>Flights</span><strong>{upcomingFlights.length}</strong><small>{upcomingFlights[0] ? `Next: ${upcomingFlights[0].name}` : 'No Flights yet'}</small></div>
      <div className="airport-summary-card attention"><span>Ticket Kiosk</span><strong>{actionFlights.length}</strong><small>registration actions</small></div>
      <div className="airport-summary-card"><span>Boarding Passes</span><strong>{completedFlights.length}</strong><small>completed registrations</small></div>
      <button className="airport-summary-card" type="button" onClick={openInbox}><span>Squawk Box</span><strong>{unreadCount}</strong><small>unread messages</small></button>
    </section>

    <section className="airport-grid">
      <article className="airport-panel airport-departures">
        <div className="airport-panel-heading"><div><span className="airport-icon">✈</span><div><p className="platform-eyebrow">Departure Board</p><h2>Flights</h2></div></div></div>
        {loading ? <div className="airport-empty"><strong>Loading departures...</strong></div> : upcomingFlights.length ? <div className="airport-flight-list">{upcomingFlights.slice(0,6).map((flight) => <button className="airport-flight-row" key={flight.key} type="button" onClick={() => onBoard(flight)}><div><strong>{flight.name}</strong><span>{flight.course || 'Venue details pending'}</span></div><div><strong>{formatDate(flight.eventDates?.[0])}</strong><span>{roleLabel(flight.accessRole)}</span></div><div className="airport-flight-actions"><span className={`airport-ticket-status ${flight.registration && ['paid','comp'].includes(String(flight.registration.payment_status || '').toLowerCase()) ? 'ready' : flight.registration ? 'action' : 'ready'}`}>{flight.accessRole === 'event_coordinator' ? 'ATC / EIE' : flight.registration && ['paid','comp'].includes(String(flight.registration.payment_status || '').toLowerCase()) ? 'Boarding Pass Ready' : flight.registration ? 'Ticket Action Needed' : 'Assigned Event'}</span><b>{flight.accessRole === 'event_coordinator' ? 'Open ATC / EIE →' : 'Manage Registration & Team →'}</b></div></button>)}</div> : <div className="airport-empty"><strong>No Flights on the board yet.</strong><span>Registered events and assigned EIE events will appear here automatically.</span></div>}
      </article>

      <article className="airport-panel airport-kiosk">
        <div className="airport-panel-heading"><div><span className="airport-icon">🎟</span><div><p className="platform-eyebrow">Things To Do</p><h2>Ticket Kiosk</h2></div></div></div>
        {actionFlights.length ? <div className="airport-action-list">{actionFlights.slice(0,5).map((flight) => <button key={flight.key} type="button" onClick={() => onBoard(flight)}><div><strong>{flight.name}</strong><span>Registration or payment still needs attention.</span></div><b>Continue →</b></button>)}</div> : <div className="airport-empty"><strong>Ticket Kiosk is clear.</strong><span>No unfinished registration or payment actions right now.</span></div>}
      </article>

      <article className="airport-panel">
        <div className="airport-panel-heading"><div><span className="airport-icon">🏢</span><div><p className="platform-eyebrow">Your Network</p><h2>Hangars</h2></div></div></div>
        {memberships.length ? <div className="airport-hangar-list">{memberships.filter((membership) => membership.organization?.slug !== 'elevated-impact-group').slice(0,6).map((membership) => <button key={membership.organization_id} type="button" onClick={() => onOpenWorkspace(membership.organization_id)}><div className="airport-hangar-mark">{membership.organization?.name?.slice(0,2).toUpperCase()}</div><div><strong>{membership.organization?.name || 'Hangar'}</strong><span>{roleLabel(membership.role)} access</span></div><b>Open →</b></button>)}</div> : <div className="airport-empty"><strong>No Hangars yet.</strong><span>Businesses and venues connected to your EIG activity will collect here.</span></div>}
      </article>

      <article className="airport-panel airport-profile-panel">
        <div className="airport-panel-heading"><div><span className="airport-icon">🪪</span><div><p className="platform-eyebrow">Passenger ID</p><h2>My Profile</h2></div></div><span className="airport-progress-label">{profileProgress}%</span></div>
        <div className="airport-profile-progress"><div style={{width: `${profileProgress}%`}} /></div>
        <p className="airport-panel-copy">Your permanent EIG identity follows you into registrations and future apps.</p>
        <div className="airport-mini-grid"><div><span>Name</span><strong>{displayName}</strong></div><div><span>Username</span><strong>{username || 'Add later'}</strong></div><div><span>Email</span><strong>{user?.email || 'Add later'}</strong></div><div><span>Role Spaces</span><strong>{memberships.length}</strong></div></div>
        <button className="platform-primary-button inline" type="button" onClick={onOpenProfile}>Open My Profile →</button>
      </article>

      <article className="airport-panel">
        <div className="airport-panel-heading"><div><span className="airport-icon">📻</span><div><p className="platform-eyebrow">Communications</p><h2>Squawk Box</h2></div></div><span className={`airport-message-badge ${unreadCount ? 'has-unread' : ''}`}>{unreadCount}</span></div>
        <p className="airport-panel-copy">Messages tied to Flights, Cockpits, EIE events, and your network stay accessible from the same global Squawk Box.</p>
        <button className="platform-primary-button inline" type="button" onClick={openInbox}>Open Squawk Box</button>
      </article>

      <article className="airport-panel">
        <div className="airport-panel-heading"><div><span className="airport-icon">🏆</span><div><p className="platform-eyebrow">Flight Record</p><h2>Results & Awards</h2></div></div></div>
        <div className="airport-mini-grid"><div><span>Completed Flights</span><strong>{completedFlights.length}</strong></div><div><span>Upcoming</span><strong>{upcomingFlights.length}</strong></div><div><span>Results</span><strong>0</strong></div><div><span>Awards</span><strong>0</strong></div></div>
      </article>
    </section>
  </div>;
}


export function PassengerProfilePage({
  profile,
  passenger,
  passengerProfile,
  user,
  savedPaymentCount = 0,
  onBack,
  onSave,
}) {
  const [form, setForm] = React.useState({
    first_name: '',
    last_name: '',
    preferred_name: '',
    display_name: '',
    username: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    ghin_number: '',
    home_course: '',
    handedness: '',
    player_status: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state_region: '',
    postal_code: '',
    favorite_brands: '',
  });
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setForm({
      first_name: passenger?.first_name || profile?.first_name || '',
      last_name: passenger?.last_name || profile?.last_name || '',
      preferred_name: passenger?.preferred_name || '',
      display_name: profile?.display_name || '',
      username: profile?.username || '',
      phone: profile?.phone || '',
      date_of_birth: passenger?.date_of_birth || '',
      gender: passenger?.gender || '',
      ghin_number: passenger?.ghin_number || '',
      home_course: passengerProfile?.home_course || '',
      handedness: passengerProfile?.handedness || '',
      player_status: passengerProfile?.player_status || '',
      address_line_1: passengerProfile?.address_line_1 || '',
      address_line_2: passengerProfile?.address_line_2 || '',
      city: passengerProfile?.city || '',
      state_region: passengerProfile?.state_region || '',
      postal_code: passengerProfile?.postal_code || '',
      favorite_brands: Array.isArray(passengerProfile?.favorite_brands) ? passengerProfile.favorite_brands.join(', ') : '',
    });
  }, [profile, passenger, passengerProfile]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await onSave(form);
      setNotice('Profile saved. Your updated Passenger information will be available to future EIG registrations.');
    } catch (saveError) {
      setError(saveError?.message || 'Unable to save your profile.');
    } finally {
      setBusy(false);
    }
  }

  const completed = [
    form.first_name,
    form.last_name,
    user?.email,
    form.phone,
    form.date_of_birth,
    form.ghin_number,
    form.home_course,
    form.handedness,
  ].filter(Boolean).length;
  const progress = Math.round((completed / 8) * 100);

  return <div className="platform-page passenger-profile-page">
    <section className="platform-hero organization">
      <div>
        <p className="platform-eyebrow">Airport · Passenger ID</p>
        <h1>My Profile</h1>
        <p>This is your permanent EIG identity. Event registrations can reuse the information you choose to keep here.</p>
      </div>
      <div className="review-actions">
        <button className="platform-secondary-button" type="button" onClick={onBack}>← Airport</button>
        <div className="platform-role-pill">{progress}% Complete</div>
      </div>
    </section>

    {notice && <div className="platform-success">{notice}</div>}
    {error && <div className="platform-error banner">{error}</div>}

    <form className="passenger-profile-form" onSubmit={submit}>
      <section className="platform-section-card">
        <div className="platform-section-heading">
          <div><p className="platform-eyebrow">Identity</p><h2>About Me</h2><p>The basics that identify you across ElevationPilot.</p></div>
        </div>
        <div className="form-grid two">
          <label>First name<input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} /></label>
          <label>Last name<input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} /></label>
          <label>Preferred name<input value={form.preferred_name} onChange={(e) => update('preferred_name', e.target.value)} placeholder="What should EIG call you?" /></label>
          <label>Display name<input value={form.display_name} onChange={(e) => update('display_name', e.target.value)} placeholder="Shown around ElevationPilot" /></label>
          <label>Username<input value={form.username} onChange={(e) => update('username', e.target.value)} placeholder="Future Squawk / Squadron username" /></label>
          <label>Email<input value={user?.email || ''} disabled /><small>Your sign-in email is managed with your account.</small></label>
          <label>Phone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} type="tel" /></label>
          <label>Date of birth<input value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} type="date" /></label>
          <label>Gender<input value={form.gender} onChange={(e) => update('gender', e.target.value)} /></label>
        </div>
      </section>

      <section className="platform-section-card">
        <div className="platform-section-heading">
          <div><p className="platform-eyebrow">Golf Profile</p><h2>My Game</h2><p>Reusable golf information for EIE registrations.</p></div>
        </div>
        <div className="form-grid two">
          <label>GHIN number<input value={form.ghin_number} onChange={(e) => update('ghin_number', e.target.value)} /></label>
          <label>Home course<input value={form.home_course} onChange={(e) => update('home_course', e.target.value)} /></label>
          <label>Handedness<select value={form.handedness} onChange={(e) => update('handedness', e.target.value)}><option value="">Choose</option><option value="right">Right</option><option value="left">Left</option></select></label>
          <label>Player status<select value={form.player_status} onChange={(e) => update('player_status', e.target.value)}><option value="">Choose</option><option value="recreational">Recreational</option><option value="competitive">Competitive</option><option value="club">Club Player</option><option value="professional">Professional</option></select></label>
          <label className="full-label">Favorite brands<input value={form.favorite_brands} onChange={(e) => update('favorite_brands', e.target.value)} placeholder="Titleist, FootJoy, TravisMathew..." /></label>
        </div>
      </section>

      <section className="platform-section-card">
        <div className="platform-section-heading">
          <div><p className="platform-eyebrow">Contact</p><h2>Address</h2><p>Kept private by default and available for future event, shipping, and store workflows.</p></div>
        </div>
        <div className="form-grid two">
          <label className="full-label">Address<input value={form.address_line_1} onChange={(e) => update('address_line_1', e.target.value)} /></label>
          <label className="full-label">Address line 2<input value={form.address_line_2} onChange={(e) => update('address_line_2', e.target.value)} /></label>
          <label>City<input value={form.city} onChange={(e) => update('city', e.target.value)} /></label>
          <label>State / Region<input value={form.state_region} onChange={(e) => update('state_region', e.target.value)} /></label>
          <label>ZIP / Postal code<input value={form.postal_code} onChange={(e) => update('postal_code', e.target.value)} /></label>
          <div className="profile-payment-summary"><span>Saved payment methods</span><strong>{savedPaymentCount}</strong><small>Card details remain with the payment provider, not EIG.</small></div>
        </div>
      </section>

      <div className="passenger-profile-savebar">
        <div><strong>Passenger Profile</strong><span>Save once. Reuse across EIG.</span></div>
        <button className="platform-primary-button" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save My Profile'}</button>
      </div>
    </form>
  </div>;
}

export function MainCabinPage({ flight, onBack, onOpenHub }) {
  const { unreadCount, openInbox } = useSquawk();
  const [paymentBusy, setPaymentBusy] = React.useState(false);
  const [paymentError, setPaymentError] = React.useState('');
  const [teamGroup, setTeamGroup] = React.useState(null);
  const [teamLoading, setTeamLoading] = React.useState(false);
  const [teamMessage, setTeamMessage] = React.useState('');
  const [teamWorkingId, setTeamWorkingId] = React.useState('');
  const [newPlayer, setNewPlayer] = React.useState({ first_name: '', last_name: '', email: '' });

  React.useEffect(() => {
    let active = true;
    async function loadTeam() {
      if (!flight?.registration?.id) {
        if (active) setTeamGroup(null);
        return;
      }
      setTeamLoading(true);
      setTeamMessage('');
      try {
        const { data, error } = await supabase.functions.invoke('golf-my-registrations', {
          body: { action: 'list' },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Unable to load registration details.');
        const group = (data.groups || []).find((item) =>
          item?.registration?.id === flight.registration.id ||
          (item?.registration?.event_id === flight.eventId && item?.registration?.team_id === flight.registration.team_id)
        );
        if (active) setTeamGroup(group || null);
      } catch (error) {
        if (active) setTeamMessage(error instanceof Error ? error.message : 'Unable to load registration details.');
      } finally {
        if (active) setTeamLoading(false);
      }
    }
    loadTeam();
    return () => { active = false; };
  }, [flight?.registration?.id, flight?.eventId]);

  if (!flight) return null;

  const registration = flight.registration || {};
  const eventDate = flight.eventDates?.[0];
  const eventEnd = flight.eventDates?.[1];
  const registrationStatus = String(registration.registration_status || 'Active').replaceAll('_', ' ');
  const paymentStatus = String(registration.payment_status || 'Pending').replaceAll('_', ' ');
  const teamLabel = teamGroup?.team?.entry_number || registration.entry_number || (registration.team_id ? 'Assigned' : 'Not assigned');
  const boardingCode = String(flight.eventId || flight.key || 'EIG').replaceAll('-', '').slice(0, 8).toUpperCase();

  function activeMembers() {
    return (teamGroup?.members || []).filter((member) => member.registration_status === 'active');
  }

  function isReservedTba(member) {
    return member?.custom_fields?.reserved_tba === true || (
      String(member?.first_name || '').trim().toUpperCase() === 'TBA' &&
      String(member?.last_name || '').trim().toUpperCase() === 'RESERVED'
    );
  }

  async function refreshTeam() {
    const { data, error } = await supabase.functions.invoke('golf-my-registrations', { body: { action: 'list' } });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Unable to refresh team.');
    const group = (data.groups || []).find((item) =>
      item?.registration?.id === registration.id ||
      (item?.registration?.event_id === flight.eventId && item?.registration?.team_id === registration.team_id)
    );
    setTeamGroup(group || null);
  }

  async function resendInvite(member) {
    if (!teamGroup?.team?.id || !member?.id) return;
    setTeamWorkingId(member.id);
    setTeamMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('golf-team-member', {
        body: {
          action: 'invite',
          team_id: teamGroup.team.id,
          registration_id: member.id,
          app_origin: 'https://golf.elevatedimpactgroup.net',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unable to resend invite.');
      setTeamMessage(data.email_sent ? 'Invitation sent.' : (data.warning || 'Invite saved, but email delivery needs attention.'));
      await refreshTeam();
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : 'Unable to resend invite.');
    } finally {
      setTeamWorkingId('');
    }
  }

  async function removeGolfer(member) {
    if (!member?.id || !window.confirm('Remove this golfer from the team and reopen the spot for a replacement?')) return;
    setTeamWorkingId(member.id);
    setTeamMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('golf-team-status', {
        body: { action: 'remove', registration_id: member.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unable to remove golfer.');
      setTeamMessage('Golfer removed. The team spot is open for a replacement.');
      await refreshTeam();
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : 'Unable to remove golfer.');
    } finally {
      setTeamWorkingId('');
    }
  }

  async function addGolfer() {
    if (!teamGroup?.team?.id) return;
    if (!newPlayer.first_name.trim() || !newPlayer.last_name.trim() || !newPlayer.email.trim()) {
      setTeamMessage('Enter the golfer’s first name, last name, and email.');
      return;
    }
    setTeamWorkingId('add-player');
    setTeamMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('golf-team-member', {
        body: {
          action: 'add',
          team_id: teamGroup.team.id,
          first_name: newPlayer.first_name.trim(),
          last_name: newPlayer.last_name.trim(),
          email: newPlayer.email.trim(),
          app_origin: 'https://golf.elevatedimpactgroup.net',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unable to add golfer.');
      setNewPlayer({ first_name: '', last_name: '', email: '' });
      setTeamMessage(data.email_sent ? 'Golfer added and invitation sent.' : (data.warning || 'Golfer added, but email delivery needs attention.'));
      await refreshTeam();
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : 'Unable to add golfer.');
    } finally {
      setTeamWorkingId('');
    }
  }
  const paymentAmount = Number(registration.price || 0);

  async function startCheckout() {
    if (!registration.id || paymentBusy) return;
    setPaymentBusy(true);
    setPaymentError('');
    try {
      const { data, error } = await supabase.functions.invoke('create-golf-checkout-session', {
        body: { registration_id: registration.id, save_payment_method: false },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error || 'Unable to start payment.');
      window.location.assign(data.url);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to start payment.');
      setPaymentBusy(false);
    }
  }

  return <div className="platform-page main-cabin-page premium-main-cabin">
    <section className="main-cabin-entry">
      <button className="platform-secondary-button" type="button" onClick={onBack}>← Airport</button>
      <div className="main-cabin-entry-title">
        <p className="platform-eyebrow">ElevationPilot · Main Cabin</p>
        <strong>{flight.name}</strong>
      </div>
      <div className="main-cabin-entry-actions">
        <button className="global-squawk-trigger main-cabin-sb-trigger" type="button" onClick={openInbox}>
          <span className="global-squawk-trigger-icon">SB</span>
          <span className="global-squawk-trigger-label">Squawk Box</span>
          {unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}
        </button>
        {flight.publicSlug && <button className="platform-primary-button" type="button" onClick={() => onOpenHub(flight)}>Event Hub ↗</button>}
      </div>
    </section>

    <section className="main-cabin-airframe">
      <div className="main-cabin-overhead" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i />
      </div>

      <div className="main-cabin-forward-screen">
        <div className="main-cabin-screen-frame">
          <div className="main-cabin-screen-topline">
            <span>WELCOME ABOARD</span>
            <b>EP · {boardingCode}</b>
          </div>
          <h1>{flight.name}</h1>
          <p>{flight.course || flight.organizationName || 'Event destination'}</p>
          <div className="main-cabin-screen-route">
            <div><small>EVENT DATE</small><strong>{formatDate(eventDate)}</strong></div>
            <span className="main-cabin-route-line"><i /><b>EP</b><i /></span>
            <div><small>{eventEnd ? 'FINAL DAY' : 'DESTINATION'}</small><strong>{eventEnd ? formatDate(eventEnd) : (flight.course || 'Venue TBD')}</strong></div>
          </div>
        </div>
      </div>

      <div className="main-cabin-status-ribbon">
        <div><span>Registration</span><strong>{registrationStatus}</strong></div>
        <div><span>Payment</span><strong>{paymentStatus}</strong></div>
        <div><span>Team</span><strong>{teamLabel}</strong></div>
        <div><span>Messages</span><strong>{unreadCount ? unreadCount + ' unread' : 'All caught up'}</strong></div>
      </div>

      <div className="main-cabin-seat-map">
        <article className="main-cabin-seat-pod">
          <div className="main-cabin-seat-shell">
            <div className="main-cabin-seat-number">01A</div>
            <div className="main-cabin-seat-screen boarding-pass-screen">
              <span>BOARDING PASS</span>
              <h2>{flight.name}</h2>
              <div className="boarding-pass-grid">
                <div><small>DATE</small><strong>{formatDate(eventDate)}</strong></div>
                <div><small>ROLE</small><strong>Passenger</strong></div>
                <div><small>STATUS</small><strong>{registrationStatus}</strong></div>
                <div><small>REF</small><strong>{boardingCode}</strong></div>
              </div>
            </div>
            <div className="main-cabin-seat-console"><i /><i /><i /></div>
          </div>
        </article>

        <div className="main-cabin-aisle" aria-hidden="true">
          <span>ROW 01</span>
          <i /><i /><i />
          <b>FORWARD</b>
        </div>

        <article className="main-cabin-seat-pod">
          <div className="main-cabin-seat-shell">
            <div className="main-cabin-seat-number">01F</div>
            <div className="main-cabin-seat-screen">
              <span>MY EVENT</span>
              <h2>{flight.course || 'Venue TBD'}</h2>
              <div className="main-cabin-event-lines">
                <div><small>Hangar</small><strong>{flight.organizationName || 'Event venue'}</strong></div>
                <div><small>Team</small><strong>{teamLabel}</strong></div>
                <div><small>Payment</small><strong>{paymentStatus}</strong></div>
                {String(registration.payment_status || '').toLowerCase() === 'pending' && registration.id && (
                  <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                    <button className="platform-primary-button" type="button" disabled={paymentBusy} onClick={startCheckout}>
                      {paymentBusy ? 'Opening secure checkout...' : `Pay ${paymentAmount > 0 ? paymentAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : 'Balance'}`}
                    </button>
                    {paymentError && <div className="platform-error" style={{ marginTop: 8 }}>{paymentError}</div>}
                  </div>
                )}
              </div>
            </div>
            <div className="main-cabin-seat-console"><i /><i /><i /></div>
          </div>
        </article>

        <article className="main-cabin-seat-pod interactive">
          <button className="main-cabin-seat-shell" type="button" onClick={openInbox}>
            <div className="main-cabin-seat-number">02A</div>
            <div className="main-cabin-seat-screen squawk-screen">
              <span>SB · SEATBACK COMMS</span>
              <div className="main-cabin-sb-mark">SB</div>
              <h2>Squawk Box</h2>
              <p>{unreadCount ? unreadCount + ' unread message' + (unreadCount === 1 ? '' : 's') : 'Messages, event updates, and direct Squawks live here.'}</p>
              <b className="main-cabin-screen-action">OPEN MESSAGES →</b>
            </div>
            <div className="main-cabin-seat-console"><i /><i /><i /></div>
          </button>
        </article>

        <div className="main-cabin-aisle second" aria-hidden="true">
          <span>ROW 02</span>
          <i /><i /><i />
          <b>CABIN</b>
        </div>

        <article className={'main-cabin-seat-pod interactive ' + (!flight.publicSlug ? 'disabled' : '')}>
          {flight.publicSlug ? <button className="main-cabin-seat-shell" type="button" onClick={() => onOpenHub(flight)}>
            <div className="main-cabin-seat-number">02F</div>
            <div className="main-cabin-seat-screen hub-screen">
              <span>EVENT HUB</span>
              <div className="main-cabin-hub-window"><i /><i /><i /></div>
              <h2>Event AirSpace</h2>
              <p>Event information, sponsors, media, announcements, and public updates.</p>
              <b className="main-cabin-screen-action">OPEN EVENT HUB ↗</b>
            </div>
            <div className="main-cabin-seat-console"><i /><i /><i /></div>
          </button> : <div className="main-cabin-seat-shell">
            <div className="main-cabin-seat-number">02F</div>
            <div className="main-cabin-seat-screen hub-screen">
              <span>EVENT HUB</span>
              <div className="main-cabin-hub-window"><i /><i /><i /></div>
              <h2>Preparing for departure</h2>
              <p>The event's public Hub will appear here when it is published.</p>
            </div>
            <div className="main-cabin-seat-console"><i /><i /><i /></div>
          </div>}
        </article>
      </div>

      <section className="main-cabin-team-tools">
        <div className="main-cabin-team-heading">
          <div>
            <span>REGISTRATION & TEAM</span>
            <h2>{teamGroup?.role === 'captain' ? 'Manage My Team' : 'My Team'}</h2>
            <p>Team / Entry #{teamGroup?.team?.entry_number || registration.entry_number || '—'} · {paymentStatus}</p>
          </div>
          {teamLoading && <small>Loading team...</small>}
        </div>

        {teamMessage && <div className="platform-success">{teamMessage}</div>}

        {!teamLoading && teamGroup ? <>
          <div className="main-cabin-team-roster">
            {activeMembers().map((member) => (
              <div className="main-cabin-team-member" key={member.id}>
                <div>
                  <strong>{isReservedTba(member) ? 'TBA · Reserved' : [member.first_name, member.last_name].filter(Boolean).join(' ')}</strong>
                  <span>{member.id === teamGroup.team?.captain_registration_id ? 'Captain' : isReservedTba(member) ? 'Open reserved spot' : member.passenger_claim_status === 'claimed' ? 'Account connected' : 'Invite pending'}</span>
                </div>
                {teamGroup.role === 'captain' && member.id !== teamGroup.team?.captain_registration_id && !isReservedTba(member) && (
                  <div className="main-cabin-team-actions">
                    {member.passenger_claim_status !== 'claimed' && <button type="button" className="platform-secondary-button" disabled={teamWorkingId === member.id} onClick={() => resendInvite(member)}>Resend Invite</button>}
                    <button type="button" className="platform-secondary-button" disabled={teamWorkingId === member.id} onClick={() => removeGolfer(member)}>Remove / Replace</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {teamGroup.role === 'captain' && activeMembers().some(isReservedTba) && (
            <div className="main-cabin-add-golfer">
              <strong>Fill Reserved TBA Spot</strong>
              <div className="main-cabin-add-grid">
                <label>First name<input value={newPlayer.first_name} onChange={(e) => setNewPlayer((current) => ({ ...current, first_name: e.target.value }))} /></label>
                <label>Last name<input value={newPlayer.last_name} onChange={(e) => setNewPlayer((current) => ({ ...current, last_name: e.target.value }))} /></label>
                <label>Email<input type="email" value={newPlayer.email} onChange={(e) => setNewPlayer((current) => ({ ...current, email: e.target.value }))} /></label>
              </div>
              <button type="button" className="platform-primary-button" disabled={teamWorkingId === 'add-player'} onClick={addGolfer}>
                {teamWorkingId === 'add-player' ? 'Adding Golfer...' : 'Add Golfer & Send Invite'}
              </button>
            </div>
          )}
        </> : !teamLoading && <div className="airport-empty"><strong>Registration details are not available yet.</strong><span>Refresh the Airport or contact the event coordinator if this persists.</span></div>}
      </section>

      <div className="main-cabin-aft-panel">
        <span>MAIN CABIN · {flight.name}</span>
        <strong>Your registration, team, payment, and event tools live in this Flight.</strong>
        <small>Team roster · payment · event hub · messages</small>
      </div>
    </section>
  </div>;
}

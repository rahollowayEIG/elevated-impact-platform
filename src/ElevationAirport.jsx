import React from 'react';
import { useSquawk } from './SquawkCenter';

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
        {loading ? <div className="airport-empty"><strong>Loading departures...</strong></div> : upcomingFlights.length ? <div className="airport-flight-list">{upcomingFlights.slice(0,6).map((flight) => <button className="airport-flight-row" key={flight.key} type="button" onClick={() => onBoard(flight)}><div><strong>{flight.name}</strong><span>{flight.course || 'Venue details pending'}</span></div><div><strong>{formatDate(flight.eventDates?.[0])}</strong><span>{roleLabel(flight.accessRole)}</span></div><span className={`airport-ticket-status ${flight.registration && ['paid','comp'].includes(String(flight.registration.payment_status || '').toLowerCase()) ? 'ready' : flight.registration ? 'action' : 'ready'}`}>{flight.accessRole === 'event_coordinator' ? 'ATC / EIE' : flight.registration && ['paid','comp'].includes(String(flight.registration.payment_status || '').toLowerCase()) ? 'Boarding Pass Ready' : flight.registration ? 'Ticket Action Needed' : 'Assigned Event'}</span></button>)}</div> : <div className="airport-empty"><strong>No Flights on the board yet.</strong><span>Registered events and assigned EIE events will appear here automatically.</span></div>}
      </article>

      <article className="airport-panel airport-kiosk">
        <div className="airport-panel-heading"><div><span className="airport-icon">🎟</span><div><p className="platform-eyebrow">Things To Do</p><h2>Ticket Kiosk</h2></div></div></div>
        {actionFlights.length ? <div className="airport-action-list">{actionFlights.slice(0,5).map((flight) => <button key={flight.key} type="button" onClick={() => onBoard(flight)}><div><strong>{flight.name}</strong><span>Registration or payment still needs attention.</span></div><b>Continue →</b></button>)}</div> : <div className="airport-empty"><strong>Ticket Kiosk is clear.</strong><span>No unfinished registration or payment actions right now.</span></div>}
      </article>

      <article className="airport-panel">
        <div className="airport-panel-heading"><div><span className="airport-icon">🏢</span><div><p className="platform-eyebrow">Your Network</p><h2>Hangars</h2></div></div></div>
        {memberships.length ? <div className="airport-hangar-list">{memberships.filter((membership) => membership.organization?.slug !== 'elevated-impact-group').slice(0,6).map((membership) => <button key={membership.organization_id} type="button" onClick={() => onOpenWorkspace(membership.organization_id)}><div className="airport-hangar-mark">{membership.organization?.name?.slice(0,2).toUpperCase()}</div><div><strong>{membership.organization?.name || 'Hangar'}</strong><span>{roleLabel(membership.role)} access</span></div><b>Open →</b></button>)}</div> : <div className="airport-empty"><strong>No Hangars yet.</strong><span>Businesses and venues connected to your EIG activity will collect here.</span></div>}
      </article>

      <article className="airport-panel">
        <div className="airport-panel-heading"><div><span className="airport-icon">🪪</span><div><p className="platform-eyebrow">Passenger ID</p><h2>My Profile</h2></div></div><span className="airport-progress-label">{profileProgress}%</span></div>
        <div className="airport-profile-progress"><div style={{width: `${profileProgress}%`}} /></div>
        <p className="airport-panel-copy">Your permanent EIG identity follows you into registrations and future apps.</p>
        <div className="airport-mini-grid"><div><span>Name</span><strong>{displayName}</strong></div><div><span>Username</span><strong>{username || 'Add later'}</strong></div><div><span>Email</span><strong>{user?.email || 'Add later'}</strong></div><div><span>Role Spaces</span><strong>{memberships.length}</strong></div></div>
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

export function MainCabinPage({ flight, onBack, onOpenHub }) {
  const { unreadCount, openInbox } = useSquawk();
  if (!flight) return null;

  const registration = flight.registration || {};
  const eventDate = flight.eventDates?.[0];
  const eventEnd = flight.eventDates?.[1];
  const registrationStatus = String(registration.registration_status || 'Active').replaceAll('_', ' ');
  const paymentStatus = String(registration.payment_status || 'Pending').replaceAll('_', ' ');
  const teamLabel = registration.team_id || 'Not assigned';
  const boardingCode = String(flight.eventId || flight.key || 'EIG').replaceAll('-', '').slice(0, 8).toUpperCase();

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

      <div className="main-cabin-aft-panel">
        <span>MAIN CABIN · {flight.name}</span>
        <strong>Additional passenger tools will occupy new seats as they come online.</strong>
        <small>Itinerary · tickets · purchases · results · team tools</small>
      </div>
    </section>
  </div>;
}

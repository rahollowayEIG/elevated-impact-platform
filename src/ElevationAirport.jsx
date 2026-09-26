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

  return <div className="platform-page airport-page">
    <section className="airport-hero">
      <div className="airport-terminal-grid" aria-hidden="true" />
      <div className="airport-hero-copy">
        <p className="platform-eyebrow">ElevationPilot · Airport</p>
        <h1>Welcome, {displayName}</h1>
        <p>Your personal departure board for events, messages, and the Hangars you can access.</p>
        {username && <span className="airport-username">{username}</span>}
      </div>
      <button className="airport-squawk-card" type="button" onClick={openInbox}>
        <span>SB</span>
        <strong>Squawk Box</strong>
        <small>{unreadCount ? unreadCount + ' unread message' + (unreadCount === 1 ? '' : 's') : 'No unread messages'}</small>
      </button>
    </section>

    <section className="airport-status-strip">
      <div><span>Upcoming Departures</span><strong>{upcomingFlights.length}</strong></div>
      <div><span>Hangars</span><strong>{memberships.length}</strong></div>
      <div><span>Squawks</span><strong>{unreadCount}</strong></div>
      <div><span>Account</span><strong>{username || 'Ready'}</strong></div>
    </section>

    <section className="platform-section-card airport-departures">
      <div className="platform-section-heading">
        <div>
          <p className="platform-eyebrow">Departure Board</p>
          <h2>Your Events</h2>
          <p>Choose an event to board. ElevationPilot will open the area that matches your role for that event.</p>
        </div>
        <span>{upcomingFlights.length} event{upcomingFlights.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? <p className="platform-login-copy">Loading your departures...</p>
        : upcomingFlights.length ? <div className="airport-flight-list">
          {upcomingFlights.map((flight) => <article className="airport-flight-card" key={flight.key}>
            <div className="airport-flight-date">
              <span>{formatDate(flight.eventDates?.[0])}</span>
              <small>{flight.eventDates?.[1] ? 'Through ' + formatDate(flight.eventDates[1]) : 'Single-day event'}</small>
            </div>
            <div className="airport-flight-main">
              <div className="airport-flight-topline">
                <span className={'airport-role-badge ' + (flight.accessRole || 'passenger')}>{roleLabel(flight.accessRole)}</span>
                <span className={'request-status ' + (flight.status || 'draft')}>{flight.status || 'draft'}</span>
              </div>
              <h3>{flight.name}</h3>
              <p>{flight.course || flight.organizationName || 'Venue to be announced'}</p>
              {flight.registration && <div className="airport-flight-detail">
                <span>Registration: <strong>{String(flight.registration.registration_status || 'active').replaceAll('_', ' ')}</strong></span>
                <span>Payment: <strong>{String(flight.registration.payment_status || 'pending').replaceAll('_', ' ')}</strong></span>
                {flight.registration.team_id && <span>Team: <strong>{flight.registration.team_id}</strong></span>}
              </div>}
            </div>
            <div className="airport-flight-action">
              <button className="platform-primary-button" type="button" onClick={() => onBoard(flight)}>
                Board Event →
              </button>
              <small>{flight.destinationLabel || 'Main Cabin'}</small>
            </div>
          </article>)}
        </div>
        : <div className="empty-state airport-empty">
          <strong>No departures on your board yet.</strong>
          <span>When you register for an event or receive an event role, it will appear here automatically.</span>
        </div>}
    </section>

    {!!memberships.length && <section className="platform-section-card">
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">Hangars</p><h2>Your Workspaces</h2><p>Organization access stays separate from your personal Airport.</p></div>
      </div>
      <div className="airport-hangar-grid">
        {memberships.map((membership) => <button type="button" className="airport-hangar-card" key={membership.organization_id} onClick={() => onOpenWorkspace(membership.organization_id)}>
          <span>{roleLabel(membership.role)}</span>
          <strong>{membership.organization?.name || 'EIG Workspace'}</strong>
          <small>Enter Hangar / Cockpit →</small>
        </button>)}
      </div>
    </section>}
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

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
  const { openInbox } = useSquawk();
  if (!flight) return null;

  const registration = flight.registration || {};
  const eventDate = flight.eventDates?.[0];

  return <div className="platform-page main-cabin-page">
    <section className="main-cabin-hero">
      <div>
        <p className="platform-eyebrow">ElevationPilot · Main Cabin</p>
        <h1>{flight.name}</h1>
        <p>{flight.course || flight.organizationName || 'Event destination'}</p>
      </div>
      <div className="review-actions">
        <button className="platform-secondary-button" type="button" onClick={onBack}>← Airport</button>
        <button className="platform-secondary-button" type="button" onClick={openInbox}>SB · Messages</button>
        {flight.publicSlug && <button className="platform-primary-button" type="button" onClick={() => onOpenHub(flight)}>Open Event Hub ↗</button>}
      </div>
    </section>

    <section className="platform-stats-grid">
      <div className="platform-stat-card"><span>Departure</span><strong>{formatDate(eventDate)}</strong><small>{flight.course || 'Venue TBD'}</small></div>
      <div className="platform-stat-card"><span>Registration</span><strong>{String(registration.registration_status || 'Active').replaceAll('_', ' ')}</strong><small>Your event access</small></div>
      <div className="platform-stat-card"><span>Payment</span><strong>{String(registration.payment_status || 'Pending').replaceAll('_', ' ')}</strong><small>{registration.amount_paid != null ? '$' + Number(registration.amount_paid || 0).toFixed(2) + ' paid' : 'Payment details will appear here'}</small></div>
    </section>

    <section className="platform-section-card">
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">Your Trip</p><h2>Main Cabin</h2><p>This is the participant space for this event. Event updates, itinerary, team details, payments, documents, and other passenger tools will collect here as they are connected.</p></div>
      </div>
      <div className="main-cabin-grid">
        <div><span>Event</span><strong>{flight.name}</strong><small>{formatDate(eventDate)}</small></div>
        <div><span>Venue</span><strong>{flight.course || 'TBD'}</strong><small>{flight.organizationName || 'Event venue'}</small></div>
        <div><span>Team</span><strong>{registration.team_id || 'Not assigned'}</strong><small>Team details will stay with this event.</small></div>
        <button type="button" onClick={openInbox}><span>SB</span><strong>Squawk Box</strong><small>Event messages and updates</small></button>
      </div>
    </section>
  </div>;
}

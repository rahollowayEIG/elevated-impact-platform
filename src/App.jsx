import React, { useMemo, useState } from 'react';
import { useEventSystemData } from './hooks/useEventSystemData';

const iconPaths = {
  bolt: 'M13 2L4 14h7l-1 8 10-13h-7z',
  calendar: 'M7 2v4M17 2v4M4 8h16M5 4h14a1 1 0 0 1 1 1v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z',
  chart: 'M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8',
  check: 'M20 6L9 17l-5-5',
  chevron: 'M9 18l6-6-6-6',
  dollar: 'M12 2v20M17 7.5C17 5.6 15.2 4 12.5 4H11c-2.5 0-4 1.2-4 3s1.1 3 4.2 3.5l2 .5c2.7.7 3.8 1.7 3.8 3.5s-1.5 3.5-4.5 3.5H11c-2.8 0-5-1.6-5-3.8',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  gift: 'M20 12v8H4v-8M2 7h20v5H2zM12 22V7M12 7H8a2 2 0 1 1 2-2c0 2-2 2-2 2M12 7h4a2 2 0 1 0-2-2c0 2 2 2 2 2',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  megaphone: 'M4 13h3l9 4V7l-9 4H4zM7 13v4a2 2 0 0 0 2 2h1M18 10a4 4 0 0 1 0 4',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  plus: 'M12 5v14M5 12h14',
  screen: 'M4 5h16v11H4zM8 21h8M12 16v5',
  settings: 'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.5-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.4a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3.5.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.5.2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V2h4v.4a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3.5-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
};

const fallbackEvents = [
  { id: 'demo-1', name: 'Demo Charity Golf Outing', event_date: '2026-06-18', location: 'Primary Golf Course', golfer_count: 120, revenue_goal: 25000, status: 'demo_mode' },
];

const fallbackProducts = [
  { id: 'demo-sp-1', event_id: 'demo-1', name: 'Title Sponsor', price: 5000, quantity_available: 1, quantity_sold: 0, product_type: 'tier' },
  { id: 'demo-sp-2', event_id: 'demo-1', name: 'Gold Sponsor', price: 2500, quantity_available: 4, quantity_sold: 2, product_type: 'tier' },
  { id: 'demo-sp-3', event_id: 'demo-1', name: 'Hole Sponsor', price: 300, quantity_available: 18, quantity_sold: 9, product_type: 'placement' },
];

const fallbackSponsors = [
  { id: 'demo-s-1', event_id: 'demo-1', business_name: 'Oak Ridge Dental', contact_name: 'Amanda Lee', status: 'active', logo_status: 'received' },
  { id: 'demo-s-2', event_id: 'demo-1', business_name: 'Summit Auto Group', contact_name: 'Chris Miller', status: 'pending', logo_status: 'needed' },
];

const fallbackPurchases = [
  { id: 'demo-p-1', event_id: 'demo-1', sponsor_id: 'demo-s-1', product_name: 'Gold Sponsor', amount: 2500, payment_status: 'paid' },
  { id: 'demo-p-2', event_id: 'demo-1', sponsor_id: 'demo-s-2', product_name: 'Hole Sponsor + Digital Spot', amount: 550, payment_status: 'pending' },
];

const fallbackVolunteers = [
  { id: 'demo-v-1', event_id: 'demo-1', name: 'Jamie Ross', assigned_role: 'Registration Table', availability: 'Morning', status: 'confirmed' },
];

const fallbackRequests = [
  { id: 'demo-r-1', event_id: 'demo-1', request_type: 'swag', title: 'Golfer gift package', base_quantity: 120, additional_quantity: 12, status: 'submitted', notes: 'Golf balls, tees, towel, swag bag.' },
  { id: 'demo-r-2', event_id: 'demo-1', request_type: 'catering', title: 'Lunch + drink tickets', base_quantity: 120, additional_quantity: 20, status: 'reviewing', notes: 'Include volunteers and staff.' },
];

const mediaOptions = [
  { title: 'Digital TV Ads', category: 'Digital Media', detail: 'Clubhouse, bar, and pro shop screen campaigns powered manually through OptiSigns for V1.' },
  { title: 'Granite Tee Signs', category: 'On-Course Advertising', detail: 'Featured premium on-course placement for long-term visibility.' },
  { title: 'Clubhouse Placements', category: 'On-Property Advertising', detail: 'Banners, displays, registration signage, and facility placements.' },
  { title: 'Event Day Exposure', category: 'Event-Based Exposure', detail: 'One-day digital spots and sponsorship visibility tied to a specific event.' },
];

function Icon({ name, className = '' }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name] || iconPaths.bolt} />
    </svg>
  );
}

function Button({ children, onClick, variant = 'primary', type = 'button', disabled = false }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`btn ${variant}`}>{children}</button>;
}

function Card({ children, className = '' }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function Badge({ children, tone = 'red' }) {
  return <span className={`badge ${tone === 'dark' ? 'dark' : ''}`}>{children}</span>;
}

function Metric({ label, value, sub }) {
  return (
    <Card>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {sub && <p className="metric-sub">{sub}</p>}
    </Card>
  );
}

function ProgressBar({ value }) {
  return <div className="progress"><div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

function Shell({ page, setPage, children }) {
  const nav = [
    { key: 'home', label: 'Home', icon: 'bolt' },
    { key: 'builder', label: 'Build Event', icon: 'plus' },
    { key: 'dashboard', label: 'Event Dashboard', icon: 'chart' },
    { key: 'media', label: 'Media / Ads', icon: 'screen' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <div className="app">
      <div className="layout">
        <aside className="sidebar">
          <button onClick={() => setPage('home')} className="brand">
            <div className="brand-icon"><Icon name="bolt" /></div>
            <div>
              <p className="brand-title">Elevated Impact</p>
              <p className="brand-sub">Phase 1 MVP</p>
            </div>
          </button>

          <div className="nav">
            {nav.map((item) => (
              <button key={item.key} onClick={() => setPage(item.key)} className={`nav-button ${page === item.key ? 'active' : ''}`}>
                <Icon name={item.icon} /> {item.label}
              </button>
            ))}
          </div>

          <div className="card" style={{ marginTop: 32 }}>
            <Badge>Admin Review First</Badge>
            <p style={{ marginTop: 12, color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>Every request enters the system as pending so you can approve, price, and fulfill manually.</p>
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = '', type = 'text' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function RequirementPreview({ label, qty }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row">
        <span style={{ color: '#cbd5e1', fontSize: 14 }}>{label}</span>
        <span style={{ fontSize: 20, fontWeight: 950 }}>{qty || 0}</span>
      </div>
    </div>
  );
}

function HomePage({ setPage, data }) {
  const events = data.events.length ? data.events : fallbackEvents;
  const requests = data.requests.length ? data.requests : fallbackRequests;
  const sponsors = data.sponsors.length ? data.sponsors : fallbackSponsors;
  const event = events[0];

  return (
    <div>
      <section className="hero-grid">
        <div>
          <Badge>Events + Sponsorships + Media</Badge>
          <h1 className="h1">Build events. Sell exposure. Run everything from one command center.</h1>
          <p className="lead">Phase 1 gives Elevated Impact a real front-end foundation for event requests, sponsorship tracking, volunteers, event needs, uploads, and media opportunities.</p>
          <div className="actions">
            <Button onClick={() => setPage('builder')}>Start Build Your Event <Icon name="chevron" /></Button>
            <Button variant="secondary" onClick={() => setPage('dashboard')}>View Event Dashboard</Button>
          </div>
        </div>
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #e11d2e, #7f1d1d)', margin: -24, marginBottom: 24, padding: 24 }}>
            <p style={{ fontSize: 13, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fee2e2' }}>Live Event Snapshot</p>
            <h2 style={{ fontSize: 34, fontWeight: 950, margin: '12px 0 0' }}>{event.name}</h2>
          </div>
          <div className="grid grid-2">
            <Metric label="Goal" value={`$${Number(event.revenue_goal || 0).toLocaleString()}`} sub="target revenue" />
            <Metric label="Golfers" value={event.golfer_count || 0} sub="drives needs" />
            <Metric label="Sponsors" value={sponsors.length} sub="tracked buyers" />
            <Metric label="Requests" value={requests.length} sub="swag, catering, signage" />
          </div>
        </Card>
      </section>

      <section className="grid grid-3" style={{ marginTop: 40 }}>
        <Feature icon="calendar" title="Event Operating System" text="Build events, track progress, manage requests, and keep every outing organized." />
        <Feature icon="dollar" title="Sponsorship Engine" text="Break sponsorships into packages, add-ons, contributions, and event-day digital exposure." />
        <Feature icon="screen" title="Media + Advertising" text="Support TV ads, granite tee signs, on-course placements, property ads, and event exposure." />
      </section>
    </div>
  );
}

function Feature({ icon, title, text }) {
  return (
    <Card>
      <div style={{ display: 'flex', width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 18, background: 'rgba(239,68,68,0.18)', color: '#fee2e2', marginBottom: 20 }}>
        <Icon name={icon} />
      </div>
      <h3 style={{ fontSize: 22, fontWeight: 950, margin: 0 }}>{title}</h3>
      <p style={{ marginTop: 12, color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}>{text}</p>
    </Card>
  );
}

function EventBuilder({ createEvent, setPage, isSupabaseConfigured }) {
  const [form, setForm] = useState({ name: '', date: '', location: '', golferCount: 120, revenueGoal: 20000, eventType: 'Golf Outing' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured yet. Add the Vercel environment variables first.');
      }

      await createEvent({
        name: form.name || 'New Event Request',
        event_type: form.eventType || 'Golf Outing',
        event_date: form.date || undefined,
        location: form.location || undefined,
        golfer_count: Number(form.golferCount) || 0,
        revenue_goal: Number(form.revenueGoal) || 0,
        status: 'pending_review',
      });

      setPage('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create event.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Badge>Build Your Event</Badge>
      <h1 className="h2">Create the event request.</h1>
      <p className="lead">This Phase 1 intake flow creates a pending event so you can review availability, pricing, and next steps before anything becomes final.</p>

      {error && <div className="alert">{error}</div>}

      <div className="grid grid-2">
        <Card>
          <form onSubmit={submit} className="grid">
            <div className="grid grid-2">
              <Field label="Event Name" value={form.name} onChange={(v) => update('name', v)} placeholder="Charity Golf Outing" />
              <Field label="Event Type" value={form.eventType} onChange={(v) => update('eventType', v)} placeholder="Golf Outing" />
              <Field label="Preferred Date" type="date" value={form.date} onChange={(v) => update('date', v)} />
              <Field label="Location / Course" value={form.location} onChange={(v) => update('location', v)} placeholder="Primary Golf Course" />
              <Field label="Expected Golfers" type="number" value={form.golferCount} onChange={(v) => update('golferCount', v)} />
              <Field label="Revenue Goal" type="number" value={form.revenueGoal} onChange={(v) => update('revenueGoal', v)} />
            </div>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Pending Event'} <Icon name="chevron" /></Button>
          </form>
        </Card>
        <Card>
          <h2 style={{ marginTop: 0, fontSize: 26, fontWeight: 950 }}>Auto-planning preview</h2>
          <p style={{ color: '#cbd5e1' }}>Quantities are driven by registration/golfer count.</p>
          <div className="grid">
            <RequirementPreview label="Golfer gifts / swag" qty={form.golferCount} />
            <RequirementPreview label="Base meals" qty={form.golferCount} />
            <RequirementPreview label="Scorecards" qty={form.golferCount} />
            <RequirementPreview label="Drink tickets estimate" qty={Number(form.golferCount || 0) * 2} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function EventDashboard({ data }) {
  const [tab, setTab] = useState('overview');

  const events = data.events.length ? data.events : fallbackEvents;
  const products = data.products.length ? data.products : fallbackProducts;
  const sponsors = data.sponsors.length ? data.sponsors : fallbackSponsors;
  const purchases = data.purchases.length ? data.purchases : fallbackPurchases;
  const volunteers = data.volunteers.length ? data.volunteers : fallbackVolunteers;
  const requests = data.requests.length ? data.requests : fallbackRequests;
  const selectedEventId = data.selectedEventId || events[0]?.id;

  const event = events.find((e) => e.id === selectedEventId) || events[0];
  const eventProducts = products.filter((p) => p.event_id === event.id);
  const eventSponsors = sponsors.filter((s) => s.event_id === event.id);
  const eventPurchases = purchases.filter((p) => p.event_id === event.id);
  const eventVolunteers = volunteers.filter((v) => v.event_id === event.id);
  const eventRequests = requests.filter((r) => r.event_id === event.id);

  const revenue = eventPurchases.reduce((sum, purchase) => purchase.payment_status === 'paid' ? sum + Number(purchase.amount || 0) : sum, 0);
  const revenuePct = event.revenue_goal ? Math.round((revenue / event.revenue_goal) * 100) : 0;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'chart' },
    { key: 'sponsorships', label: 'Sponsorships', icon: 'dollar' },
    { key: 'needs', label: 'Event Needs', icon: 'gift' },
    { key: 'volunteers', label: 'Volunteers', icon: 'people' },
    { key: 'uploads', label: 'Uploads', icon: 'upload' },
    { key: 'comms', label: 'Communications', icon: 'mail' },
  ];

  if (!event) {
    return <Card><h2>No events yet</h2><p>Create your first event from Build Event.</p></Card>;
  }

  return (
    <div>
      <div className="row" style={{ alignItems: 'end', marginBottom: 24 }}>
        <div>
          <Badge>{event.status}</Badge>
          <h1 className="h2">{event.name}</h1>
          <p style={{ color: '#cbd5e1' }}>{event.event_date || 'Date pending'} • {event.location || 'Location pending'} • {event.golfer_count || 0} golfers</p>
        </div>
        <select value={event.id} onChange={(e) => data.setSelectedEventId(e.target.value)} className="select" style={{ maxWidth: 320 }}>
          {events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <div className="grid grid-4">
        <Metric label="Revenue" value={`$${revenue.toLocaleString()}`} sub={`Goal $${Number(event.revenue_goal || 0).toLocaleString()}`} />
        <Metric label="Sponsors" value={eventSponsors.length} sub="tracked buyers" />
        <Metric label="Volunteers" value={eventVolunteers.length} sub="signups" />
        <Metric label="Requests" value={eventRequests.length} sub="event needs" />
      </div>

      <Card style={{ marginTop: 24 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 900 }}>Revenue progress</span>
          <span style={{ color: '#fee2e2', fontWeight: 950 }}>{revenuePct}%</span>
        </div>
        <ProgressBar value={revenuePct} />
      </Card>

      <div className="tabs">
        {tabs.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`tab ${tab === item.key ? 'active' : ''}`}>
            <Icon name={item.icon} /> {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab event={event} products={eventProducts} sponsors={eventSponsors} requests={eventRequests} />}
      {tab === 'sponsorships' && <SponsorshipsTab products={eventProducts} sponsors={eventSponsors} purchases={eventPurchases} />}
      {tab === 'needs' && <NeedsTab event={event} requests={eventRequests} createEventRequest={data.createEventRequest} isSupabaseConfigured={data.isSupabaseConfigured} />}
      {tab === 'volunteers' && <VolunteersTab volunteers={eventVolunteers} />}
      {tab === 'uploads' && <PlaceholderTab icon="upload" title="Uploads + Google Drive" text="Sponsor logos, ad assets, signage files, and event documents will route into organized Google Drive folders in a later integration." />}
      {tab === 'comms' && <PlaceholderTab icon="mail" title="Event Communication Center" text="Email sponsors, golfers, volunteers, vendors, and generate flyer/promo templates. This is structured now and built out later." />}
    </div>
  );
}

function OverviewTab({ event, products, sponsors, requests }) {
  return (
    <div className="grid grid-2">
      <Card>
        <h2 style={{ marginTop: 0 }}>Next actions</h2>
        <div className="grid">
          {['Review date availability', 'Confirm sponsorship package list', 'Request missing sponsor logos', 'Quote swag and catering requests'].map((item) => (
            <div key={item} className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Icon name="check" /> <span style={{ color: '#cbd5e1' }}>{item}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 style={{ marginTop: 0 }}>Event structure</h2>
        <div className="grid grid-2">
          <RequirementPreview label="Sponsor products" qty={products.length} />
          <RequirementPreview label="Sponsors" qty={sponsors.length} />
          <RequirementPreview label="Event requests" qty={requests.length} />
          <RequirementPreview label="Golfer-driven base qty" qty={event.golfer_count} />
        </div>
      </Card>
    </div>
  );
}

function SponsorshipsTab({ products, sponsors, purchases }) {
  return (
    <div className="grid grid-2">
      <Card>
        <h2 style={{ marginTop: 0 }}>Sponsorship Products</h2>
        <div className="grid">
          {products.map((product) => (
            <div key={product.id} className="card" style={{ padding: 16 }}>
              <div className="row">
                <div>
                  <p style={{ margin: 0, fontWeight: 950 }}>{product.name}</p>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 12 }}>{product.product_type}</p>
                </div>
                <p style={{ fontWeight: 950, color: '#fee2e2' }}>${Number(product.price || 0).toLocaleString()}</p>
              </div>
              <p style={{ color: '#cbd5e1', fontSize: 14 }}>Sold {product.quantity_sold} of {product.quantity_available}</p>
              <ProgressBar value={(product.quantity_sold / Math.max(1, product.quantity_available)) * 100} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 style={{ marginTop: 0 }}>Sponsor Purchases</h2>
        <div style={{ overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18 }}>
          {purchases.map((purchase) => {
            const sponsor = sponsors.find((s) => s.id === purchase.sponsor_id);
            return (
              <div key={purchase.id} className="table-row" style={{ gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr' }}>
                <div style={{ fontWeight: 950 }}>{sponsor?.business_name || 'Sponsor'}</div>
                <div style={{ color: '#cbd5e1' }}>{purchase.product_name || 'Product'}</div>
                <div style={{ color: '#cbd5e1' }}>${Number(purchase.amount || 0).toLocaleString()}</div>
                <div style={{ color: '#cbd5e1' }}>{purchase.payment_status}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function NeedsTab({ event, requests, createEventRequest, isSupabaseConfigured }) {
  const [type, setType] = useState('Swag');
  const [extraQty, setExtraQty] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function addRequest() {
    setSaving(true);
    setError('');

    try {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured yet.');
      await createEventRequest({
        event_id: event.id,
        request_type: type.toLowerCase(),
        title: `${type} request`,
        base_quantity: event.golfer_count,
        additional_quantity: Number(extraQty) || 0,
        status: 'submitted',
        notes: notes || 'Manual fulfillment request.',
      });

      setExtraQty(0);
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-2">
      <Card>
        <h2 style={{ marginTop: 0 }}>Add Event Need</h2>
        <p style={{ color: '#cbd5e1' }}>Base quantity uses golfer count. Additional quantity handles extras like staff, volunteers, raffle inventory, or upgrades.</p>
        {error && <div className="alert">{error}</div>}
        <div className="grid">
          <label className="field">
            <span>Category</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {['Swag', 'Catering', 'Signage', 'Prizes', 'Insurance', 'Awards'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <RequirementPreview label="Base quantity" qty={event.golfer_count} />
          <Field label="Additional Quantity" type="number" value={extraQty} onChange={setExtraQty} />
          <label className="field">
            <span>Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Example: lunch for golfers + 15 volunteers, branded coolers, 10 gift cards, etc." />
          </label>
          <Button onClick={addRequest} disabled={saving}>{saving ? 'Saving...' : 'Add Request'} <Icon name="plus" /></Button>
        </div>
      </Card>
      <Card>
        <h2 style={{ marginTop: 0 }}>Current Requests</h2>
        <div className="grid">
          {requests.map((request) => (
            <div key={request.id} className="card" style={{ padding: 16 }}>
              <div className="row">
                <div>
                  <Badge tone="dark">{request.request_type}</Badge>
                  <p style={{ margin: '12px 0 0', fontWeight: 950 }}>{request.title}</p>
                </div>
                <p style={{ color: '#fee2e2', fontWeight: 950 }}>Total {Number(request.base_quantity || 0) + Number(request.additional_quantity || 0)}</p>
              </div>
              <p style={{ color: '#cbd5e1', fontSize: 14 }}>Base {request.base_quantity} + Extra {request.additional_quantity}</p>
              <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>{request.notes}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function VolunteersTab({ volunteers }) {
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Volunteer Signups</h2>
      <div className="grid grid-2">
        {volunteers.map((volunteer) => (
          <div key={volunteer.id} className="card" style={{ padding: 16 }}>
            <div className="row">
              <p style={{ margin: 0, fontWeight: 950 }}>{volunteer.name}</p>
              <Badge tone="dark">{volunteer.status}</Badge>
            </div>
            <p style={{ color: '#cbd5e1' }}>{volunteer.assigned_role || volunteer.preferred_role || 'Unassigned'}</p>
            <p style={{ color: '#94a3b8', fontSize: 12 }}>Availability: {volunteer.availability || 'Not specified'}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlaceholderTab({ icon, title, text }) {
  return (
    <Card style={{ textAlign: 'center' }}>
      <div style={{ margin: '0 auto', display: 'flex', width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 24, background: 'rgba(239,68,68,0.18)', color: '#fee2e2' }}>
        <Icon name={icon} />
      </div>
      <h2 style={{ fontSize: 34, fontWeight: 950 }}>{title}</h2>
      <p style={{ margin: '0 auto', maxWidth: 700, color: '#cbd5e1' }}>{text}</p>
    </Card>
  );
}

function MediaPage() {
  return (
    <div>
      <Badge>Media & Advertising</Badge>
      <h1 className="h2">Advertising options beyond the event.</h1>
      <p className="lead">This page is structured to support digital TV ads, on-course placements, on-property ads, and event-based exposure. Details can be loaded later.</p>
      <div className="grid grid-2" style={{ marginTop: 32 }}>
        {mediaOptions.map((option) => (
          <Card key={option.title}>
            <Badge>{option.category}</Badge>
            <h2 style={{ fontSize: 28, fontWeight: 950 }}>{option.title}</h2>
            <p style={{ color: '#cbd5e1', lineHeight: 1.7 }}>{option.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div>
      <Badge>Integration Roadmap</Badge>
      <h1 className="h2">Phase 1 is frontend-first.</h1>
      <div className="grid grid-2" style={{ marginTop: 32 }}>
        <Feature icon="calendar" title="Google Calendar" text="Show availability, submit event requests, and create reviewable calendar holds after approval." />
        <Feature icon="upload" title="Google Drive Uploads" text="Create folders by event and sponsor for logos, ads, signage files, contracts, and documents." />
        <Feature icon="dollar" title="Stripe Payments" text="Collect deposits, sponsorship purchases, balances, and advertising payments." />
        <Feature icon="mail" title="Communication Center" text="Email sponsors, golfers, volunteers, vendors, and generate flyers or promotional copy." />
      </div>
    </div>
  );
}

export default function ElevatedImpactPhaseOneFrontend() {
  const [page, setPage] = useState('home');
  const data = useEventSystemData();

  useMemo(() => {
    console.assert(fallbackEvents.length >= 1, 'Preview needs at least one fallback event.');
    console.assert(mediaOptions.length >= 4, 'Media page should include the main four advertising categories.');
  }, []);

  return (
    <Shell page={page} setPage={setPage}>
      {data.error && <div className="alert">{data.error}</div>}
      {data.loading && <div className="loading">Loading platform data...</div>}

      {page === 'home' && <HomePage setPage={setPage} data={data} />}
      {page === 'builder' && <EventBuilder createEvent={data.createEvent} setPage={setPage} isSupabaseConfigured={data.isSupabaseConfigured} />}
      {page === 'dashboard' && <EventDashboard data={data} />}
      {page === 'media' && <MediaPage />}
      {page === 'settings' && <SettingsPage />}
    </Shell>
  );
}

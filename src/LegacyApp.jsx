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

const DEFAULT_EVENT_GOLFER_FIELDS = [
  { field_key: 'first_name', label: 'First Name' },
  { field_key: 'last_name', label: 'Last Name' },
  { field_key: 'email', label: 'Email' },
  { field_key: 'phone', label: 'Phone' },
  { field_key: 'gender', label: 'Male or Female' },
  { field_key: 'date_of_birth', label: 'Date of Birth' },
  { field_key: 'ghin_number', label: 'GHIN Number' },
  { field_key: 'handicap_index', label: 'Handicap Index' },
  { field_key: 'tee', label: 'Tee' },
];

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function statusLabel(status) {
  const labels = {
    draft: 'Draft',
    pending_review: 'Pending Review — Waiting for Date Approval',
    date_change_requested: 'Date Change Requested',
    approved: 'Date Approved',
    published: 'Published',
    completed: 'Completed',
    demo_mode: 'Demo Mode',
  };
  return labels[status] || status || 'Draft';
}

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function sourceLabel(source) {
  const labels = {
    direct: 'Direct',
    sponsorship: 'Sponsor Included',
    comp: 'Comp',
    admin: 'Admin / Manual',
  };
  return labels[source] || source || 'Direct';
}

function EventBuilder({
  createEvent,
  updateEvent,
  existingEvent,
  setPage,
  clearEditingEvent,
  isSupabaseConfigured,
}) {
  const [form, setForm] = useState({
    name: existingEvent?.name || '',
    eventType: existingEvent?.event_type || 'Golf Outing',
    date: existingEvent?.event_date || '',
    startTime: existingEvent?.start_time || '',
    location: existingEvent?.location || '',
    golferCount: existingEvent?.golfer_count ?? 120,
    revenueGoal: existingEvent?.revenue_goal ?? 20000,
    organizerName: existingEvent?.organizer_name || '',
    organizerEmail: existingEvent?.organizer_email || '',
    organizerPhone: existingEvent?.organizer_phone || '',
    notes: existingEvent?.notes || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateForReview() {
    const required = [
      ['Event name', form.name],
      ['Requested date', form.date],
      ['Location / course', form.location],
      ['Organizer name', form.organizerName],
      ['Organizer email', form.organizerEmail],
    ];

    const missing = required.filter(([, value]) => !String(value || '').trim());
    if (missing.length) {
      throw new Error(`Complete the basic information before review: ${missing.map(([label]) => label).join(', ')}.`);
    }
  }

  async function save(status) {
    setSaving(true);
    setError('');

    try {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured yet.');
      if (!form.name.trim()) throw new Error('Event name is required to save a draft.');
      if (status === 'pending_review') validateForReview();

      const year = form.date ? new Date(`${form.date}T12:00:00`).getFullYear() : '';
      const slug = slugify(`${form.name}${year ? `-${year}` : ''}`);

      const payload = {
        name: form.name.trim(),
        event_type: form.eventType || 'Golf Outing',
        event_date: form.date || null,
        start_time: form.startTime || null,
        location: form.location || null,
        golfer_count: Number(form.golferCount) || 0,
        max_golfers: Number(form.golferCount) || 0,
        revenue_goal: Number(form.revenueGoal) || 0,
        organizer_name: form.organizerName || null,
        organizer_email: form.organizerEmail || null,
        organizer_phone: form.organizerPhone || null,
        notes: form.notes || null,
        slug,
        status,
        registration_status: 'closed',
        is_published: false,
      };

      if (existingEvent) {
        await updateEvent(existingEvent.id, payload);
      } else {
        await createEvent(payload);
      }

      clearEditingEvent();
      setPage('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event.');
    } finally {
      setSaving(false);
    }
  }

  const currentStatus = existingEvent?.status || 'draft';
  const canSubmitForReview = ['draft', 'date_change_requested'].includes(currentStatus);

  return (
    <div>
      <Badge>{existingEvent ? statusLabel(currentStatus) : 'New Event Draft'}</Badge>
      <h1 className="h2">{existingEvent ? 'Continue basic event setup.' : 'Start the event request.'}</h1>
      <p className="lead">
        Complete the basic event information first. Registration, sponsorships, and advanced setup stay locked until the requested date is approved.
      </p>

      {error && <div className="alert">{error}</div>}

      <div className="grid grid-2">
        <Card>
          <div className="grid grid-2">
            <Field label="Event Name" value={form.name} onChange={(v) => update('name', v)} placeholder="Charity Golf Outing" />
            <Field label="Event Type" value={form.eventType} onChange={(v) => update('eventType', v)} placeholder="Golf Outing" />
            <Field label="Requested Date" type="date" value={form.date} onChange={(v) => update('date', v)} />
            <Field label="Preferred Start Time" type="time" value={form.startTime} onChange={(v) => update('startTime', v)} />
            <Field label="Location / Course" value={form.location} onChange={(v) => update('location', v)} placeholder="Primary Golf Course" />
            <Field label="Expected Golfers" type="number" value={form.golferCount} onChange={(v) => update('golferCount', v)} />
            <Field label="Revenue Goal" type="number" value={form.revenueGoal} onChange={(v) => update('revenueGoal', v)} />
          </div>

          <h3 style={{ marginTop: 28 }}>Organizer contact</h3>
          <div className="grid">
            <Field label="Organizer Name" value={form.organizerName} onChange={(v) => update('organizerName', v)} />
            <Field label="Organizer Email" type="email" value={form.organizerEmail} onChange={(v) => update('organizerEmail', v)} />
            <Field label="Organizer Phone" type="tel" value={form.organizerPhone} onChange={(v) => update('organizerPhone', v)} />
          </div>

          <label className="field" style={{ display: 'block', marginTop: 20 }}>
            <span>Basic Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Anything EIG should know while reviewing the requested date."
            />
          </label>

          <div className="actions">
            <Button
              variant="secondary"
              onClick={() => save(currentStatus === 'pending_review' ? 'pending_review' : 'draft')}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>

            {canSubmitForReview && (
              <Button onClick={() => save('pending_review')} disabled={saving}>
                Submit Date for Review <Icon name="chevron" />
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Approval gate</h2>
          <p style={{ color: '#cbd5e1', lineHeight: 1.7 }}>
            We intentionally stop here until EIG confirms the requested date and course availability.
          </p>

          <div className="grid">
            <div className="card" style={{ padding: 16 }}>
              <Badge tone="dark">1. Draft</Badge>
              <p style={{ marginBottom: 0, color: '#cbd5e1' }}>Enter the basic event information.</p>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <Badge tone="dark">2. Pending Review</Badge>
              <p style={{ marginBottom: 0, color: '#cbd5e1' }}>EIG checks date and course availability.</p>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <Badge tone="dark">3. Approved</Badge>
              <p style={{ marginBottom: 0, color: '#cbd5e1' }}>Registration and sponsorship setup unlock.</p>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <Badge tone="dark">4. Published</Badge>
              <p style={{ marginBottom: 0, color: '#cbd5e1' }}>The event hub can go public after setup is complete.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RegistrationFieldRow({ field, onChange }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row">
        <div>
          <p style={{ margin: 0, fontWeight: 950 }}>{field.label}</p>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 12 }}>
            {field.is_system_field ? 'Standard golfer field' : 'Custom field'}
          </p>
        </div>
        <select
          className="select"
          style={{ maxWidth: 170 }}
          value={field.requirement_status}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="required">Required</option>
          <option value="optional">Optional</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
    </div>
  );
}

function RegistrationOptionsBuilder({ event, data }) {
  const eventTypes = data.registrationTypes.filter((type) => type.event_id === event.id);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('team');
  const [teamSize, setTeamSize] = useState(4);
  const [price, setPrice] = useState('');
  const [quantityAvailable, setQuantityAvailable] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function addType(payload) {
    await data.createRegistrationType({
      event_id: event.id,
      name: payload.name,
      description: payload.description || null,
      registration_kind: payload.registration_kind,
      team_size: payload.team_size,
      price: Number(payload.price) || 0,
      quantity_available:
        payload.quantity_available === '' || payload.quantity_available == null
          ? null
          : Number(payload.quantity_available),
      status: 'active',
      sort_order: payload.sort_order ?? eventTypes.length * 10 + 10,
    });
  }

  async function addDefaults() {
    setSaving(true);
    setMessage('');
    try {
      const names = new Set(eventTypes.map((type) => String(type.name || '').toLowerCase()));
      if (!names.has('individual golfer')) {
        await addType({
          name: 'Individual Golfer',
          description: 'One golfer registration.',
          registration_kind: 'individual',
          team_size: 1,
          price: 0,
          quantity_available: '',
          sort_order: 10,
        });
      }
      if (!names.has('foursome')) {
        await addType({
          name: 'Foursome',
          description: 'One team of four golfers.',
          registration_kind: 'team',
          team_size: 4,
          price: 0,
          quantity_available: '',
          sort_order: 20,
        });
      }
      setMessage('Default registration options are ready. Set the prices before opening registration.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create default registration options.');
    } finally {
      setSaving(false);
    }
  }

  async function addCustomType() {
    if (!name.trim()) {
      setMessage('Enter a registration option name.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await addType({
        name: name.trim(),
        description: description.trim(),
        registration_kind: kind,
        team_size: kind === 'individual' ? 1 : Math.max(1, Number(teamSize) || 4),
        price,
        quantity_available: quantityAvailable,
      });
      setName('');
      setKind('team');
      setTeamSize(4);
      setPrice('');
      setQuantityAvailable('');
      setDescription('');
      setMessage('Registration option added.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to add registration option.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ marginTop: 24 }}>
      <div className="row" style={{ alignItems: 'start', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Registration options</h2>
          <p style={{ color: '#cbd5e1', marginBottom: 0 }}>
            These are the choices a golfer or team will eventually see on the public registration page.
          </p>
        </div>
        <Button onClick={addDefaults} disabled={saving}>Add Individual + Foursome Defaults</Button>
      </div>

      {message && <div className="alert">{message}</div>}

      {eventTypes.length > 0 ? (
        <div className="grid grid-2" style={{ marginBottom: 24 }}>
          {eventTypes.map((type) => (
            <div key={type.id} className="card" style={{ padding: 16 }}>
              <div className="row" style={{ alignItems: 'start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 950 }}>{type.name}</p>
                  <p style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: 12 }}>
                    {type.registration_kind === 'individual' ? 'Individual' : `Team of ${type.team_size}`}
                  </p>
                </div>
                <Badge tone="dark">{type.status}</Badge>
              </div>
              <p style={{ fontSize: 26, fontWeight: 950, margin: '16px 0 8px' }}>{money(type.price)}</p>
              <p style={{ color: '#cbd5e1', fontSize: 14, minHeight: 40 }}>{type.description || 'No description yet.'}</p>
              <p style={{ color: '#94a3b8', fontSize: 12 }}>
                Capacity: {type.quantity_available == null ? 'Unlimited / event cap' : type.quantity_available}
              </p>
              <div className="actions">
                <Button
                  variant="secondary"
                  onClick={() => data.updateRow('registration_types', type.id, { status: type.status === 'active' ? 'inactive' : 'active' })}
                >
                  {type.status === 'active' ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 16, color: '#94a3b8', marginBottom: 24 }}>
          No registration options yet. Start with Individual Golfer and Foursome, then add any special categories you need.
        </div>
      )}

      <h3 style={{ marginTop: 0 }}>Add another registration option</h3>
      <div className="grid grid-2">
        <Field label="Option Name" value={name} onChange={setName} placeholder="Example: Senior Foursome" />
        <label className="field">
          <span>Registration Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="team">Team</option>
            <option value="individual">Individual</option>
          </select>
        </label>
        {kind === 'team' && <Field label="Golfers Per Team" type="number" value={teamSize} onChange={setTeamSize} />}
        <Field label="Price" type="number" value={price} onChange={setPrice} placeholder="0" />
        <Field label="Quantity Available" type="number" value={quantityAvailable} onChange={setQuantityAvailable} placeholder="Leave blank for event capacity" />
        <label className="field">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is included with this registration?" />
        </label>
      </div>
      <div className="actions">
        <Button onClick={addCustomType} disabled={saving}><Icon name="plus" /> Add Registration Option</Button>
      </div>
    </Card>
  );
}

function EventSetup({ event, data, setPage }) {
  const eventFields = data.registrationFields.filter((field) => field.event_id === event.id);
  const [registrationDeadline, setRegistrationDeadline] = useState(
    event.registration_deadline ? String(event.registration_deadline).slice(0, 16) : ''
  );
  const [registrationStatus, setRegistrationStatus] = useState(event.registration_status || 'closed');
  const [maxGolfers, setMaxGolfers] = useState(event.max_golfers ?? event.golfer_count ?? 0);
  const [description, setDescription] = useState(event.description || '');
  const [customLabel, setCustomLabel] = useState('');
  const [customType, setCustomType] = useState('short_text');
  const [customRequirement, setCustomRequirement] = useState('optional');
  const [customAppliesTo, setCustomAppliesTo] = useState('golfer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function ensureFields() {
    setSaving(true);
    setError('');
    try {
      await data.ensureDefaultRegistrationFields(event.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize registration fields.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setError('');
    try {
      await data.updateEvent(event.id, {
        registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
        registration_status: registrationStatus,
        max_golfers: Number(maxGolfers) || 0,
        description: description || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event setup.');
    } finally {
      setSaving(false);
    }
  }

  async function updateField(fieldId, requirementStatus) {
    try {
      await data.updateRow('event_registration_fields', fieldId, {
        requirement_status: requirementStatus,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update field.');
    }
  }

  async function addCustomField() {
    if (!customLabel.trim()) {
      setError('Enter a label for the custom field.');
      return;
    }

    try {
      setError('');
      const key = `custom_${slugify(customLabel).replace(/-/g, '_')}_${Date.now()}`;
      await data.createRegistrationField({
        event_id: event.id,
        field_key: key,
        label: customLabel.trim(),
        field_type: customType,
        applies_to: customAppliesTo,
        requirement_status: customRequirement,
        include_in_internal_export: true,
        include_in_golf_genius_export: false,
        sort_order: 500 + eventFields.length * 10,
      });
      setCustomLabel('');
      setCustomType('short_text');
      setCustomRequirement('optional');
      setCustomAppliesTo('golfer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add custom field.');
    }
  }

  if (!['approved', 'published', 'completed'].includes(event.status)) {
    return (
      <Card>
        <Badge>{statusLabel(event.status)}</Badge>
        <h2>Advanced setup is locked.</h2>
        <p style={{ color: '#cbd5e1' }}>
          The requested date must be approved before registration and sponsorship setup can continue.
        </p>
        <Button variant="secondary" onClick={() => setPage('dashboard')}>Back to Dashboard</Button>
      </Card>
    );
  }

  return (
    <div>
      <Badge>{statusLabel(event.status)}</Badge>
      <h1 className="h2">Continue Event Setup</h1>
      <p className="lead">{event.name} is approved. Registration and advanced setup are now unlocked.</p>

      {error && <div className="alert">{error}</div>}

      <div className="grid grid-2">
        <Card>
          <h2 style={{ marginTop: 0 }}>Registration settings</h2>
          <div className="grid">
            <Field label="Maximum Golfers" type="number" value={maxGolfers} onChange={setMaxGolfers} />
            <Field label="Registration Deadline" type="datetime-local" value={registrationDeadline} onChange={setRegistrationDeadline} />

            <label className="field">
              <span>Registration Status</span>
              <select value={registrationStatus} onChange={(e) => setRegistrationStatus(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
                <option value="open">Open</option>
                <option value="waitlist">Waitlist</option>
              </select>
            </label>

            <label className="field">
              <span>Public Event Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>

            <Button onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Registration Settings'}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Event hub status</h2>
          <div className="grid">
            <RequirementPreview label="Expected golfers" qty={event.golfer_count} />
            <RequirementPreview label="Maximum golfers" qty={maxGolfers} />
            <RequirementPreview label="Estimated foursomes" qty={Math.ceil(Number(maxGolfers || 0) / 4)} />
          </div>
          <div className="card" style={{ marginTop: 16, padding: 16 }}>
            <p className="metric-label">Future Public URL</p>
            <p style={{ marginBottom: 0, fontWeight: 900 }}>/events/{event.slug || slugify(event.name)}</p>
          </div>
        </Card>
      </div>

      <RegistrationOptionsBuilder event={event} data={data} />

      <Card style={{ marginTop: 24 }}>
        <div className="row" style={{ alignItems: 'start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0 }}>Golfer information requirements</h2>
            <p style={{ color: '#cbd5e1', marginBottom: 0 }}>
              These fields will drive the event registration form.
            </p>
          </div>
          {eventFields.length === 0 && (
            <Button onClick={ensureFields} disabled={saving}>Initialize Registration Setup</Button>
          )}
        </div>

        {eventFields.length === 0 ? (
          <div className="card" style={{ padding: 16, color: '#94a3b8' }}>
            This event was created before registration fields existed. Click Initialize Registration Setup to add the defaults.
          </div>
        ) : (
          <div className="grid grid-2">
            {eventFields.map((field) => (
              <RegistrationFieldRow
                key={field.id}
                field={field}
                onChange={(status) => updateField(field.id, status)}
              />
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Add a custom registration field</h2>
        <div className="grid grid-2">
          <Field label="Field Label" value={customLabel} onChange={setCustomLabel} placeholder="Example: Meal Choice" />

          <label className="field">
            <span>Field Type</span>
            <select value={customType} onChange={(e) => setCustomType(e.target.value)}>
              <option value="short_text">Short Text</option>
              <option value="long_text">Long Text</option>
              <option value="number">Number</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="date">Date</option>
              <option value="yes_no">Yes / No</option>
              <option value="single_select">Dropdown</option>
              <option value="multi_select">Multiple Choice</option>
            </select>
          </label>

          <label className="field">
            <span>Applies To</span>
            <select value={customAppliesTo} onChange={(e) => setCustomAppliesTo(e.target.value)}>
              <option value="golfer">Each Golfer</option>
              <option value="team">Team</option>
              <option value="captain">Team Captain</option>
            </select>
          </label>

          <label className="field">
            <span>Requirement</span>
            <select value={customRequirement} onChange={(e) => setCustomRequirement(e.target.value)}>
              <option value="required">Required</option>
              <option value="optional">Optional</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
        </div>

        <div className="actions">
          <Button onClick={addCustomField}><Icon name="plus" /> Add Custom Field</Button>
        </div>
      </Card>
    </div>
  );
}

function EventDashboard({ data, editEvent, openSetup }) {
  const [tab, setTab] = useState('overview');
  const [actionError, setActionError] = useState('');
  const [working, setWorking] = useState(false);

  const events = data.events.length ? data.events : fallbackEvents;
  const products = data.products.length ? data.products : fallbackProducts;
  const sponsors = data.sponsors.length ? data.sponsors : fallbackSponsors;
  const purchases = data.purchases.length ? data.purchases : fallbackPurchases;
  const volunteers = data.volunteers.length ? data.volunteers : fallbackVolunteers;
  const requests = data.requests.length ? data.requests : fallbackRequests;
  const selectedEventId = data.selectedEventId || events[0]?.id;
  const event = events.find((e) => e.id === selectedEventId) || events[0];

  if (!event) {
    return <Card><h2>No events yet</h2><p>Create your first event from Build Event.</p></Card>;
  }

  const eventProducts = products.filter((p) => p.event_id === event.id);
  const eventSponsors = sponsors.filter((s) => s.event_id === event.id);
  const eventPurchases = purchases.filter((p) => p.event_id === event.id);
  const eventVolunteers = volunteers.filter((v) => v.event_id === event.id);
  const eventRequests = requests.filter((r) => r.event_id === event.id);
  const eventRegistrationTypes = data.registrationTypes.filter((type) => type.event_id === event.id);
  const eventTeamRegistrations = data.teamRegistrations.filter((team) => team.event_id === event.id);
  const eventGolfers = data.golfers.filter((golfer) => golfer.event_id === event.id);

  const revenue = eventPurchases.reduce(
    (sum, purchase) => purchase.payment_status === 'paid' ? sum + Number(purchase.amount || 0) : sum,
    0
  );
  const revenuePct = event.revenue_goal ? Math.round((revenue / event.revenue_goal) * 100) : 0;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'chart' },
    { key: 'registrations', label: 'Registrations', icon: 'people' },
    { key: 'sponsorships', label: 'Sponsorships', icon: 'dollar' },
    { key: 'needs', label: 'Event Needs', icon: 'gift' },
    { key: 'volunteers', label: 'Volunteers', icon: 'people' },
    { key: 'uploads', label: 'Uploads', icon: 'upload' },
    { key: 'comms', label: 'Communications', icon: 'mail' },
  ];

  async function approveDate() {
    setWorking(true);
    setActionError('');
    try {
      await data.updateEvent(event.id, { status: 'approved' });
      await data.ensureDefaultRegistrationFields(event.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to approve event date.');
    } finally {
      setWorking(false);
    }
  }

  async function requestDateChange() {
    setWorking(true);
    setActionError('');
    try {
      await data.updateEvent(event.id, { status: 'date_change_requested' });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to request a date change.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      {actionError && <div className="alert">{actionError}</div>}

      <div className="row" style={{ alignItems: 'end', marginBottom: 24 }}>
        <div>
          <Badge>{statusLabel(event.status)}</Badge>
          <h1 className="h2">{event.name}</h1>
          <p style={{ color: '#cbd5e1' }}>
            {event.event_date || 'Date pending'} • {event.location || 'Location pending'} • {event.golfer_count || 0} golfers
          </p>
        </div>
        <select value={event.id} onChange={(e) => data.setSelectedEventId(e.target.value)} className="select" style={{ maxWidth: 320 }}>
          {events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <div className="row" style={{ alignItems: 'start', flexWrap: 'wrap' }}>
          <div>
            <p className="metric-label">Event Workflow</p>
            <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 950 }}>{statusLabel(event.status)}</p>
          </div>

          <div className="actions" style={{ marginTop: 0 }}>
            {['draft', 'date_change_requested'].includes(event.status) && (
              <Button onClick={() => editEvent(event)}>Continue Basic Info</Button>
            )}

            {event.status === 'pending_review' && (
              <>
                <Button variant="secondary" onClick={() => editEvent(event)}>Edit Basic Info</Button>
                <Button onClick={approveDate} disabled={working}>{working ? 'Working...' : 'Approve Event Date'}</Button>
                <Button variant="secondary" onClick={requestDateChange} disabled={working}>Request Date Change</Button>
              </>
            )}

            {['approved', 'published', 'completed'].includes(event.status) && (
              <Button onClick={() => openSetup(event)}>Continue Event Setup</Button>
            )}
          </div>
        </div>

        {event.status === 'pending_review' && (
          <p style={{ color: '#cbd5e1', marginBottom: 0 }}>
            Registration and sponsorship setup remain locked until the requested date is approved.
          </p>
        )}

        {event.status === 'date_change_requested' && (
          <p style={{ color: '#cbd5e1', marginBottom: 0 }}>
            Update the requested date or course information, then resubmit the event for review.
          </p>
        )}
      </Card>

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
      {tab === 'registrations' && (
        <RegistrationsTab
          event={event}
          registrationTypes={eventRegistrationTypes}
          teams={eventTeamRegistrations}
          golfers={eventGolfers}
          purchases={eventPurchases}
          sponsors={eventSponsors}
          data={data}
          openSetup={() => openSetup(event)}
        />
      )}
      {tab === 'sponsorships' && <SponsorshipsTab products={eventProducts} sponsors={eventSponsors} purchases={eventPurchases} />}
      {tab === 'needs' && <NeedsTab event={event} requests={eventRequests} createEventRequest={data.createEventRequest} isSupabaseConfigured={data.isSupabaseConfigured} />}
      {tab === 'volunteers' && <VolunteersTab volunteers={eventVolunteers} />}
      {tab === 'uploads' && <PlaceholderTab icon="upload" title="Uploads + Google Drive" text="Sponsor logos, ad assets, signage files, and event documents will route into organized Google Drive folders in a later integration." />}
      {tab === 'comms' && <PlaceholderTab icon="mail" title="Event Communication Center" text="Email sponsors, golfers, volunteers, vendors, and generate flyer/promo templates. This is structured now and built out later." />}
    </div>
  );
}

function RegistrationsTab({ event, registrationTypes, teams, golfers, purchases, sponsors, data, openSetup }) {
  const activeTypes = registrationTypes.filter((type) => type.status === 'active');
  const eligibleSponsorPurchases = purchases.filter((purchase) => Number(purchase.included_team_count || 0) > 0);
  const incompleteTeams = teams.filter((team) => team.roster_status !== 'complete').length;
  const capacity = Number(event.max_golfers || event.golfer_count || 0);
  const remaining = capacity > 0 ? Math.max(0, capacity - golfers.filter((g) => g.status !== 'cancelled').length) : null;

  const [source, setSource] = useState('direct');
  const [registrationTypeId, setRegistrationTypeId] = useState(activeTypes[0]?.id || '');
  const [teamName, setTeamName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [captainEmail, setCaptainEmail] = useState('');
  const [captainPhone, setCaptainPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [amountCharged, setAmountCharged] = useState('');
  const [sponsorPurchaseId, setSponsorPurchaseId] = useState('');
  const [compReason, setCompReason] = useState('');
  const [compApprovedBy, setCompApprovedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedType = registrationTypes.find((type) => type.id === registrationTypeId);

  function sponsorPurchaseLabel(purchase) {
    const sponsor = sponsors.find((item) => item.id === purchase.sponsor_id);
    const used = teams.filter((team) => team.sponsor_purchase_id === purchase.id).length;
    const allowed = Number(purchase.included_team_count || 0);
    return `${sponsor?.business_name || 'Sponsor'} — ${purchase.product_name || 'Sponsorship'} (${Math.max(0, allowed - used)} of ${allowed} teams remaining)`;
  }

  async function addManualRegistration() {
    if (!registrationTypeId) {
      setMessage('Create and select a registration option first.');
      return;
    }
    if (!captainName.trim()) {
      setMessage(selectedType?.registration_kind === 'individual' ? 'Enter the golfer name.' : 'Enter the team captain name.');
      return;
    }
    if (source === 'comp' && (!compReason.trim() || !compApprovedBy.trim())) {
      setMessage('Comp teams require both a comp reason and who approved it.');
      return;
    }
    if (source === 'sponsorship' && !sponsorPurchaseId) {
      setMessage('Choose the sponsorship purchase that includes this team.');
      return;
    }

    setSaving(true);
    setMessage('');
    const payload = {
      event_id: event.id,
      registration_type_id: registrationTypeId,
      team_name: selectedType?.registration_kind === 'individual' ? captainName.trim() : (teamName.trim() || null),
      captain_name: captainName.trim(),
      captain_email: captainEmail.trim() || null,
      captain_phone: captainPhone.trim() || null,
      registered_golfer_count: 0,
      roster_status: 'empty',
      notes: notes.trim() || null,
    };

    try {
      if (source === 'comp') {
        await data.createCompTeam({
          ...payload,
          comp_reason: compReason.trim(),
          comp_approved_by: compApprovedBy.trim(),
        });
      } else if (source === 'sponsorship') {
        await data.createSponsorIncludedTeam({
          ...payload,
          sponsor_purchase_id: sponsorPurchaseId,
        });
      } else {
        await data.createTeamRegistration({
          ...payload,
          registration_source: source,
          payment_status: paymentStatus,
          amount_charged: Number(amountCharged) || 0,
        });
      }

      setTeamName('');
      setCaptainName('');
      setCaptainEmail('');
      setCaptainPhone('');
      setPaymentStatus('pending');
      setAmountCharged('');
      setSponsorPurchaseId('');
      setCompReason('');
      setCompApprovedBy('');
      setNotes('');
      setMessage('Registration added. Add golfers to the roster in the next registration-form step.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to add registration.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid">
      <div className="grid grid-4">
        <Metric label="Registration Options" value={registrationTypes.length} sub={`${activeTypes.length} active`} />
        <Metric label="Teams / Entries" value={teams.length} sub={`${incompleteTeams} incomplete rosters`} />
        <Metric label="Golfers" value={golfers.filter((g) => g.status !== 'cancelled').length} sub={remaining == null ? 'no event cap' : `${remaining} spots remaining`} />
        <Metric label="Sponsor Teams" value={teams.filter((team) => team.registration_source === 'sponsorship').length} sub="included with sponsorships" />
      </div>

      <div className="grid grid-2">
        <Card>
          <div className="row" style={{ alignItems: 'start', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0 }}>Registration options</h2>
              <p style={{ color: '#cbd5e1', marginBottom: 0 }}>Prices and team sizes configured for this event.</p>
            </div>
            <Button variant="secondary" onClick={openSetup}>Edit Setup</Button>
          </div>
          <div className="grid">
            {registrationTypes.length ? registrationTypes.map((type) => (
              <div key={type.id} className="card" style={{ padding: 16 }}>
                <div className="row">
                  <div>
                    <p style={{ margin: 0, fontWeight: 950 }}>{type.name}</p>
                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 12 }}>
                      {type.registration_kind === 'individual' ? 'Individual golfer' : `Team of ${type.team_size}`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontWeight: 950 }}>{money(type.price)}</p>
                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 12 }}>{type.status}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="card" style={{ padding: 16, color: '#94a3b8' }}>No registration options yet.</div>
            )}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Add a registration manually</h2>
          <p style={{ color: '#cbd5e1' }}>
            Use this for phone registrations, admin-entered teams, true comps, or teams included with a sponsorship.
          </p>
          {message && <div className="alert">{message}</div>}

          <div className="grid">
            <label className="field">
              <span>Registration Source</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="direct">Direct Registration</option>
                <option value="admin">Admin / Manual</option>
                <option value="sponsorship">Included With Sponsorship</option>
                <option value="comp">Complimentary / Comp</option>
              </select>
            </label>

            <label className="field">
              <span>Registration Option</span>
              <select value={registrationTypeId} onChange={(e) => setRegistrationTypeId(e.target.value)}>
                <option value="">Select an option</option>
                {activeTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name} — {money(type.price)}</option>
                ))}
              </select>
            </label>

            {selectedType?.registration_kind !== 'individual' && (
              <Field label="Team Name" value={teamName} onChange={setTeamName} placeholder="Optional team name" />
            )}
            <Field label={selectedType?.registration_kind === 'individual' ? 'Golfer Name' : 'Captain Name'} value={captainName} onChange={setCaptainName} />
            <Field label="Email" type="email" value={captainEmail} onChange={setCaptainEmail} />
            <Field label="Phone" value={captainPhone} onChange={setCaptainPhone} />

            {['direct', 'admin'].includes(source) && (
              <>
                <label className="field">
                  <span>Payment Status</span>
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="invoiced">Invoiced</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </label>
                <Field label="Amount Charged" type="number" value={amountCharged} onChange={setAmountCharged} placeholder={String(selectedType?.price || 0)} />
              </>
            )}

            {source === 'sponsorship' && (
              <label className="field">
                <span>Sponsorship Purchase</span>
                <select value={sponsorPurchaseId} onChange={(e) => setSponsorPurchaseId(e.target.value)}>
                  <option value="">Select an eligible sponsorship</option>
                  {eligibleSponsorPurchases.map((purchase) => (
                    <option key={purchase.id} value={purchase.id}>{sponsorPurchaseLabel(purchase)}</option>
                  ))}
                </select>
                {eligibleSponsorPurchases.length === 0 && (
                  <small style={{ color: '#94a3b8' }}>No sponsor purchases currently include a team entitlement.</small>
                )}
              </label>
            )}

            {source === 'comp' && (
              <>
                <Field label="Comp Reason" value={compReason} onChange={setCompReason} placeholder="Required — why is this team complimentary?" />
                <Field label="Approved By" value={compApprovedBy} onChange={setCompApprovedBy} placeholder="Required approver name" />
              </>
            )}

            <label className="field">
              <span>Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <Button onClick={addManualRegistration} disabled={saving}>{saving ? 'Saving...' : 'Add Registration'}</Button>
          </div>
        </Card>
      </div>

      <Card>
        <h2 style={{ marginTop: 0 }}>Current registrations</h2>
        {teams.length === 0 ? (
          <div className="card" style={{ padding: 16, color: '#94a3b8' }}>No registrations have been added yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 850 }}>
              {teams.map((team) => {
                const type = registrationTypes.find((item) => item.id === team.registration_type_id);
                const sponsorPurchase = purchases.find((item) => item.id === team.sponsor_purchase_id);
                const sponsor = sponsors.find((item) => item.id === sponsorPurchase?.sponsor_id);
                return (
                  <div key={team.id} className="table-row" style={{ gridTemplateColumns: '1.4fr 1.2fr 1.1fr .8fr .9fr 1.1fr' }}>
                    <div>
                      <div style={{ fontWeight: 950 }}>{team.team_name || team.captain_name}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{team.captain_email || 'No email'}</div>
                    </div>
                    <div style={{ color: '#cbd5e1' }}>{type?.name || 'Registration'}</div>
                    <div style={{ color: '#cbd5e1' }}>{sourceLabel(team.registration_source)}</div>
                    <div style={{ color: '#cbd5e1' }}>{team.registered_golfer_count || 0}/{type?.team_size || 4}</div>
                    <div style={{ color: '#cbd5e1' }}>{team.roster_status}</div>
                    <div>
                      <div style={{ color: '#cbd5e1' }}>{team.payment_status}</div>
                      {sponsor && <div style={{ color: '#94a3b8', fontSize: 12 }}>{sponsor.business_name}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
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
  const [editingEventId, setEditingEventId] = useState('');
  const [setupEventId, setSetupEventId] = useState('');
  const data = useEventSystemData();

  useMemo(() => {
    console.assert(fallbackEvents.length >= 1, 'Preview needs at least one fallback event.');
    console.assert(mediaOptions.length >= 4, 'Media page should include the main four advertising categories.');
  }, []);

  const editingEvent = data.events.find((event) => event.id === editingEventId) || null;
  const setupEvent = data.events.find((event) => event.id === setupEventId) || null;

  function editEvent(event) {
    setEditingEventId(event.id);
    setPage('builder');
  }

  function openSetup(event) {
    setSetupEventId(event.id);
    setPage('setup');
  }

  function clearEditingEvent() {
    setEditingEventId('');
  }

  return (
    <Shell
      page={page}
      setPage={(nextPage) => {
        if (nextPage !== 'builder') setEditingEventId('');
        setPage(nextPage);
      }}
    >
      {data.error && <div className="alert">{data.error}</div>}
      {data.loading && <div className="loading">Loading platform data...</div>}

      {page === 'home' && <HomePage setPage={setPage} data={data} />}

      {page === 'builder' && (
        <EventBuilder
          createEvent={data.createEvent}
          updateEvent={data.updateEvent}
          existingEvent={editingEvent}
          setPage={setPage}
          clearEditingEvent={clearEditingEvent}
          isSupabaseConfigured={data.isSupabaseConfigured}
        />
      )}

      {page === 'dashboard' && (
        <EventDashboard
          data={data}
          editEvent={editEvent}
          openSetup={openSetup}
        />
      )}

      {page === 'setup' && setupEvent && (
        <EventSetup event={setupEvent} data={data} setPage={setPage} />
      )}

      {page === 'setup' && !setupEvent && (
        <Card>
          <h2>No event selected.</h2>
          <Button onClick={() => setPage('dashboard')}>Return to Event Dashboard</Button>
        </Card>
      )}

      {page === 'media' && <MediaPage />}
      {page === 'settings' && <SettingsPage />}
    </Shell>
  );
}

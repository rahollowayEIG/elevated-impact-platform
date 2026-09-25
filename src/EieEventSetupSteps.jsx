import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

const STEP_ITEMS = [
  ['details', '1', 'Event Details'],
  ['registration', '2', 'Registration Details'],
  ['pricing', '3', 'Pricing & Add-ons'],
  ['roster', '4', 'Roster / ATC'],
  ['hub', '5', 'Event Info / Hub'],
];

function blankDivision() {
  return { name: '', eligibility: '', description: '' };
}

function blankCustomField() {
  return { id: '', label: '', type: 'text', required: false, options: [] };
}

function blankOffer(event) {
  return {
    id: null,
    name: '',
    description: '',
    offer_type: 'add_on',
    price: '',
    charge_by: event?.field_settings?.registration_format === 'team' ? 'team' : 'player',
    is_required: false,
    availability_start: '',
    availability_end: '',
    inventory_limit: '',
    quantity_max: '',
    coupon_eligible: true,
    metadata: { taxable: false },
    status: 'active',
    _removed: false,
  };
}

function eventStructure(settings = {}) {
  return settings.registration_format === 'individual' ? 'individual' : 'team';
}

function requiredHeaders(settings, customFields) {
  const headers = ['First Name', 'Last Name', 'Email', 'Phone'];
  [
    ['dob', 'Date of Birth'],
    ['gender', 'Gender'],
    ['division', 'Division'],
    ['membership', 'Club Membership Status'],
    ['ghin', 'GHIN'],
  ].forEach(([key, label]) => {
    if (settings[key] === 'required') headers.push(label);
  });
  customFields.filter((field) => field.required && field.label).forEach((field) => headers.push(field.label));
  return headers;
}

function downloadCsv(headers, fileName) {
  const csv = headers.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function EieEventSetupSteps({
  event,
  organization,
  activeStep,
  onStepChange,
  onEventUpdated,
  onReload,
}) {
  const initialSettings = event?.field_settings || {};
  const initialDivisionDetails = Array.isArray(initialSettings.division_details) && initialSettings.division_details.length
    ? initialSettings.division_details
    : (Array.isArray(event?.divisions) ? event.divisions : []).map((name) => ({ name, eligibility: '', description: '' }));

  const [details, setDetails] = useState({
    name: event?.name || '',
    course: event?.course || organization?.name || '',
    day1: Array.isArray(event?.event_dates) ? event.event_dates[0] || '' : '',
    day2: Array.isArray(event?.event_dates) ? event.event_dates[1] || '' : '',
    structure: eventStructure(initialSettings),
    divisions_enabled: typeof initialSettings.divisions_enabled === 'boolean'
      ? initialSettings.divisions_enabled
      : initialDivisionDetails.length > 0,
    flights_enabled: initialSettings.flights_enabled === true,
    tournament_format: initialSettings.tournament_format || '',
    format_description: initialSettings.format_description || '',
    player_information: initialSettings.player_information || '',
    division_details: initialDivisionDetails,
  });

  const [registration, setRegistration] = useState({
    member_price: event?.member_price ?? '',
    non_member_price: event?.non_member_price ?? '',
    team_size: initialSettings.team_size || 4,
    allow_team_name: initialSettings.allow_team_name !== false,
    allow_partial_team: initialSettings.allow_partial_team !== false,
    team_payment_mode: initialSettings.team_payment_mode || 'captain_all',
    registration_deadline: initialSettings.registration_deadline || '',
    registration_contact_name: initialSettings.registration_contact_name || '',
    registration_contact_email: initialSettings.registration_contact_email || '',
    registration_contact_phone: initialSettings.registration_contact_phone || '',
    dob: initialSettings.dob || 'optional',
    gender: initialSettings.gender || 'optional',
    division: initialSettings.division || (initialDivisionDetails.length ? 'optional' : 'hidden'),
    membership: initialSettings.membership || 'optional',
    ghin: initialSettings.ghin || 'optional',
    custom_fields: Array.isArray(initialSettings.custom_fields) ? initialSettings.custom_fields : [],
  });

  const [offers, setOffers] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [customDraft, setCustomDraft] = useState(blankCustomField);
  const [busy, setBusy] = useState(false);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadPricing() {
      const [{ data: offerRows, error: offerError }, { data: paymentRow, error: paymentError }] = await Promise.all([
        supabase
          .from('event_offers')
          .select('id,name,description,offer_type,price,charge_by,is_required,availability_start,availability_end,inventory_limit,quantity_max,coupon_eligible,metadata,status,sort_order')
          .eq('golf_event_id', event.id)
          .order('sort_order'),
        supabase
          .from('golf_event_payment_settings')
          .select('*')
          .eq('event_id', event.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (offerError || paymentError) {
        setNotice(offerError?.message || paymentError?.message || 'Unable to load pricing settings.');
        return;
      }
      setOffers((offerRows || []).map((row) => ({
        ...row,
        price: row.price ?? '',
        availability_start: row.availability_start || '',
        availability_end: row.availability_end || '',
        inventory_limit: row.inventory_limit ?? '',
        quantity_max: row.quantity_max ?? '',
        metadata: row.metadata || {},
        _removed: row.status !== 'active',
      })));
      setPaymentSettings(paymentRow || null);
      if (paymentRow?.team_payment_mode) {
        setRegistration((current) => ({ ...current, team_payment_mode: paymentRow.team_payment_mode }));
      }
    }
    if (event?.id) loadPricing();
    return () => { cancelled = true; };
  }, [event?.id]);

  const settingsPreview = useMemo(() => {
    const divisionSetting = details.divisions_enabled ? registration.division : 'hidden';
    return {
      ...event.field_settings,
      registration_format: details.structure,
      team_size: details.structure === 'team' ? Number(registration.team_size || 4) : 1,
      allow_team_name: details.structure === 'team' ? registration.allow_team_name : false,
      allow_partial_team: details.structure === 'team' ? registration.allow_partial_team : false,
      team_payment_mode: details.structure === 'team' ? registration.team_payment_mode : 'captain_all',
      divisions_enabled: details.divisions_enabled,
      flights_enabled: details.flights_enabled,
      division: divisionSetting,
      dob: registration.dob,
      gender: registration.gender,
      membership: registration.membership,
      ghin: registration.ghin,
      custom_fields: registration.custom_fields,
    };
  }, [details, event.field_settings, registration]);

  function setDetail(field, value) {
    setDetails((current) => ({ ...current, [field]: value }));
    setNotice('');
  }

  function setRegistrationField(field, value) {
    setRegistration((current) => ({ ...current, [field]: value }));
    setNotice('');
  }

  function changeStructure(nextStructure) {
    setDetails((current) => ({
      ...current,
      structure: nextStructure,
      divisions_enabled: nextStructure === 'team' ? false : (current.division_details.length > 0 || current.divisions_enabled),
      flights_enabled: nextStructure === 'team' ? false : current.flights_enabled,
    }));
    setRegistration((current) => ({
      ...current,
      team_size: nextStructure === 'team' ? Math.max(2, Number(current.team_size || 4)) : 1,
      allow_team_name: nextStructure === 'team',
      allow_partial_team: nextStructure === 'team',
      team_payment_mode: nextStructure === 'team' ? (current.team_payment_mode || 'captain_all') : 'captain_all',
      division: nextStructure === 'team' ? 'hidden' : current.division === 'hidden' && details.division_details.length ? 'optional' : current.division,
    }));
    setNotice('');
  }

  function updateDivision(index, field, value) {
    setDetails((current) => ({
      ...current,
      division_details: current.division_details.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  }

  function addDivision() {
    setDetails((current) => ({ ...current, divisions_enabled: true, division_details: [...current.division_details, blankDivision()] }));
    setRegistration((current) => ({ ...current, division: current.division === 'hidden' ? 'optional' : current.division }));
  }

  function removeDivision(index) {
    setDetails((current) => {
      const next = current.division_details.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, division_details: next, divisions_enabled: next.length ? current.divisions_enabled : false };
    });
  }

  function addCustomField() {
    if (!customDraft.label.trim()) {
      setNotice('Enter a custom question label first.');
      return;
    }
    const base = customDraft.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `field_${Date.now()}`;
    const used = new Set(registration.custom_fields.map((field) => field.id));
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}_${suffix++}`;
    setRegistration((current) => ({
      ...current,
      custom_fields: [...current.custom_fields, {
        ...customDraft,
        id,
        label: customDraft.label.trim(),
        options: customDraft.type === 'select'
          ? (Array.isArray(customDraft.options) ? customDraft.options : String(customDraft.options || '').split(',')).map((value) => String(value).trim()).filter(Boolean)
          : [],
      }],
    }));
    setCustomDraft(blankCustomField());
    setNotice('');
  }

  function removeCustomField(index) {
    setRegistration((current) => ({ ...current, custom_fields: current.custom_fields.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function saveEventDetails(next = false) {
    setBusy(true);
    setNotice('');
    try {
      const divisionDetails = details.division_details
        .map((item) => ({ name: item.name.trim(), eligibility: item.eligibility.trim(), description: item.description.trim() }))
        .filter((item) => item.name);
      if (details.divisions_enabled && !divisionDetails.length) throw new Error('Add at least one division or turn divisions off.');
      if (!details.name.trim()) throw new Error('Event name is required.');
      if (!details.day1) throw new Error('Event date is required.');

      const nextSettings = {
        ...(event.field_settings || {}),
        registration_format: details.structure,
        team_size: details.structure === 'team' ? Math.max(2, Math.min(12, Number(registration.team_size || 4))) : 1,
        allow_team_name: details.structure === 'team' ? registration.allow_team_name : false,
        allow_partial_team: details.structure === 'team' ? registration.allow_partial_team : false,
        team_payment_mode: details.structure === 'team' ? registration.team_payment_mode : 'captain_all',
        divisions_enabled: details.divisions_enabled,
        flights_enabled: details.flights_enabled,
        division: details.divisions_enabled ? (registration.division === 'required' ? 'required' : 'optional') : 'hidden',
        division_details: divisionDetails,
        tournament_format: details.tournament_format.trim(),
        format_description: details.format_description.trim(),
        player_information: details.player_information.trim(),
      };

      const dates = [details.day1, details.day2].filter(Boolean);
      const { data, error } = await supabase
        .from('golf_registration_events')
        .update({
          name: details.name.trim(),
          course: details.course.trim() || null,
          event_dates: dates,
          divisions: divisionDetails.map((item) => item.name),
          field_settings: nextSettings,
        })
        .eq('id', event.id)
        .select()
        .single();
      if (error) throw error;

      if (event.master_event_id) {
        const { error: masterError } = await supabase
          .from('events')
          .update({
            name: details.name.trim(),
            date: details.day1,
            event_date: details.day1,
            location: details.course.trim() || null,
          })
          .eq('id', event.master_event_id);
        if (masterError) throw masterError;
      }

      onEventUpdated(data);
      await onReload();
      setNotice('Event Details saved.');
      if (next) onStepChange('registration');
    } catch (error) {
      setNotice(error.message || 'Unable to save Event Details.');
    } finally {
      setBusy(false);
    }
  }

  async function saveRegistrationDetails(next = false) {
    setBusy(true);
    setNotice('');
    try {
      const divisionSetting = details.divisions_enabled ? registration.division : 'hidden';
      const teamSize = details.structure === 'team' ? Math.max(2, Math.min(12, Number(registration.team_size || 4))) : 1;
      const nextSettings = {
        ...(event.field_settings || {}),
        registration_format: details.structure,
        team_size: teamSize,
        allow_team_name: details.structure === 'team' ? registration.allow_team_name : false,
        allow_partial_team: details.structure === 'team' ? registration.allow_partial_team : false,
        team_payment_mode: details.structure === 'team' ? registration.team_payment_mode : 'captain_all',
        allow_split_team_payments: details.structure === 'team' && ['split_equal', 'each_player'].includes(registration.team_payment_mode),
        registration_deadline: registration.registration_deadline || null,
        registration_contact_name: registration.registration_contact_name.trim(),
        registration_contact_email: registration.registration_contact_email.trim(),
        registration_contact_phone: registration.registration_contact_phone.trim(),
        dob: registration.dob,
        gender: registration.gender,
        division: divisionSetting,
        membership: registration.membership,
        ghin: registration.ghin,
        custom_fields: registration.custom_fields,
        participant_fields_status: 'configured',
      };

      const { data, error } = await supabase
        .from('golf_registration_events')
        .update({
          member_price: Number(registration.member_price || 0),
          non_member_price: Number(registration.non_member_price || 0),
          field_settings: nextSettings,
        })
        .eq('id', event.id)
        .select()
        .single();
      if (error) throw error;

      if (paymentSettings?.id) {
        const { error: paymentError } = await supabase
          .from('golf_event_payment_settings')
          .update({
            team_payment_mode: details.structure === 'team' ? registration.team_payment_mode : 'captain_all',
            allow_split_team_payments: details.structure === 'team' && ['split_equal', 'each_player'].includes(registration.team_payment_mode),
          })
          .eq('id', paymentSettings.id);
        if (paymentError) throw paymentError;
      }

      if (event.master_event_id) {
        const { error: masterError } = await supabase
          .from('events')
          .update({ registration_deadline: registration.registration_deadline || null })
          .eq('id', event.master_event_id);
        if (masterError) throw masterError;
      }

      onEventUpdated(data);
      await onReload();
      setNotice('Registration Details saved. Roster rules are now updated.');
      if (next) onStepChange('pricing');
    } catch (error) {
      setNotice(error.message || 'Unable to save Registration Details.');
    } finally {
      setBusy(false);
    }
  }

  async function prepareRosterSheet() {
    setBusy(true);
    setNotice('Preparing the event roster sheet...');
    const rosterWindow = window.open('about:blank', '_blank');
    try {
      await saveRegistrationDetails(false);
      const { data, error } = await supabase.functions.invoke('golf-import-roster', {
        body: {
          action: 'prepare_required_roster_template',
          event_id: event.id,
          event_key: event.event_key,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unable to prepare the required roster sheet.');
      const url = data.roster_template_url || data.google_sheet_url || '';
      if (!url) throw new Error('The roster sheet was prepared but no Google Sheet link was returned.');
      if (rosterWindow && !rosterWindow.closed) rosterWindow.location.replace(url);
      else window.location.assign(url);
      setNotice(data.existing_headers_preserved ? 'Required roster sheet opened. Existing roster work was preserved.' : 'Required roster sheet created and opened.');
    } catch (error) {
      if (rosterWindow && !rosterWindow.closed) rosterWindow.close();
      setNotice(error.message || 'Unable to prepare the required roster sheet.');
    } finally {
      setBusy(false);
    }
  }

  function addOffer() {
    setOffers((current) => [...current, blankOffer(event)]);
  }

  function updateOffer(index, field, value) {
    setOffers((current) => current.map((offer, offerIndex) => offerIndex === index ? { ...offer, [field]: value } : offer));
  }

  function removeOffer(index) {
    setOffers((current) => current.map((offer, offerIndex) => offerIndex === index
      ? (offer.id ? { ...offer, _removed: true } : null)
      : offer
    ).filter(Boolean));
  }

  async function savePricing(next = false) {
    setPricingBusy(true);
    setNotice('');
    try {
      const activeOffers = offers.filter((offer) => !offer._removed);
      for (const offer of activeOffers) {
        if (!offer.name.trim()) throw new Error('Every pricing line item needs a name.');
        if (Number(offer.price || 0) < 0) throw new Error('Pricing amounts cannot be negative.');
      }

      const existingToDisable = offers.filter((offer) => offer.id && offer._removed);
      for (const offer of existingToDisable) {
        const { error } = await supabase.from('event_offers').update({ status: 'inactive' }).eq('id', offer.id);
        if (error) throw error;
      }

      for (let index = 0; index < activeOffers.length; index += 1) {
        const offer = activeOffers[index];
        const payload = {
          organization_id: organization.id,
          master_event_id: event.master_event_id,
          golf_event_id: event.id,
          source_app: 'eie',
          source_module: 'event_setup',
          offer_type: offer.offer_type,
          name: offer.name.trim(),
          description: offer.description.trim() || null,
          price: Number(offer.price || 0),
          charge_by: offer.charge_by,
          is_required: Boolean(offer.is_required),
          is_default: offer.offer_type === 'registration' && index === 0,
          availability_start: offer.availability_start || null,
          availability_end: offer.availability_end || null,
          inventory_limit: offer.inventory_limit === '' ? null : Number(offer.inventory_limit),
          quantity_min: offer.is_required ? 1 : 0,
          quantity_max: offer.quantity_max === '' ? null : Number(offer.quantity_max),
          coupon_eligible: Boolean(offer.coupon_eligible),
          visibility: 'public',
          status: 'active',
          sort_order: index,
          metadata: { ...(offer.metadata || {}), taxable: Boolean(offer.metadata?.taxable) },
        };
        if (offer.id) {
          const { error } = await supabase.from('event_offers').update(payload).eq('id', offer.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('event_offers').insert(payload);
          if (error) throw error;
        }
      }

      const { data: refreshed, error: refreshError } = await supabase
        .from('event_offers')
        .select('id,name,description,offer_type,price,charge_by,is_required,availability_start,availability_end,inventory_limit,quantity_max,coupon_eligible,metadata,status,sort_order')
        .eq('golf_event_id', event.id)
        .order('sort_order');
      if (refreshError) throw refreshError;
      setOffers((refreshed || []).map((row) => ({
        ...row,
        price: row.price ?? '',
        availability_start: row.availability_start || '',
        availability_end: row.availability_end || '',
        inventory_limit: row.inventory_limit ?? '',
        quantity_max: row.quantity_max ?? '',
        metadata: row.metadata || {},
        _removed: row.status !== 'active',
      })));

      setNotice('Pricing & Add-ons saved.');
      if (next) onStepChange('roster');
    } catch (error) {
      setNotice(error.message || 'Unable to save pricing.');
    } finally {
      setPricingBusy(false);
    }
  }

  const visibleOffers = offers.filter((offer) => !offer._removed);
  const rosterHeaders = requiredHeaders(settingsPreview, registration.custom_fields);
  const fileSafeName = String(event.name || 'event').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

  return <>
    <nav className="eie-setup-steps" aria-label="EIE event setup steps">
      {STEP_ITEMS.map(([key, number, label]) => <button
        key={key}
        type="button"
        className={activeStep === key ? 'active' : ''}
        onClick={() => onStepChange(key)}
      >
        <span>{number}</span><strong>{label}</strong>
      </button>)}
    </nav>

    {notice && <div className={notice.toLowerCase().includes('unable') || notice.toLowerCase().includes('required') ? 'platform-error banner' : 'platform-success'}>{notice}</div>}

    {activeStep === 'details' && <section className="platform-section-card">
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">Step 1 · Event Details</p><h2>What is this event?</h2><p>This step defines the event structure. Registration and roster behavior inherit these choices.</p></div>
        <span>{details.structure === 'team' ? 'Team Event' : 'Individual Event'}</span>
      </div>

      <div className="form-grid two">
        <label>Event name<input value={details.name} onChange={(e) => setDetail('name', e.target.value)} /></label>
        <label>Course / location<input value={details.course} onChange={(e) => setDetail('course', e.target.value)} /></label>
        <label>Day 1<input type="date" value={details.day1} onChange={(e) => setDetail('day1', e.target.value)} /></label>
        <label>Day 2<input type="date" value={details.day2} onChange={(e) => setDetail('day2', e.target.value)} /></label>
        <label>Event structure<select value={details.structure} onChange={(e) => changeStructure(e.target.value)}><option value="individual">Individual</option><option value="team">Team</option></select></label>
        <label>Tournament format<input value={details.tournament_format} onChange={(e) => setDetail('tournament_format', e.target.value)} placeholder="Scramble, stroke play, match play..." /></label>
        <label className="full-span">Format description<textarea rows="3" value={details.format_description} onChange={(e) => setDetail('format_description', e.target.value)} placeholder="Explain the format in plain language." /></label>
        <label className="full-span">What players need to know<textarea rows="4" value={details.player_information} onChange={(e) => setDetail('player_information', e.target.value)} placeholder="Eligibility, rules, check-in, dress code, what is included, and other player notes." /></label>
      </div>

      <div className="eie-option-switches">
        <label><input type="checkbox" checked={details.divisions_enabled} onChange={(e) => { setDetail('divisions_enabled', e.target.checked); if (!e.target.checked) setRegistrationField('division', 'hidden'); else if (registration.division === 'hidden') setRegistrationField('division', 'optional'); }} /><span><strong>Use Divisions</strong><small>Division choices flow into registration, roster entry, uploads and exports.</small></span></label>
        <label><input type="checkbox" checked={details.flights_enabled} onChange={(e) => setDetail('flights_enabled', e.target.checked)} /><span><strong>Use Flights</strong><small>Keep flight organization available for Event Info and scoring workflows.</small></span></label>
      </div>

      {details.divisions_enabled && <div className="eie-builder-block">
        <div className="platform-section-heading">
          <div><p className="platform-eyebrow">Divisions</p><h3>Division Setup</h3></div>
          <button className="platform-secondary-button" type="button" onClick={addDivision}>+ Add Division</button>
        </div>
        <div className="eie-builder-list">
          {details.division_details.map((division, index) => <div className="eie-builder-row" key={'division-' + index}>
            <div className="form-grid two">
              <label>Division name<input value={division.name} onChange={(e) => updateDivision(index, 'name', e.target.value)} placeholder="Example: Senior" /></label>
              <label>Eligibility / age note<input value={division.eligibility} onChange={(e) => updateDivision(index, 'eligibility', e.target.value)} placeholder="Example: Age 55+" /></label>
              <label className="full-span">Description<textarea rows="2" value={division.description} onChange={(e) => updateDivision(index, 'description', e.target.value)} placeholder="Explain who this division is for." /></label>
            </div>
            <button className="platform-secondary-button danger-outline" type="button" onClick={() => removeDivision(index)}>Remove Division</button>
          </div>)}
          {!details.division_details.length && <div className="availability-note"><strong>No divisions yet</strong><span>Add the divisions used for this event.</span></div>}
        </div>
      </div>}

      <div className="review-actions">
        <button className="platform-secondary-button" type="button" disabled={busy} onClick={() => saveEventDetails(false)}>Save Event Details</button>
        <button className="platform-primary-button" type="button" disabled={busy} onClick={() => saveEventDetails(true)}>{busy ? 'Saving...' : 'Save & Continue →'}</button>
      </div>
    </section>}

    {activeStep === 'registration' && <section className="platform-section-card">
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">Step 2 · Registration Details</p><h2>Define what registration needs</h2><p>These settings build the manual roster form, upload template, public registration fields and ATC requirements.</p></div>
        <span>{details.structure === 'team' ? 'Team Registration' : 'Individual Registration'}</span>
      </div>

      <div className="form-grid two">
        <label>Member price<input type="number" min="0" step="0.01" value={registration.member_price} onChange={(e) => setRegistrationField('member_price', e.target.value)} /></label>
        <label>Non-member price<input type="number" min="0" step="0.01" value={registration.non_member_price} onChange={(e) => setRegistrationField('non_member_price', e.target.value)} /></label>
        {details.structure === 'team' && <label>Players per team<input type="number" min="2" max="12" value={registration.team_size} onChange={(e) => setRegistrationField('team_size', e.target.value)} /></label>}
        {details.structure === 'team' && <label>Team payment<select value={registration.team_payment_mode} onChange={(e) => setRegistrationField('team_payment_mode', e.target.value)}><option value="captain_all">Captain pays all</option><option value="split_equal">Split equally</option><option value="each_player">Each player pays</option></select></label>}
        <label>Registration deadline<input type="date" value={registration.registration_deadline} onChange={(e) => setRegistrationField('registration_deadline', e.target.value)} /></label>
        <div />
        {details.structure === 'team' && <label className="eie-inline-check"><input type="checkbox" checked={registration.allow_team_name} onChange={(e) => setRegistrationField('allow_team_name', e.target.checked)} /><span>Allow team name</span></label>}
        {details.structure === 'team' && <label className="eie-inline-check"><input type="checkbox" checked={registration.allow_partial_team} onChange={(e) => setRegistrationField('allow_partial_team', e.target.checked)} /><span>Allow partial teams / hold incomplete team</span></label>}
      </div>

      <div className="eie-builder-block">
        <p className="platform-eyebrow">Golfer Information</p>
        <h3>Required, Optional or Hidden</h3>
        <div className="eie-registration-settings">
          {[
            ['dob', 'Date of Birth'],
            ['gender', 'Gender'],
            ...(details.divisions_enabled ? [['division', 'Division']] : []),
            ['membership', 'Club Membership Status'],
            ['ghin', 'GHIN #'],
          ].map(([key, label]) => <div className="eie-registration-setting" key={key}>
            <strong>{label}</strong>
            <select value={registration[key]} onChange={(e) => setRegistrationField(key, e.target.value)}>
              <option value="required">Required</option>
              <option value="optional">Optional</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>)}
        </div>
      </div>

      <div className="eie-builder-block">
        <p className="platform-eyebrow">Registration Contact</p>
        <div className="form-grid three">
          <label>Name<input value={registration.registration_contact_name} onChange={(e) => setRegistrationField('registration_contact_name', e.target.value)} /></label>
          <label>Email<input type="email" value={registration.registration_contact_email} onChange={(e) => setRegistrationField('registration_contact_email', e.target.value)} /></label>
          <label>Phone<input type="tel" value={registration.registration_contact_phone} onChange={(e) => setRegistrationField('registration_contact_phone', e.target.value)} /></label>
        </div>
      </div>

      <div className="eie-builder-block">
        <div className="platform-section-heading"><div><p className="platform-eyebrow">Offline Registration</p><h3>Required Roster Sheet</h3><p>Built from this event's required fields, exactly like the test setup.</p></div></div>
        <div className="availability-note"><strong>Required for this event</strong><span>{rosterHeaders.join(' · ')}</span></div>
        <div className="review-actions">
          <button className="platform-secondary-button" type="button" onClick={() => downloadCsv(rosterHeaders, `${fileSafeName}-required-roster-template.csv`)}>Download CSV Template</button>
          <button className="platform-primary-button" type="button" disabled={busy} onClick={prepareRosterSheet}>Open Required Google Roster Sheet</button>
        </div>
      </div>

      <div className="eie-builder-block">
        <div className="platform-section-heading"><div><p className="platform-eyebrow">Custom Questions</p><h3>Additional Registration Fields</h3></div></div>
        <div className="eie-custom-field-list">
          {registration.custom_fields.map((field, index) => <div className="eie-custom-field-row" key={field.id || index}><div><strong>{field.label}</strong><span>{field.type || 'text'} · {field.required ? 'required' : 'optional'}</span></div><button className="platform-secondary-button danger-outline" type="button" onClick={() => removeCustomField(index)}>Remove</button></div>)}
          {!registration.custom_fields.length && <div className="availability-note"><strong>No custom questions</strong><span>Add event-specific questions only when this event needs them.</span></div>}
        </div>
        <div className="form-grid three" style={{ marginTop: 14 }}>
          <label>Question label<input value={customDraft.label} onChange={(e) => setCustomDraft((current) => ({ ...current, label: e.target.value }))} placeholder="Example: Shirt size" /></label>
          <label>Field type<select value={customDraft.type} onChange={(e) => setCustomDraft((current) => ({ ...current, type: e.target.value }))}><option value="text">Text</option><option value="textarea">Long text</option><option value="number">Number</option><option value="date">Date</option><option value="email">Email</option><option value="phone">Phone</option><option value="select">Dropdown</option><option value="checkbox">Yes / No checkbox</option></select></label>
          {customDraft.type === 'select' ? <label>Dropdown choices<input value={Array.isArray(customDraft.options) ? customDraft.options.join(', ') : customDraft.options} onChange={(e) => setCustomDraft((current) => ({ ...current, options: e.target.value }))} placeholder="Small, Medium, Large" /></label> : <label className="eie-inline-check"><input type="checkbox" checked={customDraft.required} onChange={(e) => setCustomDraft((current) => ({ ...current, required: e.target.checked }))} /><span>Required question</span></label>}
        </div>
        {customDraft.type === 'select' && <label className="eie-inline-check" style={{ marginTop: 10 }}><input type="checkbox" checked={customDraft.required} onChange={(e) => setCustomDraft((current) => ({ ...current, required: e.target.checked }))} /><span>Required question</span></label>}
        <button className="platform-secondary-button" type="button" style={{ marginTop: 12 }} onClick={addCustomField}>+ Add Custom Question</button>
      </div>

      <div className="review-actions">
        <button className="platform-secondary-button" type="button" onClick={() => onStepChange('details')}>← Event Details</button>
        <button className="platform-secondary-button" type="button" disabled={busy} onClick={() => saveRegistrationDetails(false)}>Save Registration</button>
        <button className="platform-primary-button" type="button" disabled={busy} onClick={() => saveRegistrationDetails(true)}>{busy ? 'Saving...' : 'Save & Continue →'}</button>
      </div>
    </section>}

    {activeStep === 'pricing' && <section className="platform-section-card">
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">Step 3 · Pricing & Add-ons</p><h2>Flexible event pricing</h2><p>Keep Member / Non-Member as the base registration price, then add as many event-specific line items as needed.</p></div>
        <span>{visibleOffers.length} line item{visibleOffers.length === 1 ? '' : 's'}</span>
      </div>

      <div className="platform-stats-grid" style={{ marginBottom: 18 }}>
        <div className="platform-stat-card"><span>Member Base</span><strong>${Number(registration.member_price || 0).toFixed(2)}</strong><small>From Registration Details</small></div>
        <div className="platform-stat-card"><span>Non-Member Base</span><strong>${Number(registration.non_member_price || 0).toFixed(2)}</strong><small>From Registration Details</small></div>
        <div className="platform-stat-card"><span>Event Structure</span><strong>{details.structure === 'team' ? 'Team' : 'Individual'}</strong><small>{details.structure === 'team' ? registration.team_size + ' players per team' : 'One golfer per entry'}</small></div>
      </div>

      <div className="eie-builder-list">
        {visibleOffers.map((offer) => {
          const realIndex = offers.indexOf(offer);
          return <div className="eie-builder-row" key={offer.id || 'new-offer-' + realIndex}>
            <div className="form-grid three">
              <label>Line item name<input value={offer.name} onChange={(e) => updateOffer(realIndex, 'name', e.target.value)} placeholder="Mulligans, meal guest, donation..." /></label>
              <label>Type<select value={offer.offer_type} onChange={(e) => updateOffer(realIndex, 'offer_type', e.target.value)}><option value="registration">Registration</option><option value="add_on">Add-on</option><option value="package">Package</option><option value="donation">Donation</option><option value="sponsorship">Sponsorship</option><option value="other">Other</option></select></label>
              <label>Amount<input type="number" min="0" step="0.01" value={offer.price} onChange={(e) => updateOffer(realIndex, 'price', e.target.value)} /></label>
              <label>Charge by<select value={offer.charge_by} onChange={(e) => updateOffer(realIndex, 'charge_by', e.target.value)}><option value="player">Per golfer</option><option value="team">Per team</option><option value="order">Per order</option><option value="flat">Flat amount</option></select></label>
              <label>Available from<input type="date" value={offer.availability_start} onChange={(e) => updateOffer(realIndex, 'availability_start', e.target.value)} /></label>
              <label>Available through<input type="date" value={offer.availability_end} onChange={(e) => updateOffer(realIndex, 'availability_end', e.target.value)} /></label>
              <label>Inventory limit<input type="number" min="0" value={offer.inventory_limit} onChange={(e) => updateOffer(realIndex, 'inventory_limit', e.target.value)} placeholder="Unlimited" /></label>
              <label>Max quantity / order<input type="number" min="1" value={offer.quantity_max} onChange={(e) => updateOffer(realIndex, 'quantity_max', e.target.value)} placeholder="Unlimited" /></label>
              <label className="eie-inline-check"><input type="checkbox" checked={Boolean(offer.is_required)} onChange={(e) => updateOffer(realIndex, 'is_required', e.target.checked)} /><span>Required line item</span></label>
              <label className="eie-inline-check"><input type="checkbox" checked={Boolean(offer.coupon_eligible)} onChange={(e) => updateOffer(realIndex, 'coupon_eligible', e.target.checked)} /><span>Coupon eligible</span></label>
              <label className="eie-inline-check"><input type="checkbox" checked={Boolean(offer.metadata?.taxable)} onChange={(e) => updateOffer(realIndex, 'metadata', { ...(offer.metadata || {}), taxable: e.target.checked })} /><span>Taxable</span></label>
              <label className="full-span">Description<textarea rows="2" value={offer.description || ''} onChange={(e) => updateOffer(realIndex, 'description', e.target.value)} placeholder="Optional participant-facing description." /></label>
            </div>
            <button className="platform-secondary-button danger-outline" type="button" onClick={() => removeOffer(realIndex)}>Remove Line Item</button>
          </div>;
        })}
        {!visibleOffers.length && <div className="availability-note"><strong>No extra line items</strong><span>The event can run on base Member / Non-Member pricing only.</span></div>}
      </div>

      <button className="platform-secondary-button" type="button" style={{ marginTop: 14 }} onClick={addOffer}>+ Add Pricing Line Item</button>

      <div className="review-actions">
        <button className="platform-secondary-button" type="button" onClick={() => onStepChange('registration')}>← Registration Details</button>
        <button className="platform-secondary-button" type="button" disabled={pricingBusy} onClick={() => savePricing(false)}>Save Pricing</button>
        <button className="platform-primary-button" type="button" disabled={pricingBusy} onClick={() => savePricing(true)}>{pricingBusy ? 'Saving...' : 'Save & Open Roster →'}</button>
      </div>
    </section>}
  </>;
}

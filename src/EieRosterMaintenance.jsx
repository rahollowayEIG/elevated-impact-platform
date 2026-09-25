import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import RosterUpload from './RosterUpload';

function emptyGolfer() {
  return {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    membership_status: 'Member',
    division: '',
    date_of_birth: '',
    gender: '',
    ghin_number: '',
    price: '',
    custom_fields: {},
    payment_status: 'pending',
  };
}

function money(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '$0.00';
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function displayCustomValue(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value ?? '';
}

async function readFunctionError(error, fallback) {
  try {
    const body = await error?.context?.json();
    if (body) return body;
  } catch {
    // Supabase Functions may already have consumed the response body.
  }
  return { error: error?.message || fallback };
}

export default function EieRosterMaintenance({ event, rows, loading, onRefresh }) {
  const settings = event?.field_settings || {};
  const customFields = Array.isArray(settings.custom_fields) ? settings.custom_fields : [];
  const divisionOptions = Array.isArray(event?.divisions)
    ? event.divisions.filter(Boolean)
    : Array.isArray(settings.division_details)
      ? settings.division_details.map((item) => item?.name).filter(Boolean)
      : [];
  const teamMode = settings.registration_format === 'team';
  const membersOnly = settings.event_access === 'members_only';
  const teamSize = teamMode ? Math.max(2, Number(settings.team_size || 4)) : 1;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualGolfer, setManualGolfer] = useState(emptyGolfer);
  const [manualReason, setManualReason] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [teamId, setTeamId] = useState('');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkTeamId, setBulkTeamId] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [syncWorking, setSyncWorking] = useState(false);
  const [rosterView, setRosterView] = useState('all');
  const [requiredRosterWorking, setRequiredRosterWorking] = useState(false);
  const [requiredRosterUrl, setRequiredRosterUrl] = useState('');
  const [googleSheetUrl, setGoogleSheetUrl] = useState(event?.google_sheet_url || '');

  useEffect(() => {
    let active = true;
    async function refreshRosterLinks() {
      if (!event?.id) return;
      const { data } = await supabase
        .from('golf_registration_events')
        .select('google_sheet_url')
        .eq('id', event.id)
        .maybeSingle();
      if (active && data?.google_sheet_url) setGoogleSheetUrl(data.google_sheet_url);
    }
    setGoogleSheetUrl(event?.google_sheet_url || '');
    refreshRosterLinks();
    return () => { active = false; };
  }, [event?.id, event?.google_sheet_url]);

  useEffect(() => {
    if (!selected?.id) return undefined;
    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const row = document.querySelector(`tr[data-registration-id="${selected.id}"]`);
        if (!row) return;
        const rect = row.getBoundingClientRect();
        const targetTop = window.scrollY + rect.top - Math.max(24, (window.innerHeight - rect.height) / 2);
        window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [selected?.id]);

  const missingRequiredManual = useMemo(() => {
    const standardMissing =
      (settings.dob === 'required' && !manualGolfer.date_of_birth) ||
      (settings.gender === 'required' && !manualGolfer.gender) ||
      (settings.division === 'required' && !manualGolfer.division) ||
      (settings.membership === 'required' && !manualGolfer.membership_status) ||
      (settings.ghin === 'required' && !manualGolfer.ghin_number);

    const customMissing = customFields.some((field) => {
      if (!field?.required) return false;
      const value = manualGolfer.custom_fields?.[field.id];
      return field.type === 'checkbox' ? value !== true : !String(value ?? '').trim();
    });

    return standardMissing || customMissing;
  }, [customFields, manualGolfer, settings]);

  async function invoke(body) {
    const { data, error } = await supabase.functions.invoke('golf-admin-registration', { body });
    if (error) {
      const details = await readFunctionError(error, 'Roster maintenance could not be completed.');
      const wrapped = new Error(details.error || 'Roster maintenance could not be completed.');
      wrapped.details = details;
      throw wrapped;
    }
    if (!data?.success) {
      const wrapped = new Error(data?.error || 'Roster maintenance could not be completed.');
      wrapped.details = data;
      throw wrapped;
    }
    return data;
  }


  async function openRequiredRosterSheet() {
    setRequiredRosterWorking(true);
    setNotice('Preparing the Required Roster Sheet...');
    const rosterWindow = window.open('about:blank', '_blank');
    try {
      const { data, error } = await supabase.functions.invoke('golf-import-roster', {
        body: {
          action: 'prepare_required_roster_template',
          event_id: event.id,
          event_key: event.event_key,
        },
      });
      if (error) {
        const details = await readFunctionError(error, 'Unable to prepare the Required Roster Sheet.');
        throw new Error(details.error || 'Unable to prepare the Required Roster Sheet.');
      }
      if (!data?.success) throw new Error(data?.error || 'Unable to prepare the Required Roster Sheet.');

      const requiredUrl = data.roster_template_url || data.google_sheet_url || '';
      const workbookUrl = data.google_sheet_url || googleSheetUrl || '';
      if (!requiredUrl) throw new Error('The Required Roster Sheet was prepared but no link was returned.');

      setRequiredRosterUrl(requiredUrl);
      if (workbookUrl) setGoogleSheetUrl(workbookUrl);

      if (rosterWindow && !rosterWindow.closed) {
        rosterWindow.location.replace(requiredUrl);
        setNotice(data.existing_headers_preserved
          ? 'Required Roster Sheet opened. Existing roster work was preserved.'
          : 'Required Roster Sheet created and opened.');
      } else {
        setNotice('Required Roster Sheet is ready. Use the Reopen button below.');
      }
    } catch (error) {
      if (rosterWindow && !rosterWindow.closed) rosterWindow.close();
      setNotice(error instanceof Error ? error.message : 'Unable to prepare the Required Roster Sheet.');
    } finally {
      setRequiredRosterWorking(false);
    }
  }

    async function pullGoogleChanges() {
    setSyncWorking(true);
    setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('pull-google-roster-edits', {
        body: { event_id: event.id, event_key: event.event_key },
      });
      if (error) {
        const details = await readFunctionError(error, 'Unable to pull Google roster edits.');
        throw new Error(details.error || 'Unable to pull Google roster edits.');
      }
      if (!data?.success) throw new Error(data?.error || 'Unable to pull Google roster edits.');
      await onRefresh();
      const count = data.updated_count ?? 0;
      setNotice(`Google roster checked. ${count} golfer${count === 1 ? '' : 's'} updated in EIE.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to pull Google roster edits.');
    } finally {
      setSyncWorking(false);
    }
  }

  async function syncGoogleSheet() {
    setSyncWorking(true);
    setNotice('');
    try {
      const pull = await supabase.functions.invoke('pull-google-roster-edits', {
        body: { event_id: event.id, event_key: event.event_key },
      });
      if (pull.error) {
        const details = await readFunctionError(pull.error, 'Unable to pull Google roster edits before sync.');
        throw new Error(details.error || 'Unable to pull Google roster edits before sync.');
      }

      const { data, error } = await supabase.functions.invoke('sync-google-roster', {
        body: { event_key: event.event_key },
      });
      if (error) {
        const details = await readFunctionError(error, 'Google Sheet sync failed.');
        throw new Error(details.error || 'Google Sheet sync failed.');
      }
      if (!data?.success) throw new Error(data?.error || 'Google Sheet sync failed.');
      await onRefresh();
      const count = data.registrations_synced ?? rows.length;
      setNotice(`Google Sheet synced successfully. ${count} registration${count === 1 ? '' : 's'} updated.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to sync Google Sheet.');
    } finally {
      setSyncWorking(false);
    }
  }

  function toggleBulkSelection(registrationId, checked) {
    setBulkSelectedIds((current) => {
      if (checked) return current.includes(registrationId) ? current : [...current, registrationId];
      return current.filter((id) => id !== registrationId);
    });
  }

  function toggleAllRows(checked) {
    setBulkSelectedIds(checked ? rows.map((row) => row.id) : []);
  }

  async function applyBulkAction() {
    if (!bulkSelectedIds.length || !bulkAction || bulkWorking) return;
    if (bulkAction === 'comp' && !bulkReason.trim()) {
      setNotice('A reason is required when comping golfers.');
      return;
    }
    if (bulkAction === 'set_team' && !bulkTeamId.trim()) {
      setNotice('Enter a Team ID for the selected golfers.');
      return;
    }
    if ((bulkAction === 'withdraw' || bulkAction === 'cancel') && !window.confirm(
      `Apply this action to ${bulkSelectedIds.length} selected golfer${bulkSelectedIds.length === 1 ? '' : 's'}?`
    )) return;

    setBulkWorking(true);
    setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('golf-bulk-registration', {
        body: {
          action: bulkAction,
          registration_ids: bulkSelectedIds,
          reason: bulkReason.trim() || null,
          team_id: bulkAction === 'set_team' ? bulkTeamId.trim() : undefined,
        },
      });
      if (error) {
        const details = await readFunctionError(error, 'Bulk roster update could not be completed.');
        throw new Error(details.error || 'Bulk roster update could not be completed.');
      }
      if (!data?.success) throw new Error(data?.error || 'Bulk roster update could not be completed.');

      const count = data.updated_count ?? bulkSelectedIds.length;
      setBulkSelectedIds([]);
      setBulkAction('');
      setBulkReason('');
      setBulkTeamId('');
      setNotice(data.sync_warning || `${count} golfer${count === 1 ? '' : 's'} updated successfully.`);
      await onRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to update selected golfers.');
    } finally {
      setBulkWorking(false);
    }
  }

  function exportGolfGenius() {
    let confirmed = rows.filter((row) =>
      ['paid', 'comp'].includes(row.payment_status) &&
      (row.registration_status || 'active') === 'active'
    );
    if (!confirmed.length) {
      window.alert('There are no confirmed golfers to export yet.');
      return;
    }

    const registrationFormat = teamMode ? 'team' : 'individual';
    const teamSize = registrationFormat === 'team'
      ? Math.max(2, Math.min(12, Number(settings.team_size || 4)))
      : 1;

    if (registrationFormat === 'team') {
      const missingTeam = confirmed.filter((row) => !String(row.team_id ?? '').trim());
      if (missingTeam.length) {
        window.alert(
          `${missingTeam.length} confirmed golfer${missingTeam.length === 1 ? '' : 's'} still need a Team ID. Use Manage -> Set / Move Team before exporting.`
        );
        return;
      }

      const teamOrder = [];
      const teamMap = new Map();
      confirmed.forEach((row) => {
        const raw = String(row.team_id ?? '').trim();
        if (!teamMap.has(raw)) {
          teamMap.set(raw, teamOrder.length + 1);
          teamOrder.push(raw);
        }
      });

      confirmed = [...confirmed].sort((a, b) => {
        const aTeam = teamMap.get(String(a.team_id ?? '').trim()) || 0;
        const bTeam = teamMap.get(String(b.team_id ?? '').trim()) || 0;
        if (aTeam !== bTeam) return aTeam - bTeam;
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });

      const teamPositions = new Map();
      confirmed = confirmed.map((row) => {
        const exportTeamId = teamMap.get(String(row.team_id ?? '').trim()) || '';
        const nextPosition = (teamPositions.get(exportTeamId) || 0) + 1;
        teamPositions.set(exportTeamId, nextPosition);
        return {
          ...row,
          __export_team_id: exportTeamId,
          __export_entry_number: ((Number(exportTeamId) - 1) * teamSize) + nextPosition,
        };
      });
    } else {
      confirmed = confirmed.map((row, index) => ({
        ...row,
        __export_team_id: '',
        __export_entry_number: index + 1,
      }));
    }

    const customKeys = Array.from(new Set(confirmed.flatMap((row) => {
      const custom = row.custom_fields && typeof row.custom_fields === 'object' ? row.custom_fields : {};
      return Object.keys(custom);
    })));
    const pretty = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
    const headers = [
      'Team Id', 'Entry Number', 'Email', 'Phone', 'First Name', 'Last Name',
      'DOB', 'Gender', 'Tee', 'Division', 'Member Type', 'GHIN ID',
      ...customKeys.map(pretty),
      'Age', 'Price', 'Payment Status', 'Registration Date', 'Registration ID',
    ];

    const csvRows = confirmed.map((row, index) => {
      const custom = row.custom_fields && typeof row.custom_fields === 'object' ? row.custom_fields : {};
      return [
        row.__export_team_id ?? '',
        row.__export_entry_number ?? index + 1,
        row.email,
        row.phone,
        row.first_name,
        row.last_name,
        row.date_of_birth,
        row.gender,
        row.tee ?? '',
        row.division,
        row.membership_status,
        row.ghin_number,
        ...customKeys.map((key) => displayCustomValue(custom[key])),
        row.age,
        row.price,
        row.payment_status,
        row.created_at,
        row.id,
      ].map(csvEscape).join(',');
    });

    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'golf-genius-confirmed-roster.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function updateManual(field, value) {
    setManualGolfer((current) => ({ ...current, [field]: value }));
    setDuplicateWarning(null);
    setNotice('');
  }

  const inheritedBasePrice = membersOnly
    ? Number(event?.member_price || 0)
    : manualGolfer.membership_status === 'Non-Member'
      ? Number(event?.non_member_price || 0)
      : Number(event?.member_price || 0);
  const effectiveManualPrice = manualGolfer.price === ''
    ? inheritedBasePrice
    : Number(manualGolfer.price || 0);

  function updateCustom(fieldId, value) {
    setManualGolfer((current) => ({
      ...current,
      custom_fields: { ...(current.custom_fields || {}), [fieldId]: value },
    }));
    setDuplicateWarning(null);
    setNotice('');
  }

  async function addManual(confirmDuplicate = false) {
    setWorking(true);
    setNotice('');
    try {
      const data = await invoke({
        action: 'add_golfer_manually',
        event_id: event.id,
        event_key: event.event_key,
        golfer: manualGolfer,
        reason: manualGolfer.payment_status === 'comp' ? manualReason.trim() : null,
        confirm_duplicate: confirmDuplicate,
      });
      setManualGolfer(emptyGolfer());
      setManualReason('');
      setDuplicateWarning(null);
      setManualOpen(false);
      setNotice(data.sync_warning || 'Golfer added successfully.');
      await onRefresh();
    } catch (error) {
      if (error?.details?.code === 'possible_duplicate') {
        setDuplicateWarning(error.details.duplicates || []);
        setNotice(error.details.error || 'A possible duplicate was found.');
      } else {
        setNotice(error instanceof Error ? error.message : 'Unable to add golfer.');
      }
    } finally {
      setWorking(false);
    }
  }

  function openManage(row) {
    setSelected(row);
    setAction('');
    setReason('');
    setTeamId(row.team_id || '');
    setNotice('');
  }

  function closeManage() {
    if (working) return;
    setSelected(null);
    setAction('');
    setReason('');
    setTeamId('');
  }

  async function applyAction() {
    if (!selected?.id || !action || working) return;
    if (action === 'comp' && !reason.trim()) {
      setNotice('A reason is required when comping a golfer.');
      return;
    }
    if (action === 'set_team' && !teamId.trim()) {
      setNotice('Enter a Team ID before moving this golfer.');
      return;
    }
    if ((action === 'withdraw' || action === 'cancel') && !window.confirm(
      action === 'withdraw'
        ? `Withdraw ${selected.first_name} ${selected.last_name} from this event?`
        : `Cancel ${selected.first_name} ${selected.last_name}'s registration?`
    )) return;

    setWorking(true);
    setNotice('');
    try {
      const data = await invoke({
        action,
        registration_id: selected.id,
        reason: reason.trim() || null,
        team_id: action === 'set_team' ? teamId.trim() : undefined,
      });
      setSelected(null);
      setAction('');
      setReason('');
      setTeamId('');
      setNotice(data.sync_warning || 'Roster updated successfully.');
      await onRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to update golfer.');
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    const validIds = new Set(rows.map((row) => row.id));
    setBulkSelectedIds((current) => current.filter((id) => validIds.has(id)));
  }, [rows]);

  const activeCount = rows.filter((row) => (row.registration_status || 'active') === 'active').length;
  const paidCount = rows.filter((row) => row.payment_status === 'paid').length;
  const compCount = rows.filter((row) => row.payment_status === 'comp').length;
  const pendingCount = rows.filter((row) => row.payment_status === 'pending').length;
  const confirmedRows = rows.filter((row) =>
    ['paid', 'comp'].includes(row.payment_status) &&
    (row.registration_status || 'active') === 'active'
  );
  const visibleRows = rosterView === 'confirmed' ? confirmedRows : rows;

  return (
    <>
      <section className="platform-section-card">
        <div className="platform-section-heading">
          <div>
            <p className="platform-eyebrow">ATC · Roster</p>
            <h2>Roster Maintenance</h2>
            <p>Run the golfer list from the same EIE event. Add players, import a spreadsheet, update payment status, comp, withdraw, cancel, reactivate, or move teams.</p>
          </div>
          <span>{loading ? 'Loading...' : `${rows.length} golfer${rows.length === 1 ? '' : 's'}`}</span>
        </div>

        <div className="eie-roster-inherited">
          <div><span>Structure</span><strong>{teamMode ? `${teamSize}-Player Team` : 'Individual'}</strong></div>
          <div><span>Divisions</span><strong>{settings.division === 'hidden' ? 'Off' : divisionOptions.length ? divisionOptions.join(' · ') : 'On / none configured'}</strong></div>
          <div><span>Audience</span><strong>{membersOnly ? 'Members Only' : 'Open / Public'}</strong></div>
          <div><span>Membership</span><strong>{membersOnly ? 'Member Required' : settings.membership === 'hidden' ? 'Hidden' : 'Member / Non-Member'}</strong></div>
          <div><span>Base Price</span><strong>{membersOnly ? money(event?.member_price) : `${money(event?.member_price)} / ${money(event?.non_member_price)}`}</strong></div>
          <div><span>Required Fields</span><strong>{[
            settings.dob === 'required' && 'DOB',
            settings.gender === 'required' && 'Gender',
            settings.division === 'required' && 'Division',
            settings.membership === 'required' && 'Membership',
            settings.ghin === 'required' && 'GHIN',
            ...customFields.filter((field) => field.required).map((field) => field.label),
          ].filter(Boolean).join(' · ') || 'Standard contact only'}</strong></div>
        </div>

        <div className="platform-stats-grid" style={{ marginBottom: 18 }}>
          <div className="platform-stat-card"><span>Active</span><strong>{activeCount}</strong><small>Current roster</small></div>
          <div className="platform-stat-card"><span>Paid</span><strong>{paidCount}</strong><small>Clubhouse / online</small></div>
          <div className="platform-stat-card"><span>Comp</span><strong>{compCount}</strong><small>Reason required</small></div>
          <div className="platform-stat-card"><span>Pending</span><strong>{pendingCount}</strong><small>Payment outstanding</small></div>
        </div>

        <div className="review-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <button className="platform-primary-button" type="button" onClick={() => { setManualOpen(true); setUploadOpen(false); setNotice(''); }}>+ Add Golfer Manually</button>
          <button className="platform-secondary-button" type="button" onClick={() => { setUploadOpen(true); setManualOpen(false); setNotice(''); }}>Upload Roster</button>
          <button className="platform-secondary-button" type="button" disabled={loading || syncWorking} onClick={onRefresh}>{loading ? 'Refreshing...' : 'Refresh Roster'}</button>
          <button className="platform-secondary-button" type="button" disabled={syncWorking} onClick={pullGoogleChanges}>{syncWorking ? 'Working...' : 'Pull Google Changes'}</button>
          <button className="platform-secondary-button" type="button" disabled={syncWorking} onClick={syncGoogleSheet}>{syncWorking ? 'Working...' : 'Sync Google Sheet'}</button>
          <button className="platform-secondary-button" type="button" disabled={requiredRosterWorking} onClick={openRequiredRosterSheet}>{requiredRosterWorking ? 'Preparing...' : 'Open Required Roster Sheet'}</button>
          {requiredRosterUrl && <button className="platform-secondary-button" type="button" onClick={() => window.open(requiredRosterUrl, '_blank', 'noopener,noreferrer')}>Reopen Required Roster Sheet</button>}
          {googleSheetUrl && <button className="platform-secondary-button" type="button" onClick={() => window.open(googleSheetUrl, '_blank', 'noopener,noreferrer')}>Open Roster Workbook</button>}
          <button className="platform-secondary-button" type="button" disabled={!rows.some((row) => ['paid','comp'].includes(row.payment_status) && (row.registration_status || 'active') === 'active')} onClick={exportGolfGenius}>Export Confirmed Golf Genius CSV</button>
        </div>

        {notice && <div className="message" style={{ marginTop: 16 }}>{notice}</div>}

        {manualOpen && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.1)' }}>
            <div className="platform-section-heading">
              <div><p className="platform-eyebrow">Roster Maintenance</p><h3>Add Golfer Manually</h3><p>For phone, clubhouse, staff-entered, or complimentary registrations.</p></div>
            </div>

            <div className="form-grid two">
              <label>First name *<input value={manualGolfer.first_name} onChange={(e) => updateManual('first_name', e.target.value)} /></label>
              <label>Last name *<input value={manualGolfer.last_name} onChange={(e) => updateManual('last_name', e.target.value)} /></label>
              <label>Email *<input type="email" value={manualGolfer.email} onChange={(e) => updateManual('email', e.target.value)} /></label>
              <label>Phone *<input type="tel" value={manualGolfer.phone} onChange={(e) => updateManual('phone', e.target.value)} /></label>

              {!membersOnly && settings.membership !== 'hidden' && (
                <label>Club Membership Status{settings.membership === 'required' ? ' *' : ''}
                  <select value={manualGolfer.membership_status} onChange={(e) => updateManual('membership_status', e.target.value)}>
                    <option>Member</option><option>Non-Member</option>
                  </select>
                </label>
              )}
              {membersOnly && <div className="availability-note"><strong>Members Only Event</strong><span>Manual registrations are treated as Member registrations and use the Member event price.</span></div>}
              {settings.division !== 'hidden' && (
                <label>Division{settings.division === 'required' ? ' *' : ''}
                  <select value={manualGolfer.division} onChange={(e) => updateManual('division', e.target.value)}>
                    <option value="">Not selected</option>
                    {divisionOptions.map((division) => <option key={division} value={division}>{division}</option>)}
                  </select>
                </label>
              )}
              {settings.dob !== 'hidden' && <label>Date of birth{settings.dob === 'required' ? ' *' : ''}<input type="date" value={manualGolfer.date_of_birth} onChange={(e) => updateManual('date_of_birth', e.target.value)} /></label>}
              {settings.gender !== 'hidden' && (
                <label>Gender{settings.gender === 'required' ? ' *' : ''}
                  <select value={manualGolfer.gender} onChange={(e) => updateManual('gender', e.target.value)}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </label>
              )}
              {settings.ghin !== 'hidden' && <label>GHIN #{settings.ghin === 'required' ? ' *' : ''}<input value={manualGolfer.ghin_number} onChange={(e) => updateManual('ghin_number', e.target.value)} /></label>}
              <label>Price override
                <input type="number" min="0" step="0.01" value={manualGolfer.price} onChange={(e) => updateManual('price', e.target.value)} placeholder={`Uses ${money(inheritedBasePrice)} event price`} />
                <small className="eie-field-help">Current registration price: <strong>{money(effectiveManualPrice)}</strong>{manualGolfer.price === '' ? ' · inherited from Event Setup' : ' · manual override'}</small>
              </label>

              {customFields.map((field) => (
                field.type === 'checkbox'
                  ? <label key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input style={{ width: 'auto' }} type="checkbox" checked={manualGolfer.custom_fields?.[field.id] === true} onChange={(e) => updateCustom(field.id, e.target.checked)} />{field.label}{field.required ? ' *' : ''}</label>
                  : field.type === 'select'
                    ? <label key={field.id}>{field.label}{field.required ? ' *' : ''}<select value={manualGolfer.custom_fields?.[field.id] || ''} onChange={(e) => updateCustom(field.id, e.target.value)}><option value="">Choose</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                    : <label key={field.id}>{field.label}{field.required ? ' *' : ''}<input value={manualGolfer.custom_fields?.[field.id] || ''} onChange={(e) => updateCustom(field.id, e.target.value)} /></label>
              ))}

              <label>Payment status
                <select value={manualGolfer.payment_status} onChange={(e) => updateManual('payment_status', e.target.value)}>
                  <option value="pending">Unpaid / pending</option>
                  <option value="comp">Comp player</option>
                </select>
              </label>
              {manualGolfer.payment_status === 'comp' && <label>Comp reason *<input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="Required reason for complimentary player" /></label>}
            </div>

            {duplicateWarning && <div className="message" style={{ marginTop: 16 }}>Possible duplicate: {duplicateWarning.map((row) => `${row.first_name} ${row.last_name}`).join(', ')}. Review the roster before choosing Add Anyway.</div>}

            <div className="review-actions" style={{ marginTop: 16 }}>
              <button className="platform-secondary-button" type="button" disabled={working} onClick={() => { setManualOpen(false); setManualGolfer(emptyGolfer()); setManualReason(''); setDuplicateWarning(null); }}>Cancel</button>
              <button className="platform-primary-button" type="button" disabled={
                working ||
                !manualGolfer.first_name.trim() ||
                !manualGolfer.last_name.trim() ||
                !manualGolfer.email.trim() ||
                !manualGolfer.phone.trim() ||
                missingRequiredManual ||
                (manualGolfer.payment_status === 'comp' && !manualReason.trim())
              } onClick={() => addManual(Boolean(duplicateWarning))}>
                {working ? 'Saving...' : duplicateWarning ? 'Add Anyway' : 'Add Golfer'}
              </button>
            </div>
          </div>
        )}
      </section>

      <RosterUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        event={{
          dbId: event.id,
          id: event.event_key,
          name: event.name,
          fields: {
            dob: settings.dob || 'optional',
            gender: settings.gender || 'optional',
            division: settings.division || 'optional',
            membership: settings.membership || 'optional',
            ghin: settings.ghin || 'optional',
          },
          customFields,
          divisions: divisionOptions,
          registrationFormat: settings.registration_format || 'individual',
          teamSize,
          memberPrice: Number(event?.member_price || 0),
          nonMemberPrice: Number(event?.non_member_price || 0),
          eventAccess: settings.event_access || 'public',
          googleSheetUrl: googleSheetUrl || event.google_sheet_url || '',
        }}
        existingRows={rows}
        onImported={async () => {
          await onRefresh();
          setNotice('Roster import complete and refreshed.');
        }}
      />

      <section className="platform-section-card">
        <div className="platform-section-heading">
          <div><p className="platform-eyebrow">ATC · Roster</p><h2>Golfers</h2><p>Choose Manage to work on one golfer. The selected row centers in the window and stays highlighted while its controls are open.</p></div>
          <span>{rows.length} total</span>
        </div>

        <div className="eie-roster-tabs" role="tablist" aria-label="Roster view">
          <button type="button" className={rosterView === 'all' ? 'active' : ''} onClick={() => setRosterView('all')}>
            All Registrations <span>{rows.length}</span>
          </button>
          <button type="button" className={rosterView === 'confirmed' ? 'active' : ''} onClick={() => setRosterView('confirmed')}>
            Confirmed Roster <span>{confirmedRows.length}</span>
          </button>
        </div>

        {!!bulkSelectedIds.length && (
          <div className="eie-bulk-roster-panel">
            <div><strong>{bulkSelectedIds.length} selected</strong><span>Apply one roster action to the selected golfers.</span></div>
            <div className="form-grid two">
              <label>Bulk action
                <select value={bulkAction} onChange={(e) => { setBulkAction(e.target.value); setBulkReason(''); setBulkTeamId(''); setNotice(''); }}>
                  <option value="">Choose an action</option>
                  <option value="paid_clubhouse">Mark Paid</option>
                  <option value="comp">Comp Players</option>
                  {teamMode && <option value="set_team">Set / Move Team</option>}
                  <option value="withdraw">Withdraw</option>
                  <option value="cancel">Cancel Registration</option>
                </select>
              </label>
              {bulkAction === 'set_team'
                ? <label>Team ID *<input value={bulkTeamId} onChange={(e) => setBulkTeamId(e.target.value)} placeholder="Example: 1" /></label>
                : <label>{bulkAction === 'comp' ? 'Reason *' : 'Reason / internal note'}<input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder={bulkAction === 'comp' ? 'Required reason for complimentary players' : 'Optional note'} /></label>}
            </div>
            <div className="review-actions" style={{ marginTop: 12 }}>
              <button className="platform-secondary-button" type="button" disabled={bulkWorking} onClick={() => { setBulkSelectedIds([]); setBulkAction(''); setBulkReason(''); setBulkTeamId(''); }}>Clear Selection</button>
              <button className="platform-primary-button" type="button" disabled={
                bulkWorking ||
                !bulkAction ||
                (bulkAction === 'comp' && !bulkReason.trim()) ||
                (bulkAction === 'set_team' && !bulkTeamId.trim())
              } onClick={applyBulkAction}>{bulkWorking ? 'Updating...' : `Apply to ${bulkSelectedIds.length} Selected`}</button>
            </div>
          </div>
        )}

        {!visibleRows.length ? (
          <div className="availability-note">
            <strong>{rosterView === 'confirmed' ? 'No confirmed golfers yet' : 'No golfers yet'}</strong>
            <span>{rosterView === 'confirmed' ? 'Confirmed golfers are active registrations with Paid or Comp status.' : 'Add a golfer manually or upload an organizer roster.'}</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th><input aria-label="Select all visible golfers" type="checkbox" style={{ width: 'auto' }} checked={visibleRows.length > 0 && visibleRows.every((row) => bulkSelectedIds.includes(row.id))} onChange={(e) => {
                if (e.target.checked) setBulkSelectedIds((current) => Array.from(new Set([...current, ...visibleRows.map((row) => row.id)])));
                else setBulkSelectedIds((current) => current.filter((id) => !visibleRows.some((row) => row.id === id)));
              }} /></th><th>Golfer</th>{teamMode && <th>Team</th>}<th>Contact</th><th>Price</th><th>Payment</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isSelected = selected?.id === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        data-registration-id={row.id}
                        className={isSelected ? 'eie-roster-row-selected' : ''}
                      >
                        <td><input aria-label={`Select ${row.first_name} ${row.last_name}`} type="checkbox" style={{ width: 'auto' }} checked={bulkSelectedIds.includes(row.id)} onChange={(e) => toggleBulkSelection(row.id, e.target.checked)} /></td>
                        <td><strong>{row.first_name} {row.last_name}</strong><small style={{ display: 'block', opacity: .7 }}>{row.membership_status || 'Member'}{row.division ? ` · ${row.division}` : ''}</small></td>
                        {teamMode && <td>{row.team_id || 'Unassigned'}</td>}
                        <td>{row.email || 'No email'}<small style={{ display: 'block', opacity: .7 }}>{row.phone || 'No phone'}</small></td>
                        <td>{money(row.price)}</td>
                        <td><span className="pill">{row.payment_status || 'pending'}</span></td>
                        <td><span className="pill">{row.registration_status || 'active'}</span></td>
                        <td><button className="platform-secondary-button" type="button" onClick={() => isSelected ? closeManage() : openManage(row)}>{isSelected ? 'Close' : 'Manage'}</button></td>
                      </tr>

                      {isSelected && (
                        <tr className="eie-roster-manage-row">
                          <td colSpan={teamMode ? 8 : 7}>
                            <div className="eie-roster-manage-panel">
                              <div>
                                <p className="platform-eyebrow">Manage Golfer</p>
                                <h3 style={{ marginTop: 4 }}>{selected.first_name} {selected.last_name}</h3>
                                <p className="platform-login-copy">Payment and roster status are tracked separately. Every action is written to the existing EIE audit history.</p>
                              </div>
                              <div className="form-grid two">
                                <label>Action
                                  <select value={action} onChange={(e) => { setAction(e.target.value); setReason(''); setNotice(''); }}>
                                    <option value="">Choose an action</option>
                                    <option value="paid_clubhouse">Mark Paid</option>
                                    <option value="comp">Comp Player</option>
                                    <option value="withdraw">Withdraw</option>
                                    <option value="cancel">Cancel Registration</option>
                                    {(selected.registration_status || 'active') !== 'active' && <option value="reactivate">Reactivate</option>}
                                    {teamMode && <option value="set_team">Set / Move Team</option>}
                                  </select>
                                </label>
                                {action === 'set_team'
                                  ? <label>Team ID *<input value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="Example: 1" /></label>
                                  : <label>{action === 'comp' ? 'Reason *' : 'Reason / internal note'}<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={action === 'comp' ? 'Required reason for complimentary player' : 'Optional note'} /></label>}
                              </div>
                              <div className="review-actions" style={{ marginTop: 16 }}>
                                <button className="platform-secondary-button" type="button" disabled={working} onClick={closeManage}>Close</button>
                                <button className="platform-primary-button" type="button" disabled={
                                  working ||
                                  !action ||
                                  (action === 'comp' && !reason.trim()) ||
                                  (action === 'set_team' && !teamId.trim())
                                } onClick={applyAction}>{working ? 'Saving...' : 'Apply Action'}</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

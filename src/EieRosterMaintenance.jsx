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
  const teamMode = settings.registration_format === 'team';
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

  function updateManual(field, value) {
    setManualGolfer((current) => ({ ...current, [field]: value }));
    setDuplicateWarning(null);
    setNotice('');
  }

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

  const activeCount = rows.filter((row) => (row.registration_status || 'active') === 'active').length;
  const paidCount = rows.filter((row) => row.payment_status === 'paid').length;
  const compCount = rows.filter((row) => row.payment_status === 'comp').length;
  const pendingCount = rows.filter((row) => row.payment_status === 'pending').length;

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

        <div className="platform-stats-grid" style={{ marginBottom: 18 }}>
          <div className="platform-stat-card"><span>Active</span><strong>{activeCount}</strong><small>Current roster</small></div>
          <div className="platform-stat-card"><span>Paid</span><strong>{paidCount}</strong><small>Clubhouse / online</small></div>
          <div className="platform-stat-card"><span>Comp</span><strong>{compCount}</strong><small>Reason required</small></div>
          <div className="platform-stat-card"><span>Pending</span><strong>{pendingCount}</strong><small>Payment outstanding</small></div>
        </div>

        <div className="review-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <button className="platform-primary-button" type="button" onClick={() => { setManualOpen(true); setUploadOpen(false); setNotice(''); }}>+ Add Golfer Manually</button>
          <button className="platform-secondary-button" type="button" onClick={() => { setUploadOpen(true); setManualOpen(false); setNotice(''); }}>Upload Roster</button>
          <button className="platform-secondary-button" type="button" disabled={loading} onClick={onRefresh}>{loading ? 'Refreshing...' : 'Refresh Roster'}</button>
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

              {settings.membership !== 'hidden' && (
                <label>Club membership
                  <select value={manualGolfer.membership_status} onChange={(e) => updateManual('membership_status', e.target.value)}>
                    <option>Member</option><option>Non-Member</option>
                  </select>
                </label>
              )}
              {settings.division !== 'hidden' && <label>Division{settings.division === 'required' ? ' *' : ''}<input value={manualGolfer.division} onChange={(e) => updateManual('division', e.target.value)} /></label>}
              {settings.dob !== 'hidden' && <label>Date of birth{settings.dob === 'required' ? ' *' : ''}<input type="date" value={manualGolfer.date_of_birth} onChange={(e) => updateManual('date_of_birth', e.target.value)} /></label>}
              {settings.gender !== 'hidden' && <label>Gender{settings.gender === 'required' ? ' *' : ''}<input value={manualGolfer.gender} onChange={(e) => updateManual('gender', e.target.value)} /></label>}
              {settings.ghin !== 'hidden' && <label>GHIN #{settings.ghin === 'required' ? ' *' : ''}<input value={manualGolfer.ghin_number} onChange={(e) => updateManual('ghin_number', e.target.value)} /></label>}
              <label>Price override<input type="number" min="0" step="0.01" value={manualGolfer.price} onChange={(e) => updateManual('price', e.target.value)} placeholder="Leave blank for event price" /></label>

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
          googleSheetUrl: event.google_sheet_url || '',
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

        {!rows.length ? (
          <div className="availability-note"><strong>No golfers yet</strong><span>Add a golfer manually or upload an organizer roster.</span></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Golfer</th>{teamMode && <th>Team</th>}<th>Contact</th><th>Price</th><th>Payment</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const isSelected = selected?.id === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        data-registration-id={row.id}
                        className={isSelected ? 'eie-roster-row-selected' : ''}
                      >
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
                          <td colSpan={teamMode ? 7 : 6}>
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

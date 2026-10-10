import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

function isTba(row) {
  return row?.custom_fields?.reserved_tba === true ||
    String(row?.first_name || '').trim().toUpperCase() === 'TBA';
}
function golferName(row) {
  return isTba(row) ? 'TBA / Reserved Spot' :
    [row?.first_name, row?.last_name].filter(Boolean).join(' ') || 'Unknown golfer';
}
function numericTeam(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}
async function messageFromError(error) {
  try {
    const data = await error?.context?.json();
    if (data?.error) return data.error;
  } catch {}
  return error?.message || 'Team update failed.';
}
const blank = () => ({ first_name: '', last_name: '', email: '', phone: '', ghin_number: '', division: '' });
const panelStyle = { padding: 18, borderRadius: 14, border: '1px solid #dfe4ec', background: '#fff', color: '#1D245D' };
const muted = { color: '#70727A', fontSize: 13, lineHeight: 1.5 };
const thStyle = { padding: 10, textAlign: 'left', borderBottom: '1px solid #dfe4ec' };
const tdStyle = { padding: 10, borderBottom: '1px solid #edf0f4', verticalAlign: 'middle' };

export default function EieTeamManagement({ event, onRefresh, onClose }) {
  const [teams, setTeams] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [incompleteOnly, setIncompleteOnly] = useState(true);
  const [sort, setSort] = useState({ field: 'number', direction: 'asc' });
  const [teamId, setTeamId] = useState('');
  const [action, setAction] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [targetTeamId, setTargetTeamId] = useState('');
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [fields, setFields] = useState(blank);
  const [reason, setReason] = useState('');

  async function invoke(body) {
    const { data, error: failed } = await supabase.functions.invoke('golf-admin-team-management', {
      body: { event_id: event.id, ...body },
    });
    if (failed) throw new Error(await messageFromError(failed));
    if (!data?.success) throw new Error(data?.error || 'Team update was not saved.');
    return data;
  }
  async function reload(keepCurrent = true) {
    setLoading(true);
    try {
      const data = await invoke({ action: 'list' });
      const nextTeams = data.teams || [];
      const nextPlayers = data.registrations || [];
      setTeams(nextTeams);
      setRegistrations(nextPlayers);
      setTeamId((old) => keepCurrent && nextTeams.some((t) => t.id === old) ? old :
        nextTeams.find((t) => t.status === 'roster_incomplete')?.id || nextTeams[0]?.id || '');
      setError('');
    } catch (caught) {
      setError(caught.message || 'Unable to load team manager.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setTeamId('');
    setAction('');
    reload(false);
  }, [event.id]);

  const membersByTeam = useMemo(() => {
    const byTeam = new Map();
    for (const row of registrations) {
      if (!byTeam.has(row.team_id)) byTeam.set(row.team_id, []);
      byTeam.get(row.team_id).push(row);
    }
    return byTeam;
  }, [registrations]);
  const selectedTeam = teams.find((t) => t.id === teamId) || null;
  const selectedMembers = useMemo(() => (membersByTeam.get(selectedTeam?.team_id) || []).slice().sort((a, b) => {
    if (a.id === selectedTeam?.captain_registration_id) return -1;
    if (b.id === selectedTeam?.captain_registration_id) return 1;
    if (isTba(a) !== isTba(b)) return isTba(a) ? 1 : -1;
    return golferName(a).localeCompare(golferName(b));
  }), [membersByTeam, selectedTeam]);
  const selectedPlayer = registrations.find((p) => p.id === playerId);
  const targetTeam = teams.find((t) => t.id === targetTeamId);
  const targetMembers = (membersByTeam.get(targetTeam?.team_id) || []).filter((p) => p.registration_status === 'active');
  const targetPlayer = targetMembers.find((p) => p.id === targetPlayerId);
  const captain = selectedMembers.find((p) => p.id === selectedTeam?.captain_registration_id);

  const shownTeams = useMemo(() => teams.filter((t) => {
    if (incompleteOnly && t.status !== 'roster_incomplete') return false;
    const players = membersByTeam.get(t.team_id) || [];
    const value = [t.entry_number,t.team_name, ...players.flatMap((r) => [r.first_name,r.last_name,r.email])]
      .filter(Boolean).join(' ').toLowerCase();
    return value.includes(search.toLowerCase().trim());
  }).sort((a, b) => {
    const ac = membersByTeam.get(a.team_id) || [];
    const bc = membersByTeam.get(b.team_id) || [];
    const capA = golferName(ac.find((p) => p.id === a.captain_registration_id));
    const capB = golferName(bc.find((p) => p.id === b.captain_registration_id));
    const openA = ac.filter(isTba).length;
    const openB = bc.filter(isTba).length;
    let compare = 0;
    if (sort.field === 'number') compare = numericTeam(a.entry_number) - numericTeam(b.entry_number) ||
      String(a.entry_number).localeCompare(String(b.entry_number));
    else if (sort.field === 'captain') compare = capA.localeCompare(capB);
    else if (sort.field === 'open') compare = openA - openB;
    else compare = String(a.status).localeCompare(String(b.status));
    return compare * (sort.direction === 'asc' ? 1 : -1);
  }), [teams, membersByTeam, search, incompleteOnly, sort]);
  function sortBy(field) {
    setSort((s) => ({ field, direction: s.field === field && s.direction === 'asc' ? 'desc' : 'asc' }));
  }
  function begin(nextAction, row) {
    setAction(nextAction);
    setPlayerId(row.id);
    setTargetTeamId('');
    setTargetPlayerId('');
    setReason('');
    setNotice('');
    setError('');
    setFields({
      first_name: isTba(row) ? '' : row.first_name || '',
      last_name: isTba(row) ? '' : row.last_name || '',
      email: row.email || '',
      phone: row.phone || '',
      ghin_number: row.ghin_number || '',
      division: row.division || '',
    });
  }
  function selectTeam(id) {
    setTeamId(id);
    setAction('');
    setPlayerId('');
    setNotice('');
    setError('');
  }
  async function resendInvite(row) {
    if (working || !row?.id || !row.email || row.user_id || row.passenger_claim_status === 'claimed') return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const response = await invoke({ action: 'resend_invite', registration_id: row.id });
      setNotice(response.email_sent ? 'Registration invitation sent to ' + row.email :
        response.warnings?.join(' ') || 'Invitation saved but email delivery needs attention.');
      await reload();
      if (onRefresh) await onRefresh();
    } catch (caught) {
      setError(caught.message || 'Could not resend the account invitation.');
    } finally {
      setWorking(false);
    }
  }

  async function save() {
    if (!selectedTeam || !selectedPlayer || working) return;
    const normalizedAction = action === 'move_or_swap'
      ? (isTba(targetPlayer) ? 'move_to_tba' : 'swap') : action;
    let registrationId = selectedPlayer.id;
    let otherRegistrationId = targetPlayer?.id || null;
    if (action === 'transfer_captain') {
      registrationId = selectedTeam.captain_registration_id;
      otherRegistrationId = selectedPlayer.id;
    }
    if (action === 'move_or_swap' && (!targetPlayer || !targetTeam || targetTeam.id === selectedTeam.id)) {
      setError('Choose a golfer or TBA spot on another team.');
      return;
    }
    if (['fill_tba','edit_player'].includes(action) && (!fields.first_name.trim() || !fields.last_name.trim() || !fields.email.trim())) {
      setError('First name, last name and email are required.');
      return;
    }
    let confirmText = '';
    if (normalizedAction === 'transfer_captain') {
      confirmText = 'Make ' + golferName(selectedPlayer) + ' captain of Team #' +
        selectedTeam.entry_number + '? The existing team fee and payment history will not move.';
    } else if (normalizedAction === 'swap' || normalizedAction === 'move_to_tba') {
      confirmText = (normalizedAction === 'swap' ? 'Swap ' : 'Move ') +
        golferName(selectedPlayer) + ' (Team #' + selectedTeam.entry_number + ') ' +
        (normalizedAction === 'swap' ? 'with ' + golferName(targetPlayer) : 'into an open spot') +
        ' (Team #' + targetTeam.entry_number + ')?\n\nTeam numbers and payment history stay with each team. Golfer names, account connections and captain permissions move together.';
    } else {
      confirmText = (action === 'fill_tba' ? 'Fill' : 'Update') + ' ' +
        golferName(selectedPlayer) + ' on Team #' + selectedTeam.entry_number + '?';
    }
    if (!window.confirm(confirmText)) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const response = await invoke({
        action: normalizedAction, registration_id: registrationId,
        other_registration_id: otherRegistrationId,
        fields: ['fill_tba','edit_player'].includes(action) ? fields : {},
        reason: reason.trim() || null,
      });
      setAction('');
      setPlayerId('');
      setTargetTeamId('');
      setTargetPlayerId('');
      setNotice('Saved. ' + (response.warnings?.length ? response.warnings.join(' · ') : 'Team roster updated and invitations processed.'));
      await reload();
      if (onRefresh) await onRefresh();
    } catch (caught) {
      setError(caught?.message || 'Unable to save team changes.');
    } finally {
      setWorking(false);
    }
  }

  return <section className="eie-team-manager" style={{ ...panelStyle, marginTop: 20, padding: 22 }} aria-label="Team and Player Manager">
    <div className="platform-section-heading" style={{ gap: 12 }}>
      <div>
        <p className="platform-eyebrow">EIE · Staff Operations</p>
        <h3>Manage Teams & Players</h3>
        <p style={muted}>Fill missing golfers, edit registration details, move or swap players, and transfer captains. Team / Entry numbers and payment records remain with their teams.</p>
      </div>
      <div className="review-actions">
        <button type="button" className="platform-secondary-button" disabled={loading || working} onClick={() => reload()}>{loading ? 'Loading...' : 'Refresh Teams'}</button>
        <button type="button" className="platform-secondary-button" onClick={onClose}>Close Manager</button>
      </div>
    </div>
    {error && <div role="alert" className="platform-error" style={{ marginBottom: 14 }}>{error}</div>}
    {notice && <div role="status" className="message" style={{ marginBottom: 14 }}>{notice}</div>}
    <div className="form-grid two" style={{ marginBottom: 14 }}>
      <label>Search teams, golfers or email
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Team #, captain, golfer..." />
      </label>
      <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={incompleteOnly} onChange={(e) => setIncompleteOnly(e.target.checked)} />
        Show incomplete teams only ({teams.filter((t) => t.status === 'roster_incomplete').length})
      </label>
    </div>
    <div style={{ overflowX: 'auto', maxHeight: 350, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
        <thead><tr>
          {[['number','Team / Entry #'],['captain','Captain'],['open','TBA Spots'],['status','Roster Status']].map(([key,label]) =>
            <th key={key} style={thStyle}><button type="button" className="eie-sort-header" onClick={() => sortBy(key)}>
              {label} {sort.field === key ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
            </button></th>)}
        </tr></thead>
        <tbody>
          {shownTeams.map((team) => {
            const members = membersByTeam.get(team.team_id) || [];
            const captainRow = members.find((row) => row.id === team.captain_registration_id);
            const open = members.filter(isTba).length;
            return <tr key={team.id} style={{ background: team.id === teamId ? '#eef2fd' : 'transparent' }}>
              <td style={tdStyle}><button className="platform-secondary-button" style={{ padding: '7px 10px' }} type="button" onClick={() => selectTeam(team.id)}><strong>#{team.entry_number}</strong> · Manage</button></td>
              <td style={tdStyle}>{golferName(captainRow)}</td>
              <td style={tdStyle}>{open}</td>
              <td style={tdStyle}>{team.status === 'roster_complete' ? 'Complete' : 'Needs golfers'}</td>
            </tr>;
          })}
          {!shownTeams.length && <tr><td colSpan={4} style={tdStyle}>{loading ? 'Loading teams...' : 'No matching teams.'}</td></tr>}
        </tbody>
      </table>
    </div>

    {selectedTeam && <div style={{ ...panelStyle, background: '#f8f9fc', marginTop: 16 }}>
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">Selected Team</p><h3>Team / Entry #{selectedTeam.entry_number}</h3>
          <p style={muted}>Captain: {golferName(captain)} · {selectedMembers.filter(isTba).length} TBA · {selectedTeam.payment_mode === 'captain_all' ? 'Captain covers team fee' : 'Team payment arrangements'}</p></div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {selectedMembers.map((r) => <div key={r.id} style={{ ...panelStyle, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 12 }}>
          <div style={{ flex: '1 1 210px', minWidth: 180 }}>
            <strong>{golferName(r)}</strong>
            {r.id === selectedTeam.captain_registration_id && <span style={{ ...muted, marginLeft: 9 }}>Captain</span>}
            <div style={muted}>{isTba(r) ? 'Reserved opening' : (r.email || 'No email')} · {r.user_id ? 'Passenger linked' : 'Unclaimed'} · {r.payment_status === 'paid' ? 'Team fee covered' : 'Payment pending'}</div>
          </div>
          <div className="review-actions" style={{ gap: 6 }}>
            {isTba(r) ? <button className="platform-primary-button" type="button" onClick={() => begin('fill_tba',r)}>Fill TBA</button> : <>
              <button className="platform-secondary-button" type="button" onClick={() => begin('edit_player',r)}>Edit</button>
              {!r.user_id && r.passenger_claim_status !== 'claimed' && !!r.email &&
                <button className="platform-secondary-button" type="button" disabled={working} onClick={() => resendInvite(r)}>Resend Account Invite</button>}
              <button className="platform-secondary-button" type="button" onClick={() => begin('move_or_swap',r)}>Move / Swap</button>
              {r.id !== selectedTeam.captain_registration_id &&
                <button className="platform-secondary-button" type="button" disabled={!r.user_id || r.passenger_claim_status !== 'claimed'}
                  title={!r.user_id ? 'Golfer must claim their Passenger account before becoming captain' : ''} onClick={() => begin('transfer_captain',r)}>Make Captain</button>}
            </>}
          </div>
        </div>)}
      </div>
      {action && selectedPlayer && <div style={{ ...panelStyle, marginTop: 16, borderColor: '#b5c1df' }}>
        <div className="platform-section-heading"><div><p className="platform-eyebrow">Staff Change · Team #{selectedTeam.entry_number}</p>
          <h3>{action === 'fill_tba' ? 'Fill Reserved Spot' : action === 'edit_player' ? 'Edit Golfer' : action === 'transfer_captain' ? 'Transfer Captain' : 'Move / Swap Golfer'}</h3>
        </div></div>
        {['fill_tba','edit_player'].includes(action) && <div className="form-grid two">
          {[['first_name','First name'],['last_name','Last name'],['email','Email'],['phone','Phone'],['ghin_number','GHIN'],['division','Division']].map(([key,label]) =>
            <label key={key}>{label}{['first_name','last_name','email'].includes(key) ? ' *' : ''}
              <input type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={fields[key] || ''}
                disabled={working || (key === 'email' && action === 'edit_player' && !!selectedPlayer.user_id)}
                onChange={(e) => setFields((s) => ({ ...s, [key]: e.target.value }))}/>
            </label>)}
          {action === 'edit_player' && !!selectedPlayer.user_id && <p style={muted}>Linked Passenger email is managed through Account Management.</p>}
        </div>}
        {action === 'move_or_swap' && <div className="form-grid two">
          <label>Destination team
            <select value={targetTeamId} onChange={(e) => { setTargetTeamId(e.target.value); setTargetPlayerId(''); }}>
              <option value="">Choose team...</option>
              {teams.filter((t) => t.id !== teamId).sort((a,b) => numericTeam(a.entry_number) - numericTeam(b.entry_number)).map((t) =>
                <option key={t.id} value={t.id}>Team #{t.entry_number} · {(membersByTeam.get(t.team_id) || []).filter(isTba).length} TBA</option>)}
            </select>
          </label>
          <label>Golfer / destination spot
            <select value={targetPlayerId} onChange={(e) => setTargetPlayerId(e.target.value)} disabled={!targetTeamId}>
              <option value="">Choose a golfer or open spot...</option>
              {targetMembers.map((r) => <option key={r.id} value={r.id}>
                {golferName(r)}{r.id === targetTeam?.captain_registration_id ? ' (captain)' : ''}
              </option>)}
            </select>
          </label>
          {targetPlayer && <p style={muted}>{isTba(targetPlayer) ? 'Moves your golfer into this TBA spot and leaves a TBA behind.' : 'Exchanges the two golfers.'} Account links follow the golfers. Team numbers and existing payment records stay in place.</p>}
        </div>}
        {action === 'transfer_captain' && <p style={muted}>Give {golferName(selectedPlayer)} permission to manage this team. The original captain stays registered as a teammate. Existing payment history is preserved.</p>}
        <label>Reason / staff note (optional)
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Roster correction" maxLength={1500} disabled={working}/>
        </label>
        <div className="review-actions" style={{ marginTop: 14 }}>
          <button className="platform-primary-button" type="button" disabled={working || loading || (action === 'move_or_swap' && !targetPlayerId)} onClick={save}>
            {working ? 'Saving...' : 'Review & Confirm'}
          </button>
          <button className="platform-secondary-button" type="button" disabled={working} onClick={() => setAction('')}>Cancel</button>
        </div>
      </div>}
    </div>}
  </section>;
}
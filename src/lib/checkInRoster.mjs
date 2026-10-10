import { FALL_8IN_CUP_EVENT_ID, isReservedTba, numericTeamId } from '../rosterNumbering.mjs';

/**
 * Starting holes from the organizer-supplied Golf Genius tee sheet:
 * "2026 Chapel Hill GC Fall 8\" Cup", Round 1, Sat Oct 10, 9:00 AM.
 *
 * These are NOT sequential EIE Team IDs. Names were reconciled against all
 * 31 complete Fall 8in Cup teams, including the Team 19 / 20 paid swap.
 * Assignments are read-only labels and never modify payment or roster data.
 */
export const FALL_8IN_CUP_TEE_SHEET = Object.freeze([
  ['1A','15'], ['1B','31'], ['2A','23'], ['2B','22'],
  ['3','29'], ['4','24'], ['5A','7'], ['5B','8'],
  ['6A','25'], ['6B','26'], ['7A','28'], ['7B','12'],
  ['8A','3'], ['8B','30'], ['9A','21'], ['9B','9'],
  ['10A','17'], ['10B','18'], ['11A','19'], ['11B','20'],
  ['12A','14'], ['12B','11'], ['13','2'], ['14A','27'],
  ['14B','10'], ['15','4'], ['16A','5'], ['16B','6'],
  ['17','13'], ['18A','16'], ['18B','1'],
].map(([hole, team_id]) => Object.freeze({ hole, team_id, tee_time:'9:00 AM' })));

/**
 * Active registrations, per-golfer payment flags, and the current team captain
 * come from authorized EIE staff roster data. Only starting holes use the
 * exported Golf Genius tee sheet. Do NOT copy payment status from Golf Genius.
 */
export function buildPrintableCheckInRoster({ event, registrations = [], teams = [] }) {
  const eventId = String(event?.id || '');
  const teamSize = Math.max(2, Number(event?.field_settings?.team_size || 4));
  if (!eventId || !Array.isArray(registrations) || !Array.isArray(teams)) {
    throw new Error('The event roster is not available.');
  }
  if (!Number.isSafeInteger(teamSize) || teamSize > 4) {
    throw new Error('This four-column check-in print layout supports team sizes of two to four.');
  }

  const active = registrations.filter(r =>
    r && (r.registration_status || 'active') === 'active' &&
    (!r.event_id || String(r.event_id) === eventId)
  );
  const byId = new Map(active.map(r => [String(r.id), r]));
  const byTeam = new Map();
  for (const golfer of active) {
    const key = String(golfer.team_id || '').trim();
    if (!key) continue;
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key).push(golfer);
  }

  const teamByNumber = new Map();
  for (const team of teams) {
    if (team.event_id && String(team.event_id) !== eventId) continue;
    const key = String(team.team_id ?? '').trim();
    if (key) teamByNumber.set(key, team);
  }

  const isFall = eventId === FALL_8IN_CUP_EVENT_ID;
  const teePositions = isFall ? FALL_8IN_CUP_TEE_SHEET : [];
  const byStartingHole = new Map(teePositions.map((entry, index) =>
    [entry.team_id, { ...entry, tee_order: index }]
  ));
  const teamKeys = new Set([...byTeam.keys(), ...teamByNumber.keys()]);
  const warnings = [];

  const rows = [...teamKeys].map(team_id => {
    const members = (byTeam.get(team_id) || []).slice().sort((a, b) =>
      String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
      String(a.id || '').localeCompare(String(b.id || ''))
    );
    if (members.length > teamSize) throw new Error(
      'Team #' + team_id + ' has ' + members.length + ' active golfers; correct the roster before printing.'
    );
    const team = teamByNumber.get(team_id);
    const captain = byId.get(String(team?.captain_registration_id || ''));
    const validCaptain = captain && String(captain.team_id) === team_id && !isReservedTba(captain) &&
      String(captain.first_name || '').trim() && String(captain.last_name || '').trim();
    let numberedTbas = 0;
    const players = members.map(golfer => {
      let name = [golfer.first_name, golfer.last_name].filter(Boolean).join(' ').trim();
      if (isReservedTba(golfer)) {
        numberedTbas += 1;
        if (validCaptain) {
          name = [captain.first_name, captain.last_name].filter(Boolean).join(' ').trim() + ' ' + numberedTbas;
        } else {
          name = 'TBA ' + numberedTbas;
          warnings.push('Team #' + team_id + ' needs a current captain name for its TBA labels.');
        }
      }
      return {
        id: golfer.id,
        name,
        is_tba: isReservedTba(golfer),
        payment_status: String(golfer.payment_status || 'pending').toLowerCase(),
      };
    });
    if (members.length < teamSize) warnings.push('Team #' + team_id + ' has ' + members.length + ' of ' + teamSize + ' roster spots.');
    while (players.length < teamSize) players.push({ id: null, name: 'Open spot', payment_status: '', is_tba:true });
    const tee = byStartingHole.get(team_id);
    if (isFall && !tee) warnings.push('Team #' + team_id + ' has no starting hole in the supplied Golf Genius tee sheet.');
    return {
      team_id,
      team_entry_number: String(team?.entry_number || team_id),
      hole: tee?.hole || '',
      tee_time: tee?.tee_time || '',
      tee_order: tee?.tee_order ?? Number.MAX_SAFE_INTEGER,
      players,
    };
  }).sort((a, b) =>
    a.tee_order - b.tee_order ||
    (numericTeamId(a.team_id) ?? 999999) - (numericTeamId(b.team_id) ?? 999999) ||
    a.team_id.localeCompare(b.team_id)
  );

  for (const spot of teePositions) {
    if (!teamKeys.has(spot.team_id)) warnings.push('Starting hole ' + spot.hole + ': Team #' + spot.team_id + ' is not in the current roster.');
  }

  const summary = { teams: rows.length, golfers: active.length, paid: 0, comp: 0, pending: 0, other:0, assigned_holes:rows.filter(row=>Boolean(row.hole)).length };
  for (const row of rows) {
    for (const player of row.players) {
      if (!player.id) continue;
      if (player.payment_status === 'paid') summary.paid++;
      else if (player.payment_status === 'comp') summary.comp++;
      else if (player.payment_status === 'pending') summary.pending++;
      else summary.other++;
    }
  }

  return { eventId, eventName:event?.name || 'Event', rows, summary, warnings, teamSize };
}

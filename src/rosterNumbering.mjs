/**
 * Roster entry numbers are DISPLAY / EXPORT numbers, never database IDs.
 *
 * A four-player team's stable Team ID 19 maps to entries 73-76.
 * Derive positions from the complete ACTIVE team roster BEFORE applying
 * payment filters, searches, or visual sorting. Neither money nor team
 * ownership is changed by numbering.
 */
const active = (r) => (r?.registration_status || 'active') === 'active';

const comparePosition = (a, b) =>
  String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
  String(a.id || '').localeCompare(String(b.id || ''));

export function numericTeamId(value) {
  const raw = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function isReservedTba(row) {
  return row?.custom_fields?.reserved_tba === true ||
    String(row?.first_name || '').trim().toUpperCase() === 'TBA';
}

export function buildRosterEntryNumbers(rows, teamSize = 4, teamMode = true) {
  const result = new Map();
  const records = (Array.isArray(rows) ? rows : []).filter(active);
  if (!teamMode) {
    records.slice().sort(comparePosition).forEach((row, i) => {
      if (row.id) result.set(row.id, i + 1);
    });
    return result;
  }

  const size = Number(teamSize);
  if (!Number.isSafeInteger(size) || size < 2 || size > 12) return result;
  const grouped = new Map();
  for (const row of records) {
    const key = String(row.team_id ?? '').trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  for (const [key, members] of grouped.entries()) {
    const teamNumber = numericTeamId(key);
    if (teamNumber === null || members.length > size) continue;
    members.sort(comparePosition).forEach((row, i) => {
      if (row.id) result.set(row.id, (teamNumber - 1) * size + i + 1);
    });
  }
  return result;
}

export function golfGeniusRosterRows(rows, { teamSize = 4, teamMode = true, scope = 'confirmed' } = {}) {
  if (scope !== 'confirmed' && scope !== 'all') throw new Error('Unsupported Golf Genius roster scope');
  const activeRows = (Array.isArray(rows) ? rows : []).filter(active);
  const numbers = buildRosterEntryNumbers(activeRows, teamSize, teamMode);
  const selected = scope === 'all' ? activeRows : activeRows.filter((row) =>
    ['paid', 'comp'].includes(row.payment_status)
  );
  if (!selected.length) throw new Error('No golfers match this export');

  if (teamMode) {
    const badTeam = selected.find((row) => numericTeamId(row.team_id) === null);
    if (badTeam) throw new Error('A golfer needs a valid numeric Team ID before Golf Genius export');
    const missingSlot = selected.find((row) => !numbers.has(row.id));
    if (missingSlot) throw new Error('A team has more players than its configured size or a missing roster slot');
    const seen = new Set();
    for (const row of selected) {
      const number = numbers.get(row.id);
      if (seen.has(number)) throw new Error('Duplicate golfer entry number; check Team IDs');
      seen.add(number);
    }
  }

  return selected
    .slice()
    .sort((a, b) => (numbers.get(a.id) || Number.MAX_SAFE_INTEGER) -
      (numbers.get(b.id) || Number.MAX_SAFE_INTEGER) || comparePosition(a, b))
    .map((row) => ({
      ...row,
      __export_team_id: teamMode ? String(row.team_id).trim() : '',
      __export_entry_number: numbers.get(row.id) ?? '',
      // Preserve the internal TBA/Reserved flag for later claims; only
      // normalize the exported name to match Golf Genius's TBA/TBA rows.
      __export_first_name: isReservedTba(row) ? 'TBA' : (row.first_name || ''),
      __export_last_name: isReservedTba(row) ? 'TBA' : (row.last_name || ''),
    }));
}

/**
 * Golf Genius can assign golfer entry numbers on import. For the Fall 8" Cup,
 * only Team ID and first/last name are needed. Keep the richer export for other
 * events and all internal roster numbering unchanged.
 */
export const FALL_8IN_CUP_EVENT_ID = '56cfd38c-6b97-4c63-ad4a-fc72642ac2ab';

export function golfGeniusCsvFields(exportedRows, eventId) {
  const simple = String(eventId || '') === FALL_8IN_CUP_EVENT_ID;
  return {
    headers: simple
      ? ['Team Id', 'First Name', 'Last Name']
      : ['Team Id', 'Entry Number', 'First Name', 'Last Name',
        'Email', 'Phone', 'Payment Status', 'Registration ID'],
    records: exportedRows.map(row => simple
      ? [row.__export_team_id, row.__export_first_name, row.__export_last_name]
      : [row.__export_team_id, row.__export_entry_number,
        row.__export_first_name, row.__export_last_name,
        row.email ?? '', row.phone ?? '', row.payment_status || 'pending', row.id]),
  };
}

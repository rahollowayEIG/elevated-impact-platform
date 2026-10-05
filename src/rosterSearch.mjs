function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return ''; }
  }
  return String(value);
}

function normalize(value) {
  return text(value).trim().toLowerCase();
}

function compact(value) {
  return normalize(value).replace(/[\s().+\-]/g, '');
}

export function rosterMatchesSearch(row, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  const values = [
    row?.first_name,
    row?.last_name,
    [row?.first_name, row?.last_name].filter(Boolean).join(' '),
    row?.email,
    row?.phone,
    row?.team_id,
    row?.entry_number,
    row?.ghin_number,
    row?.division,
    row?.membership_status,
    row?.payment_status,
    row?.registration_status,
    row?.tee,
    row?.custom_fields,
  ];

  const haystack = values.map(text).join(' ').toLowerCase();
  if (haystack.includes(normalizedQuery)) return true;

  const compactQuery = compact(normalizedQuery);
  if (compactQuery.length < 3) return false;
  return compact(haystack).includes(compactQuery);
}

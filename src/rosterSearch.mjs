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


const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortValue(row, field) {
  switch (field) {
    case 'golfer':
      return [row?.last_name, row?.first_name].filter(Boolean).join(', ');
    case 'team':
      return row?.team_id ?? '';
    case 'contact':
      return row?.email || row?.phone || '';
    case 'price':
      return Number(row?.price || 0);
    case 'payment':
      return row?.payment_status || '';
    case 'status':
      return row?.registration_status || 'active';
    default:
      return '';
  }
}

export function sortRosterRows(rows, sort) {
  if (!Array.isArray(rows) || !sort?.field) return Array.isArray(rows) ? [...rows] : [];
  const direction = sort.direction === 'desc' ? -1 : 1;

  return rows
    .map((row, index) => ({ row, index, value: sortValue(row, sort.field) }))
    .sort((a, b) => {
      const aValue = a.value;
      const bValue = b.value;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (aValue !== bValue) return (aValue - bValue) * direction;
      } else {
        const compared = collator.compare(String(aValue ?? ''), String(bValue ?? ''));
        if (compared !== 0) return compared * direction;
      }

      return a.index - b.index;
    })
    .map(({ row }) => row);
}

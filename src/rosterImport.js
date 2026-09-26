const FIELD_OPTIONS = [
  { value: '', label: 'Ignore this column' },
  { value: 'entry_number', label: 'Entry #' },
  { value: 'team_id', label: 'Team ID' },
  { value: 'full_name', label: 'Full Name' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'membership_status', label: 'Club Membership Status' },
  { value: 'division', label: 'Division' },
  { value: 'ghin_number', label: 'GHIN' },
  { value: 'date_of_birth', label: 'Date of Birth' },
  { value: 'gender', label: 'Gender' },
  { value: 'payment_status', label: 'Payment Status' },
  { value: 'price', label: 'Price' },
  { value: 'comp_reason', label: 'Comp Reason' }
];

const ALIASES = {
  entry_number: ['entry', 'entry #', 'entry number', 'entry no', 'entry no.', 'registration number', 'registration #'],
  team_id: ['team', 'team id', 'team #', 'team number', 'group', 'group id'],
  full_name: ['name', 'golfer', 'golfer name', 'player', 'player name', 'participant', 'participant name'],
  first_name: ['first', 'first name', 'firstname', 'given name'],
  last_name: ['last', 'last name', 'lastname', 'surname', 'family name'],
  email: ['email', 'email address', 'e-mail', 'e-mail address'],
  phone: ['phone', 'phone number', 'mobile', 'mobile phone', 'cell', 'cell phone'],
  membership_status: ['member', 'member status', 'membership', 'membership status', 'club membership status', 'member type'],
  division: ['division', 'flight', 'class'],
  ghin_number: ['ghin', 'ghin id', 'ghin number', 'handicap id'],
  date_of_birth: ['dob', 'date of birth', 'birth date', 'birthday'],
  gender: ['gender', 'sex'],
  payment_status: ['payment', 'payment status', 'paid', 'paid status'],
  price: ['price', 'amount', 'fee', 'registration fee'],
  comp_reason: ['comp reason', 'complimentary reason', 'waiver reason', 'reason']
};

const STANDARD_TEMPLATE_FIELDS = {
  dob: { value: 'date_of_birth', label: 'Date of Birth' },
  gender: { value: 'gender', label: 'Gender' },
  division: { value: 'division', label: 'Division' },
  membership: { value: 'membership_status', label: 'Club Membership Status' },
  ghin: { value: 'ghin_number', label: 'GHIN' }
};

export function getRequiredRosterColumns(event = {}) {
  const columns = [
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' }
  ];

  const fields = event?.fields || {};
  Object.entries(STANDARD_TEMPLATE_FIELDS).forEach(([key, definition]) => {
    if (fields[key] === 'required') columns.push(definition);
  });

  (event?.customFields || [])
    .filter((field) => field?.id && field?.label && field.required)
    .forEach((field) => {
      columns.push({
        value: `custom:${field.id}`,
        label: String(field.label)
      });
    });

  return columns;
}

export function getRequiredRosterMappingKeys(event = {}) {
  return getRequiredRosterColumns(event).map((column) => column.value);
}

export function isEieRequiredRosterTemplate(headers = [], event = {}) {
  const expected = getRequiredRosterColumns(event).map((column) =>
    normalizeHeader(column.label)
  );
  const actual = headers.map((header) => normalizeHeader(header));

  return expected.length === actual.length &&
    expected.every((header, index) => header === actual[index]);
}

export function getMissingRequiredMappings(mapping = [], event = {}) {
  const mapped = new Set(mapping.filter(Boolean));
  const missing = [];

  const hasFullName = mapped.has('full_name');
  if (!mapped.has('first_name') && !hasFullName) missing.push('First Name');
  if (!mapped.has('last_name') && !hasFullName) missing.push('Last Name');
  if (!mapped.has('email')) missing.push('Email');
  if (!mapped.has('phone')) missing.push('Phone');

  const requiredColumns = getRequiredRosterColumns(event).slice(4);
  requiredColumns.forEach((column) => {
    if (!mapped.has(column.value)) missing.push(column.label);
  });

  return missing;
}

export function mappingIsRequired(value, event = {}) {
  if (!value) return false;
  if (value === 'full_name') return true;
  return getRequiredRosterMappingKeys(event).includes(value);
}


function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function text(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizePhone(value) {
  return text(value).replace(/\D/g, '');
}

function normalizePayment(value, fallback = 'pending') {
  const raw = normalizeHeader(value);
  if (!raw) return fallback;
  if (['paid', 'yes', 'complete', 'completed', 'received'].includes(raw)) return 'paid';
  if (['comp', 'complimentary', 'waived', 'free'].includes(raw)) return 'comp';
  if (['pending', 'unpaid', 'no', 'open', 'due', 'balance due'].includes(raw)) return 'pending';
  return fallback;
}

function normalizeMembership(value, fallback = 'Member') {
  const raw = normalizeHeader(value);
  if (!raw) return fallback;
  if (['non member', 'nonmember', 'guest', 'public'].includes(raw)) return 'Non-Member';
  if (['member', 'yes', 'm'].includes(raw)) return 'Member';
  return fallback;
}

function parseCsv(textValue) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < textValue.length; i += 1) {
    const char = textValue[i];
    const next = textValue[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => text(value))) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => text(value))) rows.push(row);
  return rows;
}

export async function parseRosterFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  let matrix;
  if (extension === 'csv') {
    matrix = parseCsv(await file.text());
  } else if (extension === 'xlsx') {
    const { readSheet } = await import('read-excel-file/browser');
    matrix = await readSheet(file);
  } else {
    throw new Error('Choose a .csv or .xlsx roster file.');
  }

  const firstDataRow = matrix.findIndex((row) =>
    Array.isArray(row) && row.some((value) => text(value))
  );

  if (firstDataRow < 0) throw new Error('The roster file is empty.');

  const rawHeaders = matrix[firstDataRow];
  const headers = rawHeaders.map((value, index) => text(value) || `Column ${index + 1}`);
  const rows = matrix
    .slice(firstDataRow + 1)
    .filter((row) => Array.isArray(row) && row.some((value) => text(value)));

  if (!rows.length) throw new Error('The roster file has headers but no golfer rows.');

  return { headers, rows, headerRowNumber: firstDataRow + 1 };
}

export function inferRosterMapping(headers, customFields = []) {
  const used = new Set();
  const customByHeader = new Map(
    (customFields || [])
      .filter((field) => field?.id && field?.label)
      .map((field) => [normalizeHeader(field.label), `custom:${field.id}`])
  );

  return headers.map((header) => {
    const normalized = normalizeHeader(header);

    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (!used.has(field) && aliases.includes(normalized)) {
        used.add(field);
        return field;
      }
    }

    const customField = customByHeader.get(normalized);
    if (customField && !used.has(customField)) {
      used.add(customField);
      return customField;
    }

    return '';
  });
}

function mappedValue(headers, row, mapping, field) {
  const index = mapping.findIndex((mapped) => mapped === field);
  return index < 0 ? '' : row[index];
}

function splitFullName(value) {
  const parts = text(value).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first_name: parts[0] || '', last_name: '' };
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name: parts.at(-1)
  };
}

function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return raw;

  const year = match[3].length === 2 ? Number(match[3]) + (Number(match[3]) > 30 ? 1900 : 2000) : Number(match[3]);
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return raw;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function buildRosterPreview({
  headers,
  sourceRows,
  mapping,
  existingRows,
  defaults,
  headerRowNumber = 1
}) {
  const existingEmails = new Set(
    existingRows
      .filter((row) => (row.registration_status || 'active') !== 'cancelled')
      .map((row) => text(row.email).toLowerCase())
      .filter(Boolean)
  );
  const existingPhones = new Set(
    existingRows
      .filter((row) => (row.registration_status || 'active') !== 'cancelled')
      .map((row) => normalizePhone(row.phone))
      .filter(Boolean)
  );

  const fileEmails = new Set();
  const filePhones = new Set();

  return sourceRows.map((sourceRow, index) => {
    const fullName = mappedValue(headers, sourceRow, mapping, 'full_name');
    const splitName = splitFullName(fullName);
    const requiredFields = defaults.required_fields || {};
    const configuredCustomFields = Array.isArray(defaults.custom_fields)
      ? defaults.custom_fields
      : [];
    const membershipRaw = text(
      mappedValue(headers, sourceRow, mapping, 'membership_status')
    );
    const customValues = {};

    configuredCustomFields.forEach((field) => {
      if (!field?.id) return;
      customValues[field.id] = text(
        mappedValue(headers, sourceRow, mapping, `custom:${field.id}`)
      );
    });

    const golfer = {
      entry_number: text(mappedValue(headers, sourceRow, mapping, 'entry_number')),
      team_id: text(mappedValue(headers, sourceRow, mapping, 'team_id')),
      first_name: text(mappedValue(headers, sourceRow, mapping, 'first_name')) || splitName.first_name,
      last_name: text(mappedValue(headers, sourceRow, mapping, 'last_name')) || splitName.last_name,
      email: text(mappedValue(headers, sourceRow, mapping, 'email')).toLowerCase(),
      phone: text(mappedValue(headers, sourceRow, mapping, 'phone')),
      membership_status: normalizeMembership(
        membershipRaw,
        defaults.membership_status
      ),
      division: text(mappedValue(headers, sourceRow, mapping, 'division')),
      ghin_number: text(mappedValue(headers, sourceRow, mapping, 'ghin_number')),
      date_of_birth: normalizeDate(mappedValue(headers, sourceRow, mapping, 'date_of_birth')),
      gender: text(mappedValue(headers, sourceRow, mapping, 'gender')),
      payment_status: normalizePayment(
        mappedValue(headers, sourceRow, mapping, 'payment_status'),
        defaults.payment_status
      ),
      price: text(mappedValue(headers, sourceRow, mapping, 'price')),
      comp_reason:
        text(mappedValue(headers, sourceRow, mapping, 'comp_reason')) ||
        (defaults.payment_status === 'comp' ? text(defaults.comp_reason) : ''),
      custom_fields: customValues
    };

    const issues = [];
    const duplicateReasons = [];
    const email = golfer.email;
    const phone = normalizePhone(golfer.phone);

    if (!golfer.first_name) issues.push('Missing first name');
    if (!golfer.last_name) issues.push('Missing last name');
    if (!email) issues.push('Missing email');
    if (!golfer.phone) issues.push('Missing phone');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('Invalid email');

    if (requiredFields.dob === 'required' && !golfer.date_of_birth) issues.push('Missing date of birth');
    if (requiredFields.gender === 'required' && !golfer.gender) issues.push('Missing gender');
    if (requiredFields.division === 'required' && !golfer.division) issues.push('Missing division');
    if (requiredFields.membership === 'required' && !membershipRaw) issues.push('Missing club membership status');
    if (requiredFields.ghin === 'required' && !golfer.ghin_number) issues.push('Missing GHIN');

    configuredCustomFields.forEach((field) => {
      if (field?.required && !text(golfer.custom_fields?.[field.id])) {
        issues.push(`Missing ${field.label}`);
      }
    });

    if (golfer.payment_status === 'comp' && !golfer.comp_reason) issues.push('Comp reason required');

    if (golfer.price) {
      const price = Number(String(golfer.price).replace(/[$,]/g, ''));
      if (!Number.isFinite(price) || price < 0) issues.push('Invalid price');
      else golfer.price = price;
    } else {
      golfer.price = null;
    }

    if (email && existingEmails.has(email)) duplicateReasons.push('email already on roster');
    if (phone && existingPhones.has(phone)) duplicateReasons.push('phone already on roster');
    if (email && fileEmails.has(email)) duplicateReasons.push('email repeated in file');
    if (phone && filePhones.has(phone)) duplicateReasons.push('phone repeated in file');

    if (email) fileEmails.add(email);
    if (phone) filePhones.add(phone);

    const status = issues.length
      ? 'needs_review'
      : duplicateReasons.length
        ? 'duplicate'
        : 'ready';

    return {
      source_row: headerRowNumber + index + 1,
      golfer,
      status,
      issues,
      duplicate_reasons: duplicateReasons
    };
  });
}

export function getRosterFieldOptions(customFields = []) {
  return [
    ...FIELD_OPTIONS,
    ...(customFields || [])
      .filter((field) => field?.id && field?.label)
      .map((field) => ({
        value: `custom:${field.id}`,
        label: field.label
      }))
  ];
}

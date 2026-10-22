import fs from 'node:fs';
const policy = JSON.parse(fs.readFileSync(new URL('./safe-load-policy.json', import.meta.url), 'utf8'));
const sensitive = /(^|[_-])(email|phone|mobile|dob|birth|password|secret|token|credential|recipient|address|contact|customer|payment|account|session|private|user_id|auth)([_-]|$)/i;
const destination = policy.restrictions.requireSandboxProjectId;
function inspect(value, path = '', depth = 0) {
  if (depth > 20) throw new Error('Nested payload exceeds safe depth');
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return;
  if (typeof value === 'string') {
    if (value.length > 20000) throw new Error('Oversized import field: ' + path);
    if (/@|\\b(?:sk_live|pk_live|sb_secret_|eyJ[A-Za-z0-9_-]{30,}|https?:\\/\\/[^\\s]*(?:supabase\\.co|stripe\\.com))/.test(value)) {
      throw new Error('Possible private value or live endpoint: ' + path);
    }
    return;
  }
  if (Array.isArray(value)) { value.forEach((item, i) => inspect(item, path + '[' + i + ']', depth + 1)); return; }
  if (typeof value !== 'object') throw new Error('Unsupported import value: ' + path);
  for (const [key, child] of Object.entries(value)) {
    if (sensitive.test(key)) throw new Error('Sensitive nested key: ' + (path ? path + '.' : '') + key);
    inspect(child, path ? path + '.' + key : key, depth + 1);
  }
}
export function checkSandboxImport({projectId, table, record}) {
  if (projectId !== destination) throw new Error('Refusing non-sandbox destination');
  const allowed = policy.allowedTables[table];
  if (!allowed || !record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Table or record not allowlisted');
  for (const [key, value] of Object.entries(record)) {
    if (!allowed.includes(key) || sensitive.test(key)) throw new Error('Unapproved field: ' + key);
    inspect(value, key);
  }
  return {table, fields:Object.keys(record), approved:true};
}
if (process.argv[1]?.endsWith('check-safe-load.mjs')) {
  const good = {projectId:destination, table:'golf_registration_events', record:{event_key:'sample-scramble', name:'Fictional Golf Event'}};
  checkSandboxImport(good);
  const bad = [
    {...good,projectId:'aszixzrdayrivungodwq'},
    {...good,record:{email:'person@example.com'}},
    {...good,record:{field_settings:{captain_email:'person@example.com'}}},
    {...good,record:{field_settings:{nested:[{access_token:'abc'}]}}},
    {...good,record:{name:'realperson@example.com'}},
    {...good,record:{name:'https://live.supabase.co/private'}}
  ];
  for (const item of bad) {
    let denied = false;
    try { checkSandboxImport(item); } catch { denied = true; }
    if (!denied) throw new Error('An unsafe import was accepted');
  }
  console.log('Safe-load preflight passed: allowed example accepted; ' + bad.length + ' unsafe cases denied.');
}

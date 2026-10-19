import fs from 'node:fs';
const policy = JSON.parse(fs.readFileSync(new URL('./safe-load-policy.json', import.meta.url), 'utf8'));
const forbidden = new Set(['email','phone','first_name','last_name','date_of_birth','dob','payment_method','stripe_customer_id','access_token','refresh_token','user_id','password','address','recipient']);
export function checkSandboxImport({projectId,table,record}) {
  if (projectId !== policy.restrictions.requireSandboxProjectId) throw new Error('Refusing non-sandbox destination');
  const allowed = policy.allowedTables[table];
  if (!allowed) throw new Error('Table is not allowlisted');
  const keys = Object.keys(record || {});
  for (const key of keys) {
    if (!allowed.includes(key) || forbidden.has(key.toLowerCase())) throw new Error('Unapproved or sensitive field: '+key);
  }
  return {table,fields:keys,approved:true};
}
if (process.argv[1]?.endsWith('check-safe-load.mjs')) {
  const ok = checkSandboxImport({projectId:policy.restrictions.requireSandboxProjectId,table:'golf_registration_events',record:{event_key:'fictional-scramble',name:'Sample Event'}});
  let blocked = 0;
  for (const record of [{email:'private@example.com'},{stripe_customer_id:'cus_example'}]) {
    try { checkSandboxImport({projectId:policy.restrictions.requireSandboxProjectId,table:'golf_registration_events',record}); }
    catch {blocked++;}
  }
  try {checkSandboxImport({projectId:'aszixzrdayrivungodwq',table:'golf_registration_events',record:{name:'test'}});} catch {blocked++;}
  if (blocked !== 3) process.exitCode=1;
  else console.log('Sandbox import safety preflight passed: 3 unsafe cases denied; '+ok.fields.length+' sample fields allowed.');
}

#!/usr/bin/env node
/**
 * Explicit, one-time sandbox setup. No email is sent and no live project is
 * touched. Requires a SERVICE ROLE credential kept locally, outside GitHub.
 *
 * SAFE BY DEFAULT: running without --provision performs no external actions.
 * NEVER paste service credentials into ChatGPT or a GitHub issue/commit.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SANDBOX_DEMO_PERSONAS } from '../../src/sandbox/demoPersonas.mjs';

const EXPECTED_URL = 'https://publruuuyvpggogrrgwp.supabase.co';
const CONFIRMATION = 'CREATE_FICTIONAL_SANDBOX_AUTH_USERS';
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const required = ['eig_admin', 'pilot', 'co_pilot', 'atc', 'passenger'];
const emailSafe = (value) => /^[a-z0-9._+-]+@sandbox\.invalid$/.test(value);

function assertServiceKey(key) {
  if (!key) throw new Error('A sandbox service-role key is required locally.');
  if (key.startsWith('sb_secret_')) return;
  if (!key.startsWith('eyJ')) throw new Error('Unknown key format; use a sandbox service-role key.');
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.role === 'service_role' && payload.ref === 'publruuuyvpggogrrgwp') return;
  } catch {}
  throw new Error('The legacy JWT is not the sandbox service-role key.');
}

function credentialsPath(file) {
  if (!file || !isAbsolute(file)) throw new Error('Set SANDBOX_CREDENTIALS_OUTPUT to an absolute path OUTSIDE the repository.');
  const resolved = resolve(file);
  const r = relative(root, resolved);
  if (!r.startsWith('..') || r === '..') throw new Error('Credentials must never be stored in the GitHub repository.');
  return resolved;
}

function verifyPersonas() {
  if (SANDBOX_DEMO_PERSONAS.length !== 5 ||
      required.some(code => !SANDBOX_DEMO_PERSONAS.some(p => p.code === code)) ||
      new Set(SANDBOX_DEMO_PERSONAS.map(p => p.email)).size !== 5 ||
      SANDBOX_DEMO_PERSONAS.some(p => !emailSafe(p.email))) {
    throw new Error('The fictional persona allowlist has changed unexpectedly.');
  }
}

async function must(result, what) {
  if (result.error) throw new Error(what + ': ' + result.error.message);
  return result.data;
}

async function run() {
  verifyPersonas();
  if (!process.argv.includes('--provision')) {
    console.log('Dry run: 5 fictional sandbox-only roles are defined. Nothing was created.');
    console.log('To create accounts, set SANDBOX_SUPABASE_URL, SANDBOX_SERVICE_ROLE_KEY, SANDBOX_CREDENTIALS_OUTPUT and SANDBOX_PROVISION_CONFIRMATION, then add --provision.');
    return;
  }
  if (process.env.SANDBOX_SUPABASE_URL !== EXPECTED_URL ||
      process.env.SANDBOX_PROVISION_CONFIRMATION !== CONFIRMATION) {
    throw new Error('Sandbox URL or explicit one-time confirmation does not match.');
  }
  const output = credentialsPath(process.env.SANDBOX_CREDENTIALS_OUTPUT);
  assertServiceKey(process.env.SANDBOX_SERVICE_ROLE_KEY);
  const api = createClient(EXPECTED_URL, process.env.SANDBOX_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  // Abort if this database contains a non-demo login. Never modify real users.
  const firstPage = await must(await api.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'Preflight Auth users');
  if (firstPage.users?.length !== 0) {
    throw new Error('Sandbox Auth is not empty. Stop and inspect users before provisioning.');
  }
  const orgs = await must(await api.from('organizations').select('id,slug,is_test').in('slug',['elevated-impact-group','sandbox-practice-club']), 'Demo organizations');
  if (orgs.length !== 2 || orgs.some(o => !o.is_test)) throw new Error('Sandbox-only demo organizations are missing.');
  const bySlug = new Map(orgs.map(o => [o.slug,o.id]));
  if (!bySlug.get('elevated-impact-group') || !bySlug.get('sandbox-practice-club')) throw new Error('Missing demo organization.');
  const events = await must(await api.from('golf_registration_events').select('id,event_key,organization_id,status').eq('event_key','sandbox-practice-scramble'), 'Demo event');
  if (events.length !== 1 || events[0].status !== 'draft' || events[0].organization_id !== bySlug.get('sandbox-practice-club')) {
    throw new Error('Required isolated draft event is missing.');
  }

  const credentials = SANDBOX_DEMO_PERSONAS.map(p => ({ ...p, password: randomBytes(36).toString('base64url') }));
  // Create the only local record of passwords before any remote creation.
  // Exclusive creation prevents clobbering the only usable credentials.
  const file = await open(output, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify({
      project: 'publruuuyvpggogrrgwp', created_at: new Date().toISOString(),
      warning: 'SANDBOX ONLY. Private test passwords. Never sync or email this file.',
      users: credentials.map(p => ({ persona: p.code, name: p.name, email: p.email, password: p.password })),
    }, null, 2) + '\n', 'utf8');
  } finally { await file.close(); }
  console.log('Private test credential file created at the requested local path. Passwords are not printed.');

  let completed = 0;
  for (const p of credentials) {
    const [first_name, last_name] = p.name.split(' ');
    const created = await must(await api.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true, // ADMIN action: do not send signup/verification email.
      user_metadata: { first_name, last_name, sandbox_demo: true },
      app_metadata: { sandbox_demo: true },
    }), 'Create fictional Auth user '+p.code);
    if (!created.user?.id) throw new Error('Missing Auth ID for '+p.code);
    const uid = created.user.id;
    await must(await api.from('profiles').insert({
      id: uid, first_name, last_name, display_name: p.name, username: p.username, role: 'user',
    }), 'Create fictional profile '+p.code);

    const membership = p.code === 'eig_admin'
      ? { organization_id: bySlug.get('elevated-impact-group'), user_id: uid, role: 'eig_admin' }
      : p.code === 'pilot'
        ? { organization_id: bySlug.get('sandbox-practice-club'), user_id: uid, role: 'organization_admin' }
        : p.code === 'co_pilot'
          ? { organization_id: bySlug.get('sandbox-practice-club'), user_id: uid, role: 'organization_staff' }
          : null;
    if (membership) await must(await api.from('organization_memberships').insert(membership), 'Create '+p.code+' membership');
    if (p.code === 'atc') {
      await must(await api.from('event_assignments').insert({
        event_id: events[0].id, user_id: uid, role: 'event_coordinator',
      }), 'Create fictional ATC assignment');
    }
    if (p.code === 'passenger') {
      await must(await api.from('passengers').insert({
        auth_user_id: uid, first_name, last_name, preferred_name: first_name,
        status: 'claimed', claimed_at: new Date().toISOString(),
      }), 'Create fictional passenger');
    }
    completed++;
    console.log('Provisioned fictional role '+p.code+'. No emails sent.');
  }
  console.log('Completed '+completed+' sandbox users. Use the private local credential file to sign in.');
  console.log('Do not grant broader app access until RLS, Edge Function and integration isolation checks pass.');
}

run().catch((error) => {
  // Intentionally never log API payloads, passwords, tokens or credential contents.
  console.error('Stopped safely: '+error.message);
  console.error('If creation began, use the local credential file and inspect partial sandbox users before retrying.');
  process.exitCode = 1;
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('sandbox/roles/01_sandbox_role_switch.sql', 'utf8');
const selector = readFileSync('src/sandbox/SandboxPracticeRoles.jsx', 'utf8');
const main = readFileSync('src/main.jsx', 'utf8');

test('sandbox migration requires fictional fixtures and refuses real organizations', () => {
  assert.match(sql, /publruuuyvpggogrrgwp/);
  assert.match(sql, /to_regclass\('sandbox_ops\.demo_personas'\)/);
  assert.match(sql, /WHERE is_test IS NOT TRUE/);
  assert.match(sql, /elevated-impact-group/);
  assert.match(sql, /sandbox-practice-club/);
  assert.match(sql, /RAISE EXCEPTION 'Refusing to install sandbox role switching/);
  assert.doesNotMatch(sql, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+auth\./i);
});

test('only authenticated, allowlisted sandbox users may change a real DB membership', () => {
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /t\.tester_user_id = v_uid AND t\.enabled/);
  assert.match(sql, /FOR UPDATE;/);
  assert.match(sql, /p_role = ANY\(v_roles\)/);
  assert.match(sql, /o\.is_test IS TRUE/);
  assert.match(sql, /DELETE FROM public\.event_assignments/);
  assert.match(sql, /DELETE FROM public\.organization_memberships/);
  assert.match(sql, /INSERT INTO public\.organization_memberships/);
  assert.match(sql, /INSERT INTO public\.event_assignments/);
  assert.match(sql, /INSERT INTO sandbox_ops\.practice_role_audit/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.sandbox_switch_practice_role\(text\) TO authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.sandbox_switch_practice_role\(text\) FROM PUBLIC, anon/);
  assert.match(sql, /REVOKE ALL ON sandbox_ops\.practice_testers FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /SECURITY DEFINER[\s\S]*?SET search_path = ''/);
});

test('cannot silently receive EIG admin or cross another tester practice org', () => {
  assert.match(sql, /allowed_roles <@ ARRAY\['eig_admin','pilot','co_pilot','atc','passenger'\]/);
  assert.match(sql, /practice_organization_id/);
  assert.match(sql, /m\.organization_id NOT IN \(v_org, v_headquarters\)/);
  assert.match(sql, /e\.organization_id IS DISTINCT FROM v_org/);
  assert.match(sql, /p_role = 'eig_admin'/);
  assert.match(sql, /Passenger means no special membership/);
  assert.doesNotMatch(sql, /INSERT INTO auth\.users|DELETE FROM auth\.users/i);
});

test('the UI only offers roles returned from the sandbox service', () => {
  assert.match(selector, /supabase\.auth\.getUser/);
  assert.match(selector, /supabase\.rpc\('sandbox_practice_role_status'\)/);
  assert.match(selector, /data\.roles\.filter\(role => Object\.hasOwn\(LABELS, role\)\)/);
  assert.match(selector, /capabilities\?\.roles\.includes\(selected\)/);
  assert.match(selector, /supabase\.rpc\('sandbox_switch_practice_role'/);
  assert.match(selector, /window\.location\.assign\(window\.location\.origin \+ '\/'\)/);
  assert.match(selector, /Shared ElevationPilot sign-in connection is still being configured|shared ElevationPilot sign-in connection is still being configured/);
  assert.doesNotMatch(selector, /auth\.signInWithPassword|auth\.setSession|localStorage|sessionStorage|service_role/);
  assert.match(main, /\{IS_SANDBOX && <SandboxPracticeRoles \/>/);
});

test('feature has no outbound links, mail delivery, payment or production tokens', () => {
  for (const source of [selector, sql]) {
    assert.doesNotMatch(source, /https:\/\/(?!publruuuyvpggogrrgwp)|golf-event-registrations-eig\.vercel\.app/i);
    assert.doesNotMatch(source, /resend\.emails|stripe\.charges|sendEmail\(|sendSms\(/i);
    assert.doesNotMatch(source, /service_role_key|sb_secret_|api\.auth\.admin/i);
  }
});

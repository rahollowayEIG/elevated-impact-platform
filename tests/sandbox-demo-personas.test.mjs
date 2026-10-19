import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SANDBOX_DEMO_PERSONAS } from '../src/sandbox/demoPersonas.mjs';

test('only five unique fictional demo personas exist', () => {
  assert.deepEqual(SANDBOX_DEMO_PERSONAS.map(p => p.code).sort(), ['atc','co_pilot','eig_admin','passenger','pilot']);
  assert.equal(new Set(SANDBOX_DEMO_PERSONAS.map(p=>p.email)).size,5);
  for(const p of SANDBOX_DEMO_PERSONAS) {
    assert.match(p.email,/^[a-z0-9._+-]+@sandbox\.invalid$/);
    assert.ok(p.name.endsWith('Demo'));
  }
});
test('legacy five-persona sandbox Auth provisioning cannot be activated', () => {
  const env={ PATH:process.env.PATH, SYSTEMROOT:process.env.SYSTEMROOT };
  const output=execFileSync(process.execPath,['scripts/sandbox/provision-demo-auth.mjs'],{
    encoding:'utf8', env,
  });
  assert.match(output,/Dry run/);
  const attempted=spawnSync(process.execPath,['scripts/sandbox/provision-demo-auth.mjs','--provision'],{encoding:'utf8',env});
  assert.equal(attempted.status,1);
  assert.match(attempted.stderr,/REFUSED/);
  const body=readFileSync('scripts/sandbox/provision-demo-auth.mjs','utf8');
  assert.doesNotMatch(body,/auth\.admin\.createUser|\.from\('organization_memberships'\)\.insert/);
  assert.match(body,/single-tester Sandbox enrollment/);
});
test('single tester selector uses real authenticated sandbox RPCs, not impersonation', () => {
  const login=readFileSync('src/sandbox/SandboxPracticeRoles.jsx','utf8');
  const root=readFileSync('src/main.jsx','utf8');
  assert.match(login,/supabase\.auth\.getUser\(\)/);
  assert.match(login,/supabase\.rpc\('sandbox_practice_role_status'\)/);
  assert.match(login,/supabase\.rpc\('sandbox_switch_practice_role', \{ p_role: selected \}\)/);
  assert.doesNotMatch(login,/signInWithPassword|setSession|service_role|auth\.admin|localStorage/);
  assert.match(root,/const IS_SANDBOX = import.meta.env.VITE_ELEVATIONPILOT_SANDBOX === 'true'/);
  assert.match(root,/IS_SANDBOX \? \(\s*<SandboxAccessGate>/);
  assert.match(root,/<SandboxPracticeRoles \/>/);
  assert.doesNotMatch(root,/\{IS_SANDBOX && <SandboxPersonaLogin/);
});

test('first-tester enrollment requires separate verified Sandbox Auth and grants no admin membership', () => {
  const script=readFileSync('sandbox/roles/05_enroll_first_verified_tester.sql','utf8');
  assert.match(script,/publruuuyvpggogrrgwp/);
  assert.match(script,/to_regclass\('sandbox_ops\.practice_testers'\)/);
  assert.match(script,/email_confirmed_at IS NOT NULL/);
  assert.match(script,/REPLACE_WITH_APPROVED_SANDBOX_EMAIL/);
  assert.match(script,/INSERT INTO sandbox_ops\.practice_testers/);
  assert.match(script,/ARRAY\['pilot','co_pilot','atc','passenger'\]/);
  assert.doesNotMatch(script,/INSERT INTO auth\.users|CREATE USER|auth\.admin|service_role/);
  assert.doesNotMatch(script,/INSERT INTO public\.organization_memberships/);
});

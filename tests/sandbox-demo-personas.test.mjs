import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
test('sandbox Auth provisioning script is inert unless explicitly enabled', () => {
  const output=execFileSync(process.execPath,['scripts/sandbox/provision-demo-auth.mjs'],{
    encoding:'utf8',env: { PATH:process.env.PATH, SYSTEMROOT:process.env.SYSTEMROOT },
  });
  assert.match(output,/Dry run/);
  const body=readFileSync('scripts/sandbox/provision-demo-auth.mjs','utf8');
  assert.match(body,/email_confirm: true/);
  assert.match(body,/process\.env\.SANDBOX_PROVISION_CONFIRMATION/);
  assert.match(body,/auth\.admin\.createUser/);
  assert.match(body,/SANDBOX_CREDENTIALS_OUTPUT/);
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

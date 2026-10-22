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
test('practice login requires real Supabase Auth and sandbox flag', () => {
  const login=readFileSync('src/sandbox/SandboxPersonaLogin.jsx','utf8');
  const root=readFileSync('src/main.jsx','utf8');
  assert.match(login,/auth\.signInWithPassword/);
  assert.match(login,/auth\.signOut/);
  assert.doesNotMatch(login,/setItem\(['"]role|set_user_role|service_role/);
  assert.match(root,/const IS_SANDBOX = import.meta.env.VITE_ELEVATIONPILOT_SANDBOX === 'true'/);
  assert.match(root,/\{IS_SANDBOX && <SandboxPersonaLogin/);
});

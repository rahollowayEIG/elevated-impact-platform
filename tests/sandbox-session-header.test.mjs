import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SANDBOX_PRACTICE_ROLE_LABELS,
  getSandboxSessionLabel,
} from '../src/sandbox/sandboxSessionLabel.mjs';

test('shows a real signed-in account handle and the server-approved practice role', () => {
  const coPilot = getSandboxSessionLabel('  PILOT@Example.test  ', 'co_pilot');
  assert.deepEqual(coPilot, {
    email: 'pilot@example.test',
    handle: 'pilot',
    role: 'Co-Pilot',
  });
  assert.equal(Object.isFrozen(coPilot), true);
  for (const [role, label] of Object.entries({
    pilot: 'Pilot',
    co_pilot: 'Co-Pilot',
    atc: 'ATC Coordinator',
    passenger: 'Passenger',
  })) {
    assert.equal(getSandboxSessionLabel('pilot@example.test', role).role, label);
  }
  assert.deepEqual(Object.keys(SANDBOX_PRACTICE_ROLE_LABELS), [
    'pilot', 'co_pilot', 'atc', 'passenger',
  ]);
});

test('no display for unsigned or unapproved roles; never treat a client label as permission', () => {
  for (const email of ['', null, 'bad address', 'user@', ' @example.test']) {
    assert.equal(getSandboxSessionLabel(email, 'pilot'), null);
  }
  for (const role of [undefined, '', 'eig_admin', 'super_admin', 'organization_admin']) {
    assert.equal(getSandboxSessionLabel('pilot@example.test', role), null);
  }
});

test('header is Sandbox-only and requires server access and training acknowledgement', () => {
  const main = readFileSync('src/main.jsx', 'utf8');
  const gate = readFileSync('src/sandbox/SandboxAccessGate.jsx', 'utf8');
  const header = readFileSync('src/sandbox/SandboxSessionHeader.jsx', 'utf8');
  const roleSwitch = readFileSync('src/sandbox/SandboxPracticeRoles.jsx', 'utf8');

  assert.match(main, /\{IS_SANDBOX && \(/);
  assert.match(main, /id="sandbox-session-header-slot"/);
  assert.match(gate, /const result = await checkSandboxAccess\(supabase\)/);
  assert.match(gate, /if \(gate\.kind === 'authorized'\) \{/);
  assert.match(gate, /if \(entered\) return <>/);
  assert.match(gate, /<SandboxSessionHeader email=\{gate\.email\} activeRole=\{gate\.access\.activeRole\} \/>/);
  assert.match(header, /createPortal\(/);
  assert.match(header, /document\.getElementById\('sandbox-session-header-slot'\)/);
  assert.match(header, /data-testid="sandbox-session-header"/);
  assert.doesNotMatch(header, /auth\.getSession|auth\.getUser|\.rpc\(|\.from\(['\"]profiles['\"]\)|sessionStorage|localStorage|user_metadata|eig_admin|Live.*(supabase\.co)/i);
  assert.match(roleSwitch, /supabase\.rpc\('sandbox_switch_practice_role'/);
  assert.match(roleSwitch, /window\.location\.assign\(window\.location\.origin \+ '\/'\)/);
});

test('visual identity is scoped to Sandbox and fits smaller screens', () => {
  const css = readFileSync('src/sandbox/sandboxTheme.css', 'utf8');
  assert.match(css, /html\.elevationpilot-sandbox \.eig-sandbox-session-slot/);
  assert.match(css, /html\.elevationpilot-sandbox \.eig-sandbox-session-role/);
  assert.match(css, /html\.elevationpilot-sandbox \.eig-sandbox-session-handle/);
  assert.match(css, /@media \(max-width: 720px\)/);
});

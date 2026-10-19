import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SANDBOX_NOTICE_KEY,
  hasAcknowledgedSandboxNotice,
  acknowledgeSandboxNotice,
  clearSandboxNotice,
} from '../src/sandbox/sandboxNotice.mjs';

function fakeSessionStorage() {
  const entries = new Map();
  return {
    getItem(key) { return entries.has(key) ? entries.get(key) : null; },
    setItem(key, value) { entries.set(key, String(value)); },
    removeItem(key) { entries.delete(key); },
    entries,
  };
}

test('entry notice requires explicit acknowledgement for each confirmed Sandbox identity', () => {
  const storage = fakeSessionStorage();
  assert.equal(hasAcknowledgedSandboxNotice(storage, 'pilot@example.test'), false);
  assert.equal(acknowledgeSandboxNotice(storage, ''), false);
  assert.equal(acknowledgeSandboxNotice(storage, ' Pilot@Example.Test '), true);
  assert.equal(hasAcknowledgedSandboxNotice(storage, 'pilot@example.test'), true);
  assert.equal(hasAcknowledgedSandboxNotice(storage, 'other@example.test'), false);
  assert.deepEqual(Array.from(storage.entries.keys()), [SANDBOX_NOTICE_KEY]);
  assert.equal(storage.entries.get(SANDBOX_NOTICE_KEY), 'pilot@example.test');
});

test('sign-out clears consent so the next login must acknowledge again', () => {
  const storage = fakeSessionStorage();
  acknowledgeSandboxNotice(storage, 'pilot@example.test');
  clearSandboxNotice(storage);
  assert.equal(hasAcknowledgedSandboxNotice(storage, 'pilot@example.test'), false);
});

test('disabled browser storage fails closed and does not affect real authorization', () => {
  const broken = {
    getItem() { throw new Error('Storage disabled'); },
    setItem() { throw new Error('Storage disabled'); },
    removeItem() { throw new Error('Storage disabled'); },
  };
  assert.equal(hasAcknowledgedSandboxNotice(broken, 'pilot@example.test'), false);
  assert.equal(acknowledgeSandboxNotice(broken, 'pilot@example.test'), false);
  assert.doesNotThrow(() => clearSandboxNotice(broken));
  assert.equal(hasAcknowledgedSandboxNotice(null, 'pilot@example.test'), false);
});

test('notice appears only after server-owned approved gate and never replaces it', () => {
  const gate = readFileSync('src/sandbox/SandboxAccessGate.jsx', 'utf8');
  const root = readFileSync('src/main.jsx', 'utf8');
  assert.match(root, /IS_SANDBOX \? \(\s*<SandboxAccessGate>/);
  assert.match(gate, /const result = await checkSandboxAccess\(supabase\)/);
  assert.match(gate, /if \(gate\.kind === 'authorized'\) \{/);
  assert.match(gate, /if \(entered\) return <>/);
  assert.match(gate, /<SandboxSessionHeader email=\{gate\.email\} activeRole=\{gate\.access\.activeRole\} \/>/);
  assert.match(gate, /\{children\}\s*<\/>;/);
  assert.match(gate, /return <SandboxEntryNotice/);
  assert.match(gate, /aria-modal="true"/);
  assert.match(gate, /I Understand • Enter Sandbox/);
  assert.match(gate, /Cancel and Sign Out/);
  assert.match(gate, /Not for live business operations/);
  assert.match(gate, /clearSandboxNotice\(noticeStorage\(\)\)/);
  assert.doesNotMatch(gate, /auth\.admin|signInWithPassword|signUp\(/);
});

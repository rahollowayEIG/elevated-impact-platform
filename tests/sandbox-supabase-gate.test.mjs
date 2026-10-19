import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSandboxSupabaseTarget } from '../src/sandbox/sandboxSupabaseGate.mjs';
const URL = 'https://publruuuyvpggogrrgwp.supabase.co';
const key = 'sb_publishable_fixture_only';

test('accepts only the dedicated sandbox Supabase host', () => {
  assert.equal(assertSandboxSupabaseTarget(URL, { enabled: true, key }), true);
  assert.equal(assertSandboxSupabaseTarget(URL+'/', { enabled: true, key }), true);
});
test('rejects production and untrusted Supabase hosts in sandbox builds', () => {
  for (const url of [
    'https://aszixzrdayrivungodwq.supabase.co',
    'https://fyihtdhpkniuthsvxwla.supabase.co',
    'https://publruuuyvpggogrrgwp.supabase.co.evil.example',
    'http://publruuuyvpggogrrgwp.supabase.co',
    '', undefined
  ]) assert.throws(() => assertSandboxSupabaseTarget(url, { enabled: true, key }));
});
test('blocks secret keys, but leaves production-mode configuration unchanged', () => {
  assert.throws(() => assertSandboxSupabaseTarget(URL, { enabled: true, key: 'sb_secret_fixture' }));
  assert.doesNotThrow(() => assertSandboxSupabaseTarget('https://other.example', { enabled: false }));
});

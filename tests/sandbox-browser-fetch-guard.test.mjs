import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isAllowedSandboxFetchTarget, createSandboxGuardedFetch,
  installSandboxBrowserFetchGuard,
} from '../src/sandbox/sandboxBrowserFetchGuard.mjs';

const config = Object.freeze({
  appOrigin: 'https://elevationpilot-sandbox.vercel.app',
  sandboxSupabaseUrl: 'https://publruuuyvpggogrrgwp.supabase.co',
});

test('fetch only reaches the sandbox origin or its dedicated Supabase host', () => {
  for (const target of [
    '/api/inspect', '?tab=airport', 'https://elevationpilot-sandbox.vercel.app/events',
    'https://publruuuyvpggogrrgwp.supabase.co/auth/v1/user',
    'https://publruuuyvpggogrrgwp.supabase.co/rest/v1/organizations',
    new Request('https://publruuuyvpggogrrgwp.supabase.co/functions/v1/demo'),
    'data:text/plain,hello',
    'blob:https://elevationpilot-sandbox.vercel.app/00000000-0000-4000-8000-000000000000',
  ]) {
    assert.equal(isAllowedSandboxFetchTarget(target, config), true, String(target));
  }
  for (const target of [
    'https://aszixzrdayrivungodwq.supabase.co/rest/v1/profiles',
    'https://elevated-impact-platform.vercel.app/api/something',
    'https://golf-event-registrations-eig.vercel.app',
    'https://golf.elevatedimpactgroup.net',
    '//evil.example/test', 'http://publruuuyvpggogrrgwp.supabase.co',
    'https://publruuuyvpggogrrgwp.supabase.co.evil.example',
    'https://user@publruuuyvpggogrrgwp.supabase.co',
    'javascript:alert(1)', 'blob:https://elevated-impact-platform.vercel.app/aaa',
    null, {}, '',
  ]) {
    assert.equal(isAllowedSandboxFetchTarget(target, config), false, String(target));
  }
});

test('bad target/project configuration fails closed', () => {
  for (const altered of [
    { ...config, sandboxSupabaseUrl: 'https://aszixzrdayrivungodwq.supabase.co' },
    { ...config, appOrigin: 'http://elevationpilot-sandbox.vercel.app' },
    { ...config, sandboxSupabaseUrl: 'https://publruuuyvpggogrrgwp.supabase.co.evil.example' },
    { ...config, sandboxSupabaseUrl: undefined },
  ]) {
    assert.equal(isAllowedSandboxFetchTarget('/', altered), false);
    assert.throws(() => createSandboxGuardedFetch(() => {}, altered), /network configuration/);
  }
});

test('blocked requests never reach the underlying transport or expose URLs in errors', async () => {
  let calls = 0;
  const fakeFetch = async (target) => { calls++; return { ok: true, target }; };
  const guarded = createSandboxGuardedFetch(fakeFetch, config);
  const response = await guarded('/api/check');
  assert.equal(response.ok, true);
  assert.equal(calls, 1);
  await assert.rejects(guarded('https://aszixzrdayrivungodwq.supabase.co/rest/v1/profiles'), /blocked an external/);
  assert.equal(calls, 1);
});

test('browser interception is Sandbox-only, and cleanly restores original fetch', async () => {
  let calls = 0;
  const original = async () => { calls++; return { ok: true }; };
  const windowMock = { location: { origin: config.appOrigin }, fetch: original };
  const noOp = installSandboxBrowserFetchGuard({
    enabled: false, windowObject: windowMock, sandboxSupabaseUrl: config.sandboxSupabaseUrl,
  });
  assert.equal(windowMock.fetch, original);
  noOp();
  const restore = installSandboxBrowserFetchGuard({
    enabled: true, windowObject: windowMock, sandboxSupabaseUrl: config.sandboxSupabaseUrl,
  });
  assert.notEqual(windowMock.fetch, original);
  await windowMock.fetch('https://publruuuyvpggogrrgwp.supabase.co/auth/v1/user');
  assert.equal(calls, 1);
  await assert.rejects(windowMock.fetch('https://elevated-impact-platform.vercel.app'));
  assert.equal(calls, 1);
  restore();
  assert.equal(windowMock.fetch, original);
});

test('production stays unchanged and the full Sandbox workspace remains locked', () => {
  const root = readFileSync('src/main.jsx', 'utf8');
  const supabase = readFileSync('src/lib/supabase.js', 'utf8');
  const gate = readFileSync('src/sandbox/sandboxSupabaseGate.mjs', 'utf8');
  assert.match(gate, /export const EXPECTED_SANDBOX_HOST = 'publruuuyvpggogrrgwp.supabase.co'/);
  assert.match(root, /installSandboxBrowserFetchGuard\(\{\s*enabled: IS_SANDBOX/);
  assert.match(root, /VITE_SANDBOX_WORKSPACE_ENABLED === 'true'/);
  assert.match(supabase, /isSandbox\s*\?\s*\{ global: \{ fetch: createSandboxGuardedFetch/);
  assert.match(supabase, /: undefined\)\s*:/);
  assert.doesNotMatch(root, /VITE_SANDBOX_WORKSPACE_ENABLED\s*=\s*true/);
});

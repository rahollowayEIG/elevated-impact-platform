import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isAllowedSandboxReadOnlyRequest,
  createSandboxGuardedFetch,
} from '../src/sandbox/sandboxBrowserFetchGuard.mjs';
import { installSandboxReadOnlyActionsGuard } from '../src/sandbox/sandboxReadOnlyActionsGuard.mjs';

const config = {
  appOrigin: 'https://elevationpilot-sandbox.vercel.app',
  sandboxSupabaseUrl: 'https://publruuuyvpggogrrgwp.supabase.co',
  readOnly: true,
};
const api = config.sandboxSupabaseUrl;
const app = config.appOrigin;

test('real EP UI preview can READ Sandbox-only data and existing reviewed Edge Functions', () => {
  for (const [url, method] of [
    [api + '/rest/v1/organizations?select=*', 'GET'],
    [api + '/rest/v1/golf_registration_events', 'HEAD'],
    [api + '/storage/v1/object/public/event-assets/test.png', 'GET'],
    [api + '/rest/v1/rpc/sandbox_practice_role_status', 'POST'],
    [api + '/rest/v1/rpc/sandbox_switch_practice_role', 'POST'],
    [api + '/rest/v1/rpc/read_eie_event_budget', 'POST'],
    [api + '/functions/v1/public-event-squawks', 'POST'],
    [api + '/functions/v1/golf-my-registrations', 'POST'],
    [api + '/auth/v1/otp', 'POST'],
    [api + '/auth/v1/verify', 'POST'],
    [api + '/auth/v1/token?grant_type=refresh_token', 'POST'],
    [api + '/auth/v1/user', 'GET'],
    [api + '/auth/v1/logout', 'POST'],
    [app + '/assets/logo.svg', 'GET'],
  ]) {
    assert.equal(isAllowedSandboxReadOnlyRequest(url, { method }, config), true, method + ' ' + url);
  }
});

test('real EP UI preview DENIES data writes, unreviewed RPC, provider calls and Vercel APIs', () => {
  for (const [url, method] of [
    [api + '/rest/v1/organizations', 'POST'],
    [api + '/rest/v1/golf_registration_events?id=eq.fake', 'PATCH'],
    [api + '/rest/v1/golf_registrations?id=eq.fake', 'DELETE'],
    [api + '/rest/v1/rpc/create_eie_golf_event', 'POST'],
    [api + '/rest/v1/rpc/create_squawk_draft', 'POST'],
    [api + '/rest/v1/rpc/save_eie_event_budget', 'POST'],
    [api + '/rest/v1/rpc/read_eie_event_budget', 'GET'],
    [api + '/rest/v1/rpc/create_eie_golf_event', 'GET'],
    [api + '/functions/v1/platform-invite', 'POST'],
    [api + '/functions/v1/golf-registration-flow', 'POST'],
    [api + '/functions/v1/create-golf-checkout-session', 'POST'],
    [api + '/auth/v1/signup', 'POST'],
    [api + '/auth/v1/user', 'PUT'],
    [api + '/storage/v1/object/event-assets/test.png', 'POST'],
    [app + '/api/event-share', 'GET'],
    [app + '/api/event-share', 'POST'],
    [app + '/uploads', 'POST'],
    ['https://aszixzrdayrivungodwq.supabase.co/rest/v1/profiles', 'GET'],
    ['https://api.resend.com/emails', 'POST'],
    ['https://api.stripe.com/v1/checkout/sessions', 'POST'],
    ['https://elevated-impact-platform.vercel.app', 'GET'],
    ['http://publruuuyvpggogrrgwp.supabase.co/rest/v1/organizations', 'GET'],
    [api + '/auth/v1/token', 'TRACE'],
  ]) {
    assert.equal(isAllowedSandboxReadOnlyRequest(url, { method }, config), false, method + ' ' + url);
  }
});

test('request objects and method overrides are checked before the network transport', async () => {
  let hits = 0;
  const fake = async () => { hits++; return { ok: true }; };
  const guarded = createSandboxGuardedFetch(fake, config);
  const safe = new Request(api + '/rest/v1/organizations', { method: 'GET' });
  await guarded(safe);
  assert.equal(hits, 1);
  await assert.rejects(guarded(new Request(api + '/rest/v1/organizations', { method: 'POST' })));
  await assert.rejects(guarded(api + '/rest/v1/profiles', { method: 'PATCH' }));
  assert.equal(hits, 1);
});

test('extra read-only preview guards stop external tabs, XHR writes and external sockets', () => {
  let opened = [];
  class FakeXHR { open(method, url) { this.method = method; this.url = url; } }
  class FakeSocket { constructor(url) { this.url = url; } }
  class FakeEventSource { constructor(url) { this.url = url; } }
  const originalOpen = (url) => { opened.push(url); return { url }; };
  const win = {
    location: { origin: app },
    open: originalOpen,
    XMLHttpRequest: FakeXHR,
    WebSocket: FakeSocket,
    EventSource: FakeEventSource,
  };
  const restore = installSandboxReadOnlyActionsGuard({
    enabled: true, windowObject: win, sandboxSupabaseUrl: api,
  });
  assert.deepEqual(win.open('/events/test'), { url: '/events/test' });
  assert.equal(win.open('https://elevated-impact-platform.vercel.app'), null);
  assert.deepEqual(opened, ['/events/test']);
  const xhr = new win.XMLHttpRequest();
  xhr.open('GET', api + '/rest/v1/organizations');
  assert.equal(xhr.method, 'GET');
  assert.throws(() => xhr.open('POST', api + '/rest/v1/organizations'), /blocked/);
  assert.throws(() => xhr.open('GET', 'https://evil.example'), /blocked/);
  assert.ok(new win.WebSocket('wss://publruuuyvpggogrrgwp.supabase.co/realtime/v1/websocket'));
  assert.throws(() => new win.WebSocket('wss://evil.example'), /blocked/);
  assert.ok(new win.EventSource(api + '/rest/v1/organizations'));
  assert.throws(() => new win.EventSource('https://evil.example'), /blocked/);
  restore();
  assert.equal(win.open, originalOpen);
  assert.equal(win.XMLHttpRequest, FakeXHR);
  assert.equal(win.WebSocket, FakeSocket);
  assert.equal(win.EventSource, FakeEventSource);
});

test('the original EP UI is behind the verified Sandbox gate and a separate opt-in read-only flag', () => {
  const main = readFileSync('src/main.jsx', 'utf8');
  const client = readFileSync('src/lib/supabase.js', 'utf8');
  assert.match(main, /import ElevatedImpactPhaseOneFrontend from '\.\/App\.jsx'/);
  assert.match(main, /<SandboxAccessGate>/);
  assert.match(main, /!SANDBOX_WORKSPACE_ENABLED\s*&&\s*import\.meta\.env\.VITE_SANDBOX_READONLY_PREVIEW_ENABLED === 'true'/);
  assert.match(main, /SANDBOX_READONLY_REQUESTED\s*\?\s*<SandboxReadOnlyPreview \/>/);
  assert.match(main, /<SandboxWorkspaceStaging \/>/);
  assert.match(main, /readOnly: SANDBOX_READONLY_PREVIEW_ENABLED/);
  assert.match(main, /installSandboxReadOnlyActionsGuard\(/);
  assert.match(client, /readOnly: sandboxReadOnlyPreview/);
  assert.match(main, /Saving, payments, outgoing messages and other integrations are disabled/);
});

test('new database grants are select-only, fictional-only and rollbackable', () => {
  const sql = readFileSync('sandbox/grants/01_sandbox_ui_read_only.sql', 'utf8');
  const rollback = readFileSync('sandbox/grants/02_rollback_ui_read_only.sql', 'utf8');
  assert.match(sql, /sandbox_ops\.practice_testers/);
  assert.match(sql, /is_test IS DISTINCT FROM TRUE/);
  assert.match(sql, /GRANT SELECT ON TABLE/);
  assert.doesNotMatch(sql, /GRANT (?:ALL|INSERT|UPDATE|DELETE|TRUNCATE)/);
  assert.match(rollback, /REVOKE SELECT ON TABLE/);
  assert.match(rollback, /REVOKE USAGE ON SCHEMA app_private/);
  assert.match(sql, /authenticated;/);
});

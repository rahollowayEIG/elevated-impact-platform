import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { injectPwaHead, injectPwaOnApplicationHtml, resolvePwaFlavor } from '../src/pwa/pwaBranding.mjs';

const SANDBOX_URL = 'https://publruuuyvpggogrrgwp.supabase.co';
const html = readFileSync('index.html', 'utf8');
const data = kind => JSON.parse(readFileSync('public/pwa/' + kind + '.webmanifest', 'utf8'));

test('same app code builds with two explicitly distinct installation identities', () => {
  const live = data('live'), sandbox = data('sandbox');
  assert.equal(live.name, 'ElevationPilot');
  assert.equal(sandbox.name, 'ElevationPilot Sandbox');
  assert.notEqual(live.id, sandbox.id);
  for (const [kind, manifest] of [['live', live], ['sandbox', sandbox]]) {
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.prefer_related_applications, false);
    assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
    for (const icon of manifest.icons) {
      assert.equal(icon.type, 'image/png');
      assert.match(icon.purpose, /maskable/);
      assert.ok(icon.src.startsWith('/pwa/' + kind + '-'));
    }
  }
});

test('Vite refuses to build a sandbox app using any live or unknown Supabase project', () => {
  assert.equal(resolvePwaFlavor({}), 'live');
  assert.equal(resolvePwaFlavor({ VITE_ELEVATIONPILOT_SANDBOX: 'false' }), 'live');
  assert.equal(resolvePwaFlavor({
    VITE_ELEVATIONPILOT_SANDBOX: 'true',
    VITE_SUPABASE_URL: SANDBOX_URL,
  }), 'sandbox');
  assert.throws(() => resolvePwaFlavor({
    VITE_ELEVATIONPILOT_SANDBOX: 'true',
    VITE_SUPABASE_URL: 'https://aszixzrdayrivungodwq.supabase.co',
  }));
  assert.throws(() => resolvePwaFlavor({
    VITE_ELEVATIONPILOT_SANDBOX: 'false',
    VITE_SUPABASE_URL: SANDBOX_URL,
  }));
  assert.throws(() => resolvePwaFlavor({ VITE_ELEVATIONPILOT_SANDBOX: 'yes' }));
});

test('each HTML build selects exactly one matching manifest, icon, tab title and iOS title', () => {
  for (const kind of ['live', 'sandbox']) {
    const rendered = injectPwaHead(html, kind);
    const other = kind === 'live' ? 'sandbox' : 'live';
    const name = kind === 'live' ? 'ElevationPilot' : 'ElevationPilot Sandbox';
    assert.match(rendered, new RegExp('<title>' + name + '</title>'));
    assert.ok(rendered.includes('href="/pwa/' + kind + '.webmanifest"'));
    assert.ok(rendered.includes('href="/pwa/' + kind + '-192.png"'));
    assert.ok(rendered.includes('content="' + name + '"'));
    assert.equal((rendered.match(/rel="manifest"/g) || []).length, 1);
    assert.ok(!rendered.includes('href="/pwa/' + other + '.webmanifest"'));
    assert.ok(!rendered.includes('href="/pwa/' + other + '-192.png"'));
  }
});

test('four correctly-sized, visually distinct PNG icons can be built without network or dependencies', () => {
  execFileSync(process.execPath, ['scripts/generate-pwa-icons.mjs'], { stdio: 'pipe' });
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  for (const kind of ['live', 'sandbox']) {
    for (const size of [192,512]) {
      const bytes = readFileSync('public/pwa/' + kind + '-' + size + '.png');
      assert.ok(bytes.subarray(0,8).equals(signature));
      assert.equal(bytes.readUInt32BE(16),size);
      assert.equal(bytes.readUInt32BE(20),size);
      assert.ok(bytes.byteLength > 500, 'Expected an actual PNG with rendered geometry');
    }
  }
  assert.notDeepEqual(
    readFileSync('public/pwa/live-512.png'),
    readFileSync('public/pwa/sandbox-512.png'),
  );
});

test('PWA injection skips stand-alone browser harness HTML but decorates the real app', () => {
  const harness = readFileSync('tests/account-states.html', 'utf8');
  const testContext = { filename: '/repo/tests/account-states.html', path: '/tests/account-states.html' };
  assert.equal(injectPwaOnApplicationHtml(harness, 'live', testContext), harness);
  assert.equal(injectPwaOnApplicationHtml(harness, 'sandbox', testContext), harness);
  for (const flavor of ['live', 'sandbox']) {
    const decorated = injectPwaOnApplicationHtml(html, flavor, { filename: '/repo/index.html', path: '/' });
    assert.ok(decorated.includes('href="/pwa/' + flavor + '.webmanifest"'));
    assert.equal((decorated.match(/rel="manifest"/g) || []).length, 1);
  }
});

test('PWA does not add a service worker, offline transaction queue, or private-data cache', () => {
  const vite = readFileSync('vite.config.js','utf8');
  const assets = readFileSync('scripts/generate-pwa-icons.mjs','utf8');
  assert.match(vite, /injectPwaOnApplicationHtml/);
  assert.match(vite, /resolvePwaFlavor/);
  assert.doesNotMatch(vite, /serviceWorker|workbox|registerSW/);
  assert.doesNotMatch(assets, /fetch\(|https?:\/\//);
});

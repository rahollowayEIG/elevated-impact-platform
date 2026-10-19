import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('sandbox/edge-functions/read-only-pilot-manifest.json','utf8'));
const approvedProject = 'publruuuyvpggogrrgwp.supabase.co';
const liveProject = 'aszixzrdayrivungodwq.supabase.co';

test('only two explicitly audited read-only functions are eligible for initial Sandbox deployment', () => {
  assert.equal(manifest.target_project, 'publruuuyvpggogrrgwp');
  assert.equal(manifest.functions.length, 2);
  assert.deepEqual(manifest.functions.map(f => f.slug).sort(), [
    'golf-my-registrations',
    'public-event-squawks'
  ]);
  assert.deepEqual(manifest.functions.map(f => f.verify_jwt), [false, true]);
});

for (const entry of manifest.functions) {
  test(`${entry.slug} is pinned to Sandbox and cannot mutate data or call outbound services`, () => {
    const source = readFileSync(entry.entrypoint, 'utf8');
    assert.match(source, new RegExp(approvedProject.replaceAll('.', '\\.')));
    assert.doesNotMatch(source, new RegExp(liveProject.replaceAll('.', '\\.')));
    assert.match(source, /Sandbox service is not configured/);
    assert.match(source, /Access-Control-Allow-Origin": "https:\/\/elevationpilot-sandbox\.vercel\.app"/);
    assert.doesNotMatch(source, /\.(?:insert|upsert|update|delete)\s*\(/);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /(?:RESEND_API_KEY|STRIPE_SECRET_KEY|GOOGLE_CLIENT_SECRET|oauth2\.googleapis\.com|api\.resend\.com|api\.stripe\.com)/);
    assert.doesNotMatch(source, /auth\.admin\.|(?:window|globalThis)\.location\./);
    assert.match(source, new RegExp(entry.live_sha256));
  });
}

test('public Squawk feed preserves the existing published event and hub-visible filters', () => {
  const file = readFileSync('sandbox/edge-functions/public-event-squawks/index.ts','utf8');
  assert.match(file, /eq\("status", "published"\)/);
  assert.match(file, /contains\("metadata", \{ hub_visible: true \}\)/);
  assert.match(file, /if \(eventError \|\| !event\)/);
  assert.match(file, /supabaseUrl !== "https:\/\/publruuuyvpggogrrgwp\.supabase\.co"/);
});

test('golfer registration service still requires a real bearer-token user identity', () => {
  const file = readFileSync('sandbox/edge-functions/golf-my-registrations/index.ts','utf8');
  assert.match(file, /admin\.auth\.getUser\(token\)/);
  assert.match(file, /if \(userError \|\| !user\)/);
  assert.match(file, /user_id\.eq\./);
  assert.match(file, /url !== "https:\/\/publruuuyvpggogrrgwp\.supabase\.co"/);
});

test('full application remains gated; no Live environment or new grant is changed', () => {
  const main = readFileSync('src/main.jsx', 'utf8');
  assert.match(main, /VITE_SANDBOX_WORKSPACE_ENABLED === 'true'/);
  assert.match(main, /SANDBOX_WORKSPACE_ENABLED \? <ElevatedImpactPhaseOneFrontend \/> : <SandboxWorkspaceStaging \/>/);
});

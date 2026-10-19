import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forward = readFileSync('sandbox/grants/03_sandbox_event_builder_reads.sql','utf8');
const reverse = readFileSync('sandbox/grants/04_rollback_event_builder_reads.sql','utf8');
const setup = readFileSync('src/EieEventSetupSteps.jsx','utf8');
const directory = readFileSync('src/PlatformApp.jsx','utf8');
const main = readFileSync('src/main.jsx','utf8');

test('existing Event Builder reads offer, payment and master-event settings', () => {
  assert.match(setup, /\.from\('event_offers'\)/);
  assert.match(setup, /\.from\('golf_event_payment_settings'\)/);
  assert.match(setup, /supabase\.from\('events'\)\.select\('max_golfers,start_time'\)/);
  assert.match(directory, /\.from\('sponsors'\)/);
});

test('Sandbox grants are read-only and limited to required existing event tables', () => {
  assert.match(forward, /to_regclass\('sandbox_ops\.practice_testers'\)/);
  assert.match(forward, /is_test IS DISTINCT FROM TRUE/);
  assert.match(forward, /role='eig_admin'/);
  assert.match(forward, /GRANT SELECT ON TABLE\s+public\.event_offers,/);
  for (const table of ['golf_event_payment_settings','events','sponsors']) {
    assert.match(forward,new RegExp('public\\.'+table+'\\b'));
  }
  assert.doesNotMatch(forward, /GRANT (?:ALL|INSERT|UPDATE|DELETE|TRUNCATE)\s+ON/i);
  assert.match(forward, /TO authenticated;/);
});

test('master-event and sponsor policies verify server-owned fictional membership', () => {
  assert.match(forward,/CREATE POLICY "sandbox member read fictional master events"/);
  assert.match(forward,/CREATE POLICY "sandbox member read fictional sponsors"/);
  assert.match(forward,/ON public\.events FOR SELECT TO authenticated/);
  assert.match(forward,/ON public\.sponsors FOR SELECT TO authenticated/);
  assert.match(forward,/public\.is_organization_member\(/);
  assert.match(forward,/o\.is_test IS TRUE/);
  assert.match(forward,/o\.slug <> 'elevated-impact-group'/);
  assert.doesNotMatch(forward,/CREATE POLICY[^;]+FOR (?:UPDATE|INSERT|DELETE|ALL)/s);
});

test('there is an explicit standalone rollback and the full workflow stays locked', () => {
  assert.match(reverse,/DROP POLICY IF EXISTS "sandbox member read fictional sponsors"/);
  assert.match(reverse,/DROP POLICY IF EXISTS "sandbox member read fictional master events"/);
  assert.match(reverse,/REVOKE SELECT ON TABLE/);
  assert.match(reverse,/REVOKE EXECUTE ON FUNCTION app_private\.is_event_coordinator_for_master/);
  assert.match(main,/VITE_SANDBOX_WORKSPACE_ENABLED === 'true'/);
  assert.match(main,/VITE_SANDBOX_READONLY_PREVIEW_ENABLED === 'true'/);
});

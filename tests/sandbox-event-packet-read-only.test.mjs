import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAllowedSandboxReadOnlyRequest } from '../src/sandbox/sandboxBrowserFetchGuard.mjs';

const grant=readFileSync('sandbox/grants/05_sandbox_event_packet_read_only.sql','utf8');
const rollback=readFileSync('sandbox/grants/06_rollback_event_packet_read_only.sql','utf8');
const studio=readFileSync('src/components/EventPacketStudio.jsx','utf8');
const main=readFileSync('src/main.jsx','utf8');

test('the existing Event Packet screen reads saved assets with the original Supabase query',()=>{
  assert.match(studio,/\.from\("event_builder_assets"\)/);
  assert.match(studio,/\.select\("data,version,updated_at"\)/);
  assert.match(studio,/\.maybeSingle\(\)/);
  assert.match(studio,/row\?\.data \|\| \{ flyer: newFlyer\(\) \}/);
  assert.match(studio,/if \(!event\.field_settings\?\.venue_booking_request_id\) return;/);
});

test('a sandbox-only verified and non-privileged profile is provisioned without Live personal data',()=>{
  assert.match(grant,/to_regclass\('sandbox_ops\.practice_testers'\)/);
  assert.match(grant,/count\(\*\) FROM sandbox_ops\.practice_testers WHERE enabled\) <> 1/);
  assert.match(grant,/is_test IS DISTINCT FROM TRUE/);
  assert.match(grant,/status = 'published'/);
  assert.match(grant,/SELECT tester_user_id INTO v_uid/);
  assert.match(grant,/email_confirmed_at IS NOT NULL/);
  assert.match(grant,/FROM auth\.sessions s/);
  assert.match(grant,/INSERT INTO public\.profiles\(id,role,account_status\)/);
  assert.match(grant,/t\.tester_user_id,'user','active'/);
  assert.doesNotMatch(grant,/INSERT INTO public\.profiles\([^)]*(?:phone|email|date_of_birth|user_metadata)/);
});

test('Event Packet table receives SELECT only and reuses existing strict event RLS',()=>{
  assert.match(grant,/GRANT USAGE ON SCHEMA eig_private TO authenticated/);
  assert.match(grant,/GRANT EXECUTE ON FUNCTION eig_private\.can_manage_event_assets\(uuid\)/);
  assert.match(grant,/GRANT SELECT ON TABLE public\.event_builder_assets TO authenticated/);
  assert.doesNotMatch(grant,/GRANT (?:ALL|INSERT|UPDATE|DELETE|TRUNCATE)/);
  assert.doesNotMatch(grant,/CREATE POLICY/);
  assert.doesNotMatch(grant,/SECURITY DEFINER/);
  assert.match(rollback,/REVOKE SELECT ON TABLE public\.event_builder_assets/);
  assert.match(rollback,/REVOKE EXECUTE ON FUNCTION eig_private\.can_manage_event_assets/);
  assert.match(rollback,/REVOKE USAGE ON SCHEMA eig_private/);
});

test('read-only UI and write restrictions remain enabled, without broadening other RPCs',()=>{
  assert.match(main,/VITE_SANDBOX_READONLY_PREVIEW_ENABLED === 'true'/);
  assert.match(main,/VITE_SANDBOX_WORKSPACE_ENABLED === 'true'/);
  const cfg={appOrigin:'https://elevationpilot-sandbox.vercel.app',sandboxSupabaseUrl:'https://publruuuyvpggogrrgwp.supabase.co'};
  assert.equal(isAllowedSandboxReadOnlyRequest(cfg.sandboxSupabaseUrl+'/rest/v1/event_builder_assets?select=*',{method:'GET'},cfg),true);
  assert.equal(isAllowedSandboxReadOnlyRequest(cfg.sandboxSupabaseUrl+'/rest/v1/event_builder_assets',{method:'POST'},cfg),false);
  assert.equal(isAllowedSandboxReadOnlyRequest(cfg.sandboxSupabaseUrl+'/rest/v1/rpc/save_event_builder_assets',{method:'POST'},cfg),false);
  assert.equal(isAllowedSandboxReadOnlyRequest(cfg.sandboxSupabaseUrl+'/rest/v1/rpc/read_eie_event_budget',{method:'POST'},cfg),true);
  assert.equal(isAllowedSandboxReadOnlyRequest(cfg.sandboxSupabaseUrl+'/rest/v1/rpc/save_eie_event_budget',{method:'POST'},cfg),false);
  assert.equal(isAllowedSandboxReadOnlyRequest('https://aszixzrdayrivungodwq.supabase.co/rest/v1/event_builder_assets',{method:'GET'},cfg),false);
});

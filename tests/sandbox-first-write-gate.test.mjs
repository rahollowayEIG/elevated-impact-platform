import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isAllowedSandboxReadOnlyRequest,
  createSandboxGuardedFetch,
} from '../src/sandbox/sandboxBrowserFetchGuard.mjs';
const sql=readFileSync('sandbox/first-write/01_sandbox_atomic_event_details.sql','utf8');
const rollback=readFileSync('sandbox/first-write/02_rollback_atomic_event_details.sql','utf8');
const ui=readFileSync('src/EieEventSetupSteps.jsx','utf8');
const main=readFileSync('src/main.jsx','utf8');
const supabaseClient=readFileSync('src/lib/supabase.js','utf8');
const actionsGuard=readFileSync('src/sandbox/sandboxReadOnlyActionsGuard.mjs','utf8');
const api='https://publruuuyvpggogrrgwp.supabase.co';
const opts={
  appOrigin:'https://elevationpilot-sandbox.vercel.app',
  sandboxSupabaseUrl:api,
  readOnly:true,
};
const target=api+'/rest/v1/rpc/sandbox_save_practice_event_details';

test('Sandbox Event Details first-write remains OFF in the normal read-only preview',()=>{
  assert.equal(isAllowedSandboxReadOnlyRequest(target,{method:'POST'},opts),false);
  const devEnabled={...opts,eventDetailsWriteEnabled:true};
  assert.equal(isAllowedSandboxReadOnlyRequest(target,{method:'POST'},devEnabled),true);
  for(const [url,method] of [
    [target,'GET'],[target,'PATCH'],[target,'DELETE'],
    [api+'/rest/v1/golf_registration_events','PATCH'],
    [api+'/rest/v1/events','PATCH'],
    [api+'/rest/v1/rpc/save_event_builder_assets','POST'],
    [api+'/rest/v1/rpc/save_eie_event_budget','POST'],
    [api+'/functions/v1/platform-invite','POST'],
    [api+'/functions/v1/create-golf-checkout-session','POST'],
    ['https://aszixzrdayrivungodwq.supabase.co/rest/v1/rpc/sandbox_save_practice_event_details','POST'],
  ]) assert.equal(isAllowedSandboxReadOnlyRequest(url,{method},devEnabled),false,method+' '+url);
});

test('the Sandbox fetch transport enforces the exact gated RPC path',async()=>{
  let calls=0;
  const fake=async()=>{calls++;return {ok:true};};
  const blocked=createSandboxGuardedFetch(fake,opts);
  await assert.rejects(blocked(target,{method:'POST'}),/restricted network request/);
  assert.equal(calls,0);
  const enabled=createSandboxGuardedFetch(fake,{...opts,eventDetailsWriteEnabled:true});
  await enabled(target,{method:'POST'});
  await assert.rejects(enabled(api+'/rest/v1/rpc/save_eie_event_budget',{method:'POST'}),/restricted network request/);
  assert.equal(calls,1);
});

test('the original Live Save implementation is preserved behind the strict Sandbox feature gate',()=>{
  assert.match(ui,/VITE_ELEVATIONPILOT_SANDBOX === 'true'/);
  assert.match(ui,/VITE_SANDBOX_READONLY_PREVIEW_ENABLED === 'true'/);
  assert.match(ui,/VITE_SANDBOX_WORKSPACE_ENABLED !== 'true'/);
  assert.match(ui,/VITE_SANDBOX_EVENT_DETAILS_SAVE_ENABLED === 'true'/);
  assert.match(ui,/\.rpc\(\s*'sandbox_save_practice_event_details'/);
  assert.match(ui,/p_expected_updated_at: event\.updated_at/);
  assert.match(ui,/p_event_id: event\.id/);
  assert.match(ui,/details\.google_calendar_sync_enabled/);
  assert.match(ui,/\.from\('golf_registration_events'\)\s*\.update\(/);
  assert.match(ui,/\.from\('events'\)\s*\.update\(/);
  assert.match(main,/SANDBOX_EVENT_DETAILS_SAVE_ENABLED = SANDBOX_READONLY_PREVIEW_ENABLED/);
  assert.match(main,/Saving, payments, outgoing messages and other integrations are disabled/);
  assert.match(main,/Only Event Details for the fictional Draft event can save/);
  assert.match(supabaseClient,/eventDetailsWriteEnabled: sandboxEventDetailsSaveEnabled/);
  assert.match(actionsGuard,/eventDetailsWriteEnabled = false/);
});

test('the ONLY privileged write procedure is private, and the public facade is SECURITY INVOKER',()=>{
  assert.match(sql,/CREATE FUNCTION sandbox_ops\.save_practice_event_details/);
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/SET search_path = ''/);
  assert.match(sql,/CREATE FUNCTION public\.sandbox_save_practice_event_details/);
  assert.match(sql,/LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.sandbox_save_practice_event_details/);
  assert.match(sql,/FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.sandbox_save_practice_event_details/);
  assert.doesNotMatch(sql,/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE)\s+ON TABLE/i);
});

test('the sandbox-only SQL explicitly checks identity, role, fixture, no registrations and concurrency',()=>{
  for(const expected of [
    "sandbox_ops.practice_testers",
    "FROM auth.users u",
    "JOIN auth.sessions s",
    "u.email_confirmed_at IS NOT NULL",
    "p.account_status='active'",
    "v_tester.active_role NOT IN ('pilot','co_pilot')",
    "m.role=CASE WHEN v_tester.active_role='pilot'",
    "organization_id=v_org.id",
    "status='draft'",
    "is_sandbox_fixture",
    "google_calendar_sync_enabled IS FALSE",
    "EXISTS (SELECT 1 FROM public.golf_registrations",
    "v_event.updated_at IS DISTINCT FROM p_expected_updated_at",
    "ERRCODE='40001'",
    "WHERE id=v_event.master_event_id",
    "status='pending_review'",
    "Unexpected or missing Event Details fields",
    "p_expected_updated_at",
    "google_calendar_sync_status='not_synced'",
  ]) assert.ok(sql.includes(expected),'SQL missing safeguard: '+expected);
  assert.match(rollback,/DROP FUNCTION IF EXISTS public\.sandbox_save_practice_event_details/);
  assert.match(rollback,/DROP FUNCTION IF EXISTS sandbox_ops\.save_practice_event_details/);
  assert.match(rollback,/REVOKE USAGE ON SCHEMA sandbox_ops FROM authenticated/);
});

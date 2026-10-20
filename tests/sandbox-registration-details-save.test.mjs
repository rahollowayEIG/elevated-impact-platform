import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAllowedSandboxReadOnlyRequest,createSandboxGuardedFetch } from '../src/sandbox/sandboxBrowserFetchGuard.mjs';
const sql=readFileSync('sandbox/first-write/04_sandbox_atomic_registration_details.sql','utf8');
const smoke=readFileSync('sandbox/first-write/05_atomic_registration_smoke_test.sql','utf8');
const rollback=readFileSync('sandbox/first-write/06_rollback_atomic_registration_details.sql','utf8');
const ui=readFileSync('src/EieEventSetupSteps.jsx','utf8');
const main=readFileSync('src/main.jsx','utf8');
const apiClient=readFileSync('src/lib/supabase.js','utf8');
const actions=readFileSync('src/sandbox/sandboxReadOnlyActionsGuard.mjs','utf8');
const sandboxUrl='https://publruuuyvpggogrrgwp.supabase.co';
const opts={
 appOrigin:'https://elevationpilot-sandbox.vercel.app',
 sandboxSupabaseUrl:sandboxUrl,readOnly:true,
};
const allowed=sandboxUrl+'/rest/v1/rpc/sandbox_save_practice_registration_details';

test('new Registration Details RPC is denied until the independent feature flag is enabled',()=>{
 assert.equal(isAllowedSandboxReadOnlyRequest(allowed,{method:'POST'},opts),false);
 assert.equal(isAllowedSandboxReadOnlyRequest(allowed,{method:'POST'},{
  ...opts,eventDetailsWriteEnabled:true,
 }),false);
 assert.equal(isAllowedSandboxReadOnlyRequest(allowed,{method:'POST'},{
  ...opts,registrationDetailsWriteEnabled:true,
 }),true);
 assert.equal(isAllowedSandboxReadOnlyRequest(
  sandboxUrl+'/rest/v1/rpc/sandbox_save_practice_event_details',{method:'POST'},
  {...opts,registrationDetailsWriteEnabled:true}),false);
});

test('all unrelated writes, providers, live project and other HTTP methods remain forbidden',()=>{
 const approved={...opts,registrationDetailsWriteEnabled:true};
 for (const [url,method] of [
  [allowed,'GET'],[allowed,'PATCH'],[allowed,'PUT'],[allowed,'DELETE'],
  [sandboxUrl+'/rest/v1/golf_registration_events','PATCH'],
  [sandboxUrl+'/rest/v1/event_offers','POST'],
  [sandboxUrl+'/rest/v1/golf_event_payment_settings','POST'],
  [sandboxUrl+'/rest/v1/rpc/save_event_builder_assets','POST'],
  [sandboxUrl+'/rest/v1/rpc/save_eie_event_budget','POST'],
  [sandboxUrl+'/rest/v1/rpc/create_eie_quick_registration_event','POST'],
  [sandboxUrl+'/rest/v1/rpc/save_hub_setup','POST'],
  [sandboxUrl+'/functions/v1/golf-admin-team-registration','POST'],
  [sandboxUrl+'/functions/v1/golf-admin-team-management','POST'],
  [sandboxUrl+'/functions/v1/platform-invite','POST'],
  [sandboxUrl+'/functions/v1/create-golf-checkout-session','POST'],
  ['https://aszixzrdayrivungodwq.supabase.co/rest/v1/rpc/sandbox_save_practice_registration_details','POST'],
 ]) assert.equal(isAllowedSandboxReadOnlyRequest(url,{method},approved),false,method+' '+url);
});

test('fetch client invokes only the specific authorized Sandbox RPC when enabled',async()=>{
 let called=0;
 const stub=async()=>{called++;return {ok:true};};
 const off=createSandboxGuardedFetch(stub,opts);
 await assert.rejects(off(allowed,{method:'POST'}),/restricted network request/);
 const on=createSandboxGuardedFetch(stub,{...opts,registrationDetailsWriteEnabled:true});
 await on(allowed,{method:'POST'});
 await assert.rejects(on(sandboxUrl+'/rest/v1/rpc/save_eie_event_budget',{method:'POST'}),/restricted network request/);
 assert.equal(called,1);
});

test('original registration editor is conditionally wired, not replaced for Live',()=>{
 for(const expected of [
  "VITE_ELEVATIONPILOT_SANDBOX === 'true'",
  "VITE_SANDBOX_READONLY_PREVIEW_ENABLED === 'true'",
  "VITE_SANDBOX_WORKSPACE_ENABLED !== 'true'",
  "VITE_SANDBOX_REGISTRATION_DETAILS_SAVE_ENABLED === 'true'",
  "'sandbox_save_practice_registration_details'",
  "p_event_id: event.id",
  "p_expected_updated_at: event.updated_at",
  "registration_deadline_utc:",
  "registration.custom_fields.map",
  "onEventUpdated(saved.event)",
  "saved.event.status !== 'draft'",
 ]) assert.ok(ui.includes(expected),'Missing original UI scoped save: '+expected);
 assert.match(ui,/async function saveRegistrationDetails\(next = false\)/);
 assert.match(ui,/const \{ data, error \} = await supabase\s*\.from\('golf_registration_events'\)\s*\.update\(\{\s*member_price/);
 assert.match(ui,/\.from\('golf_event_payment_settings'\)\s*\.upsert\(/);
 assert.match(ui,/\.from\('event_offers'\)\.insert\(/);
 assert.match(main,/SANDBOX_REGISTRATION_DETAILS_SAVE_ENABLED = SANDBOX_READONLY_PREVIEW_ENABLED/);
 assert.match(main,/Actual registrations, payments, reminders, invitations, publishing and all other editing remain disabled/);
 assert.match(apiClient,/registrationDetailsWriteEnabled: sandboxRegistrationDetailsSaveEnabled/);
 assert.match(actions,/registrationDetailsWriteEnabled = false/);
});

test('privileged registration transaction lives outside exposed Data API schema',()=>{
 assert.match(sql,/CREATE FUNCTION sandbox_ops\.save_practice_registration_details/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/SET search_path = ''/);
 assert.match(sql,/CREATE FUNCTION public\.sandbox_save_practice_registration_details/);
 assert.match(sql,/SECURITY INVOKER SET search_path=''/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.sandbox_save_practice_registration_details/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|ALL)\s+ON TABLE/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.sandbox_save_practice_registration_details/);
});

test('server checks real session, ownership, Draft status, optimistic lock and limited fields',()=>{
 for(const token of [
  "sandbox_ops.practice_testers",
  "WHERE enabled AND tester_user_id=auth.uid()",
  "JOIN auth.sessions s",
  "u.email_confirmed_at IS NOT NULL",
  "m.role=CASE WHEN v_tester.active_role='pilot'",
  "v_tester.active_role NOT IN ('pilot','co_pilot')",
  "e.status='draft'",
  "e.field_settings->>'is_sandbox_fixture'='true'",
  "e.field_settings->>'event_details_status'='configured'",
  "e.google_calendar_sync_enabled IS FALSE",
  "EXISTS (",
  "public.golf_registrations r WHERE r.event_id=p_event_id",
  "m.is_published IS FALSE",
  "m.registration_status IN ('draft','closed')",
  "v_event.updated_at IS DISTINCT FROM p_expected_updated_at",
  "ERRCODE='40001'",
  "Unknown or incomplete Registration Details fields",
  "custom_fields",
  "reminders_enabled=false",
  "auto_charge_at_deadline=false",
  "'participant_fields_status','configured'",
  "'base_registration_price',v_price",
 ]) assert.ok(sql.includes(token),'Missing SQL safeguard: '+token);
 assert.match(rollback,/DROP FUNCTION IF EXISTS public\.sandbox_save_practice_registration_details/);
 assert.match(rollback,/DROP FUNCTION IF EXISTS sandbox_ops\.save_practice_registration_details/);
 assert.doesNotMatch(rollback,/REVOKE USAGE ON SCHEMA sandbox_ops/);
});

test('negative role and malformed-registration integration cases are rollback-only',()=>{
 assert.match(smoke,/^BEGIN;/m);
 assert.match(smoke,/^ROLLBACK;/m);
 assert.doesNotMatch(smoke,/^COMMIT;/m);
 for(const fragment of [
  "public.sandbox_switch_practice_role('pilot')",
  "public.sandbox_switch_practice_role('co_pilot')",
  "ARRAY['atc','passenger']",
  "Stale registration overwrite unexpectedly succeeded",
  "Published injection unexpectedly succeeded",
  "Negative registration price unexpectedly saved",
  "Oversized team unexpectedly saved",
  "Invalid registration calendar date accepted",
  "Unrelated event unexpectedly editable",
  "payment_settings_after_rollback",
  "active_offers_after_rollback",
  "direct_write_grants",
 ]) assert.ok(smoke.includes(fragment),'Missing rollback integration case: '+fragment);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isAllowedSandboxReadOnlyRequest,
  createSandboxGuardedFetch,
} from '../src/sandbox/sandboxBrowserFetchGuard.mjs';

const migration=readFileSync('sandbox/grants/07_sandbox_budget_read_only.sql','utf8');
const rollback=readFileSync('sandbox/grants/08_rollback_budget_read_only.sql','utf8');
const budgetStore=readFileSync('src/lib/eventBudgetStore.js','utf8');
const budget=readFileSync('src/components/EventBudget.jsx','utf8');
const client=readFileSync('src/lib/supabase.js','utf8');
const main=readFileSync('src/main.jsx','utf8');
const cfg={
  appOrigin:'https://elevationpilot-sandbox.vercel.app',
  sandboxSupabaseUrl:'https://publruuuyvpggogrrgwp.supabase.co',
  readOnly:true,
};
const api=cfg.sandboxSupabaseUrl;

test('reuse the original EIE Budget read path rather than copying the UI',()=>{
  assert.match(budgetStore,/supabase\.rpc\("read_eie_event_budget"/);
  assert.match(budgetStore,/supabase\.rpc\("save_eie_event_budget"/);
  assert.match(budget,/eventBudgetStore\.load\(event\.id\)/);
  assert.match(main,/import ElevatedImpactPhaseOneFrontend from '\.\/App\.jsx'/);
  assert.match(main,/VITE_SANDBOX_WORKSPACE_ENABLED === 'true'/);
});

test('Sandbox Budget grants are exactly two existing read-RPC EXECUTEs and no writes',()=>{
  assert.match(migration,/sandbox_ops\.practice_testers/);
  assert.match(migration,/is_test IS DISTINCT FROM TRUE/);
  assert.match(migration,/account_status='active'/);
  assert.match(migration,/email_confirmed_at IS NOT NULL/);
  assert.match(migration,/read_eie_event_budget/);
  assert.match(migration,/eig_private\.read_event_budget/);
  assert.match(migration,/p\.prosecdef IS FALSE/);
  assert.match(migration,/p\.prosecdef IS TRUE/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION eig_private\.read_event_budget\(uuid\) TO authenticated/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.read_eie_event_budget\(uuid\) TO authenticated/);
  assert.doesNotMatch(migration,/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE|SELECT)\b/i);
  assert.doesNotMatch(migration,/(?:GRANT EXECUTE ON FUNCTION|TO authenticated)\s+(?:public\.)?save_eie_event_budget\b/i);
  assert.doesNotMatch(migration,/CREATE POLICY/);
  assert.match(rollback,/REVOKE EXECUTE ON FUNCTION public\.read_eie_event_budget\(uuid\) FROM authenticated/);
  assert.match(rollback,/REVOKE EXECUTE ON FUNCTION eig_private\.read_event_budget\(uuid\) FROM authenticated/);
});

test('browser preview permits existing Budget read POST and rejects every write path', async()=>{
  const allowed=api+'/rest/v1/rpc/read_eie_event_budget';
  const blocked=api+'/rest/v1/rpc/save_eie_event_budget';
  assert.equal(isAllowedSandboxReadOnlyRequest(allowed,{method:'POST'},cfg),true);
  for(const [url,method] of [
    [allowed,'GET'], [allowed,'PATCH'], [allowed,'DELETE'],
    [blocked,'POST'], [blocked,'GET'],
    [api+'/rest/v1/eie_event_budgets','PATCH'],
    [api+'/rest/v1/eie_event_budgets','POST'],
    [api+'/rest/v1/rpc/save_event_builder_assets','POST'],
    ['https://aszixzrdayrivungodwq.supabase.co/rest/v1/rpc/read_eie_event_budget','POST'],
  ]) assert.equal(isAllowedSandboxReadOnlyRequest(url,{method},cfg),false,method+' '+url);
  let sent=0;
  const fetch=createSandboxGuardedFetch(async()=>{sent++;return {ok:true};},cfg);
  await fetch(allowed,{method:'POST'});
  await assert.rejects(fetch(blocked,{method:'POST'}),/restricted network request/);
  assert.equal(sent,1);
  assert.match(client,/readOnly: sandboxReadOnlyPreview/);
  assert.match(main,/VITE_SANDBOX_READONLY_PREVIEW_ENABLED === 'true'/);
});

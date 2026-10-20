import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script=readFileSync('sandbox/first-write/03_transactional_smoke_test.sql','utf8');
const source=readFileSync('sandbox/first-write/01_sandbox_atomic_event_details.sql','utf8');
const rollback=readFileSync('sandbox/first-write/02_rollback_atomic_event_details.sql','utf8');

test('Sandbox first-save smoke test always rolls back synthetic data',()=>{
  assert.match(script,/^BEGIN;$/m);
  assert.match(script,/^ROLLBACK;$/m);
  assert.match(script,/sandbox_ops\.practice_testers/);
  assert.match(script,/is_sandbox_fixture/);
  assert.match(script,/original_event_preserved/);
  assert.match(script,/original_role_preserved/);
  assert.match(script,/authenticated_write_grants/);
  assert.doesNotMatch(script,/^COMMIT;/m);
});

test('Real first-save protections have matching automated negative SQL scenarios',()=>{
  for(const expected of [
    'Stale optimistic concurrency accepted',
    'Malicious status field was accepted',
    'Invalid date was accepted',
    'Oversized team was accepted',
    'Unknown event accepted',
    'Co-Pilot denied',
    'Forbidden role % could save',
    'Anonymous RPC or broad authenticated table write grant',
  ]) assert.ok(script.includes(expected),'Missing negative test: '+expected);
  assert.match(source,/AND google_calendar_sync_enabled IS FALSE/);
  assert.match(source,/AND status='draft'/);
  assert.match(source,/AND m\.status='pending_review'/);
  assert.match(source,/EXISTS \(SELECT 1 FROM public\.golf_registrations/);
  assert.match(source,/auth\.jwt\(\)->>'session_id'/);
  assert.match(rollback,/REVOKE EXECUTE ON FUNCTION public\.sandbox_save_practice_event_details/);
});

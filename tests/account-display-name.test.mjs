import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDisplayName } from '../src/lib/accountDisplayName.mjs';
test('name fallback uses trimmed display name, full name, then unique handle without email-derived names', () => {
  assert.equal(accountDisplayName({ profile: { display_name: ' Avery ', first_name: 'Other', username: 'other' } }), 'Avery');
  assert.equal(accountDisplayName({ profile: { display_name: ' ', first_name: ' Avery ', last_name: ' Tester ', username: 'avery' } }), 'Avery Tester');
  assert.equal(accountDisplayName({ email: 'private@example.test', profile: { username: 'avery' } }), '@avery');
  assert.equal(accountDisplayName({ email: 'private@example.test' }), 'ElevationPilot User');
});

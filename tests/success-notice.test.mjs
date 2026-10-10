import test from 'node:test';
import assert from 'node:assert/strict';
import { isActionSuccessText, announceActionComplete } from '../src/lib/successNotice.mjs';

test('announces meaningful successful actions across the platform', () => {
  for (const text of [
    'Saved. Team roster updated and invitations processed.',
    'Public Hub details saved.',
    'Profile saved. Your updated Passenger information will be available.',
    'Team / Entry #20 created.',
    'Golfer removed. The team spot is open for a replacement.',
    'Google Sheet synced successfully. 24 registrations updated.',
    'Budget saved. Version 2.',
    'Posting plan reviewed and saved. Version 3. Nothing has been published.',
    'Event packet saved. Version 3.',
    'Your account is ready. Sign in with the password you just created.',
    'Calendar downloaded for manual posting reminders.',
    'Registration invitation sent.',
    'Approved design attached to the event packet.',
  ]) {
    assert.equal(isActionSuccessText(text), true, text);
  }
});

test('does not turn validation, progress, failures or warnings into green success', () => {
  for (const text of [
    '',
    'Loading team...',
    'Preparing the Required Roster Sheet...',
    'Required mapping needed: Email.',
    'A reason is required when comping golfers.',
    'Unable to save Event Details.',
    'Golfer added, but email delivery needs attention.',
    'Invite saved but email was not sent.',
    'Save a reviewed version before exporting.',
    'Unsaved changes',
    'Failed to update roster.',
    'Roster import could not be completed.',
    'Select a golfer and try again.',
    'Payment pending',
  ]) {
    assert.equal(isActionSuccessText(text), false, text);
  }
});

test('dispatch helper is safe during server-side rendering', () => {
  assert.equal(announceActionComplete('Profile saved.'), true);
  assert.equal(announceActionComplete('Payment pending'), false);
});

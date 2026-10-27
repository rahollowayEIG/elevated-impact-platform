import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('current ElevationPilot Airport My Profile renders email controls outside the profile form', async () => {
  const screen = await read('src/ElevationAirport.jsx');
  const formIndex = screen.indexOf('export function PassengerProfilePage');
  const nextPage = screen.indexOf('export function ', formIndex + 20);
  const profile = screen.slice(formIndex, nextPage >= 0 ? nextPage : undefined);
  assert.match(screen, /import PassengerEmailSettings from '\.\/components\/PassengerEmailSettings\.jsx'/);
  const formClose = profile.indexOf('</form>');
  const emailComponent = profile.indexOf('<PassengerEmailSettings />');
  assert.ok(emailComponent > formClose && formClose > 0, 'Settings must be outside save-profile form');
  assert.match(profile, /Airport · Passenger ID/);
  assert.match(profile, /My Profile/);
});

test('email management cannot be enabled against production backend', async () => {
  const src = await read('src/components/PassengerEmailSettings.jsx');
  assert.match(src, /VITE_EP_PERSON_EMAIL_MANAGEMENT_ENABLED === 'true'/);
  assert.match(src, /VITE_ELEVATIONPILOT_SANDBOX === 'true'/);
  assert.match(src, /VITE_SUPABASE_URL === 'https:\/\/publruuuyvpggogrrgwp\.supabase\.co'/);
  assert.match(src, /if \(!CAN_MANAGE_PASSENGER_EMAILS\) return null/);
});

test('email preferences UI uses authenticated server-owned operations, not direct contact table edits', async () => {
  const src = await read('src/components/PassengerEmailSettings.jsx');
  assert.match(src, /supabase\.functions\.invoke\('golf-account-emails'/);
  for (const action of ['list','request_verification','verify','set_default','deactivate']) {
    assert.ok(src.includes("'" + action + "'"), action + ' action missing');
  }
  assert.doesNotMatch(src, /\.from\(['"]passenger_contacts['"]\)/);
  assert.match(src, /Sandbox note: verification emails are currently disabled/);
});

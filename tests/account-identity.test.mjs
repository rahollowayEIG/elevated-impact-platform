import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACCOUNT_GENDERS, validateAccountIdentity } from '../src/lib/accountIdentity.mjs';

const now = new Date('2026-10-10T12:00:00Z');

test('new accounts require a valid DOB and an explicit gender selection', () => {
  assert.equal(validateAccountIdentity({date_of_birth:'1990-02-28',gender:'Male'},now),'');
  assert.equal(validateAccountIdentity({date_of_birth:'2001-07-14',gender:'Female'},now),'');
  assert.equal(validateAccountIdentity({date_of_birth:'1980-11-10',gender:'Prefer not to say'},now),'');
  assert.match(validateAccountIdentity({date_of_birth:'',gender:'Female'},now),/date of birth/);
  assert.match(validateAccountIdentity({date_of_birth:'2000-01-01',gender:''},now),/gender/i);
  assert.match(validateAccountIdentity({date_of_birth:'2026-10-11',gender:'Male'},now),/future/i);
  assert.match(validateAccountIdentity({date_of_birth:'2023-02-29',gender:'Male'},now),/valid date/i);
  assert.match(validateAccountIdentity({date_of_birth:'1899-12-31',gender:'Male'},now),/valid date/i);
  assert.match(validateAccountIdentity({date_of_birth:'2000-01-01',gender:'Guess'},now),/valid gender/i);
  assert.deepEqual(ACCOUNT_GENDERS,['Male','Female','Prefer not to say']);
});

test('Elevated Impact join, team invite, and new role invite all require identity fields', async () => {
  const [platform,teammate] = await Promise.all([
    readFile(new URL('../src/PlatformApp.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/GolfTeamInvitation.jsx',import.meta.url),'utf8'),
  ]);
  assert.match(platform,/joinDateOfBirth/);
  assert.match(platform,/joinGender/);
  assert.match(platform,/date_of_birth: joinDateOfBirth/);
  assert.match(platform,/gender: joinGender/);
  assert.match(platform,/validateAccountIdentity/);
  assert.match(platform,/requiresIdentityDetails/);
  assert.match(teammate,/validateAccountIdentity/);
  assert.match(teammate,/date_of_birth: dateOfBirth/);
  assert.match(teammate,/gender/);
  assert.match(teammate,/type="date"/);
});

test('account profile identity remains optional for previously registered users', async () => {
  const source = await readFile(new URL('../src/PlatformApp.jsx',import.meta.url),'utf8');
  const signIn = source.slice(source.indexOf('async function submit(event) {'),source.indexOf('async function createPassengerAccount(event)'));
  assert.doesNotMatch(signIn,/validateAccountIdentity/);
  assert.match(source,/if \(requiresIdentityDetails\)/);
});


test('new role invites validate and persist DOB/Gender before activating access', async () => {
  const source=await readFile(new URL('../supabase/functions/platform-invite/index.ts',import.meta.url),'utf8');
  const start=source.indexOf('if (action === "accept")');
  const end=source.indexOf('if (action === "revoke")',start);
  const section=source.slice(start,end>start?end:undefined);
  assert.match(section,/requiresIdentityDetails = invitation\.recipient_was_existing !== true/);
  assert.match(section,/validAccountDob\(dateOfBirth\)/);
  assert.match(section,/ACCOUNT_GENDERS\.has\(selectedGender\)/);
  assert.match(section,/date_of_birth: dateOfBirth/);
  assert.match(section,/gender: selectedGender/);
  assert.ok(section.indexOf('validAccountDob(dateOfBirth)') < section.indexOf('if (["eig_admin", "organization_admin"'));
  assert.match(section,/date_of_birth: registrationRow\.date_of_birth \|\| passenger\.date_of_birth \|\| null/);
  assert.match(section,/gender: registrationRow\.gender \|\| passenger\.gender \|\| null/);
});

test('on login, validated identity metadata populates only missing Passenger fields', async () => {
  const source=await readFile(new URL('../src/PlatformApp.jsx',import.meta.url),'utf8');
  const start=source.indexOf('async function loadAirportData(userId)');
  const end=source.indexOf('async function loadEventRequests(',start);
  const section=source.slice(start,end);
  assert.match(section,/validateAccountIdentity\(\{ date_of_birth: birth, gender: selectedGender \}\)/);
  assert.match(section,/date_of_birth: resolvedPassenger\?\.date_of_birth \|\| birth/);
  assert.match(section,/gender: resolvedPassenger\?\.gender \|\| selectedGender/);
  assert.match(section,/auth_user_id: userId/);
  assert.doesNotMatch(section,/\.from\('golf_registrations'\)\.update/);
});

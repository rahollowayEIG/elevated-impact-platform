import assert from 'node:assert/strict';
import test from 'node:test';
import { rosterMatchesSearch, sortRosterRows } from '../src/rosterSearch.mjs';

const rows = [
  {
    id: '1', first_name: 'Kellie', last_name: 'Martin', email: 'kellie@example.com',
    phone: '(717) 555-0101', team_id: '12', ghin_number: '1234567', division: 'Women',
    payment_status: 'paid', registration_status: 'active', price: 120,
    custom_fields: { shirt_size: 'M', company: 'Acme Golf' },
  },
  {
    id: '2', first_name: 'Dave', last_name: 'Ernst', email: 'dave@example.com',
    phone: '484-555-0199', team_id: '2', ghin_number: '7654321', division: 'Open',
    payment_status: 'pending', registration_status: 'active', price: 95,
    custom_fields: { shirt_size: 'L' },
  },
  {
    id: '3', first_name: 'Ryan', last_name: 'Holloway', email: 'ryan@example.com',
    phone: '610-555-0100', team_id: '4', ghin_number: '', division: 'Open',
    payment_status: 'comp', registration_status: 'withdrawn', price: 0,
    custom_fields: {},
  },
];

test('roster search matches common identifying and operational fields', () => {
  assert.equal(rosterMatchesSearch(rows[0], 'kellie martin'), true);
  assert.equal(rosterMatchesSearch(rows[0], 'KELLIE@EXAMPLE.COM'), true);
  assert.equal(rosterMatchesSearch(rows[0], '7175550101'), true);
  assert.equal(rosterMatchesSearch(rows[0], '1234567'), true);
  assert.equal(rosterMatchesSearch(rows[0], 'Acme Golf'), true);
  assert.equal(rosterMatchesSearch(rows[1], 'team 2'), false);
  assert.equal(rosterMatchesSearch(rows[1], '2'), true);
  assert.equal(rosterMatchesSearch(rows[2], 'withdrawn'), true);
  assert.equal(rosterMatchesSearch(rows[2], 'no-such-golfer'), false);
  assert.equal(rosterMatchesSearch(rows[2], ''), true);
});

test('roster sorting toggles meaningful fields with stable typed ordering', () => {
  assert.deepEqual(sortRosterRows(rows, { field: 'golfer', direction: 'asc' }).map((r) => r.id), ['2','3','1']);
  assert.deepEqual(sortRosterRows(rows, { field: 'golfer', direction: 'desc' }).map((r) => r.id), ['1','3','2']);
  assert.deepEqual(sortRosterRows(rows, { field: 'team', direction: 'asc' }).map((r) => r.id), ['2','3','1']);
  assert.deepEqual(sortRosterRows(rows, { field: 'price', direction: 'asc' }).map((r) => r.id), ['3','2','1']);
  assert.deepEqual(sortRosterRows(rows, { field: 'price', direction: 'desc' }).map((r) => r.id), ['1','2','3']);
  assert.deepEqual(sortRosterRows(rows, { field: '', direction: 'asc' }).map((r) => r.id), ['1','2','3']);
});

test('sorting does not mutate the source list', () => {
  const source = [...rows];
  sortRosterRows(rows, { field: 'price', direction: 'desc' });
  assert.deepEqual(rows, source);
});

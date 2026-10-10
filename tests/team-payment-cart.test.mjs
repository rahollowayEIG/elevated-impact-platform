import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTeamCart } from '../src/lib/teamPaymentCart.mjs';

function fixture() {
  const registrations = [
    { id: 'captain', first_name: 'Marshal', last_name: 'Holloway', price: 240, payment_status: 'pending', registration_status: 'active', created_at: '2026-01-01' },
    { id: 'reese', first_name: 'Reese', last_name: 'Holloway', price: 0, payment_status: 'pending', registration_status: 'active', created_at: '2026-01-02' },
    { id: 'tba-a', first_name: 'TBA', last_name: 'Reserved', price: 0, payment_status: 'pending', registration_status: 'active', custom_fields: { reserved_tba: true }, created_at: '2026-01-03' },
    { id: 'tba-b', first_name: 'TBA', last_name: 'Reserved', price: 0, payment_status: 'pending', registration_status: 'active', custom_fields: { reserved_tba: true }, created_at: '2026-01-04' },
  ];
  return {
    team: { id: 'test-team', captain_registration_id: 'captain', payment_mode: 'captain_all', team_size: 4 },
    members: registrations,
    payment_shares: [],
  };
}

test('Glow Golf $240 four-person team shows four $60 unpaid shares', () => {
  const quote = calculateTeamCart(fixture());
  assert.equal(quote.total, 24000);
  assert.equal(quote.remaining, 24000);
  assert.equal(quote.slots.length, 4);
  assert.deepEqual(quote.slots.map((s) => s.due), [6000, 6000, 6000, 6000]);
  assert.deepEqual(quote.slots.map((s) => s.status), ['Unpaid', 'Unpaid', 'Unpaid', 'Unpaid']);
  assert.equal(quote.slots[2].label, 'TBA · Reserved Spot');
});

test('confirmed captain-all payment covers every spot despite legacy pending teammates', () => {
  const group = fixture();
  group.members[0].payment_status = 'paid';
  group.members[0].amount_paid = 247.20;
  const quote = calculateTeamCart(group);
  assert.equal(quote.remaining, 0);
  assert.ok(quote.slots.every((slot) => slot.status === 'Paid'));
});

test('a Comp captain covers all team slots without collecting revenue', () => {
  const group = fixture();
  group.members[0].payment_status = 'comp';
  const quote = calculateTeamCart(group);
  assert.equal(quote.remaining, 0);
  assert.ok(quote.slots.every((slot) => slot.status === 'Comp'));
});

test('a paid share from the existing share table removes only that golfer from balance', () => {
  const group = fixture();
  group.payment_shares = [{
    registration_id: 'reese', slot_number: 2,
    amount_due: 60, amount_paid: 60, status: 'paid',
  }];
  const quote = calculateTeamCart(group);
  assert.equal(quote.remaining, 18000);
  assert.equal(quote.slots[1].status, 'Paid');
  assert.equal(quote.slots[1].remaining, 0);
  assert.equal(quote.slots[0].status, 'Unpaid');
});

test('partial payment shows remaining due without pretending golfer is paid in full', () => {
  const group = fixture();
  group.payment_shares = [{
    registration_id: 'reese', slot_number: 2,
    amount_due: 60, amount_paid: 30, status: 'pending',
  }];
  const quote = calculateTeamCart(group);
  assert.equal(quote.remaining, 21000);
  assert.equal(quote.slots[1].status, 'Partially paid');
  assert.equal(quote.slots[1].remaining, 3000);
});

test('refund reopens unpaid share and an inactive golfer is not cart selectable', () => {
  const group = fixture();
  group.members[0].payment_status = 'refunded';
  group.members[3].registration_status = 'cancelled';
  const quote = calculateTeamCart(group);
  assert.equal(quote.slots.length, 3);
  assert.equal(quote.slots[0].status, 'Unpaid');
  assert.equal(quote.slots[0].remaining, 6000);
});

test('cent remainder is assigned to slots, not lost', () => {
  const group = fixture();
  group.team.team_size = 3;
  group.members = group.members.slice(0, 3);
  group.members[0].price = 1;
  const quote = calculateTeamCart(group);
  assert.deepEqual(quote.slots.map((slot) => slot.due), [34, 33, 33]);
  assert.equal(quote.remaining, 100);
});

test('only current active teammates are counted', () => {
  const group = fixture();
  group.members.push({ ...group.members[1], id: 'withdrawn', registration_status: 'withdrawn' });
  const quote = calculateTeamCart(group);
  assert.equal(quote.slots.length, 4);
});

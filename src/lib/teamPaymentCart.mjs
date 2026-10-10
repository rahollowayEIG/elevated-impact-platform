const toCents = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
};
export const dollars = (amountInCents) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountInCents / 100);

const isTba = (member) =>
  member.custom_fields?.reserved_tba === true ||
  String(member.first_name || '').trim().toUpperCase() === 'TBA';

const golferLabel = (member) =>
  isTba(member) ? 'TBA · Reserved Spot' :
  [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Golfer';

/**
 * Read-only pilot projection. The existing captain-owned registration remains the
 * accounting record; zero-priced team spots receive an equal share for the cart.
 * When payment-share records exist, prefer their recorded due/paid amounts.
 * No prices, payments or statuses are written by this calculation.
 */
export function calculateTeamCart(group) {
  const team = group?.team;
  if (!team) return null;
  const members = (group.members || [])
    .filter((member) => member.registration_status === 'active')
    .slice()
    .sort((a, b) => {
      if (a.id === team.captain_registration_id) return -1;
      if (b.id === team.captain_registration_id) return 1;
      return String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
        String(a.id).localeCompare(String(b.id));
    });
  if (!members.length) return null;

  const captain = members.find((member) => member.id === team.captain_registration_id);
  const expectedSlots = Math.max(members.length, Number(team.team_size || members.length));
  const originalTeamTotal = members.reduce((sum, member) => sum + toCents(member.price), 0);
  const average = Math.floor(originalTeamTotal / expectedSlots);
  const remainder = originalTeamTotal - average * expectedSlots;
  const shares = group.payment_shares || [];
  const byRegistration = new Map(shares.filter((share) => share.registration_id)
    .map((share) => [share.registration_id, share]));
  const bySlot = new Map(shares.map((share) => [Number(share.slot_number), share]));

  // A paid/comp captain-all registration is already responsible for all four spots.
  // This prevents legacy zero-priced teammate "pending" values from causing charges.
  const legacyTeamCovered = team.payment_mode === 'captain_all' &&
    captain && ['paid', 'comp'].includes(captain.payment_status) && !captain.refunded_at;

  const slots = members.map((member, index) => {
    const share = byRegistration.get(member.id) || bySlot.get(index + 1);
    const fallbackDue = average + (index < remainder ? 1 : 0);
    const due = share && toCents(share.amount_due) > 0
      ? toCents(share.amount_due) : fallbackDue;
    const shareRefunded = share?.status === 'refunded';
    const compensated = !shareRefunded && (
      share?.status === 'waived' ||
      (legacyTeamCovered && captain.payment_status === 'comp') ||
      (!share && member.payment_status === 'comp' && !member.refunded_at)
    );
    const recordedPaid = shareRefunded ? 0
      : share ? toCents(share.amount_paid)
      : member.payment_status === 'paid' && !member.refunded_at ? due : 0;
    const paid = compensated ? 0 : legacyTeamCovered && captain.payment_status === 'paid'
      ? due : Math.min(due, recordedPaid);
    const covered = compensated ? due : paid;
    const remaining = Math.max(0, due - covered);
    return {
      id: member.id,
      label: golferLabel(member),
      captain: member.id === team.captain_registration_id,
      due, covered, remaining,
      status: compensated ? 'Comp' : remaining === 0 ? 'Paid' : covered > 0 ? 'Partially paid' : 'Unpaid',
    };
  });
  return {
    slots,
    total: slots.reduce((sum, slot) => sum + slot.due, 0),
    remaining: slots.reduce((sum, slot) => sum + slot.remaining, 0),
  };
}

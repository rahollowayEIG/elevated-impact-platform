import React from 'react';

const GLOW_GOLF_EVENT_ID = '5032048e-7d42-42aa-9dd3-5976734e87de';

const toCents = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
};
const dollars = (amountInCents) =>
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

export default function TeamPaymentCart({ group }) {
  const quote = React.useMemo(() => calculateTeamCart(group), [group]);
  const teamKey = group?.team?.id;
  const [captainPaysAll, setCaptainPaysAll] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState([]);

  React.useEffect(() => {
    setCaptainPaysAll(group?.team?.payment_mode === 'captain_all');
    setSelectedIds([]);
  }, [teamKey, group?.team?.payment_mode]);

  if (!quote || quote.total === 0) return null;
  const available = quote.slots.filter((slot) => slot.remaining > 0);
  const selected = available.filter((slot) => captainPaysAll || selectedIds.includes(slot.id));
  const subtotal = selected.reduce((sum, slot) => sum + slot.remaining, 0);

  function toggleGolfer(id, nextChecked) {
    const next = new Set(captainPaysAll ? available.map((slot) => slot.id) : selectedIds);
    if (nextChecked) next.add(id);
    else next.delete(id);
    setCaptainPaysAll(false);
    setSelectedIds([...next]);
  }

  return <section className="main-cabin-payment-cart" aria-label="Glow Golf team payment cart preview">
    <div className="main-cabin-cart-heading">
      <div>
        <span className="main-cabin-cart-kicker">GLOW GOLF · PAYMENT PILOT</span>
        <h3>Select Who You're Paying For</h3>
        <p>Checking a golfer adds their unpaid share to the cart. Nothing is charged in this preview.</p>
      </div>
      <strong className="main-cabin-cart-preview-tag">Preview only</strong>
    </div>

    <label className="main-cabin-cart-all">
      <input type="checkbox" checked={captainPaysAll && available.length > 0}
        disabled={available.length === 0}
        onChange={(event) => {
          setCaptainPaysAll(event.target.checked);
          setSelectedIds([]);
        }} />
      <span><strong>Captain Pays All</strong><small>Select every unpaid team spot</small></span>
    </label>

    <div className="main-cabin-cart-slots">
      {quote.slots.map((slot) => <label className={'main-cabin-cart-slot ' + (slot.remaining === 0 ? 'covered' : '')} key={slot.id}>
        <input type="checkbox"
          checked={slot.remaining > 0 && (captainPaysAll || selectedIds.includes(slot.id))}
          disabled={slot.remaining === 0}
          onChange={(event) => toggleGolfer(slot.id, event.target.checked)} />
        <span className="main-cabin-cart-golfer">
          <strong>{slot.label}</strong>
          <small>{slot.captain ? 'Captain · ' : ''}{slot.status}{slot.covered > 0 && slot.remaining > 0 ? ' · ' + dollars(slot.covered) + ' covered' : ''}</small>
        </span>
        <strong className="main-cabin-cart-share">{slot.remaining > 0 ? dollars(slot.remaining) : slot.status}</strong>
      </label>)}
    </div>

    <div className="main-cabin-cart-totals" aria-live="polite">
      <div><span>Team registration fee</span><strong>{dollars(quote.total)}</strong></div>
      <div><span>Current outstanding balance</span><strong>{dollars(quote.remaining)}</strong></div>
      <div className="main-cabin-cart-subtotal"><span>Shopping cart · {selected.length} selected</span><strong>{dollars(subtotal)}</strong></div>
      <div><span>Balance after a successful payment</span><strong>{dollars(Math.max(0, quote.remaining - subtotal))}</strong></div>
    </div>
    <p className="main-cabin-cart-footnote">
      This is a read-only Glow Golf test. The payment button remains disabled until
      we verify checkout allocation, refunds, and protection against double charges.
      Any online convenience fee will be shown at actual checkout.
    </p>
  </section>;
}

export { GLOW_GOLF_EVENT_ID };

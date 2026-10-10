import React from 'react';
import { calculateTeamCart, dollars } from './lib/teamPaymentCart.mjs';

const GLOW_GOLF_EVENT_ID = '5032048e-7d42-42aa-9dd3-5976734e87de';

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

export function cleanEstimate(input = {}) {
  const number = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n < 0 || n > 1000000)
      throw new Error(
        "Estimate amounts and quantities must be valid nonnegative numbers.",
      );
    return n;
  };
  const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const items = (Array.isArray(input.items) ? input.items : [])
    .slice(0, 100)
    .map((item, i) => {
      const quantity = number(item.quantity),
        unit_price = round(number(item.unit_price));
      return {
        id: "cost-" + i,
        name: String(item.name || "")
          .trim()
          .slice(0, 160),
        quantity,
        unit_price,
        total: round(quantity * unit_price),
      };
    });
  const subtotal = round(items.reduce((sum, item) => sum + item.total, 0)),
    tax = round(number(input.tax)),
    gratuity = round(number(input.gratuity)),
    other_fees = round(number(input.other_fees));
  return {
    version: 1,
    items,
    tax,
    gratuity,
    other_fees,
    fee_notes: String(input.fee_notes || "").slice(0, 1000),
    notes: String(input.notes || "").slice(0, 1500),
    subtotal,
    total: round(subtotal + tax + gratuity + other_fees),
  };
}
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function estimateText(input) {
  const e = cleanEstimate(input);
  return e.items
    .map(
      (i) =>
        `${i.name}: ${i.quantity} × $${i.unit_price.toFixed(2)} = $${i.total.toFixed(2)}`,
    )
    .concat([
      `Subtotal: $${e.subtotal.toFixed(2)}`,
      `Tax: $${e.tax.toFixed(2)}`,
      `Gratuity: $${e.gratuity.toFixed(2)}`,
      `Other fees: $${e.other_fees.toFixed(2)}`,
      `Total: $${e.total.toFixed(2)}`,
      e.fee_notes,
      e.notes,
    ])
    .filter(Boolean)
    .join("\n");
}
export function estimateHtml(input, name = "Event", approved = false) {
  const e = cleanEstimate(input);
  return `<!doctype html><html><head><meta charset="UTF-8"><title>${escape(name)} · Cost estimate</title><style>body{font:15px Arial;color:#14213b;max-width:850px;padding:35px;margin:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #ddd}.notes{white-space:pre-wrap}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save PDF</button><h1>${escape(name)}</h1><h2>${approved ? "Venue-approved quote" : "Estimate — subject to venue approval"}</h2><p>Prepared ${escape(new Date().toLocaleString())} · USD</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${e.items.map((i) => `<tr><td>${escape(i.name)}</td><td>${i.quantity}</td><td>$${i.unit_price.toFixed(2)}</td><td>$${i.total.toFixed(2)}</td></tr>`).join("")}</tbody></table><p>Subtotal: $${e.subtotal.toFixed(2)}<br>Tax: $${e.tax.toFixed(2)}<br>Gratuity: $${e.gratuity.toFixed(2)}<br>Other fees: $${e.other_fees.toFixed(2)}</p><h2>Total: $${e.total.toFixed(2)}</h2><p class="notes">${escape(e.fee_notes)}\n${escape(e.notes)}</p><p>Only the listed costs are included. Unpriced items, optional services and later changes need venue approval. The booking deposit is tracked separately.</p></body></html>`;
}

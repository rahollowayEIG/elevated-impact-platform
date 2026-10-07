import catalog from "./sponsorCatalog.json" with { type: "json" };
const text = (value, max = 500) => String(value ?? "").slice(0, max);
const id = (value, fallback) =>
  /^[a-zA-Z\d_-]{1,80}$/.test(value || "") ? value : fallback;
const num = (value) => Math.max(0, Math.min(1000000, Number(value) || 0));
const money = (value) => Math.round((num(value) + Number.EPSILON) * 100) / 100;
const https = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
};
export function newSponsorPlan() {
  return structuredClone({ ...catalog, sales: [] });
}
export function sanitizeSponsorPlan(value = {}) {
  return {
    items: (Array.isArray(value.items) ? value.items : [])
      .slice(0, 100)
      .map((r, i) => ({
        id: id(r.id, "item-" + i),
        category: text(r.category, 80),
        name: text(r.name, 160),
        description: text(r.description, 1000),
        available: r.available === "" ? "" : num(r.available),
        price: r.price === "" ? "" : money(r.price),
        offer_alone: r.offer_alone === true,
        notes: text(r.notes),
      })),
    packages: (Array.isArray(value.packages) ? value.packages : [])
      .slice(0, 50)
      .map((r, i) => ({
        id: id(r.id, "package-" + i),
        name: text(r.name, 160),
        price: r.price === "" ? "" : money(r.price),
        items: (Array.isArray(r.items) ? r.items : [])
          .slice(0, 100)
          .map((v) => id(v, "")),
        foursomes: num(r.foursomes),
        course_challenge: r.course_challenge === true,
        notes: text(r.notes),
      })),
    sales: (Array.isArray(value.sales) ? value.sales : [])
      .slice(0, 200)
      .map((r, i) => ({
        id: id(r.id, "sale-" + i),
        buyer: text(r.buyer, 160),
        contact: text(r.contact, 120),
        email: text(r.email, 200),
        phone: text(r.phone, 80),
        offer_kind: r.offer_kind === "package" ? "package" : "item",
        offer_id: id(r.offer_id, ""),
        offer_name: text(r.offer_name, 160),
        quantity: num(r.quantity),
        unit_price: money(r.unit_price),
        paid: r.paid === true,
        invoice_sent: r.invoice_sent === true,
        payment_method: text(r.payment_method, 80),
        reference: text(r.reference, 200),
        logo_url: https(r.logo_url),
        notes: text(r.notes, 1000),
        fulfillment: (Array.isArray(r.fulfillment) ? r.fulfillment : [])
          .slice(0, 100)
          .map((f, j) => ({
            id: id(f.id, "benefit-" + j),
            name: text(f.name, 160),
            location: text(f.location, 160),
            sign_type: text(f.sign_type, 100),
            size: text(f.size, 80),
            quantity: num(f.quantity || 1),
            due_date: /^\d{4}-\d{2}-\d{2}$/.test(f.due_date || "")
              ? f.due_date
              : "",
            logo_received: f.logo_received === true,
            artwork_approved: f.artwork_approved === true,
            sent_to_printer: f.sent_to_printer === true,
            produced: f.produced === true,
            completed: f.completed === true,
            wording: text(f.wording, 1000),
          })),
      })),
  };
}
export function sponsorTotals(raw) {
  const p = sanitizeSponsorPlan(raw);
  const sales = p.sales;
  return {
    planned: sales.reduce((sum, s) => sum + s.quantity * s.unit_price, 0),
    received: sales
      .filter((s) => s.paid)
      .reduce((sum, s) => sum + s.quantity * s.unit_price, 0),
    unpaid: sales.filter((s) => !s.paid).length,
    missing_logo: sales.filter((s) =>
      s.fulfillment.some((f) => !f.logo_received),
    ).length,
    unfinished: sales.reduce(
      (sum, s) => sum + s.fulfillment.filter((f) => !f.completed).length,
      0,
    ),
  };
}
export function sponsorInventoryUse(plan, itemId) {
  return plan.sales.reduce(
    (sum, s) =>
      sum +
      s.fulfillment
        .filter((f) => f.id === itemId)
        .reduce((n, f) => n + f.quantity * s.quantity, 0),
    0,
  );
}
export function signMakerCsv(raw) {
  const p = sanitizeSponsorPlan(raw);
  const rows = [
    [
      "Sponsor Name",
      "Package / Item",
      "Sign Type",
      "Size",
      "Qty",
      "Logo / Artwork Link",
      "Wording / Notes",
      "Due Date",
      "Artwork Approved?",
      "Sent to Sign Maker?",
      "Completed?",
      "Placement",
    ],
  ];
  for (const s of p.sales)
    for (const f of s.fulfillment)
      rows.push([
        s.buyer,
        s.offer_name,
        f.sign_type || f.name,
        f.size,
        f.quantity * s.quantity,
        s.logo_url,
        f.wording,
        f.due_date,
        f.artwork_approved ? "Yes" : "No",
        f.sent_to_printer ? "Yes" : "No",
        f.completed ? "Yes" : "No",
        f.location,
      ]);
  const cell = (value) => {
    let v = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return '"' + v.replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

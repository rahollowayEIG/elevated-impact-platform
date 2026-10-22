import React from "react";

const core = [
  {
    key: "contracts", title: "Contracts",
    detail: "Agreements, signatures and renewals from authorized contract workflows."
  },
  {
    key: "financials", title: "Financials",
    detail: "Invoices, payment status and receipts from the official financial records."
  },
  {
    key: "proofs", title: "Ad Proofs",
    detail: "Creative revisions, customer comments and approval history."
  },
  {
    key: "tracking", title: "Ad Tracking",
    detail: "Booked placements, delivery proof and measurable campaign results."
  }
];

// These modules are core Cockpit capabilities, not paid app activation toggles.
// Integration status is explicit until their domain record queries are connected.
export default function CoreCockpitServices({ organization }) {
  return <section className="platform-section-card" aria-label="Core business dashboard">
    <div className="platform-section-heading">
      <div><p className="platform-eyebrow">Every Hanger · Included</p><h2>Business Dashboard</h2>
        <p>Core relationship records are available to this Hanger without a paid app subscription. Each module will show only records belonging to {organization?.name || "this business"} once its source workflow is linked.</p>
      </div>
      <span className="platform-role-pill">CORE COCKPIT</span>
    </div>
    <div className="platform-product-grid">
      {core.map(item => <div key={item.key} className="platform-product-card">
        <div className="platform-product-topline"><span>Core</span><span className="platform-status-pill soon">Data connection pending</span></div>
        <h3>{item.title}</h3>
        <p>{item.detail}</p>
        <small>No records are linked to this dashboard section yet. This is not a report of zero activity.</small>
      </div>)}
    </div>
  </section>;
}

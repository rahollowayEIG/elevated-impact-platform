import React, { useState } from "react";
import { orderingHandoff, eventFlyerFacts } from "../lib/eventCreative.mjs";
import { downloadCreative } from "./FlyerEditor.jsx";

export default function EventMaterials({ value, onChange, event }) {
  const [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [ascending, setAscending] = useState(true);
  const facts = eventFlyerFacts(event, window.location.origin);
  const row = value.find((r) => r.id === selected);
  const update = (change) =>
    onChange(value.map((r) => (r.id === selected ? { ...r, ...change } : r)));
  return (
    <div>
      <h3>Invitations, signs & materials</h3>
      <p>
        Create the production request from the same saved event. InceptionApex
        owns artwork, EIC owns ordering, Signage owns signs, and Squawk Box
        carries proofs and approvals.
      </p>
      <div className="creative-toolbar">
        <label>
          Search materials
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={value.length >= 100}
          onClick={() => {
            const item = {
              id: crypto.randomUUID(),
              type: "Invitation",
              quantity: 1,
              size: "",
              wording: [
                facts.name,
                facts.date,
                facts.time,
                facts.venue,
                facts.registration,
                facts.contact,
              ]
                .filter(Boolean)
                .join("\n"),
              artwork_url: "",
              proof_approved: false,
              needed_by: "",
              department: "EIC",
              notes: "",
            };
            onChange([...value, item]);
            setSelected(item.id);
          }}
        >
          + Material request
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCreative(
              JSON.stringify(
                orderingHandoff(
                  event,
                  { materials: value },
                  window.location.origin,
                ),
                null,
                2,
              ),
              "EIC-Event-Materials-Request.json",
              "application/json",
            )
          }
        >
          Export EIC order request
        </button>
      </div>
      <div className="creative-editor-grid">
        <div>
          <button type="button" onClick={() => setAscending(!ascending)}>
            Material type {ascending ? "↑" : "↓"}
          </button>
          {value
            .filter((r) =>
              [r.type, r.department, r.wording]
                .join(" ")
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((r, index) => ({ r, index }))
            .sort(
              (a, b) =>
                a.r.type.localeCompare(b.r.type) * (ascending ? 1 : -1) ||
                a.index - b.index,
            )
            .map(({ r }) => r)
            .map((r) => (
              <button
                type="button"
                className="creative-material-row"
                key={r.id}
                onClick={() => setSelected(r.id)}
              >
                {r.type} · {r.quantity} · {r.size || "Size TBD"} ·{" "}
                {r.proof_approved ? "Proof approved" : "Proof pending"}
              </button>
            ))}
          {!value.length && <p>No materials requested yet.</p>}
        </div>
        <aside className="creative-inspector">
          {row ? (
            <>
              <label>
                Material type
                <select
                  value={row.type}
                  onChange={(e) => update({ type: e.target.value })}
                >
                  {[
                    "Invitation",
                    "Tee sign",
                    "Banner",
                    "Event program",
                    "Digital sign",
                    "Apparel / swag",
                    "Other",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={row.quantity}
                  onChange={(e) => update({ quantity: Number(e.target.value) })}
                />
              </label>
              <label>
                Size / specifications
                <input
                  value={row.size}
                  onChange={(e) => update({ size: e.target.value })}
                />
              </label>
              <label>
                Wording
                <textarea
                  aria-label="Wording"
                  value={row.wording}
                  onChange={(e) => update({ wording: e.target.value })}
                />
              </label>
              <label>
                Artwork / proof URL
                <input
                  type="url"
                  value={row.artwork_url}
                  onChange={(e) => update({ artwork_url: e.target.value })}
                />
              </label>
              <label>
                Needed by
                <input
                  type="date"
                  value={row.needed_by}
                  onChange={(e) => update({ needed_by: e.target.value })}
                />
              </label>
              <label>
                Next department
                <select
                  value={row.department}
                  onChange={(e) => update({ department: e.target.value })}
                >
                  {["InceptionApex", "Signage", "EIC", "Impactertising"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="builder-checkbox">
                <input
                  type="checkbox"
                  checked={row.proof_approved}
                  disabled={!row.artwork_url && !row.proof_approved}
                  onChange={(e) => update({ proof_approved: e.target.checked })}
                />
                Proof approved
              </label>
              <label>
                Production notes
                <textarea
                  value={row.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Remove this draft material request?")) {
                    onChange(value.filter((r) => r.id !== row.id));
                    setSelected("");
                  }
                }}
              >
                Remove draft request
              </button>
            </>
          ) : (
            <p>Select a material to complete its production request.</p>
          )}
        </aside>
      </div>
      <p>
        Order requests are saved planning handoffs. Live EIC checkout and vendor
        submission need the shared commerce connection; exporting does not place
        or pay for an order.
      </p>
    </div>
  );
}

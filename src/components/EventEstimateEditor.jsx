import React, { useEffect, useState } from "react";
import { cleanEstimate, estimateHtml } from "../lib/eventEstimate.mjs";
import { downloadCreative } from "./FlyerEditor.jsx";

export default function EventEstimateEditor({
  value,
  name,
  approved = false,
  locked = false,
  onSave,
  busy = false,
}) {
  const [form, setForm] = useState(() => value || cleanEstimate()),
    [error, setError] = useState("");
  useEffect(() => {
    setForm(value || cleanEstimate());
  }, [value]);
  let estimate;
  try {
    estimate = cleanEstimate(form);
  } catch {}
  const update = (key, v) => {
    setForm((current) => ({ ...current, [key]: v }));
    setError("");
  };
  function item(id, key, v) {
    update(
      "items",
      form.items.map((i, index) => (i.id === id ? { ...i, [key]: v } : i)),
    );
  }
  return (
    <div className="builder-action-box">
      <h3>Cost estimate</h3>
      <p>
        {locked
          ? "This quote is frozen with the agreement."
          : approved
            ? "Venue-approved pricing. Saving an edit creates a new estimate for review."
            : "Running estimate — subject to venue approval."}{" "}
        Tax, gratuity and other fees are explicit amounts; no unfinished
        contract policy is assumed.
      </p>
      <div className="creative-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cost item</th>
              <th>Quantity</th>
              <th>Unit price (USD)</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {form.items.map((i, index) => (
              <tr key={i.id}>
                <td>
                  <input
                    aria-label="Cost item name"
                    disabled={locked}
                    value={i.name}
                    onChange={(e) => item(i.id, "name", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label="Cost item quantity"
                    disabled={locked}
                    type="number"
                    min="0"
                    step=".01"
                    value={i.quantity}
                    onChange={(e) => item(i.id, "quantity", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label="Cost item unit price"
                    disabled={locked}
                    type="number"
                    min="0"
                    step=".01"
                    value={i.unit_price}
                    onChange={(e) => item(i.id, "unit_price", e.target.value)}
                  />
                </td>
                <td>${estimate?.items[index]?.total.toFixed(2) || "—"}</td>
                <td>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      update(
                        "items",
                        form.items.filter((v) => v.id !== i.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={locked || form.items.length >= 100}
        onClick={() =>
          update("items", [
            ...form.items,
            { id: crypto.randomUUID(), name: "", quantity: 1, unit_price: 0 },
          ])
        }
      >
        + Cost item
      </button>
      <div className="form-grid two">
        {[
          ["tax", "Tax amount"],
          ["gratuity", "Gratuity amount"],
          ["other_fees", "Other fees"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              disabled={locked}
              type="number"
              min="0"
              step=".01"
              value={form[key]}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        ))}
        <label>
          Fee basis / explanation
          <textarea
            disabled={locked}
            value={form.fee_notes}
            onChange={(e) => update("fee_notes", e.target.value)}
          />
        </label>
        <label>
          Unpriced items / assumptions
          <textarea
            disabled={locked}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </label>
      </div>
      <p>
        <strong>
          Estimated total:{" "}
          {estimate ? "$" + estimate.total.toFixed(2) : "Enter valid amounts"}
        </strong>
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="creative-toolbar">
        <button
          type="button"
          disabled={!estimate}
          onClick={() =>
            downloadCreative(
              estimateHtml(form, name, approved && locked),
              "Event-Cost-Estimate.html",
              "text/html",
            )
          }
        >
          View / download estimate
        </button>
        {onSave && (
          <>
            <button
              type="button"
              disabled={busy || locked || !estimate}
              onClick={() => onSave(estimate, false)}
            >
              Save estimate
            </button>
            <button
              type="button"
              disabled={
                busy ||
                locked ||
                !estimate?.items.length ||
                estimate.items.some((i) => !i.name)
              }
              onClick={() => {
                if (
                  window.confirm(
                    "Approve this itemized pricing for the agreement?",
                  )
                )
                  onSave(estimate, true);
              }}
            >
              Approve pricing for contract
            </button>
          </>
        )}
      </div>
    </div>
  );
}

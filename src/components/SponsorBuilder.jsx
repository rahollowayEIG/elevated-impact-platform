import React, { useState } from "react";
import {
  newSponsorPlan,
  sponsorInventoryUse,
  sponsorTotals,
  signMakerCsv,
} from "../lib/sponsorPlan.mjs";
import { downloadCreative } from "./FlyerEditor.jsx";

export default function SponsorBuilder({ value, onChange, onMapPin }) {
  const [tab, setTab] = useState("items"),
    [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("name"),
    [ascending, setAscending] = useState(true),
    [error, setError] = useState("");
  const plan = value || { items: [], packages: [], sales: [] },
    rows = plan[tab] || [],
    row = rows.find((r) => r.id === selected),
    totals = sponsorTotals(plan);
  const name = (r) => r.name || r.buyer || "Unnamed";
  const visible = rows
    .filter((r) =>
      [r.name, r.buyer, r.category, r.contact, r.offer_name]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .map((r, index) => ({ r, index }))
    .sort((a, b) => {
      const av =
          sort === "name"
            ? name(a.r)
            : Number(a.r.price ?? a.r.unit_price ?? 0),
        bv =
          sort === "name"
            ? name(b.r)
            : Number(b.r.price ?? b.r.unit_price ?? 0);
      return (
        (sort === "name"
          ? av.localeCompare(bv, undefined, { sensitivity: "base" })
          : av - bv) * (ascending ? 1 : -1) || a.index - b.index
      );
    });
  function update(change) {
    onChange({
      ...plan,
      [tab]: rows.map((r) => (r.id === selected ? { ...r, ...change } : r)),
    });
    setError("");
  }
  function add() {
    const id = crypto.randomUUID(),
      r =
        tab === "items"
          ? {
              id,
              name: "New sponsorship item",
              category: "Custom",
              description: "",
              available: "",
              price: "",
              offer_alone: true,
              notes: "",
            }
          : tab === "packages"
            ? {
                id,
                name: "New sponsor package",
                price: "",
                items: [],
                foursomes: 0,
                course_challenge: false,
                notes: "",
              }
            : {
                id,
                buyer: "New sponsor",
                contact: "",
                email: "",
                phone: "",
                offer_kind: "item",
                offer_id: "",
                offer_name: "",
                quantity: 1,
                unit_price: 0,
                paid: false,
                invoice_sent: false,
                payment_method: "",
                reference: "",
                logo_url: "",
                notes: "",
                fulfillment: [],
              };
    onChange({ ...plan, [tab]: [...rows, r] });
    setSelected(id);
  }
  function offer(kind, offerId) {
    const offer = plan[kind === "package" ? "packages" : "items"].find(
      (r) => r.id === offerId,
    );
    if (!offer) return;
    const members =
      kind === "package"
        ? plan.items.filter((i) => offer.items.includes(i.id))
        : [offer];
    if (offer.price === "") {
      setError("Set the offer price before assigning it.");
      return;
    }
    const benefits = members.map((i) => ({
      id: i.id,
      name: i.name,
      location: "",
      sign_type: i.name,
      size: "",
      quantity: 1,
      due_date: "",
      logo_received: false,
      artwork_approved: false,
      sent_to_printer: false,
      produced: false,
      completed: false,
      wording: "",
    }));
    const candidate = {
      ...plan,
      sales: plan.sales.map((s) =>
        s.id === selected
          ? {
              ...s,
              quantity: 1,
              offer_kind: kind,
              offer_id: offer.id,
              offer_name: offer.name,
              unit_price: Number(offer.price),
              fulfillment: benefits,
            }
          : s,
      ),
    };
    if (
      plan.items.some(
        (i) =>
          i.available !== "" &&
          sponsorInventoryUse(candidate, i.id) > Number(i.available),
      )
    ) {
      setError("This offer exceeds available sponsorship inventory.");
      return;
    }
    onChange(candidate);
    setError("");
  }
  function benefit(index, change) {
    update({
      fulfillment: row.fulfillment.map((f, i) =>
        i === index ? { ...f, ...change } : f,
      ),
    });
  }
  return (
    <div>
      <h3>Sponsor builder</h3>
      <p>
        Build inventory and packages, track sponsor sales, then fulfill the
        promised signage and placement. Workbook sample prices and sales are
        excluded from starter templates.
      </p>
      <div className="builder-status-grid">
        <div>
          <span>Planned sponsorship revenue</span>
          <strong>${totals.planned.toFixed(2)}</strong>
        </div>
        <div>
          <span>Manually recorded received</span>
          <strong>${totals.received.toFixed(2)}</strong>
        </div>
        <div>
          <span>Open fulfillment items</span>
          <strong>{totals.unfinished}</strong>
        </div>
      </div>
      <nav className="creative-tabs" aria-label="Sponsorship sections">
        {[
          ["items", "Sponsorship items"],
          ["packages", "Package builder"],
          ["sales", "Sales & fulfillment"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setSelected("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="creative-toolbar">
        <label>
          Search sponsor builder
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={
            rows.length >=
            (tab === "items" ? 100 : tab === "packages" ? 50 : 200)
          }
          onClick={add}
        >
          + Add{" "}
          {tab === "items"
            ? "item"
            : tab === "packages"
              ? "package"
              : "sponsor sale"}
        </button>
        {!plan.items.length && (
          <button
            type="button"
            onClick={() => {
              const starter = newSponsorPlan();
              onChange({
                ...plan,
                items: starter.items,
                packages: [...plan.packages, ...starter.packages].slice(0, 50),
              });
            }}
          >
            Load workbook starter catalog
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            downloadCreative(
              signMakerCsv(plan),
              "Sign-Maker-Export.csv",
              "text/csv",
            )
          }
        >
          Download sign maker CSV
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="creative-editor-grid">
        <div className="creative-table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  ["name", "Name"],
                  ["price", "Price"],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    aria-sort={
                      sort === key
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (sort === key) setAscending(!ascending);
                        else {
                          setSort(key);
                          setAscending(true);
                        }
                      }}
                    >
                      {label}
                      {sort === key ? (ascending ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ r }) => (
                <tr
                  key={r.id}
                  className={selected === r.id ? "creative-selected-row" : ""}
                >
                  <td>
                    {name(r)}
                    <br />
                    {r.category || r.offer_name}
                  </td>
                  <td>
                    {(r.price ?? r.unit_price) === ""
                      ? "Unpriced"
                      : "$" + Number(r.price ?? r.unit_price ?? 0).toFixed(2)}
                  </td>
                  <td>
                    <button type="button" onClick={() => setSelected(r.id)}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <p>{rows.length ? "No matches." : "No records yet."}</p>
          )}
        </div>
        <aside className="creative-inspector">
          {row ? (
            <>
              <h4>{name(row)}</h4>
              {tab !== "sales" ? (
                <>
                  <label>
                    Name
                    <input
                      value={row.name}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    Price (USD)
                    <input
                      type="number"
                      min="0"
                      step=".01"
                      value={row.price}
                      onChange={(e) => update({ price: e.target.value })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Sponsor / customer
                    <input
                      value={row.buyer}
                      onChange={(e) => update({ buyer: e.target.value })}
                    />
                  </label>
                  <label>
                    Offer
                    <select
                      disabled={
                        row.paid || row.fulfillment.some((f) => f.completed)
                      }
                      value={row.offer_kind + ":" + row.offer_id}
                      onChange={(e) => {
                        const [k, id] = e.target.value.split(":");
                        offer(k, id);
                      }}
                    >
                      <option value="item:">Choose item or package</option>
                      {plan.items
                        .filter((i) => i.offer_alone)
                        .map((i) => (
                          <option key={i.id} value={"item:" + i.id}>
                            {i.name}
                          </option>
                        ))}
                      {plan.packages.map((i) => (
                        <option key={i.id} value={"package:" + i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      min="1"
                      disabled={
                        row.paid || row.fulfillment.some((f) => f.completed)
                      }
                      value={row.quantity}
                      onChange={(e) => {
                        const quantity = Number(e.target.value);
                        const candidate = {
                          ...plan,
                          sales: plan.sales.map((s) =>
                            s.id === row.id ? { ...s, quantity } : s,
                          ),
                        };
                        if (
                          quantity < 1 ||
                          plan.items.some(
                            (i) =>
                              i.available !== "" &&
                              sponsorInventoryUse(candidate, i.id) >
                                Number(i.available),
                          )
                        ) {
                          setError("Quantity exceeds available inventory.");
                          return;
                        }
                        onChange(candidate);
                        setError("");
                      }}
                    />
                  </label>
                  <p>
                    Sale value: ${(row.quantity * row.unit_price).toFixed(2)}
                  </p>
                  {[
                    ["contact", "Contact"],
                    ["email", "Email"],
                    ["phone", "Phone"],
                    ["logo_url", "Logo / artwork URL"],
                    ["payment_method", "Payment method"],
                    ["reference", "Receipt / reference"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        value={row[key]}
                        onChange={(e) => update({ [key]: e.target.value })}
                      />
                    </label>
                  ))}
                  <label className="builder-checkbox">
                    <input
                      type="checkbox"
                      checked={row.invoice_sent}
                      onChange={(e) =>
                        update({ invoice_sent: e.target.checked })
                      }
                    />
                    Invoice sent
                  </label>
                  <label className="builder-checkbox">
                    <input
                      type="checkbox"
                      checked={row.paid}
                      disabled={!row.reference?.trim() && !row.paid}
                      onChange={(e) => update({ paid: e.target.checked })}
                    />
                    Payment received (manual record)
                  </label>
                  <h4>Fulfillment</h4>
                  {row.fulfillment.map((f, index) => (
                    <div className="builder-action-box" key={f.id}>
                      <strong>{f.name}</strong>
                      {[
                        ["location", "Hole / placement"],
                        ["sign_type", "Sign / asset type"],
                        ["size", "Size"],
                        ["wording", "Wording / instructions"],
                      ].map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            value={f[key]}
                            onChange={(e) =>
                              benefit(index, { [key]: e.target.value })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        Due date
                        <input
                          type="date"
                          value={f.due_date}
                          onChange={(e) =>
                            benefit(index, { due_date: e.target.value })
                          }
                        />
                      </label>
                      {[
                        ["logo_received", "Logo received"],
                        ["artwork_approved", "Artwork approved"],
                        ["sent_to_printer", "Sent to printer"],
                        ["produced", "Sign / asset produced"],
                        ["completed", "Completed"],
                      ].map(([key, label]) => (
                        <label className="builder-checkbox" key={key}>
                          <input
                            type="checkbox"
                            checked={f[key]}
                            onChange={(e) =>
                              benefit(index, { [key]: e.target.checked })
                            }
                          />
                          {label}
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          onMapPin({
                            id: crypto.randomUUID(),
                            type: "Sponsor",
                            label: row.buyer + " · " + f.name,
                            hole: f.location,
                            notes: f.wording,
                            x: 50,
                            y: 50,
                          })
                        }
                      >
                        Place sponsor on course map
                      </button>
                    </div>
                  ))}
                </>
              )}
              {tab === "items" && (
                <>
                  <label>
                    Category
                    <input
                      value={row.category}
                      onChange={(e) => update({ category: e.target.value })}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={row.description}
                      onChange={(e) => update({ description: e.target.value })}
                    />
                  </label>
                  <label>
                    Quantity available
                    <input
                      type="number"
                      min="0"
                      value={row.available}
                      onChange={(e) => update({ available: e.target.value })}
                    />
                  </label>
                  <p>Allocated: {sponsorInventoryUse(plan, row.id)}</p>
                  <label className="builder-checkbox">
                    <input
                      type="checkbox"
                      checked={row.offer_alone}
                      onChange={(e) =>
                        update({ offer_alone: e.target.checked })
                      }
                    />
                    Offer alone
                  </label>
                </>
              )}
              {tab === "packages" && (
                <>
                  <label>
                    Included sponsorship items
                    <select
                      multiple
                      value={row.items}
                      onChange={(e) =>
                        update({
                          items: Array.from(
                            e.target.selectedOptions,
                            (o) => o.value,
                          ),
                        })
                      }
                    >
                      {plan.items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Foursomes included
                    <input
                      type="number"
                      min="0"
                      value={row.foursomes}
                      onChange={(e) =>
                        update({ foursomes: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="builder-checkbox">
                    <input
                      type="checkbox"
                      checked={row.course_challenge}
                      onChange={(e) =>
                        update({ course_challenge: e.target.checked })
                      }
                    />
                    Course challenge package included
                  </label>
                  <p>
                    Package benefits are copied into each sale for fulfillment;
                    later package edits do not rewrite sold promises.
                  </p>
                </>
              )}
              <label>
                Notes
                <textarea
                  value={row.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (
                    tab !== "sales" &&
                    plan.sales.some(
                      (s) =>
                        s.offer_id === row.id ||
                        s.fulfillment.some((f) => f.id === row.id),
                    )
                  ) {
                    setError(
                      "This item is used by sponsor sales. Keep it for fulfillment history.",
                    );
                    return;
                  }
                  if (window.confirm("Remove this planning record?")) {
                    onChange({
                      ...plan,
                      [tab]: rows.filter((r) => r.id !== row.id),
                    });
                    setSelected("");
                  }
                }}
              >
                Remove planning record
              </button>
            </>
          ) : (
            <p>Select a record to manage it.</p>
          )}
        </aside>
      </div>
      <p>
        Sponsor payment records and budget totals are independent of the venue
        deposit and participant registration payments. Exporting a print list
        sends no messages to a printer.
      </p>
    </div>
  );
}

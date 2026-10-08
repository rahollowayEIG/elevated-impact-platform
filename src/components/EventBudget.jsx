import React, { useEffect, useRef, useState } from "react";
import { eventBudgetStore } from "../lib/eventBudgetStore";
import {
  COST_CATEGORIES,
  INCOME_CATEGORIES,
  MAX_BUDGET_ROWS,
  budgetCsv,
  budgetProblem,
  budgetStarter,
  budgetTotals,
  centsInput,
  dollars,
  moneyInput,
  newBudget,
  newBudgetLine,
  visibleBudgetRows,
} from "../lib/eventBudget.mjs";
import "./event-budget.css";
const settingsFor = (b) => ({
  goal: moneyInput(b.goal_cents),
  reserve: String(b.contingency_percent),
  package: moneyInput(b.sponsor_package_cents),
  registration: moneyInput(b.live_targets.registration),
  sponsors: moneyInput(b.live_targets.sponsors),
});
const lineFor = (row, kind) => ({
  ...row,
  ...(kind === "costs"
    ? {
        quantity: String(row.quantity),
        unit_cents: moneyInput(row.unit_cents),
        actual_cents: moneyInput(row.actual_cents),
        paid_cents: moneyInput(row.paid_cents),
      }
    : {
        target_cents: moneyInput(row.target_cents),
        committed_cents: moneyInput(row.committed_cents),
        received_cents: moneyInput(row.received_cents),
      }),
});
export default function EventBudget({
  event,
  onDirtyChange,
  onOpenSponsors,
  onOpenRoster,
}) {
  const [budget, setBudget] = useState(null),
    [version, setVersion] = useState(0),
    [sources, setSources] = useState(null),
    [history, setHistory] = useState([]),
    [historyCount, setHistoryCount] = useState(0);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [sourceError, setSourceError] = useState("");
  const [tab, setTab] = useState("costs"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState(null),
    [editing, setEditing] = useState(null),
    [settings, setSettings] = useState(null);
  const panel = useRef(null),
    mounted = useRef(true),
    refreshPending = useRef(false);
  const unsaved = dirty || !!editing || !!settings;
  useEffect(() => {
    onDirtyChange?.(unsaved);
    return () => onDirtyChange?.(false);
  }, [unsaved, onDirtyChange]);
  useEffect(() => {
    const handler = (e) => {
      if (unsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsaved]);
  useEffect(() => {
    if (editing || settings) {
      panel.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      panel.current?.querySelector("input")?.focus({ preventScroll: true });
    }
  }, [editing?.id, !!settings]);
  function receive(result, replace) {
    setSources((previous) =>
      !previous ||
      new Date(result.sources.refreshed_at) >= new Date(previous.refreshed_at)
        ? result.sources
        : previous,
    );
    setHistory(result.history || []);
    setHistoryCount(result.history_count || 0);
    setSourceError("");
    if (replace) {
      setBudget(result.budget?.data || newBudget());
      setVersion(result.budget?.version || 0);
      setDirty(false);
      setEditing(null);
      setSettings(null);
    }
  }
  async function load(replace = false) {
    if (refreshPending.current && !replace) return;
    refreshPending.current = true;
    try {
      const result = await eventBudgetStore.load(event.id);
      if (mounted.current) receive(result, replace);
    } catch (e) {
      if (mounted.current)
        replace
          ? setError(e.message || "Unable to open budget.")
          : setSourceError(
              "System refresh failed. Totals below are from the last successful refresh.",
            );
    } finally {
      refreshPending.current = false;
      if (mounted.current && replace) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    load(true);
    const timer = setInterval(() => load(), 30000);
    const focus = () => load();
    window.addEventListener("focus", focus);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [event.id]);
  const change = (next) => {
    setBudget(next);
    setDirty(true);
    setError("");
    setNotice("");
  };
  async function save() {
    if (editing || settings || busy || !budget) return false;
    const issue = budgetProblem(budget);
    if (issue) {
      setError(issue);
      return false;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await eventBudgetStore.save(event.id, version, budget);
      if (!mounted.current) return false;
      receive(result, true);
      setNotice(`Budget saved. Version ${result.budget.version}.`);
      return true;
    } catch (e) {
      if (mounted.current)
        setError(e.message || "Unable to save. Your draft is still here.");
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function exportCsv() {
    try {
      const csv = budgetCsv(budget, event.name, dirty ? 0 : version, sources);
      const url = URL.createObjectURL(
        new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "EIE-Event-Budget.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    }
  }
  function cancelPanel() {
    setEditing(null);
    setSettings(null);
    setError("");
  }
  function applyLine(e) {
    e.preventDefault();
    const row = { ...editing };
    if (tab === "costs") {
      row.quantity = /^\d+$/.test(row.quantity) ? Number(row.quantity) : null;
      for (const key of ["unit_cents", "actual_cents", "paid_cents"])
        row[key] =
          key === "actual_cents" && row[key] === ""
            ? null
            : centsInput(row[key]);
    } else
      for (const key of ["target_cents", "committed_cents", "received_cents"])
        row[key] = centsInput(row[key]);
    const found = budget[tab].some((r) => r.id === row.id);
    const next = {
      ...budget,
      [tab]: found
        ? budget[tab].map((r) => (r.id === row.id ? row : r))
        : [...budget[tab], row],
    };
    const issue = budgetProblem(next);
    if (issue) {
      setError(issue);
      return;
    }
    change(next);
    setEditing(null);
  }
  function applySettings(e) {
    e.preventDefault();
    const next = {
      ...budget,
      goal_cents: centsInput(settings.goal),
      sponsor_package_cents: centsInput(settings.package),
      contingency_percent: /^\d+$/.test(settings.reserve)
        ? Number(settings.reserve)
        : null,
      live_targets: {
        registration: centsInput(settings.registration),
        sponsors: centsInput(settings.sponsors),
      },
    };
    const issue = budgetProblem(next);
    if (issue) {
      setError(issue);
      return;
    }
    change(next);
    setSettings(null);
  }
  function switchTab(next) {
    if (
      (editing || settings) &&
      !window.confirm("Discard the open item or settings changes?")
    )
      return;
    cancelPanel();
    setTab(next);
    setCategory("");
    setSearch("");
    setSort(null);
  }
  function toggleSort(key) {
    setSort((s) => ({
      key,
      direction: s?.key === key && s.direction === "asc" ? "desc" : "asc",
    }));
  }
  function heading(key, label) {
    return (
      <th
        aria-sort={
          sort?.key === key
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        <button type="button" onClick={() => toggleSort(key)}>
          {label}{" "}
          {sort?.key === key ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </button>
      </th>
    );
  }
  const moneyField = (key, label, optional = false) => (
    <label>
      {label}
      <input
        inputMode="decimal"
        required={!optional}
        value={editing[key]}
        onChange={(e) => setEditing((r) => ({ ...r, [key]: e.target.value }))}
        placeholder={optional ? "Not yet known" : "0.00"}
      />
    </label>
  );
  if (loading)
    return (
      <section className="platform-section-card" aria-live="polite">
        Loading event budget and system totals…
      </section>
    );
  if (!budget)
    return (
      <section className="platform-section-card">
        <h2>Event budget</h2>
        <p role="alert">{error}</p>
        <button
          type="button"
          className="platform-secondary-button"
          onClick={() => {
            setLoading(true);
            load(true);
          }}
        >
          Try again
        </button>
      </section>
    );
  const totals = budgetTotals(budget, sources),
    rows = visibleBudgetRows(budget[tab], search, category, sort);
  return (
    <section className="event-budget" aria-label="EIE event budget">
      <div className="platform-section-card budget-toolbar">
        <div>
          <p className="platform-eyebrow">EIE · Live event budget</p>
          <h2>Plan the event. Know the numbers.</h2>
          <p>
            System income updates automatically. Add outside amounts in the
            manual ledger.
          </p>
          <span>
            {unsaved
              ? "Unsaved changes"
              : version
                ? `Saved · Version ${version}`
                : "No saved budget yet"}{" "}
            · USD
          </span>
        </div>
        <div className="review-actions">
          <button
            className="platform-secondary-button"
            disabled={busy || !!editing || !!settings}
            onClick={exportCsv}
          >
            Export budget CSV
          </button>
          <button
            className="platform-primary-button"
            disabled={
              busy || !!editing || !!settings || (!dirty && version > 0)
            }
            onClick={save}
          >
            {busy ? "Saving…" : "Save budget"}
          </button>
        </div>
      </div>
      {error && (
        <div className="platform-error banner" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="platform-success" role="status">
          {notice}
        </div>
      )}
      <fieldset disabled={busy} className="budget-fieldset">
        <div className="platform-stats-grid budget-stats">
          {[
            [
              "Cost forecast",
              totals.forecast + totals.contingency,
              `${dollars(totals.contingency)} contingency reserve`,
            ],
            [
              "Projected income",
              totals.projectedIncome,
              "Targets and committed amounts",
            ],
            [
              "Projected net",
              totals.projectedNet,
              `Goal: ${dollars(budget.goal_cents)}`,
            ],
            ["Cash remaining", totals.cash, "Received minus costs paid"],
          ].map(([label, value, hint]) => (
            <div className="platform-stat-card" key={label}>
              <span>{label}</span>
              <strong>{dollars(value)}</strong>
              <small>{hint}</small>
            </div>
          ))}
        </div>
        <div className="budget-overview">
          <section className="platform-section-card budget-funding">
            <p className="platform-eyebrow">Cover costs & reach your goal</p>
            <h3>{dollars(totals.gap)} more committed funding needed</h3>
            <p>
              Costs forecast + contingency + event goal, less committed income.
              Received money is already included in commitments.
            </p>
            <div
              className="budget-meter"
              role="progressbar"
              aria-label="Committed funding coverage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                totals.needed
                  ? Math.min(
                      100,
                      Math.round((totals.committed / totals.needed) * 100),
                    )
                  : 0
              }
            >
              <i
                style={{
                  width: `${totals.needed ? Math.min(100, (totals.committed / totals.needed) * 100) : 0}%`,
                }}
              />
            </div>
            <p>
              {totals.sponsorCount === null
                ? "Set a sponsor package value to estimate how many sponsors would cover this gap."
                : `${totals.sponsorCount} additional sponsor${totals.sponsorCount === 1 ? "" : "s"} at ${dollars(budget.sponsor_package_cents)} would cover this gap.`}{" "}
              This is a planning target.
            </p>
            {onOpenSponsors && (
              <button
                type="button"
                className="platform-secondary-button"
                disabled={!!editing || !!settings}
                onClick={async () => {
                  if (!dirty || (await save())) onOpenSponsors();
                }}
              >
                Help me find sponsors
              </button>
            )}
          </section>
          <section className="platform-section-card">
            <div className="platform-section-heading">
              <h3>Event goals & planning</h3>
              <button
                className="platform-secondary-button"
                disabled={!!editing || !!settings}
                onClick={() => setSettings(settingsFor(budget))}
              >
                Edit planning settings
              </button>
            </div>
            <dl className="budget-facts">
              <div>
                <dt>Committed income</dt>
                <dd>{dollars(totals.committed)}</dd>
              </div>
              <div>
                <dt>Income received</dt>
                <dd>{dollars(totals.received)}</dd>
              </div>
              <div>
                <dt>Still to collect</dt>
                <dd>{dollars(totals.outstandingIncome)}</dd>
              </div>
              <div>
                <dt>Actual costs entered</dt>
                <dd>{dollars(totals.actual)}</dd>
              </div>
              <div>
                <dt>Actual costs unpaid</dt>
                <dd>{dollars(totals.unpaidCosts)}</dd>
              </div>
            </dl>
            <p className="budget-muted">
              {totals.missingActuals} cost item
              {totals.missingActuals === 1 ? "" : "s"} still use estimates. A
              blank actual amount uses its estimate; an actual $0 replaces it.
            </p>
          </section>
        </div>
        {(editing || settings) && (
          <section
            ref={panel}
            className="budget-working-panel"
            aria-label={
              editing ? "Manage budget item" : "Manage planning settings"
            }
          >
            {editing ? (
              <form onSubmit={applyLine}>
                <h3>
                  {budget[tab].some((r) => r.id === editing.id)
                    ? "Edit"
                    : "Add"}{" "}
                  manual {tab === "costs" ? "cost" : "income"}
                </h3>
                <p className="budget-muted">
                  Add only amounts outside the connected sources. Change system
                  amounts in their original tool.
                </p>
                <div className="form-grid two">
                  <label>
                    Item name
                    <input
                      required
                      maxLength={160}
                      value={editing.name}
                      onChange={(e) =>
                        setEditing((r) => ({ ...r, name: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Category
                    <select
                      aria-label="Category"
                      value={editing.category}
                      onChange={(e) =>
                        setEditing((r) => ({ ...r, category: e.target.value }))
                      }
                    >
                      {(tab === "costs"
                        ? COST_CATEGORIES
                        : INCOME_CATEGORIES
                      ).map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Vendor / income source
                    <input
                      maxLength={160}
                      value={editing.vendor}
                      onChange={(e) =>
                        setEditing((r) => ({ ...r, vendor: e.target.value }))
                      }
                    />
                  </label>
                  {tab === "costs" ? (
                    <>
                      <label>
                        Quantity
                        <input
                          inputMode="numeric"
                          required
                          value={editing.quantity}
                          onChange={(e) =>
                            setEditing((r) => ({
                              ...r,
                              quantity: e.target.value,
                            }))
                          }
                        />
                      </label>
                      {moneyField("unit_cents", "Unit estimate (USD)")}
                      {moneyField("actual_cents", "Actual total (USD)", true)}
                      {moneyField("paid_cents", "Paid total (USD)")}
                    </>
                  ) : (
                    <>
                      {moneyField("target_cents", "Target (USD)")}
                      {moneyField("committed_cents", "Committed total (USD)")}
                      {moneyField("received_cents", "Received (USD)")}
                    </>
                  )}
                  <label>
                    Item notes
                    <textarea
                      maxLength={1000}
                      value={editing.notes}
                      onChange={(e) =>
                        setEditing((r) => ({ ...r, notes: e.target.value }))
                      }
                    />
                  </label>
                </div>
                <p className="budget-muted">
                  {tab === "costs"
                    ? "Actual is the full known cost, including any tax and fees. Paid is the portion already paid."
                    : "Committed is the full confirmed amount, including money already received. Targets are not cash."}
                </p>
                <div className="review-actions">
                  <button className="platform-primary-button">
                    Apply item
                  </button>
                  <button
                    type="button"
                    className="platform-secondary-button"
                    onClick={cancelPanel}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={applySettings}>
                <h3>Planning settings</h3>
                <div className="form-grid two">
                  {[
                    ["goal", "Event net / fundraising goal (USD)"],
                    ["reserve", "Contingency reserve (%)"],
                    ["package", "Suggested sponsor package value (USD)"],
                    ["registration", "EIE registration income target (USD)"],
                    ["sponsors", "Sponsor Builder income target (USD)"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        required
                        inputMode={key === "reserve" ? "numeric" : "decimal"}
                        value={settings[key]}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, [key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="budget-muted">
                  Connected income targets are goals, not additional receipts.
                  The contingency reserve is a percentage of estimated costs and
                  remains separate from actual spending.
                </p>
                <div className="review-actions">
                  <button className="platform-primary-button">
                    Apply settings
                  </button>
                  <button
                    type="button"
                    className="platform-secondary-button"
                    onClick={cancelPanel}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}
        <section className="platform-section-card">
          <div className="platform-section-heading">
            <div>
              <p className="platform-eyebrow">Automatically connected</p>
              <h3>Income from EIE</h3>
              <p>
                {sources
                  ? `Last refresh: ${new Date(sources.refreshed_at).toLocaleString()} · refreshes every 30 seconds`
                  : "System totals unavailable"}
              </p>
            </div>
            <button
              className="platform-secondary-button"
              onClick={() => load()}
            >
              Refresh system totals
            </button>
          </div>
          {sourceError && (
            <p className="platform-error banner" role="alert">
              {sourceError}
            </p>
          )}
          <div className="budget-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Target</th>
                  <th>Committed total</th>
                  <th>Received</th>
                  <th>Open source</th>
                </tr>
              </thead>
              <tbody>
                {(sources?.income || []).map((r) => (
                  <tr key={r.source_key}>
                    <td>
                      <strong>{r.name}</strong>
                      <small>{r.vendor}</small>
                    </td>
                    <td>
                      {dollars(
                        Math.max(
                          r.target_cents,
                          budget.live_targets[r.source_key],
                        ),
                      )}
                    </td>
                    <td>{dollars(r.committed_cents)}</td>
                    <td>{dollars(r.received_cents)}</td>
                    <td>
                      <button
                        className="platform-secondary-button"
                        disabled={!!editing || !!settings}
                        onClick={async () => {
                          if (!dirty || (await save()))
                            (r.source_key === "registration"
                              ? onOpenRoster
                              : onOpenSponsors)?.();
                        }}
                      >
                        {r.source_key === "registration"
                          ? "Roster"
                          : "Sponsors"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="budget-muted">
            Registration totals count each roster entry once, exclude
            convenience fees, comps, and full refunds, and retain unrefunded
            payments for withdrawn players. Sponsor Builder sales remain targets
            until marked paid.{" "}
            {sources?.status_only_paid_count > 0 &&
              `${sources.status_only_paid_count} paid registration(s) use the recorded price because no paid amount is stored.`}
          </p>
          <p className="budget-muted">
            Partial refunds, provider processing fees, outside purchases, and
            other apps are not connected yet. Enter these as separate manual
            costs or income. These figures reflect EIE records and are not a
            bank balance.
          </p>
        </section>
        <section className="platform-section-card">
          <div className="platform-section-heading">
            <div>
              <p className="platform-eyebrow">Outside the connected system</p>
              <h3>Manual budget ledger</h3>
            </div>
            <button
              className="platform-primary-button"
              disabled={
                !!editing || !!settings || budget[tab].length >= MAX_BUDGET_ROWS
              }
              onClick={() => {
                setEditing(lineFor(newBudgetLine(tab), tab));
                setError("");
              }}
            >
              Add manual {tab === "costs" ? "cost" : "income"}
            </button>
          </div>
          <div
            className="budget-tabs"
            role="tablist"
            aria-label="Manual budget ledger"
          >
            <button
              role="tab"
              aria-selected={tab === "costs"}
              onClick={() => switchTab("costs")}
            >
              Costs ({budget.costs.length})
            </button>
            <button
              role="tab"
              aria-selected={tab === "income"}
              onClick={() => switchTab("income")}
            >
              Income ({budget.income.length})
            </button>
          </div>
          <div className="form-grid two budget-controls">
            <label>
              Search manual items
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Item, vendor, category or notes"
              />
            </label>
            <label>
              Filter category
              <select
                aria-label="Filter category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {(tab === "costs" ? COST_CATEGORIES : INCOME_CATEGORIES).map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <p>
            {rows.length} matching item{rows.length === 1 ? "" : "s"} · totals
            include all items
          </p>
          <div className="budget-table-wrap">
            <table>
              <thead>
                <tr>
                  {heading("name", "Item")}
                  {heading("category", "Category")}
                  {heading("vendor", "Vendor / source")}
                  {heading(
                    tab === "costs" ? "planned" : "target_cents",
                    tab === "costs" ? "Planned" : "Target",
                  )}
                  {heading(
                    tab === "costs" ? "actual_cents" : "committed_cents",
                    tab === "costs" ? "Actual" : "Committed total",
                  )}
                  {heading(
                    tab === "costs" ? "paid_cents" : "received_cents",
                    tab === "costs" ? "Paid" : "Received",
                  )}
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={editing?.id === r.id ? "budget-selected" : ""}
                  >
                    <td>
                      <strong>{r.name}</strong>
                      {r.notes && <small>{r.notes}</small>}
                    </td>
                    <td>{r.category}</td>
                    <td>{r.vendor || "—"}</td>
                    <td>
                      {dollars(
                        tab === "costs"
                          ? r.quantity * r.unit_cents
                          : r.target_cents,
                      )}
                    </td>
                    <td>
                      {tab === "costs" && r.actual_cents === null
                        ? "Not yet known"
                        : dollars(
                            tab === "costs"
                              ? r.actual_cents
                              : r.committed_cents,
                          )}
                    </td>
                    <td>
                      {dollars(
                        tab === "costs" ? r.paid_cents : r.received_cents,
                      )}
                    </td>
                    <td>
                      <div className="review-actions">
                        <button
                          className="platform-secondary-button"
                          disabled={!!editing || !!settings}
                          aria-label={`Edit ${r.name}`}
                          onClick={() => {
                            setEditing(lineFor(r, tab));
                            setError("");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="platform-secondary-button danger-outline"
                          disabled={!!editing || !!settings}
                          aria-label={`Remove ${r.name}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove “${r.name}” from this budget? Save to apply. Previous saved versions remain in history.`,
                              )
                            )
                              change({
                                ...budget,
                                [tab]: budget[tab].filter((v) => v.id !== r.id),
                              });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="empty-state">
                <strong>
                  {budget[tab].length
                    ? "No matching items."
                    : "No manual items yet."}
                </strong>
                <span>
                  {budget[tab].length
                    ? "Change your search or category."
                    : "Add outside amounts, or use an event starter below."}
                </span>
              </div>
            )}
          </div>
          {!budget.costs.length && !budget.income.length && (
            <div className="review-actions">
              <button
                className="platform-secondary-button"
                disabled={!!editing || !!settings}
                onClick={() =>
                  change({
                    ...budget,
                    costs: budgetStarter("golf").costs,
                    income: budgetStarter("golf").income,
                  })
                }
              >
                Use golf event starter
              </button>
              <button
                className="platform-secondary-button"
                disabled={!!editing || !!settings}
                onClick={() =>
                  change({
                    ...budget,
                    costs: budgetStarter("general").costs,
                    income: budgetStarter("general").income,
                  })
                }
              >
                Use general event starter
              </button>
            </div>
          )}
        </section>
        <section className="platform-section-card">
          <label>
            Budget notes
            <textarea
              aria-label="Budget notes"
              rows={3}
              maxLength={3000}
              value={budget.notes}
              onChange={(e) => change({ ...budget, notes: e.target.value })}
            />
          </label>
          <div className="review-actions budget-bottom">
            <button
              className="platform-secondary-button"
              disabled={!!editing || !!settings}
              onClick={() => {
                if (
                  !unsaved ||
                  window.confirm(
                    "Reload the saved budget and discard your unsaved changes?",
                  )
                ) {
                  setLoading(true);
                  load(true);
                }
              }}
            >
              Reload saved budget
            </button>
          </div>
          <details>
            <summary>
              Budget save history · {historyCount} saved version
              {historyCount === 1 ? "" : "s"}
            </summary>
            <p className="budget-muted">
              Each save keeps the budget, source totals at save time, and the
              editor’s account ID. Showing the latest 10 saves.
            </p>
            {history.map((r) => (
              <p key={r.version}>
                Version {r.version} · {new Date(r.created_at).toLocaleString()}{" "}
                · Editor account {r.actor_user_id}
              </p>
            ))}
          </details>
        </section>
      </fieldset>
    </section>
  );
}

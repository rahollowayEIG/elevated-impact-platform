import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./event-builder.css";
import "./event-creative.css";
import EventEstimateEditor from "./EventEstimateEditor.jsx";

export async function eventBuilderApi(body) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in again to continue.");
  const response = await fetch("/api/event-builder", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Unable to complete this step.");
  return result;
}

export default function EventAgreementPanel({
  request,
  onSaved,
  api = eventBuilderApi,
}) {
  const [state, setState] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("load");
  const [kind, setKind] = useState(""),
    [signerName, setSignerName] = useState(""),
    [signerEmail, setSignerEmail] = useState("");
  const [depositStatus, setDepositStatus] = useState("paid"),
    [method, setMethod] = useState("check"),
    [reference, setReference] = useState("");
  const [reviewed, setReviewed] = useState(false),
    [confirmSend, setConfirmSend] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setState(null);
    setBusy("load");
    setError("");
    api({ action: "load", request_id: request.id })
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy("");
      });
    return () => {
      cancelled = true;
    };
  }, [request.id, api]);
  async function run(action, extra = {}) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(action);
    setError("");
    try {
      const result = await api({
        action,
        request_id: request.id,
        expected_updated_at: state?.request.updated_at || request.updated_at,
        ...extra,
      });
      setState(result);
      setReviewed(false);
      setConfirmSend(false);
      if (action === "confirm") onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }
  const current = state?.request || request,
    workflow = state?.workflow;
  const activeHold =
    current.status === "hold" &&
    Date.parse(current.hold_expires_at) > Date.now();
  const ready =
    workflow?.signed_at &&
    (["paid", "waived"].includes(current.deposit_status) ||
      (Number(current.deposit_amount) === 0 &&
        current.deposit_amount !== null &&
        current.deposit_status === "not_required"));
  function downloadExhibit() {
    const blob = new Blob([state.exhibit], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Event-Booking-Exhibit.html";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section
      className="builder-working-panel"
      aria-label="Agreement and deposit"
    >
      <p className="platform-eyebrow">Booking handoff</p>
      <h3>Agreement & deposit</h3>
      <p>
        Prepare the booking exhibit, review the agreement, verify both
        signatures, then complete the deposit requirement.
      </p>
      <div className="availability-note">
        <strong>Policy review pending</strong>
        <span>
          Contract policy cleanup must be approved before sending is enabled.
        </span>
      </div>
      {error && (
        <div className="platform-error" role="alert">
          {error}{" "}
          <button type="button" disabled={!!busy} onClick={() => run("load")}>
            Reload status
          </button>
        </div>
      )}
      {busy === "load" && <p role="status">Loading agreement status…</p>}
      {state && (
        <>
          <EventEstimateEditor
            value={current.booking_estimate}
            name={current.event_name || current.group_name || "Event"}
            approved={!!current.estimate_approved_at}
            locked={!!workflow}
            busy={!!busy}
            onSave={(estimate, approved) =>
              run("estimate", { estimate, approved })
            }
          />
          <div className="builder-status-grid">
            <div>
              <span>Agreement</span>
              <strong>
                {workflow?.envelope_status?.replaceAll("_", " ") ||
                  "Not prepared"}
              </strong>
            </div>
            <div>
              <span>Deposit</span>
              <strong>{current.deposit_status.replaceAll("_", " ")}</strong>
            </div>
            <div>
              <span>Booking</span>
              <strong>{current.status.replaceAll("_", " ")}</strong>
            </div>
          </div>
          {!state.connection.configured && (
            <p>
              Docusign API connection needs setup for this venue. Your booking
              draft can be saved while the connection is configured.
            </p>
          )}
          {!workflow && (
            <div className="form-grid two">
              <label>
                Agreement type
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="">Choose agreement</option>
                  <option value="golf">Golf outing</option>
                  <option value="venue">Venue space only</option>
                </select>
              </label>
              <label>
                Venue authorized signer
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                />
              </label>
              <label>
                Venue signer email
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                />
              </label>
              <p>
                Organizer signs first: {current.contact_full_name} ·{" "}
                {current.contact_email}
              </p>
            </div>
          )}
          {workflow && (
            <p>
              Booking terms frozen on{" "}
              {new Date(workflow.created_at).toLocaleString()}.{" "}
              {workflow.envelope_id && (
                <>
                  Envelope: <code>{workflow.envelope_id}</code>
                </>
              )}
            </p>
          )}
          <div className="review-actions">
            {(!workflow || !workflow.exhibit_attached) && (
              <button
                type="button"
                className="platform-secondary-button"
                disabled={
                  !!busy ||
                  !activeHold ||
                  (!workflow && (!kind || !signerName || !signerEmail))
                }
                onClick={() =>
                  run("prepare", {
                    agreement_kind: workflow?.agreement_kind || kind,
                    venue_signer_name: signerName,
                    venue_signer_email: signerEmail,
                  })
                }
              >
                {busy === "prepare"
                  ? "Preparing…"
                  : workflow
                    ? "Complete Docusign draft"
                    : "Prepare agreement draft"}
              </button>
            )}
            {state.exhibit && (
              <button
                type="button"
                className="platform-secondary-button"
                onClick={downloadExhibit}
              >
                Download booking exhibit
              </button>
            )}
            {workflow?.envelope_id && (
              <button
                type="button"
                className="platform-secondary-button"
                disabled={!!busy}
                onClick={() => run("sync")}
              >
                Verify signing status
              </button>
            )}
          </div>
          {workflow?.envelope_status === "created" && (
            <div className="builder-action-box">
              <p>
                Complete all placeholders and review the booking exhibit in
                Docusign before sending. Sending emails the organizer and then
                the venue representative for signature.
              </p>
              <label className="builder-checkbox">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />{" "}
                I reviewed the completed agreement, booking exhibit, signers,
                and pricing.
              </label>
              {confirmSend ? (
                <div role="dialog" aria-label="Send agreement confirmation">
                  <p>
                    Send this agreement to {workflow.terms.organizer_email},
                    then {workflow.terms.venue_signer_email}?
                  </p>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => run("send", { reviewed: true })}
                  >
                    Confirm and send
                  </button>{" "}
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setConfirmSend(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="platform-primary-button"
                  disabled={
                    !!busy ||
                    !activeHold ||
                    !reviewed ||
                    !state.connection.sends_enabled
                  }
                  onClick={() => setConfirmSend(true)}
                >
                  Send for signatures
                </button>
              )}
            </div>
          )}
          {workflow &&
            current.status === "hold" &&
            !["paid", "waived"].includes(current.deposit_status) &&
            Number(current.deposit_amount) > 0 && (
              <div className="builder-action-box">
                <h4>Record booking deposit</h4>
                <p>
                  Required: ${Number(current.deposit_amount).toFixed(2)}. This
                  records an existing payment or waiver; it does not charge a
                  card.
                </p>
                <div className="form-grid two">
                  <label>
                    Deposit action
                    <select
                      value={depositStatus}
                      onChange={(e) => setDepositStatus(e.target.value)}
                    >
                      <option value="paid">Record received payment</option>
                      <option value="waived">Waive deposit</option>
                    </select>
                  </label>
                  {depositStatus === "paid" && (
                    <label>
                      Payment method
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                      >
                        <option value="check">Check</option>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  )}
                  <label>
                    {depositStatus === "paid"
                      ? "Receipt / payment reference"
                      : "Waiver reason"}
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled={!!busy || !reference.trim()}
                  onClick={() => {
                    if (
                      window.confirm(
                        depositStatus === "paid"
                          ? `Record a received deposit of $${Number(current.deposit_amount).toFixed(2)} for ${current.group_name || current.contact_full_name}?`
                          : "Waive this booking deposit with the reason entered?",
                      )
                    )
                      run("deposit", {
                        status: depositStatus,
                        amount: current.deposit_amount,
                        method,
                        reference,
                      });
                  }}
                >
                  Save deposit record
                </button>
              </div>
            )}
          {current.status !== "confirmed" && (
            <button
              type="button"
              className="platform-primary-button"
              disabled={!!busy || !activeHold || !ready}
              onClick={() => {
                if (
                  window.confirm(
                    "Confirm this venue booking and create its unpublished event record?",
                  )
                )
                  run("confirm");
              }}
            >
              Confirm booking + create event
            </button>
          )}
          {current.event_id && (
            <p role="status">
              Saved event: <code>{current.event_id}</code>. Registration and Hub
              publication remain separate setup steps.
            </p>
          )}
          <details>
            <summary>Booking activity · {state.audit.length} entries</summary>
            <ol>
              {state.audit.map((entry, i) => (
                <li key={entry.created_at + i}>
                  {entry.action.replaceAll("_", " ")} ·{" "}
                  {new Date(entry.created_at).toLocaleString()}
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}

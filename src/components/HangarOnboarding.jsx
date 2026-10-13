import React, { useMemo, useState } from "react";
import {
  HANGAR_SOURCES, HANGAR_TYPES, onboardingProblem, suggestExistingHangars
} from "../lib/hangarOnboarding.mjs";

// EIG-owned onboarding starts with the canonical Hanger. A Pilot may claim it later.
// This UI does not grant access, merge companies, activate paid apps or perform AI scraping.
export default function HangarOnboarding({
  organizations, loading, onCreateOrganization, onInviteUser,
  onOpenOrganization, renderInviteResult
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", organizationType: "business", websiteUrl: "",
    primaryContactName: "", primaryContactEmail: "",
    source: "eig_manual", isTest: false, invitePilot: false
  });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name_asc");
  const [reviewedSimilar, setReviewedSimilar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdHanger, setCreatedHanger] = useState(null);
  const [lastCreated, setLastCreated] = useState(null);
  const [serverMatches, setServerMatches] = useState([]);
  const [inviteResult, setInviteResult] = useState(null);

  const matches = useMemo(() =>
    suggestExistingHangars(organizations, form),
  [organizations, form.name, form.websiteUrl, form.isTest]);
  const definiteMatch = matches.some(row => row.definite);
  const possibleMatch = matches.some(row => !row.definite);

  const shown = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...organizations].filter(o =>
      !q || [o.name, o.slug, o.organization_type, o.website_url].some(v =>
        String(v || "").toLowerCase().includes(q))
    ).sort((a, b) => {
      const x = String(a.name || ""), y = String(b.name || "");
      const result = x.localeCompare(y, undefined, { sensitivity: "base", numeric: true }) || String(a.id).localeCompare(String(b.id));
      return sort === "name_desc" ? -result : result;
    });
  }, [organizations, search, sort]);

  const change = (key, value) => {
    setForm(current => ({ ...current, [key]: value }));
    setReviewedSimilar(false);
    setServerMatches([]);
    setError("");
  };
  const start = () => {
    setShowCreate(v => !v);
    setError(""); setReviewedSimilar(false); setServerMatches([]);
    setCreatedHanger(null); setLastCreated(null); setInviteResult(null);
    setForm({ name: "", organizationType: "business", websiteUrl: "",
      primaryContactName: "", primaryContactEmail: "", source: "eig_manual",
      isTest: false, invitePilot: false });
  };

  async function submit(event) {
    event.preventDefault();
    setError("");
    const problem = onboardingProblem(form);
    if (problem) { setError(problem); return; }
    if (!createdHanger && definiteMatch) {
      setError("This business may already have a Hanger. Open the matching record instead of creating a duplicate.");
      return;
    }
    if (!createdHanger && possibleMatch && !reviewedSimilar) {
      setError("Review the similar Hangers and confirm that this is a different business.");
      return;
    }
    if (form.invitePilot) {
      const inviteProblem = onboardingProblem(form);
      if (!form.primaryContactName.trim() || !form.primaryContactEmail.trim()) {
        setError("Add the Pilot's name and email before sending an invitation.");
        return;
      }
      if (inviteProblem) { setError(inviteProblem); return; }
    }
    setBusy(true);
    try {
      let hanger = createdHanger;
      if (!hanger) {
        const result = await onCreateOrganization(form);
        if (result?.outcome === "matches") {
          setServerMatches(result.candidates || []);
          setError("An existing Hanger matches this business. No new Hanger was created.");
          return;
        }
        hanger = result?.organization || result;
        if (!hanger?.id) throw new Error("No Hanger was returned by the provisioning service.");
        setCreatedHanger(hanger); // Invitation failure must never create a duplicate.
      }
      if (form.invitePilot) {
        const invitation = await onInviteUser({
          email: form.primaryContactEmail.trim().toLowerCase(),
          invitee_name: form.primaryContactName.trim(),
          organization_id: hanger.id, role: "organization_admin",
          access_mode: "indefinite"
        });
        setInviteResult(invitation);
      }
      setLastCreated(hanger);
      setCreatedHanger(null);
      setShowCreate(false);
    } catch (cause) {
      setError((createdHanger ? "Hanger already created. Retry only the Pilot invitation. " : "") +
        (cause?.message || "Unable to finish Hanger onboarding."));
    } finally {
      setBusy(false);
    }
  }

  return <section className="platform-section-card">
    <div className="platform-section-heading">
      <div>
        <p className="platform-eyebrow">Business directory</p>
        <h2>Hangers</h2>
        <p>Every advertiser, merchant and venue uses one Hanger and one Cockpit, with or without paid apps.</p>
      </div>
      <button className="platform-secondary-button" type="button" onClick={start}>{showCreate ? "Cancel" : "+ Onboard Business"}</button>
    </div>

    {showCreate && <form className="platform-login-form" onSubmit={submit}>
      <div className="platform-section-heading">
        <div><p className="platform-eyebrow">New Hanger</p><h3>Search, review, create</h3><p>Find an existing business before creating a new record. A Pilot invitation is optional and can be sent later.</p></div>
      </div>
      <div className="form-grid two">
        <label>Business name *<input required maxLength={160} value={form.name} onChange={e => change("name", e.target.value)} disabled={Boolean(createdHanger)} placeholder="Merchant or business name" /></label>
        <label>Business type<select value={form.organizationType} className="platform-workspace-select" disabled={Boolean(createdHanger)} onChange={e => change("organizationType", e.target.value)}>{HANGAR_TYPES.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Business website<input value={form.websiteUrl} disabled={Boolean(createdHanger)} onChange={e => change("websiteUrl", e.target.value)} placeholder="https://business.com" /></label>
        <label>Where did the relationship start?<select value={form.source} className="platform-workspace-select" disabled={Boolean(createdHanger)} onChange={e => change("source", e.target.value)}>{HANGAR_SOURCES.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Primary contact name (optional)<input value={form.primaryContactName} onChange={e => change("primaryContactName", e.target.value)} placeholder="Name when known" /></label>
        <label>Primary contact email (optional)<input type="email" value={form.primaryContactEmail} onChange={e => change("primaryContactEmail", e.target.value)} placeholder="contact@business.com" /></label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input style={{ width: "auto" }} type="checkbox" checked={form.isTest} disabled={Boolean(createdHanger)} onChange={e => change("isTest", e.target.checked)} />
        Test/demo Hanger (keep separate from real customers)
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input style={{ width: "auto" }} type="checkbox" checked={form.invitePilot} onChange={e => change("invitePilot", e.target.checked)} />
        Send the Pilot invitation now (otherwise EIG manages this unclaimed Hanger)
      </label>
      {(matches.length > 0 || serverMatches.length > 0) && <div className="platform-section-card" aria-live="polite">
        <strong>Possible existing Hangers</strong>
        <p className="platform-login-copy">Opening a match reuses the business, its records and its Cockpit. Matching never merges two businesses automatically.</p>
        {matches.map(({ organization, reasons }) => <div key={organization.id} className="invite-result" style={{ marginBottom: 6 }}>
          <strong>{organization.name}</strong>
          <span>{reasons.join(" · ")}</span>
          <button type="button" className="platform-secondary-button compact" onClick={() => onOpenOrganization(organization.id)}>Open Existing →</button>
        </div>)}
        {serverMatches.filter(match => !matches.some(row => row.organization.id === match.id)).map(match => <div key={match.id} className="invite-result" style={{ marginBottom: 6 }}>
          <strong>{match.name}</strong><span>{String(match.reason || "Existing match").replaceAll("_"," ")}</span>
          <button type="button" className="platform-secondary-button compact" onClick={() => onOpenOrganization(match.id)}>Open Existing →</button>
        </div>)}
      </div>}
      {possibleMatch && !definiteMatch && !createdHanger && <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" style={{ width: "auto" }} checked={reviewedSimilar} onChange={e => setReviewedSimilar(e.target.checked)} />
        I reviewed the similar names and confirmed this is a different business.
      </label>}
      <p className="platform-login-copy">The new Hanger gets its business profile and Cockpit with no paid apps. Its public directory listing stays private until approved. AI-suggested details, artwork rights and customer approvals are planned for a later discovery phase.</p>
      {error && <div className="platform-error" role="alert">{error}</div>}
      <button type="submit" className="platform-primary-button"
        disabled={busy || (!createdHanger && (definiteMatch || (possibleMatch && !reviewedSimilar)))}>
        {busy ? "Working..." : createdHanger ? "Retry Pilot Invitation" : form.invitePilot ? "Create Hanger & Invite Pilot" : "Create EIG-Managed Hanger"}
      </button>
    </form>}

    {lastCreated && <div className="invite-result sent" role="status">
      <strong>{lastCreated.name} Hanger created.</strong>
      <span>{inviteResult ? "The Pilot invitation was prepared. The existing account-claim flow handles acceptance." : "EIG can manage the business now. Invite its Pilot when ready."}</span>
      <button type="button" className="platform-secondary-button compact" onClick={() => onOpenOrganization(lastCreated.id)}>Open Cockpit →</button>
      {inviteResult && renderInviteResult?.(inviteResult)}
    </div>}

    <div className="platform-section-heading" style={{ marginTop: 18 }}>
      <div><p className="platform-eyebrow">Existing Hangers</p><h3>{shown.length} of {organizations.length} businesses</h3></div>
    </div>
    <div className="form-grid two" style={{ marginBottom: 16 }}>
      <label>Search Hangers<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, slug, type, website..." /></label>
      <label>Sort Hangers<select className="platform-workspace-select" value={sort} onChange={e => setSort(e.target.value)}>
        <option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option>
      </select></label>
    </div>
    {loading ? <p>Loading Hangers...</p> : <div className="platform-org-grid">
      {shown.map(org => <button type="button" className="platform-org-card" key={org.id} onClick={() => onOpenOrganization(org.id)}>
        <div className="platform-org-icon">{org.name?.slice(0,2).toUpperCase()}</div>
        <div><strong>{org.name}{org.is_test ? " · TEST" : ""}</strong>
          <span>{(org.organization_type || "Business").replaceAll("_"," ")} · {(org.onboarding_status || "profile_incomplete").replaceAll("_"," ")}</span>
        </div><b>Open →</b>
      </button>)}
      {!shown.length && <p>{search ? "No Hangers match your search." : "No businesses found. Onboard the first Hanger."}</p>}
    </div>}
  </section>;
}

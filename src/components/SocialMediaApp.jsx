import React, { useEffect, useRef, useState } from "react";
import { socialStore } from "../lib/socialStore.js";
import {
  SOCIAL_DESTINATIONS,
  REVENUE_OPPORTUNITIES,
  newCampaign,
  cleanCampaignData,
  safePublicUrl,
  campaignProblem,
  campaignAdHtml,
  visibleCampaigns,
} from "../lib/socialCampaign.mjs";
import "./social-media.css";
import {
  CampaignTemplates,
  CampaignPostPlan,
  CampaignCalendar,
} from "./CampaignPlanning.jsx";
import { campaignCalendar } from "../lib/campaignSchedule.mjs";

const controls = [
  {
    id: "physical",
    name: "Physical spaces",
    detail: "Holes, tee signs, carts, banners, check-in and screens",
    groups: ["On course", "Print"],
  },
  {
    id: "online",
    name: "Online channels",
    detail: "Event hubs, websites, social pages and videos",
    groups: ["Digital"],
  },
  {
    id: "offers",
    name: "Products & experiences",
    detail: "Swag, hospitality, outings and event packages",
    groups: ["Products", "Event", "Venue"],
  },
];
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function SocialMediaApp({
  onBack,
  onArtwork,
  onDirtyChange,
  store = socialStore,
}) {
  const [rows, setRows] = useState([]),
    [events, setEvents] = useState([]),
    [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ field: "updated_at", ascending: false }),
    [opQuery, setOpQuery] = useState(""),
    [control, setControl] = useState("all");
  const inflight = useRef(false),
    editor = useRef(null),
    alert = useRef(null),
    connections = useRef(null);
  useEffect(() => {
    if (error)
      alert.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);
  useEffect(() => {
    let active = true;
    Promise.all([store.list(), store.events()])
      .then(([posts, ev]) => {
        if (active) {
          setRows(posts);
          setEvents(ev);
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Unable to load campaigns.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [store]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const visible = visibleCampaigns(
    rows,
    query,
    filter,
    sort.field,
    sort.ascending,
  );
  const opportunityList = REVENUE_OPPORTUNITIES.filter(
    (o) =>
      (control === "all" ||
        controls.find((c) => c.id === control)?.groups.includes(o.group)) &&
      [o.name, o.detail, o.group]
        .join(" ")
        .toLowerCase()
        .includes(opQuery.toLowerCase()),
  );
  const canLeave = () =>
    !inflight.current &&
    (!dirty || window.confirm("Leave without saving your campaign changes?"));
  function open(next) {
    if (!canLeave()) return;
    setCampaign({ ...next, data: cleanCampaignData(next.data) });
    setDirty(!next.version);
    setError("");
    setNotice("");
    requestAnimationFrame(() =>
      editor.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  function change(field, value, data = true) {
    setCampaign((p) => ({
      ...p,
      status: "draft",
      reviewed_at: null,
      ...(data ? { data: { ...p.data, [field]: value } } : { [field]: value }),
    }));
    setDirty(true);
    setNotice("");
  }
  async function save(status) {
    if (inflight.current) return;
    const issue = campaignProblem(campaign, status === "reviewed");
    if (issue) {
      setError(issue);
      return;
    }
    inflight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await store.save(campaign, status);
      setCampaign(saved);
      setDirty(false);
      setNotice(
        status === "reviewed" && saved.data.posts.length
          ? `Posting plan reviewed and saved. Version ${saved.version}. Ready for manual posting; automatic publishing pending.`
          : `${status === "reviewed" ? "Reviewed campaign saved" : "Draft saved"}. Version ${saved.version}. Nothing has been published.`,
      );
      setRows(await store.list());
    } catch (e) {
      setError(
        e.message ||
          "Unable to save. Download a draft backup to keep your changes.",
      );
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  function exportAd() {
    try {
      if (dirty)
        throw new Error(
          "Save a reviewed version before exporting a website ad.",
        );
      download("campaign-ad.html", campaignAdHtml(campaign), "text/html");
      setNotice(
        "Website ad downloaded. Add it to a site you manage; update or remove the block when it changes or expires.",
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function exportCalendar() {
    try {
      if (dirty)
        throw new Error(
          "Save a reviewed version before downloading its calendar.",
        );
      download(
        "campaign-calendar.ics",
        campaignCalendar(campaign),
        "text/calendar;charset=utf-8",
      );
      setNotice(
        "Calendar downloaded for manual posting reminders. No automatic publishing is enabled.",
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function sortBy(field) {
    setSort((s) => ({
      field,
      ascending: s.field === field ? !s.ascending : true,
    }));
  }
  return (
    <div className="sm-app">
      <header className="sm-header">
        <div className="sm-brand">
          <span aria-hidden="true">SM</span>
          <div>
            <p className="sm-kicker">ELEVATIONPILOT</p>
            <h1>Social Media & Ads</h1>
            <p>Create once. Prepare every placement.</p>
          </div>
        </div>
        <div className="sm-actions">
          <button
            type="button"
            className="platform-primary-button"
            disabled={busy || loading}
            onClick={() => open(newCampaign())}
          >
            New campaign
          </button>
          <button
            type="button"
            className="platform-secondary-button"
            onClick={() =>
              connections.current?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Connections
          </button>
          {onBack && (
            <button
              type="button"
              className="platform-secondary-button"
              disabled={busy}
              onClick={() => {
                if (canLeave()) {
                  setDirty(false);
                  onBack();
                }
              }}
            >
              Back to workspace
            </button>
          )}
        </div>
      </header>
      {error && (
        <p className="platform-error" role="alert" ref={alert}>
          {error}
        </p>
      )}
      {notice && (
        <p className="sm-notice" role="status">
          {notice}
        </p>
      )}
      <div className="sm-summary">
        <div>
          <strong>{rows.filter((r) => r.status === "draft").length}</strong>
          <span>Saved drafts</span>
        </div>
        <div>
          <strong>{rows.filter((r) => r.status === "reviewed").length}</strong>
          <span>Reviewed campaigns</span>
        </div>
        <div>
          <strong>
            {rows.reduce((n, row) => n + (row.data.posts?.length || 0), 0)}
          </strong>
          <span>Saved planned posts · automatic publishing pending</span>
        </div>
      </div>
      {loading && <p role="status">Loading your campaigns…</p>}
      <CampaignTemplates
        disabled={loading || busy}
        onChoose={(t) => {
          const next = newCampaign();
          open({
            ...next,
            name: t.name,
            data: {
              ...next.data,
              template_id: t.id,
              destinations: t.destinations,
            },
          });
        }}
      />
      {campaign && (
        <section
          className="sm-editor"
          ref={editor}
          aria-labelledby="sm-editor-title"
        >
          <div className="sm-section-heading">
            <div>
              <p className="sm-kicker">YOUR CAMPAIGN</p>
              <h2 id="sm-editor-title">
                One message. Your chosen destinations.
              </h2>
            </div>
            <span className="sm-badge">
              {dirty
                ? "Unsaved changes"
                : campaign.status === "reviewed"
                  ? `Reviewed · v${campaign.version}`
                  : `Draft · v${campaign.version}`}
            </span>
          </div>
          <div className="sm-compose">
            <div className="sm-fields">
              <label>
                Campaign name
                <input
                  maxLength={160}
                  value={campaign.name}
                  disabled={busy}
                  onChange={(e) => change("name", e.target.value, false)}
                />
              </label>
              <label>
                Event context
                <select
                  aria-label="Event context"
                  value={campaign.event_id || ""}
                  disabled={busy || campaign.version > 0}
                  onChange={(e) =>
                    change("event_id", e.target.value || null, false)
                  }
                >
                  <option value="">Personal campaign</option>
                  {events.map((e) => (
                    <option value={e.id} key={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              {campaign.version > 0 && (
                <small>Create a new campaign to change its event.</small>
              )}
              <label>
                Sponsor or partner
                <input
                  maxLength={160}
                  value={campaign.data.sponsor}
                  disabled={busy}
                  onChange={(e) => change("sponsor", e.target.value)}
                  placeholder="Who is supporting this offer?"
                />
              </label>
              <label>
                Headline
                <input
                  maxLength={160}
                  value={campaign.data.headline}
                  disabled={busy}
                  onChange={(e) => change("headline", e.target.value)}
                />
              </label>
              {campaign.data.template_id && (
                <small>
                  Use the event or business name as the headline to build your
                  template posts.
                </small>
              )}
              <label>
                Message
                <textarea
                  aria-label="Message"
                  rows={6}
                  maxLength={6000}
                  value={campaign.data.body}
                  disabled={busy}
                  onChange={(e) => change("body", e.target.value)}
                  placeholder="Add the approved offer, event facts and sponsor message."
                />
              </label>
              <small>
                {campaign.data.body.length.toLocaleString()} characters ·
                platform-specific formats will be checked when publishing is
                connected.
              </small>
              <label>
                Destination link
                <input
                  type="url"
                  maxLength={2048}
                  value={campaign.data.link}
                  disabled={busy}
                  onChange={(e) => change("link", e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label>
                Public artwork URL
                <input
                  type="url"
                  maxLength={2048}
                  value={campaign.data.image}
                  disabled={busy}
                  onChange={(e) => change("image", e.target.value)}
                  placeholder="https://… · approved image you can share"
                />
              </label>
              <label>
                Ad button text
                <input
                  maxLength={80}
                  value={campaign.data.cta}
                  disabled={busy}
                  onChange={(e) => change("cta", e.target.value)}
                />
              </label>
              <div className="sm-time-fields">
                <label>
                  {campaign.data.posts.length
                    ? "Campaign start"
                    : "Desired publish time"}
                  <input
                    type="datetime-local"
                    value={campaign.data.desired_at}
                    disabled={busy}
                    onChange={(e) => change("desired_at", e.target.value)}
                  />
                </label>
                <label>
                  Campaign end
                  <input
                    type="datetime-local"
                    value={campaign.data.ends_at}
                    disabled={busy}
                    onChange={(e) => change("ends_at", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Campaign time zone
                <input
                  aria-label="Campaign time zone"
                  maxLength={80}
                  list="sm-time-zones"
                  value={campaign.data.time_zone}
                  disabled={busy}
                  onChange={(e) => change("time_zone", e.target.value)}
                  placeholder="America/New_York"
                />
              </label>
              <datalist id="sm-time-zones">
                {[
                  "America/New_York",
                  "America/Chicago",
                  "America/Denver",
                  "America/Los_Angeles",
                  "America/Phoenix",
                  "Europe/London",
                  "UTC",
                ].map((zone) => (
                  <option value={zone} key={zone} />
                ))}
              </datalist>
              <small>
                Planning dates in the campaign’s time zone (
                {campaign.data.time_zone || "time zone not specified"}). These
                do not schedule or stop a live ad.
              </small>
            </div>
            <div className="sm-preview-area">
              <h3>Campaign preview</h3>
              <article className="sm-preview" aria-label="Campaign preview">
                <p className="sm-kicker">
                  {campaign.data.sponsor
                    ? `SPONSORED · ${campaign.data.sponsor}`
                    : "YOUR MESSAGE"}
                </p>
                {safePublicUrl(campaign.data.image) && (
                  <img
                    src={safePublicUrl(campaign.data.image)}
                    alt={campaign.data.headline || campaign.name}
                    referrerPolicy="no-referrer"
                  />
                )}
                <h3>{campaign.data.headline || campaign.name}</h3>
                <p>{campaign.data.body || "Your message will appear here."}</p>
                {campaign.data.link && (
                  <span className="sm-preview-cta">
                    {campaign.data.cta || "Learn more"}
                  </span>
                )}
              </article>
              <p className="sm-help">
                A content preview. Each network will have its own format and
                account checks.
              </p>
              <fieldset disabled={busy}>
                <legend>Prepare for these destinations</legend>
                <div className="sm-destinations">
                  {SOCIAL_DESTINATIONS.map((d) => (
                    <label key={d.id}>
                      <input
                        type="checkbox"
                        checked={campaign.data.destinations.includes(d.id)}
                        onChange={(e) =>
                          change(
                            "destinations",
                            e.target.checked
                              ? [...campaign.data.destinations, d.id]
                              : campaign.data.destinations.filter(
                                  (v) => v !== d.id,
                                ),
                          )
                        }
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="sm-help">
                Selecting a destination prepares the campaign. Social account
                connections and direct hub/display delivery are pending. Website
                ad HTML is available after review.
              </p>
              {onArtwork && (
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled={busy}
                  onClick={() => {
                    onArtwork();
                  }}
                >
                  Create artwork in InceptionApex
                </button>
              )}
            </div>
          </div>
          <CampaignPostPlan
            campaign={campaign}
            busy={busy}
            onChange={change}
            onReplace={(data) => change("data", data, false)}
            onError={setError}
          />
          <div className="sm-action-center">
            <div
              className="sm-action-group"
              role="group"
              aria-label="Save & review"
            >
              <strong>Save & review</strong>
              <div className="sm-actions">
                <button
                  type="button"
                  className="platform-primary-button"
                  disabled={busy}
                  onClick={() => save("draft")}
                >
                  {busy ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled={busy}
                  onClick={() => save("reviewed")}
                >
                  {campaign.data.posts.length
                    ? "Review & save posting plan"
                    : "Save as reviewed"}
                </button>
              </div>
            </div>
            <div
              className="sm-action-group"
              role="group"
              aria-label="Downloads"
            >
              <strong>Downloads</strong>
              <div className="sm-actions">
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled={busy}
                  onClick={() =>
                    download(
                      "campaign-draft.json",
                      JSON.stringify(
                        { type: "elevationpilot-social-campaign", ...campaign },
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
                  Download draft backup
                </button>
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled={busy || dirty || campaign.status !== "reviewed"}
                  onClick={exportAd}
                >
                  Download website ad
                </button>
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled={
                    busy ||
                    dirty ||
                    campaign.status !== "reviewed" ||
                    !campaign.data.posts.length
                  }
                  onClick={exportCalendar}
                >
                  Download posting calendar
                </button>
              </div>
            </div>
            <div
              className="sm-action-group"
              role="group"
              aria-label="Reuse & close"
            >
              <strong>Reuse & close</strong>
              <div className="sm-actions">
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled={busy}
                  onClick={() => {
                    const next = newCampaign();
                    open({
                      ...next,
                      name: `${campaign.name} · copy`.slice(0, 160),
                      event_id: campaign.event_id,
                      data: {
                        ...campaign.data,
                        posts: campaign.data.posts.map((p) => ({
                          ...p,
                          id: crypto.randomUUID(),
                        })),
                      },
                    });
                  }}
                >
                  Use as new campaign
                </button>
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled
                  title="Social account connections are required"
                >
                  Publish · connection pending
                </button>
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled={busy}
                  onClick={() => {
                    if (canLeave()) {
                      setCampaign(null);
                      setDirty(false);
                    }
                  }}
                >
                  Close campaign
                </button>
              </div>
            </div>
          </div>
          <p className="sm-help">
            Review saves a version for preparation; it does not publish,
            purchase a placement or send a notification. Static website exports
            require manual updates and removal.
          </p>
        </section>
      )}
      <section
        className="sm-opportunities"
        aria-labelledby="sm-opportunities-title"
      >
        <p className="sm-kicker">START WITH WHAT YOUR HANGAR CONTROLS</p>
        <h2 id="sm-opportunities-title">Turn a placement into an offer.</h2>
        <p>
          Choose a space, channel or product you manage. Build its sponsor
          message and prepare a campaign.
        </p>
        <div className="sm-control-types">
          {controls.map((c) => (
            <button
              type="button"
              key={c.id}
              aria-pressed={control === c.id}
              onClick={() => setControl(control === c.id ? "all" : c.id)}
            >
              <strong>{c.name}</strong>
              <span>{c.detail}</span>
            </button>
          ))}
        </div>
        <label className="sm-search">
          Search opportunities
          <input
            type="search"
            value={opQuery}
            onChange={(e) => setOpQuery(e.target.value)}
            placeholder="Hole, website, video, swag…"
          />
        </label>
        <p className="sm-help">
          {opportunityList.length} opportunities · package pricing, sales and
          orders will connect through EIC.
        </p>
        <div className="sm-opportunity-grid">
          {opportunityList.map((o) => (
            <article key={o.id}>
              <span className="sm-badge">{o.group}</span>
              <h3>{o.name}</h3>
              <p>{o.detail}</p>
              <button
                type="button"
                className="platform-secondary-button"
                disabled={loading || busy}
                onClick={() => open(newCampaign(o))}
              >
                Build {o.name.toLowerCase()}
              </button>
            </article>
          ))}
        </div>
        {!opportunityList.length && (
          <p>No opportunities match. Clear the search or selected group.</p>
        )}
      </section>
      <section className="sm-library" aria-labelledby="sm-library-title">
        <div className="sm-section-heading">
          <h2 id="sm-library-title">My campaigns</h2>
          <span>
            {visible.length} of {rows.length} campaigns
          </span>
        </div>
        <div className="sm-library-controls">
          <label>
            Search campaigns
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Campaign, sponsor or headline"
            />
          </label>
          <label>
            Show campaigns
            <select
              aria-label="Show campaigns"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All campaigns</option>
              <option value="draft">Drafts</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </label>
        </div>
        {visible.length ? (
          <div className="sm-table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    ["name", "Campaign"],
                    ["status", "Status"],
                    ["updated_at", "Updated"],
                  ].map(([field, label]) => (
                    <th
                      key={field}
                      aria-sort={
                        sort.field === field
                          ? sort.ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button type="button" onClick={() => sortBy(field)}>
                        {label}
                        {sort.field === field
                          ? sort.ascending
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr
                    key={p.id}
                    className={campaign?.id === p.id ? "selected" : ""}
                  >
                    <td>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => open(p)}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td>{p.status}</td>
                    <td>{new Date(p.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {rows.length
              ? "No campaigns match your search and filter."
              : "Start with an opportunity or create your first campaign."}
          </p>
        )}
        <p className="sm-help">
          Showing up to 200 recent campaigns you are authorized to access. Event
          campaigns follow that event’s management access.
        </p>
      </section>
      <CampaignCalendar rows={rows} disabled={busy || loading} onOpen={open} />
      <section
        className="sm-connections"
        ref={connections}
        aria-labelledby="sm-connections-title"
      >
        <p className="sm-kicker">YOUR CHANNELS</p>
        <h2 id="sm-connections-title">Account connections</h2>
        <p>
          Prepare once, then publish to the accounts your Hangar authorizes.
          Developer setup and publishing connections are the next step.
        </p>
        <div className="sm-connection-grid">
          {SOCIAL_DESTINATIONS.map((d) => (
            <article key={d.id}>
              <h3>{d.name}</h3>
              <p>{d.detail}</p>
              <span className="sm-badge">Connection pending</span>
              {d.setup && (
                <a href={d.setup} target="_blank" rel="noopener noreferrer">
                  Provider setup documentation ↗
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

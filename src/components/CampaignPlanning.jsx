import React, { useMemo, useState } from "react";
import {
  CAMPAIGN_TEMPLATES,
  MAX_CAMPAIGN_POSTS,
  scheduleRows,
  templatePlan,
} from "../lib/campaignSchedule.mjs";
import { SOCIAL_DESTINATIONS } from "../lib/socialCampaign.mjs";

export function CampaignTemplates({ onChoose, disabled }) {
  return (
    <section className="sm-templates" aria-labelledby="sm-templates-title">
      <p className="sm-kicker">READY-MADE CAMPAIGNS</p>
      <h2 id="sm-templates-title">Pick a plan. Make it yours.</h2>
      <p>
        Start with a repeatable campaign, customize the facts, and review the
        exact posting plan.
      </p>
      <div className="sm-template-grid">
        {CAMPAIGN_TEMPLATES.map((t) => (
          <article key={t.id}>
            <span className="sm-badge">{t.offsets.length} editable posts</span>
            <h3>{t.name}</h3>
            <p>{t.description}</p>
            <button
              type="button"
              className="platform-secondary-button"
              disabled={disabled}
              onClick={() => onChoose(t)}
            >
              Use {t.name.toLowerCase()}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CampaignPostPlan({
  campaign,
  busy,
  onChange,
  onReplace,
  onError,
}) {
  const d = campaign.data,
    template = CAMPAIGN_TEMPLATES.find((t) => t.id === d.template_id);
  const posts = d.posts || [];
  const changePost = (id, field, value) =>
    onChange(
      "posts",
      posts.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  function build() {
    if (
      posts.length &&
      !window.confirm(
        "Replace this posting plan with fresh template posts? Your current post edits will be replaced.",
      )
    )
      return;
    try {
      const plan = templatePlan(d.template_id, {
        subject: d.headline,
        sponsor: d.sponsor,
        offer: d.template_offer,
        anchor: d.template_anchor,
        timeZone: d.time_zone,
        link: d.link,
        eventId: campaign.event_id,
      });
      onReplace({ ...d, ...plan.data, destinations: d.destinations });
      onError("");
    } catch (e) {
      onError(e.message);
    }
  }
  return (
    <section className="sm-post-plan" aria-labelledby="sm-post-plan-title">
      <div className="sm-section-heading">
        <h3 id="sm-post-plan-title">Posting plan</h3>
        <span className="sm-badge">
          {posts.length} / {MAX_CAMPAIGN_POSTS} posts
        </span>
      </div>
      <p className="sm-help">
        All posts use this campaign’s destinations, link, artwork, and time
        zone. Review saves the whole plan. Automatic delivery requires
        publishing connections.
      </p>
      {template && (
        <fieldset disabled={busy}>
          <legend>{template.name} setup</legend>
          <p className="sm-help">
            The headline above supplies the event or business name. Check every
            generated message against your actual event or offer.
          </p>
          <div className="sm-time-fields">
            <label>
              {template.anchor}
              <input
                aria-label="Template anchor"
                type="datetime-local"
                value={d.template_anchor}
                onChange={(e) => onChange("template_anchor", e.target.value)}
              />
            </label>
            {["weekly-deal", "spotlight"].includes(template.id) && (
              <label>
                Approved offer details
                <textarea
                  aria-label="Approved offer details"
                  rows={3}
                  maxLength={2000}
                  value={d.template_offer}
                  onChange={(e) => onChange("template_offer", e.target.value)}
                />
              </label>
            )}
          </div>
          <button
            type="button"
            className="platform-primary-button"
            onClick={build}
          >
            {posts.length ? "Rebuild posting plan" : "Build posting plan"}
          </button>
        </fieldset>
      )}
      <fieldset disabled={busy} className="sm-posts-fieldset">
        <legend>Planned posts</legend>
        {posts.map((post, i) => (
          <article className="sm-post-card" key={post.id}>
            <div className="sm-section-heading">
              <strong>Post {i + 1}</strong>
              <button
                type="button"
                className="platform-secondary-button"
                aria-label={`Remove post ${i + 1}`}
                onClick={() => {
                  if (
                    window.confirm("Remove this post from the campaign plan?")
                  )
                    onChange(
                      "posts",
                      posts.filter((p) => p.id !== post.id),
                    );
                }}
              >
                Remove
              </button>
            </div>
            <div className="sm-time-fields">
              <label>
                Post title
                <input
                  aria-label={`Post ${i + 1} title`}
                  maxLength={160}
                  value={post.label}
                  onChange={(e) => changePost(post.id, "label", e.target.value)}
                />
              </label>
              <label>
                Planned posting time
                <input
                  aria-label={`Post ${i + 1} time`}
                  type="datetime-local"
                  value={post.local_at}
                  onChange={(e) =>
                    changePost(post.id, "local_at", e.target.value)
                  }
                />
              </label>
            </div>
            <label>
              Post message
              <textarea
                aria-label={`Post ${i + 1} message`}
                rows={3}
                maxLength={2000}
                value={post.body}
                onChange={(e) => changePost(post.id, "body", e.target.value)}
              />
            </label>
            <small>
              {post.body.length} / 2,000 characters ·{" "}
              {d.time_zone || "Choose a time zone"}
            </small>
          </article>
        ))}
        {!posts.length && (
          <p>No posts yet. Build a template plan or add your own post.</p>
        )}
        <button
          type="button"
          className="platform-secondary-button"
          disabled={posts.length >= MAX_CAMPAIGN_POSTS}
          onClick={() =>
            onChange("posts", [
              ...posts,
              {
                id: crypto.randomUUID(),
                label: `Post ${posts.length + 1}`,
                local_at: "",
                body: d.body.slice(0, 2000),
              },
            ])
          }
        >
          Add planned post
        </button>
      </fieldset>
    </section>
  );
}

const monthAt = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
export function CampaignCalendar({ rows, onOpen, disabled }) {
  const [month, setMonth] = useState(() => monthAt(new Date()));
  const [query, setQuery] = useState(""),
    [state, setState] = useState("all");
  const [view, setView] = useState("calendar"),
    [sort, setSort] = useState({ field: "instant", ascending: true });
  const visible = useMemo(
    () => scheduleRows(rows, query, state, month, sort.field, sort.ascending),
    [rows, query, state, month, sort.field, sort.ascending],
  );
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1),
    days = new Date(year, monthNumber, 0).getDate();
  const heading = first.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  function move(delta) {
    setMonth(monthAt(new Date(year, monthNumber - 1 + delta, 1)));
  }
  const status = (post) =>
    post.status === "reviewed" ? "Ready for manual posting" : "Needs review";
  function sortBy(field) {
    setSort((s) => ({
      field,
      ascending: s.field === field ? !s.ascending : true,
    }));
  }
  return (
    <section className="sm-calendar" aria-labelledby="sm-calendar-title">
      <p className="sm-kicker">YOUR SAVED POSTING PLANS</p>
      <h2 id="sm-calendar-title">Campaign calendar</h2>
      <p className="sm-help">
        Saved posts across campaigns you can manage. Dates appear in each
        campaign’s time zone. These are planning entries; no social posts or ads
        are delivered automatically.
      </p>
      <div className="sm-library-controls">
        <label>
          Search scheduled posts
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Campaign, sponsor, message or channel"
          />
        </label>
        <label>
          Schedule review state
          <select
            aria-label="Schedule review state"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="all">All saved plans</option>
            <option value="draft">Needs review</option>
            <option value="reviewed">Ready for manual posting</option>
          </select>
        </label>
      </div>
      <div className="sm-calendar-toolbar">
        <div className="sm-actions">
          <button
            type="button"
            className="platform-secondary-button"
            aria-label="Previous month"
            disabled={year <= 2000 && monthNumber === 1}
            onClick={() => move(-1)}
          >
            ←
          </button>
          <label>
            Calendar month
            <input
              type="month"
              min="2000-01"
              max="2100-12"
              value={month}
              onChange={(e) => {
                if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(e.target.value))
                  setMonth(e.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className="platform-secondary-button"
            aria-label="Next month"
            disabled={year >= 2100 && monthNumber === 12}
            onClick={() => move(1)}
          >
            →
          </button>
          <button
            type="button"
            className="platform-secondary-button"
            onClick={() => setMonth(monthAt(new Date()))}
          >
            This month
          </button>
        </div>
        <div className="sm-actions">
          <button
            type="button"
            className="platform-secondary-button"
            aria-pressed={view === "calendar"}
            onClick={() => setView("calendar")}
          >
            Calendar view
          </button>
          <button
            type="button"
            className="platform-secondary-button"
            aria-pressed={view === "agenda"}
            onClick={() => setView("agenda")}
          >
            Agenda view
          </button>
        </div>
      </div>
      <h3>
        {heading} · {visible.length} planned posts
      </h3>
      {view === "calendar" ? (
        <div
          className="sm-calendar-grid"
          aria-label={`${heading} posting calendar`}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <strong className="sm-calendar-weekday" key={day}>
              {day}
            </strong>
          ))}
          {Array.from({ length: first.getDay() }, (_, i) => (
            <div
              className="sm-calendar-empty"
              key={`empty-${i}`}
              aria-hidden="true"
            />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`,
              entries = visible.filter((p) => p.local_at.startsWith(date));
            return (
              <div className="sm-calendar-day" key={date}>
                <span className="sm-day-number">{i + 1}</span>
                {entries.map((p) => (
                  <button
                    type="button"
                    key={`${p.campaign_id}-${p.id}`}
                    disabled={disabled}
                    className={`sm-calendar-post ${p.status}`}
                    onClick={() =>
                      onOpen(rows.find((c) => c.id === p.campaign_id))
                    }
                  >
                    <strong>
                      {p.local_at.slice(11)} · {p.campaign}
                    </strong>
                    <span>{p.label}</span>
                    <small>
                      {p.zone} · {status(p)}
                    </small>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sm-table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  ["instant", "Planned time"],
                  ["campaign", "Campaign"],
                  ["label", "Post"],
                  ["status", "Review state"],
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
                <tr key={`${p.campaign_id}-${p.id}`}>
                  <td>
                    {p.local_at.replace("T", " ")}
                    <small className="sm-zone-label">{p.zone}</small>
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onOpen(rows.find((c) => c.id === p.campaign_id))
                      }
                    >
                      {p.campaign}
                    </button>
                  </td>
                  <td>{p.label}</td>
                  <td>{status(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!visible.length && (
        <p>
          No saved posts match this month and filter. Save your plan or select
          another month.
        </p>
      )}
    </section>
  );
}

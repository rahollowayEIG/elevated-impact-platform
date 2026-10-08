import React, { useEffect, useRef, useState } from "react";
import CreativeLinkControls from "./CreativeLinkControls.jsx";
import { creativeLinkProblem } from "../lib/creativeLink.mjs";
import { supabase } from "../lib/supabase";
import FlyerEditor, { downloadCreative } from "./FlyerEditor.jsx";
import {
  PIN_TYPES,
  eventFlyerFacts,
  newFlyer,
  packetHtml,
  sanitizePacket,
  sanitizeLayouts,
  flyerOverflow,
  orderingHandoff,
  sponsorPacketSection,
  materialsPacketSection,
  designPacketSection,
} from "../lib/eventCreative.mjs";
import { estimateHtml } from "../lib/eventEstimate.mjs";
import SponsorBuilder from "./SponsorBuilder.jsx";
import EventMaterials from "./EventMaterials.jsx";
import "./event-builder.css";
import "./event-creative.css";

async function readAssets(id) {
  const { data, error } = await supabase
    .from("event_builder_assets")
    .select("data,version,updated_at")
    .eq("event_id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
async function readQuote(id) {
  const { data, error } = await supabase.rpc("get_event_builder_quote", {
    p_event_id: id,
  });
  if (error) throw error;
  return data;
}

async function saveAssets(id, version, data) {
  const { data: row, error } = await supabase.rpc("save_event_builder_assets", {
    p_event_id: id,
    p_expected_version: version,
    p_data: data,
  });
  if (error) throw error;
  return row;
}

function CourseMap({ value, onChange }) {
  const [selected, setSelected] = useState(null),
    [type, setType] = useState(PIN_TYPES[0]),
    [error, setError] = useState("");
  const canvas = useRef(null),
    drag = useRef(null),
    suppressClick = useRef(false);
  const pin = value.pins.find((p) => p.id === selected);
  async function upload(e) {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 15000000
      )
        throw new Error("Use a PNG, JPEG or WebP course image under 15 MB.");
      const image = await createImageBitmap(file);
      const c = document.createElement("canvas"),
        scale = Math.min(1, 1600 / image.width, 1600 / image.height);
      c.width = image.width * scale;
      c.height = image.height * scale;
      c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
      image.close();
      onChange({ ...value, image: c.toDataURL("image/jpeg", 0.88) });
      setError("");
    } catch (problem) {
      setError(problem.message);
    } finally {
      e.target.value = "";
    }
  }
  function point(e) {
    const r = canvas.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    };
  }
  function add(e) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (!value.image || drag.current || value.pins.length >= 150) return;
    const p = {
      id: crypto.randomUUID(),
      type,
      label: type,
      hole: "",
      notes: "",
      ...point(e),
    };
    onChange({ ...value, pins: [...value.pins, p] });
    setSelected(p.id);
  }
  function change(payload) {
    onChange({
      ...value,
      pins: value.pins.map((p) =>
        p.id === selected ? { ...p, ...payload } : p,
      ),
    });
  }
  const sorted = value.pins.map((p, i) => ({ ...p, index: i }));
  return (
    <div className="creative-editor-grid">
      <div>
        <div className="creative-toolbar">
          <label>
            Actual course image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
            />
          </label>
          <label>
            Pin type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {PIN_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <p>
          Click the map to add the selected activity. Drag a pin to place it.
          Hole labels stay editable.
        </p>
        <div
          ref={canvas}
          className="course-map-canvas"
          onClick={add}
          onPointerMove={(e) => {
            if (drag.current)
              onChange({
                ...value,
                pins: value.pins.map((p) =>
                  p.id === drag.current ? { ...p, ...point(e) } : p,
                ),
              });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {value.image ? (
            <img src={value.image} alt="Venue course map" draggable="false" />
          ) : (
            <div className="creative-empty">
              Upload the venue’s actual course map to begin placing activities.
            </div>
          )}
          {sorted.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-label={`${p.type}: ${p.label}`}
              className={"course-pin " + (selected === p.id ? "selected" : "")}
              style={{ left: p.x + "%", top: p.y + "%" }}
              onClick={(e) => {
                e.stopPropagation();
                setSelected(p.id);
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                suppressClick.current = true;
                drag.current = p.id;
                setSelected(p.id);
                canvas.current.setPointerCapture(e.pointerId);
              }}
              onKeyDown={(e) => {
                const keys = {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                };
                if (keys[e.key]) {
                  e.preventDefault();
                  const [dx, dy] = keys[e.key];
                  onChange({
                    ...value,
                    pins: value.pins.map((v) =>
                      v.id === p.id
                        ? {
                            ...v,
                            x: Math.max(0, Math.min(100, v.x + dx)),
                            y: Math.max(0, Math.min(100, v.y + dy)),
                          }
                        : v,
                    ),
                  });
                }
              }}
            >
              {p.index + 1}
            </button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
      <aside className="creative-inspector">
        <h3>Course activities</h3>
        <label>
          Select activity
          <select
            value={selected || ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a pin</option>
            {value.pins.map((p, i) => (
              <option key={p.id} value={p.id}>
                {i + 1}. {p.label || p.type}
              </option>
            ))}
          </select>
        </label>
        {pin && (
          <>
            <label>
              Type
              <select
                value={pin.type}
                onChange={(e) => change({ type: e.target.value })}
              >
                {PIN_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Activity / vendor label
              <input
                value={pin.label}
                maxLength="120"
                onChange={(e) => change({ label: e.target.value })}
              />
            </label>
            <label>
              Hole / area
              <input
                value={pin.hole}
                maxLength="20"
                onChange={(e) => change({ hole: e.target.value })}
              />
            </label>
            <label>
              Activity notes
              <textarea
                value={pin.notes}
                maxLength="500"
                onChange={(e) => change({ notes: e.target.value })}
              />
            </label>
            <div className="form-grid two">
              {["x", "y"].map((key) => (
                <label key={key}>
                  {key.toUpperCase()} (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step=".1"
                    value={Math.round(pin[key] * 10) / 10}
                    onChange={(e) =>
                      change({
                        [key]: Math.max(
                          0,
                          Math.min(100, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onChange({
                  ...value,
                  pins: value.pins.filter((p) => p.id !== selected),
                });
                setSelected(null);
              }}
            >
              Remove activity
            </button>
          </>
        )}
        <p>
          These pin numbers and their activity notes appear together in the
          event packet.
        </p>
      </aside>
    </div>
  );
}

function RentalPlanner({ value, event, onChange }) {
  const frame = useRef(null),
    initial = useRef(value),
    callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    function receive(e) {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "chgc-layout-ready")
        frame.current.contentWindow.postMessage(
          {
            type: "chgc-layout-load",
            state: initial.current,
            event: {
              customerName: event.name,
              eventDate: event.event_dates?.[0] || "",
              guestCount: String(event.field_settings?.max_golfers || ""),
              eventType: "Event",
            },
          },
          "*",
        );
      if (e.data?.type === "chgc-layout-changed") {
        try {
          callback.current(sanitizeLayouts(e.data.state));
        } catch {}
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [event.id]);
  return (
    <>
      <p>
        CHGC’s existing rental planner. The tent is 40 × 60 ft. Other dimensions
        remain labeled as placeholders until verified. Save the packet to retain
        changes with this event.
      </p>
      <iframe
        ref={frame}
        title="CHGC interactive rental space planner"
        src="/chgc-layout-planner.html"
        sandbox="allow-scripts allow-downloads allow-modals"
        className="rental-planner-frame"
      />
    </>
  );
}

function Itinerary({ value, onChange, event }) {
  const [search, setSearch] = useState(""),
    [ascending, setAscending] = useState(true),
    [sort, setSort] = useState("time");
  const rows = value
    .filter((r) =>
      [r.activity, r.location, r.owner, r.notes, r.date, r.start]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .map((r, index) => ({ r, index }))
    .sort((a, b) => {
      const av = sort === "time" ? a.r.date + a.r.start : a.r[sort],
        bv = sort === "time" ? b.r.date + b.r.start : b.r[sort];
      return (
        String(av).localeCompare(String(bv), undefined, {
          sensitivity: "base",
        }) * (ascending ? 1 : -1) || a.index - b.index
      );
    });
  function update(id, key, data) {
    onChange(value.map((r) => (r.id === id ? { ...r, [key]: data } : r)));
  }
  function heading(key, label) {
    return (
      <th
        aria-sort={
          sort === key ? (ascending ? "ascending" : "descending") : "none"
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
    );
  }
  return (
    <>
      <div className="creative-toolbar">
        <label>
          Search itinerary
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Activity, location or person"
          />
        </label>
        <button
          type="button"
          disabled={value.length >= 150}
          onClick={() =>
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                date: event.event_dates?.[0] || "",
                start: "",
                end: "",
                activity: "",
                location: "",
                owner: "",
                notes: "",
              },
            ])
          }
        >
          + Itinerary item
        </button>
      </div>
      <p>
        Venue local time. Setup, arrivals, meals, contests, awards and cleanup
        can each have a responsible person.
      </p>
      <div className="creative-table-wrap">
        <table>
          <thead>
            <tr>
              {heading("time", "Date / time")}
              {heading("activity", "Activity")}
              {heading("location", "Location")}
              {heading("owner", "Responsible person")}
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r }) => (
              <tr key={r.id}>
                <td>
                  <input
                    aria-label="Itinerary date"
                    type="date"
                    value={r.date}
                    onChange={(e) => update(r.id, "date", e.target.value)}
                  />
                  <input
                    aria-label="Start time"
                    type="time"
                    value={r.start}
                    onChange={(e) => update(r.id, "start", e.target.value)}
                  />
                  <input
                    aria-label="End time"
                    type="time"
                    value={r.end}
                    onChange={(e) => update(r.id, "end", e.target.value)}
                  />
                </td>
                {[
                  ["activity", "Activity"],
                  ["location", "Location"],
                  ["owner", "Responsible person"],
                  ["notes", "Notes"],
                ].map(([key, label]) => (
                  <td key={key}>
                    <textarea
                      aria-label={label}
                      value={r[key]}
                      maxLength={key === "notes" ? 1000 : 200}
                      onChange={(e) => update(r.id, key, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(value.filter((row) => row.id !== r.id))
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
      {!rows.length && (
        <p>
          {value.length
            ? "No itinerary items match your search."
            : "Add the first itinerary item."}
        </p>
      )}
    </>
  );
}

export default function EventPacketStudio({
  event,
  initialTab = "flyer",
  read = readAssets,
  save = saveAssets,
  quote = readQuote,
  onDirtyChange,
  onOpenDesign,
}) {
  const [data, setData] = useState(null),
    [version, setVersion] = useState(0),
    [tab, setTab] = useState(initialTab === "sponsors" ? "sponsors" : "flyer"),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [bookingQuote, setBookingQuote] = useState(null),
    [quoteError, setQuoteError] = useState("");
  const inflight = useRef(false),
    revision = useRef(0);
  const facts = eventFlyerFacts(event, window.location.origin);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setData(null);
    read(event.id)
      .then((row) => {
        if (cancelled) return;
        setData(sanitizePacket(row?.data || { flyer: newFlyer() }));
        setVersion(row?.version || 0);
        setDirty(false);
        setError("");
      })
      .catch((problem) => {
        if (!cancelled)
          setError(problem.message || "Unable to load the event packet.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, read]);
  useEffect(() => {
    const prevent = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    let cancelled = false;
    setBookingQuote(null);
    setQuoteError("");
    if (!event.field_settings?.venue_booking_request_id) return;
    quote(event.id)
      .then((value) => {
        if (!cancelled) setBookingQuote(value);
      })
      .catch((e) => {
        if (!cancelled) setQuoteError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, quote]);
  function change(key, value) {
    revision.current++;
    setData((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setNotice("");
  }
  async function persist() {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    const started = revision.current;
    try {
      const safe = sanitizePacket(data);
      const linkProblem =
        creativeLinkProblem(safe.link, 240, 300) ||
        (safe.flyer &&
          creativeLinkProblem(
            safe.flyer.link,
            safe.flyer.width,
            safe.flyer.height,
          ));
      if (linkProblem) throw new Error(linkProblem);
      if (
        safe.itinerary.some(
          (r) =>
            !r.activity.trim() ||
            !r.date ||
            !r.start ||
            (r.end && r.end < r.start),
        )
      )
        throw new Error(
          "Each itinerary item needs a date, start time and activity; end time must follow start time.",
        );
      const row = await save(event.id, version, safe);
      setVersion(row.version);
      if (started === revision.current) setDirty(false);
      setNotice("Event packet saved. Version " + row.version + ".");
    } catch (problem) {
      setError(problem.message || "Unable to save the event packet.");
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  function exportPacket() {
    const html = packetHtml(event, data, window.location.origin).replace(
      "</body>",
      sponsorPacketSection(data.sponsors) +
        materialsPacketSection(data.materials) +
        designPacketSection(data.designs) +
        "</body>",
    );
    downloadCreative(html, "Event-Packet.html", "text/html");
  }
  return (
    <section
      className="builder-working-panel"
      aria-label="Event creative and packet studio"
    >
      <div className="platform-section-heading">
        <div>
          <p className="platform-eyebrow">
            Event Builder · Creative & Operations
          </p>
          <h2>Flyer, layouts & event packet</h2>
          {onOpenDesign && (
            <button
              type="button"
              className="platform-secondary-button"
              disabled={busy}
              onClick={() => onOpenDesign(event)}
            >
              Open InceptionApex
            </button>
          )}
        </div>
        <button
          type="button"
          className="platform-primary-button"
          disabled={busy || !data || !dirty}
          onClick={persist}
        >
          {busy ? "Working…" : "Save event packet"}
        </button>
      </div>
      <p role="status">
        {dirty
          ? "Unsaved changes"
          : version
            ? "Saved · Version " + version
            : "No saved packet yet"}
      </p>
      {error && (
        <div role="alert" className="platform-error">
          {error}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!data && busy && <p>Loading event packet…</p>}
      {data && (
        <>
          <nav className="creative-tabs" aria-label="Event packet sections">
            {[
              ["flyer", "Flyer maker"],
              ["map", "Course games & vendors"],
              ["layouts", "Buildings & tents"],
              ["itinerary", "Itinerary"],
              ["sponsors", "Sponsor builder"],
              ["materials", "Invitations & signs"],
              ["packet", "Packet export"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab !== "flyer" && (
            <CreativeLinkControls
              value={data.link}
              width={240}
              height={300}
              placement={false}
              suggestedLink={facts.registration}
              onChange={(link) => change("link", link)}
              note="This link and QR appear beside course maps, venue layouts and itinerary sections in the printable event packet. Individual approved artwork keeps its own link."
            />
          )}
          {tab === "flyer" && (
            <FlyerEditor
              design={data.flyer || newFlyer()}
              facts={facts}
              onChange={(v) => change("flyer", v)}
            />
          )}
          {tab === "map" && (
            <CourseMap value={data.map} onChange={(v) => change("map", v)} />
          )}
          {tab === "layouts" && (
            <RentalPlanner
              key={event.id}
              event={event}
              value={data.layouts}
              onChange={(v) => change("layouts", v)}
            />
          )}
          {tab === "itinerary" && (
            <Itinerary
              value={data.itinerary}
              onChange={(v) => change("itinerary", v)}
              event={event}
            />
          )}
          {tab === "sponsors" && (
            <SponsorBuilder
              value={data.sponsors}
              onChange={(v) => change("sponsors", v)}
              onMapPin={(pin) => {
                if (data.map.pins.length >= 150) {
                  setError(
                    "The course map already has 150 pins. Remove a pin first.",
                  );
                  return;
                }
                change("map", { ...data.map, pins: [...data.map.pins, pin] });
                setTab("map");
                setNotice(
                  "Sponsor pin added. Place it on the actual course image, then save the packet.",
                );
              }}
            />
          )}
          {tab === "materials" && (
            <EventMaterials
              value={data.materials}
              onChange={(v) => change("materials", v)}
              event={event}
            />
          )}
          {tab === "packet" && (
            <div>
              <h3>Event packet</h3>
              {bookingQuote && (
                <div className="builder-action-box">
                  <h4>Booking costs</h4>
                  <p>
                    Venue-approved quote: $
                    {Number(bookingQuote.estimate.total).toFixed(2)} · Booking
                    deposit: ${Number(bookingQuote.deposit_amount).toFixed(2)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCreative(
                        estimateHtml(
                          bookingQuote.estimate,
                          event.name,
                          !!bookingQuote.approved_at,
                        ),
                        "Event-Cost-Estimate.html",
                        "text/html",
                      )
                    }
                  >
                    Download booking cost estimate / Save PDF
                  </button>
                </div>
              )}
              {quoteError && (
                <p role="alert">Unable to load booking costs: {quoteError}</p>
              )}
              <p>
                The packet includes the event facts, flyer, course activity map
                and legend, each building/tent layout, and the dated itinerary.
              </p>
              <ul>
                <li>
                  Flyer:{" "}
                  {data.flyer
                    ? data.flyer.boxes.length + " text boxes"
                    : "Not started"}
                </li>
                <li>Course map: {data.map.pins.length} activities</li>
                <li>
                  Rental layouts: {data.layouts?.spaces.length || 0} areas
                </li>
                <li>Itinerary: {data.itinerary.length} items</li>
                <li>
                  Sponsors: {data.sponsors.sales.length} sales / commitments
                </li>
                <li>Materials: {data.materials.length} requests</li>
                <li>Approved designs: {data.designs.length} snapshots</li>
              </ul>
              {dirty && (
                <p>Save changes before exporting the event’s final packet.</p>
              )}
              {data.flyer && flyerOverflow(data.flyer, facts).length > 0 && (
                <p role="alert">
                  Some flyer text needs more room. Adjust the flyer before
                  exporting.
                </p>
              )}
              <div className="creative-toolbar">
                <button
                  type="button"
                  disabled={
                    dirty ||
                    busy ||
                    !!creativeLinkProblem(data.link, 240, 300) ||
                    !!(
                      data.flyer &&
                      creativeLinkProblem(
                        data.flyer.link,
                        data.flyer.width,
                        data.flyer.height,
                      )
                    ) ||
                    (data.flyer && flyerOverflow(data.flyer, facts).length > 0)
                  }
                  onClick={exportPacket}
                >
                  Download printable packet / Save PDF
                </button>
                <button
                  type="button"
                  disabled={dirty || busy}
                  onClick={() =>
                    downloadCreative(
                      JSON.stringify(
                        {
                          version: 1,
                          event_id: event.id,
                          assets: sanitizePacket(data),
                        },
                        null,
                        2,
                      ),
                      "Event-Packet-Data.json",
                      "application/json",
                    )
                  }
                >
                  Download packet data
                </button>
              </div>
              <p>
                Open the printable packet and select Print / Save PDF. Draft
                events remain visibly marked. Downloading creates a copy; it
                does not publish the event.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

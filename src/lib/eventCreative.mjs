import { sanitizeSponsorPlan } from "./sponsorPlan.mjs";
export const escapeMarkup = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const text = (value, max = 200) => String(value ?? "").slice(0, max);
const number = (value, min, max, fallback = min) =>
  Number.isFinite(Number(value))
    ? Math.max(min, Math.min(max, Number(value)))
    : fallback;
const color = (value) =>
  /^#[a-f\d]{6}$/i.test(value || "") ? value : "#ffffff";
export const FLYER_FIELDS = [
  "name",
  "date",
  "time",
  "venue",
  "address",
  "description",
  "food",
  "prizes",
  "contact",
  "registration",
  "custom",
];
export const PIN_TYPES = [
  "Closest to pin",
  "Long drive",
  "Pot of gold",
  "Course game",
  "Vendor tent",
  "Sponsor",
  "Check-in",
  "Food / beverage",
  "Parking",
  "First aid",
  "Other",
];

export function eventFlyerFacts(event, origin = "") {
  const s = event.field_settings || {};
  const dates = (
    Array.isArray(event.event_dates) ? event.event_dates : []
  ).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const formatDate = (d) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  const rawTime = s.event_start_time || "";
  const time = /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime)
    ? new Date("2000-01-01T" + rawTime + "Z").toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "";
  let base;
  try {
    const url = new URL(origin);
    if (["https:", "http:"].includes(url.protocol)) base = url.origin;
  } catch {}
  const registration =
    base && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(event.public_slug || "")
      ? base + "/events/" + event.public_slug
      : "";
  return {
    name: text(event.name),
    date: dates.map(formatDate).join(" – "),
    time,
    venue: text(event.course),
    address: text(s.hub_venue_address),
    description: text(s.hub_description, 1500),
    food: text(s.hub_food_beverage, 500),
    prizes: text(s.hub_gifts_prizes, 500),
    contact: [
      s.registration_contact_name,
      s.registration_contact_email,
      s.registration_contact_phone,
    ]
      .filter(Boolean)
      .map((v) => text(v))
      .join(" · "),
    registration,
    status: event.status,
    id: event.id,
  };
}

export function newFlyer(theme = "classic") {
  const palettes = {
    classic: ["#10213b", "#ffffff", "#e02f41"],
    fairway: ["#123a2b", "#ffffff", "#bada91"],
    celebration: ["#302448", "#fff2da", "#eeaa55"],
  };
  const p = palettes[theme] || palettes.classic;
  const box = (id, source, x, y, width, height, fontSize, ink = p[1]) => ({
    id,
    source,
    x,
    y,
    width,
    height,
    fontSize,
    color: ink,
    align: "left",
    bold: source === "name",
    text: "",
  });
  return {
    version: 1,
    name: "Event flyer",
    width: 850,
    height: 1100,
    background: p[0],
    accent: p[2],
    boxes: [
      box("title", "name", 65, 90, 720, 210, 64),
      box("date", "date", 65, 335, 720, 80, 32, p[2]),
      box("time", "time", 65, 418, 720, 55, 28),
      box("venue", "venue", 65, 500, 720, 85, 38),
      box("address", "address", 65, 585, 720, 70, 21),
      box("description", "description", 65, 680, 720, 170, 25),
      box("registration", "registration", 65, 900, 720, 80, 20),
      box("contact", "contact", 65, 1000, 720, 55, 18),
    ],
  };
}

export function sanitizeFlyer(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.boxes) ||
    value.boxes.length > 40
  )
    throw new Error("Choose a valid flyer template (up to 40 text boxes).");
  const width = number(value.width, 300, 2400, 850),
    height = number(value.height, 300, 3000, 1100);
  return {
    version: 1,
    name: text(value.name, 80),
    width,
    height,
    background: color(value.background),
    backgroundImage: safeMapImage(value.backgroundImage),
    accent: color(value.accent),
    images: (Array.isArray(value.images) ? value.images : [])
      .slice(0, 12)
      .map((image, i) => {
        const x = number(image.x, 0, width - 30),
          y = number(image.y, 0, height - 30);
        return {
          id: "image-" + i,
          src: safeMapImage(image.src),
          label: text(image.label, 120),
          x,
          y,
          width: number(image.width, 30, width - x),
          height: number(image.height, 30, height - y),
        };
      })
      .filter((image) => image.src),
    boxes: value.boxes.map((b, i) => {
      const x = number(b.x, 0, width - 30),
        y = number(b.y, 0, height - 30);
      return {
        id: "box-" + i,
        source: FLYER_FIELDS.includes(b.source) ? b.source : "custom",
        text: text(b.text, 1500),
        x,
        y,
        width: number(b.width, 30, width - x),
        height: number(b.height, 30, height - y),
        fontSize: number(b.fontSize, 8, 160, 24),
        color: color(b.color),
        align: ["left", "center", "right"].includes(b.align) ? b.align : "left",
        bold: b.bold === true,
      };
    }),
  };
}

export function flyerTemplate(design) {
  const safe = sanitizeFlyer(design);
  // Bound boxes carry their source names, not another event's facts.
  return {
    ...safe,
    boxes: safe.boxes.map((b) => ({
      ...b,
      text: b.source === "custom" ? b.text : "",
    })),
  };
}

export function wrapText(value, box) {
  const max = Math.max(1, Math.floor(box.width / (box.fontSize * 0.57)));
  const lines = [];
  String(value)
    .split("\n")
    .forEach((paragraph) => {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if ((line + " " + word).trim().length > max && line) {
          lines.push(line);
          line = "";
        }
        if (word.length > max) {
          if (line) {
            lines.push(line);
            line = "";
          }
          for (let i = 0; i < word.length; i += max) {
            const part = word.slice(i, i + max);
            if (i + max < word.length) lines.push(part);
            else line = part;
          }
        } else line = (line + " " + word).trim();
      }
      lines.push(line);
    });
  return lines;
}

export function flyerOverflow(design, facts) {
  return design.boxes.filter(
    (b) =>
      wrapText(b.source === "custom" ? b.text : facts[b.source] || "", b)
        .length *
        b.fontSize *
        1.2 >
      b.height,
  );
}

export function flyerSvg(
  design,
  facts,
  draftLabel = facts.status !== "published"
    ? "DRAFT · EVENT NOT PUBLISHED"
    : "",
) {
  const d = sanitizeFlyer(design);
  const boxes = d.boxes
    .map((b) => {
      const value = b.source === "custom" ? b.text : facts[b.source] || "";
      const x =
        b.align === "center"
          ? b.x + b.width / 2
          : b.align === "right"
            ? b.x + b.width
            : b.x;
      const anchor = { left: "start", center: "middle", right: "end" }[b.align];
      return `<text font-family="Arial,sans-serif" font-size="${b.fontSize}" font-weight="${b.bold ? "700" : "400"}" fill="${b.color}" text-anchor="${anchor}">${wrapText(
        value,
        b,
      )
        .map(
          (line, i) =>
            `<tspan x="${x}" y="${b.y + b.fontSize + i * b.fontSize * 1.2}">${escapeMarkup(line)}</tspan>`,
        )
        .join("")}</text>`;
    })
    .join("");
  const images = d.images
    .map(
      (image) =>
        `<image href="${image.src}" x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" preserveAspectRatio="xMidYMid meet"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.width} ${d.height}" width="${d.width}" height="${d.height}"><rect width="100%" height="100%" fill="${d.background}"/>${d.backgroundImage ? `<image href="${d.backgroundImage}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>` : ""}<rect x="0" y="0" width="100%" height="24" fill="${d.accent}"/>${images}${boxes}${draftLabel ? '<text x="35" y="60" font-family="Arial" font-size="20" fill="#ffffff">' + escapeMarkup(draftLabel) + "</text>" : ""}</svg>`;
}

export function safeMapImage(value) {
  return /^data:image\/(png|jpeg|webp);base64,[a-zA-Z\d+/=]+$/.test(
    value || "",
  ) && value.length < 4500000
    ? value
    : "";
}

export function sanitizeMap(value = {}) {
  return {
    image: safeMapImage(value.image),
    pins: (Array.isArray(value.pins) ? value.pins : [])
      .slice(0, 150)
      .map((pin, i) => ({
        id: "pin-" + i,
        type: PIN_TYPES.includes(pin.type) ? pin.type : "Other",
        label: text(pin.label, 120),
        hole: text(pin.hole, 20),
        notes: text(pin.notes, 500),
        x: number(pin.x, 0, 100),
        y: number(pin.y, 0, 100),
      })),
  };
}

export function sanitizeLayouts(value) {
  if (!value || !Array.isArray(value.spaces) || value.spaces.length > 15)
    throw new Error("Invalid rental layout.");
  const ids = new Set();
  const spaces = value.spaces.map((s, i) => {
    const id =
      /^[a-zA-Z\d_-]{1,60}$/.test(s.id || "") && !ids.has(s.id)
        ? s.id
        : "area-" + i;
    ids.add(id);
    const width = number(s.width, 1, 1000, 40),
      length = number(s.length, 1, 1000, 60);
    return {
      id,
      name: text(s.name, 120),
      width,
      length,
      notes: text(s.notes, 1500),
      items: (Array.isArray(s.items) ? s.items : [])
        .slice(0, 300)
        .map((item, j) => ({
          id: "item-" + j,
          label: text(item.label, 120),
          w: number(item.w, 1, 200, 8),
          d: number(item.d, 1, 200, 4),
          x: number(item.x, 0, width),
          y: number(item.y, 0, length),
          rot: number(item.rot, 0, 360),
          seats: number(item.seats, 0, 100, 0),
          table: item.table === true,
          tableW: number(item.tableW, 1, 200, 8),
          tableD: number(item.tableD, 1, 200, 2.5),
          kind: [
            "round",
            "rectTable",
            "dance",
            "bar",
            "dj",
            "stage",
            "ceremony",
            "marker",
            "custom",
          ].includes(item.kind)
            ? item.kind
            : "custom",
        })),
    };
  });
  return {
    active: spaces.some((s) => s.id === value.active)
      ? value.active
      : spaces[0]?.id,
    event: {
      customerName: text(value.event?.customerName),
      eventDate: text(value.event?.eventDate, 10),
      guestCount: text(value.event?.guestCount, 10),
      eventType: text(value.event?.eventType),
      customerNotes: text(value.event?.customerNotes, 1500),
    },
    spaces,
  };
}

export function layoutSvg(raw) {
  const space = sanitizeLayouts({ spaces: [raw] }).spaces[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${space.width + 4} ${space.length + 4}" role="img"><defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#ccd5e0" stroke-width=".08"/></pattern></defs><rect width="${space.width}" height="${space.length}" fill="#fff" stroke="#14213b" stroke-width=".2"/><rect width="${space.width}" height="${space.length}" fill="url(#grid)"/>${space.items.map((i) => `<g transform="translate(${i.x} ${i.y}) rotate(${i.rot})">${i.kind === "round" ? `<ellipse rx="${i.w / 2}" ry="${i.d / 2}" fill="#ecf0f6" stroke="#264566" stroke-width=".1"/>` : `<rect x="${-i.w / 2}" y="${-i.d / 2}" width="${i.w}" height="${i.d}" fill="#ecf0f6" stroke="#264566" stroke-width=".1"/>`}<text text-anchor="middle" font-family="Arial" font-size="${Math.min(1.1, i.w / 12)}">${escapeMarkup(i.label)}</text></g>`).join("")}</svg>`;
}

export function sanitizeItinerary(rows) {
  return (Array.isArray(rows) ? rows : []).slice(0, 150).map((row, i) => ({
    id: "schedule-" + i,
    date: /^\d{4}-\d{2}-\d{2}$/.test(row.date || "") ? row.date : "",
    start: /^\d{2}:\d{2}$/.test(row.start || "") ? row.start : "",
    end: /^\d{2}:\d{2}$/.test(row.end || "") ? row.end : "",
    activity: text(row.activity, 200),
    location: text(row.location, 120),
    owner: text(row.owner, 120),
    notes: text(row.notes, 1000),
  }));
}

export function sanitizePacket(data = {}) {
  return {
    flyer: data.flyer ? sanitizeFlyer(data.flyer) : null,
    map: sanitizeMap(data.map),
    layouts: data.layouts ? sanitizeLayouts(data.layouts) : null,
    itinerary: sanitizeItinerary(data.itinerary),
    sponsors: sanitizeSponsorPlan(data.sponsors),
    materials: sanitizeMaterials(data.materials),
    designs: (Array.isArray(data.designs) ? data.designs : [])
      .slice(0, 30)
      .map((d) => ({
        project_id: text(d.project_id, 80),
        version: number(d.version, 1, 1000000, 1),
        name: text(d.name, 160),
        material: text(d.material, 40),
        approved_at: text(d.approved_at, 80),
        design: sanitizeFlyer(d.design),
        facts: Object.fromEntries(
          FLYER_FIELDS.filter((k) => k !== "custom").map((k) => [
            k,
            text(d.facts?.[k], 1500),
          ]),
        ),
      })),
  };
}

export function designPacketSection(designs = []) {
  return sanitizePacket({ designs })
    .designs.map(
      (d) =>
        "<section><h2>" +
        escapeMarkup(d.name) +
        "</h2><p>Approved InceptionApex artwork · Version " +
        d.version +
        " · " +
        escapeMarkup(d.material) +
        "</p>" +
        flyerSvg(d.design, d.facts, "") +
        "</section>",
    )
    .join("");
}

export function sanitizeMaterials(rows) {
  return (Array.isArray(rows) ? rows : []).slice(0, 100).map((r, i) => ({
    id: /^[a-zA-Z\d_-]{1,80}$/.test(r.id || "") ? r.id : "material-" + i,
    type: [
      "Invitation",
      "Tee sign",
      "Banner",
      "Event program",
      "Digital sign",
      "Apparel / swag",
      "Other",
    ].includes(r.type)
      ? r.type
      : "Other",
    quantity: number(r.quantity, 1, 100000, 1),
    size: text(r.size, 100),
    wording: text(r.wording, 1500),
    artwork_url: publicArtworkUrl(r.artwork_url),
    proof_approved: r.proof_approved === true,
    needed_by: /^\d{4}-\d{2}-\d{2}$/.test(r.needed_by || "") ? r.needed_by : "",
    department: ["InceptionApex", "Signage", "EIC", "Impactertising"].includes(
      r.department,
    )
      ? r.department
      : "EIC",
    notes: text(r.notes, 1000),
  }));
}
function publicArtworkUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
export function orderingHandoff(event, data, origin = "") {
  return {
    schema_version: 1,
    source_app: "eie",
    source_module: "event_builder",
    organization_id: event.organization_id,
    master_event_id: event.master_event_id,
    event_id: event.id,
    event_facts: eventFlyerFacts(event, origin),
    order_status: "draft_request",
    items: sanitizeMaterials(data.materials),
    sign_maker_source: "Event Builder sponsorship fulfillment",
    routing: {
      artwork: "InceptionApex",
      orders: "EIC",
      proof_approvals: "Squawk Box",
      signs: "Signage",
      paid_placements: "Impactertising",
    },
  };
}
export function sponsorPacketSection(plan) {
  const p = sanitizeSponsorPlan(plan);
  return (
    "<section><h2>Sponsors & fulfillment</h2>" +
    p.sales
      .map(
        (s) =>
          `<h3>${escapeMarkup(s.buyer)} · ${escapeMarkup(s.offer_name)}</h3><p>${s.quantity} × $${s.unit_price.toFixed(2)} · ${s.paid ? "Payment manually recorded received" : "Payment pending"}</p><ul>${s.fulfillment.map((f) => `<li>${escapeMarkup(f.name)} · ${escapeMarkup(f.location || "Placement pending")} · ${escapeMarkup(f.size)} · Due ${escapeMarkup(f.due_date || "TBD")}<br>Logo ${f.logo_received ? "received" : "pending"} · Artwork ${f.artwork_approved ? "approved" : "pending"} · Produced ${f.produced ? "yes" : "no"} · Complete ${f.completed ? "yes" : "no"}<br>${escapeMarkup(f.wording)}</li>`).join("")}</ul>`,
      )
      .join("") +
    "</section>"
  );
}

export function packetHtml(event, data, origin = "") {
  const facts = eventFlyerFacts(event, origin),
    safe = sanitizePacket(data),
    rows = [...safe.itinerary].sort((a, b) =>
      (a.date + a.start).localeCompare(b.date + b.start),
    );
  const map = safe.map;
  return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeMarkup(facts.name)} · Event packet</title><style>body{font:14px Arial;color:#14213b;max-width:1000px;margin:30px auto;padding:20px}h1{font-size:32px}section{break-before:page;margin:35px 0}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #ccd5e0;text-align:left;vertical-align:top;white-space:pre-wrap}svg{max-width:100%;max-height:850px}li{margin:12px 0}.map{position:relative}.map img{width:100%}.pin{position:absolute;transform:translate(-50%,-50%);border-radius:50%;background:#e02f41;color:white;font-weight:bold;padding:7px} @media print{button{display:none}@page{margin:.5in}}</style></head><body><button onclick="window.print()">Print / Save PDF</button><h1>${escapeMarkup(facts.name)}</h1><p>${facts.status === "published" ? "Published event" : "DRAFT · Event not published"} · Packet generated ${escapeMarkup(new Date().toLocaleString())}</p><p>${escapeMarkup([facts.date, facts.time, facts.venue, facts.address].filter(Boolean).join(" · "))}</p><p>Saved event ID: ${escapeMarkup(facts.id)}</p>${safe.flyer ? `<section><h2>Event flyer</h2>${flyerSvg(safe.flyer, facts)}</section>` : ""}<section><h2>Course activities & vendor map</h2>${map.image ? `<div class="map"><img alt="Venue course map" src="${map.image}"/>${map.pins.map((p, i) => `<span class="pin" style="left:${p.x}%;top:${p.y}%">${i + 1}</span>`).join("")}</div>` : "<p>Course image has not been added.</p>"}<ol>${map.pins.map((p) => `<li><strong>${escapeMarkup(p.label || p.type)}</strong> · ${escapeMarkup(p.type)} ${p.hole ? "· Hole " + escapeMarkup(p.hole) : ""}<br>${escapeMarkup(p.notes)}</li>`).join("")}</ol></section>${safe.layouts ? safe.layouts.spaces.map((s) => `<section><h2>${escapeMarkup(s.name)} · ${s.width} × ${s.length} ft</h2><p>${escapeMarkup(s.notes)}</p>${layoutSvg(s)}<p>${s.items.reduce((sum, i) => sum + i.seats, 0)} seats · ${s.items.length} items</p><ul>${s.items.map((i) => `<li>${escapeMarkup(i.label)} · ${i.w} × ${i.d} ft · ${i.seats} seats</li>`).join("")}</ul></section>`).join("") : ""}<section><h2>Itinerary · Venue local time</h2><table><thead><tr><th>Date / time</th><th>Activity</th><th>Location</th><th>Responsible person</th><th>Notes</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeMarkup(r.date)}<br>${escapeMarkup(r.start)}${r.end ? " – " + escapeMarkup(r.end) : ""}</td><td>${escapeMarkup(r.activity)}</td><td>${escapeMarkup(r.location)}</td><td>${escapeMarkup(r.owner)}</td><td>${escapeMarkup(r.notes)}</td></tr>`).join("")}</tbody></table></section></body></html>`;
}

export function creativeBrief(facts) {
  return (
    "Create visual concepts for this event flyer. Leave room for the editable text boxes. Preserve all supplied event facts exactly; do not invent prices, dates, sponsors or event promises.\n\n" +
    [
      "name",
      "date",
      "time",
      "venue",
      "address",
      "description",
      "food",
      "prizes",
      "contact",
      "registration",
    ]
      .map((k) => k + ": " + (facts[k] || "Not supplied"))
      .join("\n")
  );
}

export function materialsPacketSection(rows) {
  return (
    "<section><h2>Invitations, signs & materials</h2><p>Draft production requests; orders have not been placed.</p><table><thead><tr><th>Material / specifications</th><th>Quantity</th><th>Wording</th><th>Needed by / next department</th><th>Proof</th></tr></thead><tbody>" +
    sanitizeMaterials(rows)
      .map(
        (r) =>
          `<tr><td>${escapeMarkup(r.type)}<br>${escapeMarkup(r.size)}</td><td>${r.quantity}</td><td>${escapeMarkup(r.wording)}</td><td>${escapeMarkup(r.needed_by)}<br>${escapeMarkup(r.department)}</td><td>${r.proof_approved ? "Approved" : "Pending"}</td></tr>`,
      )
      .join("") +
    "</tbody></table></section>"
  );
}

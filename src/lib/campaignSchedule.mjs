export const MAX_CAMPAIGN_POSTS = 24;
export const CAMPAIGN_TEMPLATES = [
  {
    id: "countdown",
    name: "Event countdown",
    description: "Four reminders leading up to an event.",
    anchor: "Event date and posting time",
    offsets: [-14, -7, -1, 0],
    destinations: ["facebook", "instagram", "hub"],
  },
  {
    id: "spotlight",
    name: "Sponsor spotlight",
    description: "Introduce a sponsor, highlight their offer, and thank them.",
    anchor: "First post date and time",
    offsets: [0, 3, 7],
    destinations: ["facebook", "instagram", "website"],
  },
  {
    id: "weekly-deal",
    name: "Weekly business deal",
    description: "Four weekly posts for an approved offer.",
    anchor: "First post date and time",
    offsets: [0, 7, 14, 21],
    destinations: ["facebook", "instagram", "website"],
  },
  {
    id: "registration",
    name: "Registration reminders",
    description: "Three reminders before the registration deadline.",
    anchor: "Registration deadline and posting time",
    offsets: [-7, -3, -1],
    destinations: ["facebook", "instagram", "hub"],
  },
];

const stamp = (d) => d.toISOString().slice(0, 16);
export function shiftLocalDays(value, days) {
  const date = new Date(`${value}:00Z`);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Choose a valid anchor date and time.");
  date.setUTCDate(date.getUTCDate() + days);
  return stamp(date);
}
function localParts(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || ""))
    throw new Error("Use a complete date and time.");
  const ms = Date.parse(`${value}:00Z`);
  if (
    !Number.isFinite(ms) ||
    stamp(new Date(ms)) !== value ||
    Number(value.slice(0, 4)) < 2000 ||
    Number(value.slice(0, 4)) > 2100
  )
    throw new Error("Use a valid date between 2000 and 2100.");
  return ms;
}
export function validTimeZone(zone) {
  if (typeof zone !== "string" || !zone || zone.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
export function localInstant(value, zone) {
  const wall = localParts(value);
  if (!validTimeZone(zone))
    throw new Error("Choose a valid IANA time zone, such as America/New_York.");
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const wallAt = (ms) => {
    const p = Object.fromEntries(
      fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
    );
    return Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
  };
  const offsets = new Set();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = wall + hours * 3600000;
    offsets.add(wallAt(sample) - sample);
  }
  const candidates = [...offsets]
    .map((offset) => wall - offset)
    .filter((ms) => wallAt(ms) === wall);
  if (!candidates.length)
    throw new Error(
      "This local time does not exist because of a clock change. Choose another time.",
    );
  if (candidates.length > 1)
    throw new Error(
      "This local time occurs twice because of a clock change. Choose another time or use UTC.",
    );
  return new Date(candidates[0]).toISOString();
}
export function scheduleProblem(data, review = false) {
  const posts = data.posts || [];
  if (posts.length > MAX_CAMPAIGN_POSTS)
    return `Use no more than ${MAX_CAMPAIGN_POSTS} posts per campaign.`;
  if (!posts.length) return "";
  if (!validTimeZone(data.time_zone))
    return "Choose a valid campaign time zone.";
  let start, end;
  try {
    if (data.desired_at) start = localInstant(data.desired_at, data.time_zone);
    if (data.ends_at) end = localInstant(data.ends_at, data.time_zone);
  } catch (e) {
    return e.message;
  }
  if (start && end && end < start)
    return "Campaign end must be on or after its start.";
  if (review && (!start || !end))
    return "Set the campaign start and end before reviewing its schedule.";
  const ids = new Set();
  for (const [index, post] of posts.entries()) {
    const prefix = `Post ${index + 1}: `;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        post.id || "",
      ) ||
      ids.has(post.id.toLowerCase())
    )
      return prefix + "Use a unique post identifier.";
    ids.add(post.id.toLowerCase());
    if (
      !post.label?.trim() ||
      post.label.length > 160 ||
      typeof post.body !== "string" ||
      post.body.length > 2000
    )
      return (
        prefix + "Add a title and keep the message within 2,000 characters."
      );
    if (review && !post.body.trim())
      return prefix + "Add a message before review.";
    if (review && !post.local_at)
      return prefix + "Choose a posting date and time.";
    if (post.local_at) {
      try {
        const at = localInstant(post.local_at, data.time_zone);
        if ((start && at < start) || (end && at > end))
          return prefix + "Posting time must fall within the campaign dates.";
      } catch (e) {
        return prefix + e.message;
      }
    }
  }
  return "";
}
export function templatePlan(
  templateId,
  {
    subject,
    sponsor = "",
    offer = "",
    anchor,
    timeZone,
    link = "",
    eventId = null,
  },
) {
  const template = CAMPAIGN_TEMPLATES.find((t) => t.id === templateId);
  if (!template || !subject?.trim() || subject.trim().length > 160)
    throw new Error("Choose a template and add an event or business name.");
  localInstant(anchor, timeZone);
  const name = subject.trim(),
    partner = sponsor.trim();
  if (templateId === "spotlight" && !partner)
    throw new Error("Add the sponsor name for a sponsor spotlight.");
  if (templateId === "weekly-deal" && !offer.trim())
    throw new Error("Describe the approved offer for the weekly deal.");
  const messages = {
    countdown: [
      `Join us for ${name}. Explore the event and registration details.`,
      `${name} is one week away. Plan your visit and check the event details.`,
      `${name} is tomorrow. Check the event page for the latest information.`,
      `Today is ${name}! Check the event page for arrival details.`,
    ],
    spotlight: [
      `Meet ${partner}, supporting ${name}. Learn more about our sponsor.`,
      `${partner} supports ${name}.${offer.trim() ? " " + offer.trim() : ""} Visit the link to learn more.`,
      `Thank you to ${partner} for supporting ${name}.`,
    ],
    "weekly-deal": Array.from(
      { length: 4 },
      () =>
        `${name}: ${offer.trim()} Check the linked offer for dates, eligibility, and terms.`,
    ),
    registration: [
      `Registration for ${name} closes in one week. View the event details and register.`,
      `Three days remain before registration closes for ${name}. Check availability on the event page.`,
      `Registration for ${name} closes tomorrow. Check the event page for the exact deadline and availability.`,
    ],
  };
  const posts = template.offsets.map((days, i) => ({
    id: crypto.randomUUID(),
    label: `${template.name} · ${i + 1}`,
    local_at: shiftLocalDays(anchor, days),
    body: messages[templateId][i],
  }));
  const data = {
    template_id: template.id,
    headline: name,
    body: posts[0].body,
    sponsor: partner,
    link,
    cta: templateId === "registration" ? "View registration" : "Learn more",
    time_zone: timeZone,
    desired_at: posts[0].local_at,
    ends_at: posts.at(-1).local_at,
    destinations: [...template.destinations],
    posts,
  };
  const issue = scheduleProblem(data);
  if (issue) throw new Error(issue);
  return {
    name: `${name} · ${template.name}`.slice(0, 160),
    event_id: eventId,
    data,
  };
}
export function scheduleRows(
  campaigns,
  query = "",
  state = "all",
  month = "",
  field = "instant",
  ascending = true,
) {
  return campaigns
    .filter(
      (c) => c.status !== "archived" && (state === "all" || c.status === state),
    )
    .flatMap((c) =>
      (c.data.posts || [])
        .filter(
          (p) =>
            (!month || p.local_at.startsWith(month)) &&
            [c.name, p.label, p.body, c.data.sponsor, ...c.data.destinations]
              .join(" ")
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .map((p) => {
          let instant = "";
          try {
            instant = localInstant(p.local_at, c.data.time_zone);
          } catch {
            /* incomplete draft */
          }
          return {
            ...p,
            instant,
            campaign_id: c.id,
            campaign: c.name,
            sponsor: c.data.sponsor,
            zone: c.data.time_zone,
            destinations: c.data.destinations,
            status: c.status,
            version: c.version,
          };
        }),
    )
    .sort(
      (a, b) =>
        (ascending ? 1 : -1) *
          String(a[field] || "").localeCompare(
            String(b[field] || ""),
            undefined,
            { sensitivity: "base" },
          ) ||
        a.campaign_id.localeCompare(b.campaign_id) ||
        a.id.localeCompare(b.id),
    );
}
const icsEscape = (v) =>
  String(v || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
export function campaignCalendar(campaign) {
  if (!campaign.version || campaign.status !== "reviewed")
    throw new Error(
      "Save a reviewed campaign before downloading its calendar.",
    );
  const issue = scheduleProblem(campaign.data, true);
  if (issue || !campaign.data.posts.length)
    throw new Error(issue || "Add a posting plan first.");
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ElevationPilot//Campaign planning//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const p of campaign.data.posts)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${campaign.id}-${p.id}@elevationpilot`,
      `SEQUENCE:${campaign.version}`,
      `DTSTAMP:${now}`,
      `DTSTART:${localInstant(p.local_at, campaign.data.time_zone).replace(/[-:]/g, "").slice(0, 15)}Z`,
      `SUMMARY:${icsEscape(`${campaign.name}: ${p.label}`)}`,
      `DESCRIPTION:${icsEscape(`Manual posting plan. No automatic delivery.\nChannels: ${campaign.data.destinations.join(", ")}\n${p.body}\n${campaign.data.link}`)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  lines.push("END:VCALENDAR");
  // Fold at 75 UTF-8 octets without splitting a Unicode code point (RFC 5545).
  return (
    lines
      .flatMap((line) => {
        const chunks = [];
        let chunk = "",
          bytes = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (bytes + size > 75) {
            chunks.push(chunk);
            chunk = " ";
            bytes = 1;
          }
          chunk += char;
          bytes += size;
        }
        chunks.push(chunk);
        return chunks;
      })
      .join("\r\n") + "\r\n"
  );
}

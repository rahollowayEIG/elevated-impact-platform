// Shared campaign package planning for InceptionApex and the EIG Ad Network.
// Deliberately does not discover/scrape assets, charge customers, or publish placements.
export const CAMPAIGN_CHANNELS = Object.freeze([
  "hometown_magazine", "digital_signage", "social", "event_sponsorship",
  "website", "print_other"
]);

export const HOMETOWN_MAGAZINE_FORMATS = Object.freeze({
  front: { label: "Front page", widthIn: 7.875, heightIn: 8.75 },
  back: { label: "Back page", widthIn: 7.875, heightIn: 8 },
  full: { label: "Full page", widthIn: 7.875, heightIn: 9.3125 },
  half: { label: "Half page", widthIn: 7.875, heightIn: 4.8125 },
  third: { label: "Third page", widthIn: 7.875, heightIn: 3.125 },
  quarter_extended: { label: "Quarter extended", widthIn: 7.875, heightIn: 2.3125 },
  quarter_box: { label: "Quarter box", widthIn: 3.3125, heightIn: 4.3125 }
});

const str = (v, max = 200) => typeof v === "string" ? v.trim().slice(0, max) : "";
const money = (v) => Number.isInteger(v) && v >= 0 && v <= 1000000000 ? v : null;
const isId = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v);

export function cleanCampaignPackage(source = {}) {
  const s = source && typeof source === "object" ? source : {};
  return {
    id: str(s.id, 60),
    name: str(s.name),
    advertiser_hanger_id: str(s.advertiser_hanger_id, 60),
    owner_hanger_id: str(s.owner_hanger_id, 60),
    // Stored references ONLY. Permissions must be checked on the server.
    audience: s.audience === "eig" ? "eig" : "hanger",
    status: ["draft", "proposed", "approved", "active", "completed", "canceled"].includes(s.status)
      ? s.status : "draft",
    start_date: str(s.start_date, 10),
    end_date: str(s.end_date, 10),
    placements: (Array.isArray(s.placements) ? s.placements : []).slice(0, 100).map(p => ({
      id: str(p?.id, 60),
      channel: CAMPAIGN_CHANNELS.includes(p?.channel) ? p.channel : "",
      format: str(p?.format, 60),
      label: str(p?.label),
      inventory_id: str(p?.inventory_id, 80),
      creative_project_id: str(p?.creative_project_id, 60),
      // Prices are cents. Never infer inventory, rates or availability.
      price_cents: money(p?.price_cents),
      start_date: str(p?.start_date, 10),
      end_date: str(p?.end_date, 10),
      status: ["draft", "reserved", "approved", "delivered", "canceled"].includes(p?.status) ? p.status : "draft"
    })),
    // Bundle discount is separate to preserve line-item revenue attribution.
    discount_cents: money(s.discount_cents) ?? 0,
    trial: Boolean(s.trial),
    trial_terms: str(s.trial_terms, 1200),
    notes: str(s.notes, 1200)
  };
}

export function packageTotals(value) {
  const p = cleanCampaignPackage(value);
  const subtotal_cents = p.placements.filter(x => x.status !== "canceled")
    .reduce((sum, x) => sum + (x.price_cents ?? 0), 0);
  return {
    subtotal_cents,
    discount_cents: p.discount_cents,
    total_cents: Math.max(0, subtotal_cents - p.discount_cents),
    has_unpriced_items: p.placements.some(x => x.status !== "canceled" && x.price_cents === null)
  };
}

const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"))
  && new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;

export function packageProblem(value, forApproval = false) {
  const p = cleanCampaignPackage(value);
  if (!p.name) return "Enter a campaign package name.";
  if (!isId(p.advertiser_hanger_id)) return "Connect a valid advertiser Hanger.";
  if (!isId(p.owner_hanger_id)) return "Connect the Hanger that owns the campaign.";
  if (!p.placements.length) return "Add at least one placement.";
  if (p.start_date && !validDate(p.start_date)) return "Enter a valid campaign start date.";
  if (p.end_date && !validDate(p.end_date)) return "Enter a valid campaign end date.";
  if (p.start_date && p.end_date && p.start_date > p.end_date) return "Campaign ends before it starts.";
  const ids = new Set();
  for (const item of p.placements) {
    if (!item.id || ids.has(item.id)) return "Every placement needs a unique ID.";
    ids.add(item.id);
    if (!item.channel) return "Choose a supported channel for each placement.";
    if (item.channel === "hometown_magazine" && !HOMETOWN_MAGAZINE_FORMATS[item.format])
      return "Select a confirmed Hometown Magazine print format.";
    if (item.start_date && !validDate(item.start_date)) return "Invalid placement start date.";
    if (item.end_date && !validDate(item.end_date)) return "Invalid placement end date.";
    if (item.start_date && item.end_date && item.start_date > item.end_date)
      return "A placement ends before it starts.";
    if (forApproval && item.status !== "canceled" && item.price_cents === null)
      return "Set or explicitly comp every active placement before approval.";
  }
  const totals = packageTotals(p);
  if (p.discount_cents > totals.subtotal_cents) return "Discount exceeds the package subtotal.";
  if (forApproval && p.trial && !p.trial_terms) return "Set explicit terms for a trial campaign.";
  return "";
}

// AI discovery builds a suggested profile, not an approved brand asset.
// Shared with future venue onboarding. The caller must verify sources, rights and user consent.
export function cleanDiscoverySuggestion(source = {}) {
  const s = source && typeof source === "object" ? source : {};
  return {
    hanger_id: str(s.hanger_id, 60),
    name: str(s.name),
    website: str(s.website, 2048),
    address: str(s.address, 500),
    phone: str(s.phone, 80),
    assets: (Array.isArray(s.assets) ? s.assets : []).slice(0, 50).map(a => ({
      url: str(a?.url, 2048),
      source_url: str(a?.source_url, 2048),
      kind: ["logo", "photo", "other"].includes(a?.kind) ? a.kind : "other",
      rights: ["unverified", "licensed", "owner_provided"].includes(a?.rights) ? a.rights : "unverified",
      approved: a?.approved === true && ["licensed", "owner_provided"].includes(a?.rights)
    }))
  };
}

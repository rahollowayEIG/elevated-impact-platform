export const SOCIAL_DESTINATIONS = [
  {
    id: "facebook",
    name: "Facebook",
    detail: "Page posts",
    setup: "https://developers.facebook.com/docs/pages-api/posts/",
  },
  {
    id: "instagram",
    name: "Instagram",
    detail: "Professional account posts and reels",
    setup: "https://developers.facebook.com/docs/instagram-platform/",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    detail: "Organization or member posts",
    setup:
      "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
  },
  {
    id: "tiktok",
    name: "TikTok",
    detail: "Video and photo posts",
    setup: "https://developers.tiktok.com/doc/content-posting-api-get-started/",
  },
  {
    id: "youtube",
    name: "YouTube",
    detail: "Videos and Shorts",
    setup: "https://developers.google.com/youtube/v3/guides/uploading_a_video",
  },
  {
    id: "x",
    name: "X",
    detail: "Posts",
    setup: "https://docs.x.com/x-api/posts/create-post",
  },
  { id: "hub", name: "Event hub", detail: "Event website ad block" },
  { id: "website", name: "Course website", detail: "Embeddable ad block" },
  { id: "display", name: "Digital displays", detail: "On-site screens" },
];
export const REVENUE_OPPORTUNITIES = [
  {
    id: "sponsor",
    name: "Sponsor spotlight",
    group: "Digital",
    detail: "A sponsor message across the hub, website and social pages.",
    destinations: ["hub", "website", "facebook", "instagram"],
  },
  {
    id: "title",
    name: "Presenting sponsor",
    group: "Event",
    detail: "A headline partner across event materials and announcements.",
    destinations: ["hub", "website", "facebook", "display"],
  },
  {
    id: "hole",
    name: "Hole sponsorship",
    group: "On course",
    detail: "A named hole, tee sign and supporting digital promotion.",
    destinations: ["hub", "website", "display"],
  },
  {
    id: "challenge",
    name: "Hole-in-one challenge",
    group: "On course",
    detail: "The approved prize, sponsor and contest rules.",
    destinations: ["hub", "facebook", "instagram", "display"],
  },
  {
    id: "video",
    name: "Video sponsor mention",
    group: "Digital",
    detail: "A sponsor in a briefing, hole guide or recap video.",
    destinations: ["youtube", "instagram", "tiktok"],
  },
  {
    id: "screen",
    name: "Digital screen ad",
    group: "Digital",
    detail: "Sponsor artwork for clubhouse and event screens.",
    destinations: ["display", "hub"],
  },
  {
    id: "print",
    name: "Books & printed ads",
    group: "Print",
    detail: "Outing programs, yardage books, scorecards and banners.",
    destinations: ["hub"],
  },
  {
    id: "swag",
    name: "Gifts & swag sponsor",
    group: "Products",
    detail: "Branded apparel, towels, gifts and giveaway artwork.",
    destinations: ["hub", "facebook", "instagram"],
  },
  {
    id: "hospitality",
    name: "Hospitality sponsor",
    group: "Event",
    detail: "Food, beverages, carts, check-in and awards.",
    destinations: ["hub", "display", "facebook"],
  },
  {
    id: "social",
    name: "Social promotion package",
    group: "Digital",
    detail: "A coordinated series of sponsor posts and event updates.",
    destinations: ["facebook", "instagram", "linkedin"],
  },
  {
    id: "recap",
    name: "Results & recap partner",
    group: "Event",
    detail: "Approved winners, event highlights and sponsor thanks.",
    destinations: ["facebook", "instagram", "youtube"],
  },
  {
    id: "venue",
    name: "Course & venue promotion",
    group: "Venue",
    detail: "Promote outings, offers and the course experience.",
    destinations: ["website", "facebook", "instagram", "linkedin"],
  },
];
const string = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
export function cleanCampaignData(value = {}) {
  const v = value && typeof value === "object" ? value : {};
  return {
    headline: string(v.headline, 160),
    body: string(v.body, 6000),
    sponsor: string(v.sponsor, 160),
    link: string(v.link, 2048),
    image: string(v.image, 2048),
    cta: string(v.cta, 80),
    time_zone: string(v.time_zone, 80),
    desired_at: string(v.desired_at, 40),
    ends_at: string(v.ends_at, 40),
    opportunity: REVENUE_OPPORTUNITIES.some((o) => o.id === v.opportunity)
      ? v.opportunity
      : "",
    destinations: SOCIAL_DESTINATIONS.filter(
      (d) => Array.isArray(v.destinations) && v.destinations.includes(d.id),
    ).map((d) => d.id),
  };
}
export function newCampaign(opportunity) {
  return {
    id: crypto.randomUUID(),
    name: opportunity?.name || "New campaign",
    event_id: null,
    version: 0,
    status: "draft",
    data: cleanCampaignData({
      opportunity: opportunity?.id,
      destinations: opportunity?.destinations || [],
      cta: "Learn more",
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  };
}
export function safePublicUrl(value) {
  if (!value) return "";
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export function campaignProblem(campaign, review = false) {
  if (!campaign.name.trim()) return "Give this campaign a name.";
  if (campaign.data.link && !safePublicUrl(campaign.data.link))
    return "Use a full HTTPS destination link.";
  if (campaign.data.image && !safePublicUrl(campaign.data.image))
    return "Use a full HTTPS public image URL.";
  if (
    review &&
    (!campaign.data.body.trim() || !campaign.data.destinations.length)
  )
    return "Add your message and at least one destination before marking it reviewed.";
  return "";
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function campaignAdHtml(campaign) {
  if (!campaign.version || campaign.status !== "reviewed")
    throw new Error("Save a reviewed version before exporting a website ad.");
  const d = cleanCampaignData(campaign.data),
    link = safePublicUrl(d.link),
    image = safePublicUrl(d.image);
  if (!d.destinations.some((v) => ["hub", "website"].includes(v)) || !link)
    throw new Error(
      "Select Event hub or Course website and add a destination link.",
    );
  return `<!-- Static ad for ${escape(campaign.name)}. Version ${campaign.version}. Update/remove this block when the campaign changes or ends. -->\n<aside aria-label="Sponsored message" style="max-width:720px;padding:24px;border-radius:16px;background:#12213b;color:#ffffff;font-family:Arial,sans-serif;box-sizing:border-box">\n<p style="margin:0 0 12px;font-size:12px">Sponsored${d.sponsor ? " · " + escape(d.sponsor) : ""}</p>\n${image ? `<img src="${escape(image)}" alt="${escape(d.headline || campaign.name)}" style="width:100%;height:auto;border-radius:10px" loading="lazy" referrerpolicy="no-referrer">\n` : ""}${d.headline ? `<h2>${escape(d.headline)}</h2>\n` : ""}<p style="white-space:pre-wrap">${escape(d.body)}</p>\n<a href="${escape(link)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 18px;background:#d81c22;color:#ffffff;border-radius:8px;text-decoration:none">${escape(d.cta || "Learn more")}</a>\n</aside>\n`;
}
export function visibleCampaigns(
  rows,
  query,
  status,
  field = "updated_at",
  ascending = false,
) {
  return rows
    .filter(
      (p) =>
        p.status !== "archived" &&
        (status === "all" || p.status === status) &&
        [p.name, p.data?.sponsor, p.data?.headline, p.status]
          .join(" ")
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const av = a.p[field] || "",
        bv = b.p[field] || "";
      const comparison = String(av).localeCompare(String(bv), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return (ascending ? comparison : -comparison) || a.i - b.i;
    })
    .map((v) => v.p);
}

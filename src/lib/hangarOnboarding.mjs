// One canonical Hanger for each merchant, venue, advertiser or partner.
// Discovery is a suggestion only: matching never creates or merges an organization.
export const HANGAR_TYPES = Object.freeze([
  ["business", "Business"], ["golf_course", "Golf course"], ["venue", "Venue"],
  ["nonprofit", "Nonprofit"], ["school", "School"], ["publisher", "Publisher / partner"],
]);

export const HANGAR_SOURCES = Object.freeze([
  ["eig_manual", "Direct / EIG managed"],
  ["hometown_magazine", "Hometown Magazine advertiser"],
  ["ad_network", "EIG Ad Network"],
  ["event", "Event / sponsor"],
  ["partner", "Partner / fundraiser"],
]);

export function normalizeHangarName(value) {
  return String(value || "").normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function cleanHangarWebsite(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  if (input.length > 500) throw new Error("Website is too long.");
  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : "https://" + input);
  } catch {
    throw new Error("Enter a valid business website.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.port || !/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i.test(parsed.hostname)) {
    throw new Error("Enter a public HTTPS business website.");
  }
  parsed.hash = "";
  return parsed.toString();
}

export function hangarDomain(value) {
  try {
    const website = cleanHangarWebsite(value);
    if (!website) return "";
    return new URL(website).hostname.replace(/^www\./i, "").toLowerCase();
  } catch { return ""; }
}

export function suggestExistingHangars(organizations, { name = "", websiteUrl = "", isTest = false } = {}) {
  const key = normalizeHangarName(name), domain = hangarDomain(websiteUrl);
  if (!key && !domain) return [];
  return (Array.isArray(organizations) ? organizations : [])
    .filter(org => Boolean(org?.is_test) === Boolean(isTest))
    .map(org => {
      const existing = normalizeHangarName(org.name);
      const websiteMatch = domain && domain === hangarDomain(org.website_url || org.profile?.website_url);
      const nameMatch = key && existing === key;
      const similar = key.length >= 5 && existing.length >= 5 &&
        (key.includes(existing) || existing.includes(key));
      const reasons = [
        ...(nameMatch ? ["Same business name"] : []),
        ...(websiteMatch ? ["Same website"] : []),
        ...(!nameMatch && similar ? ["Similar business name"] : []),
      ];
      return { organization: org, reasons, definite: Boolean(websiteMatch || nameMatch) };
    })
    .filter(row => row.reasons.length)
    .sort((a, b) => Number(b.definite) - Number(a.definite) ||
      a.organization.name.localeCompare(b.organization.name))
    .slice(0, 8);
}

export function onboardingProblem({ name, organizationType, websiteUrl, primaryContactName,
  primaryContactEmail, invitePilot = false } = {}) {
  const cleanName = String(name || "").trim();
  if (cleanName.length < 2 || cleanName.length > 160) return "Enter a business name (2–160 characters).";
  if (!HANGAR_TYPES.some(([key]) => key === organizationType)) return "Choose a valid business type.";
  try { cleanHangarWebsite(websiteUrl); } catch (e) { return e.message; }
  if (String(primaryContactEmail || "").trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(primaryContactEmail).trim()))
    return "Enter a valid primary contact email.";
  if (invitePilot && (!String(primaryContactName || "").trim() || !String(primaryContactEmail || "").trim()))
    return "Add the Pilot's name and email before sending an invitation.";
  return "";
}

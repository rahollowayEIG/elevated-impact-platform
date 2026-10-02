// Public venue default verified at https://www.chapelhillgolf.net/contactus/.
// An event-specific address always takes precedence.
export function eventVenueAddress(event) {
  const explicit = event?.field_settings?.hub_venue_address;
  if (explicit) return explicit.trim();
  return /^chapel hill golf course$/i.test((event?.course || '').trim())
    ? '2023 Old Lancaster Pike, Reading, PA 19608'
    : '';
}

export function eventHubUrl(slug, origin) {
  return `${origin}/events/${encodeURIComponent(slug)}`;
}

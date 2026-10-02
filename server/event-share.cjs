const SLUG = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function venueAddress(event) {
  return String(event.field_settings?.hub_venue_address ||
    (/^chapel hill golf course$/i.test((event.course || '').trim())
      ? '2023 Old Lancaster Pike, Reading, PA 19608' : '')).trim().slice(0, 160);
}

function details(event) {
  const settings = event.field_settings || {};
  const date = event.event_dates?.[0];
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(date || '')
    ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
  const time = settings.event_start_time;
  const timeLabel = /^\d{2}:\d{2}(:\d{2})?$/.test(time || '')
    ? new Date('2000-01-01T' + time + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) : '';
  return {
    title: String(event.name || 'Event Hub').slice(0, 110),
    dateTime: [dateLabel, timeLabel].filter(Boolean).join(' · '),
    venue: String(event.course || '').slice(0, 100),
    address: venueAddress(event),
  };
}

async function loadPublishedEvent(slug) {
  if (!SLUG.test(slug || '')) return null;
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error('Public event connection is unavailable.');
  const url = new URL('/rest/v1/golf_registration_events', base);
  url.search = new URLSearchParams({ select: 'name,course,event_dates,public_slug,status,field_settings', public_slug: 'eq.' + slug, status: 'eq.published', limit: '1' }).toString();
  const result = await fetch(url, { headers: { apikey: key }, signal: AbortSignal.timeout(8000) });
  if (!result.ok) throw new Error('Public event lookup failed.');
  const rows = await result.json();
  return rows[0]?.status === 'published' ? rows[0] : null;
}

// Only load public event assets from this project's storage; never arbitrary hosts.
function imageCandidates(event) {
  const s = event.field_settings || {};
  const storage = new URL('/storage/v1/object/public/', process.env.VITE_SUPABASE_URL).href;
  return [s.hub_banner_url, ...(Array.isArray(s.hub_photo_urls) ? s.hub_photo_urls : []), s.hub_flyer_url, s.hub_logo_url]
    .filter((url) => typeof url === 'string' && url.startsWith(storage) && /\.(png|jpe?g|webp)(\?|$)/i.test(url));
}

function metadata(event, origin) {
  const d = details(event);
  const canonical = origin + '/events/' + encodeURIComponent(event.public_slug);
  const image = origin + '/api/event-image?slug=' + encodeURIComponent(event.public_slug);
  const description = [d.dateTime, d.venue, d.address, String(event.field_settings?.hub_description || '').slice(0, 220)].filter(Boolean).join(' · ');
  const tags = { 'og:type': 'website', 'og:site_name': 'ElevationPilot', 'og:title': d.title, 'og:description': description, 'og:url': canonical, 'og:image': image, 'og:image:type': 'image/png', 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': [d.title, d.dateTime, d.venue, d.address].filter(Boolean).join(' · ') };
  return `<title>${escapeHtml(d.title)} | Event Hub</title>\n<link rel="canonical" href="${escapeHtml(canonical)}">\n<meta name="description" content="${escapeHtml(description)}">\n` +
    Object.entries(tags).map(([property, value]) => `<meta property="${property}" content="${escapeHtml(value)}">`).join('\n') +
    `\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${escapeHtml(d.title)}">\n<meta name="twitter:description" content="${escapeHtml(description)}">\n<meta name="twitter:image" content="${escapeHtml(image)}">`;
}

module.exports = { SLUG, escapeHtml, details, loadPublishedEvent, imageCandidates, metadata };

const React = require('react');
const { details, loadPublishedEvent, imageCandidates } = require('../server/event-share.cjs');
const h = React.createElement;

async function loadArtwork(event) {
  for (const url of imageCandidates(event).slice(0, 4)) {
    try {
      const result = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(4000) });
      const type = result.headers.get('content-type')?.split(';')[0];
      if (!result.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) continue;
      if (Number(result.headers.get('content-length')) > 10 * 1024 * 1024) continue;
      const bytes = await result.arrayBuffer();
      if (bytes.byteLength > 10 * 1024 * 1024) continue;
      return 'data:' + type + ';base64,' + Buffer.from(bytes).toString('base64');
    } catch {}
  }
  return '';
}

function card(event, artwork) {
  const d = details(event);
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#1D245D', color: '#fff', fontFamily: 'sans-serif' } },
    h('div', { style: { display: 'flex', height: 340, width: 1200, alignItems: 'center', justifyContent: 'center', background: '#eef0f5' } },
      artwork ? h('img', { src: artwork, width: 1200, height: 340, style: { objectFit: 'contain' } }) : h('div', { style: { fontSize: 64, color: '#1D245D', fontWeight: 700 } }, 'ElevationPilot Event Hub')),
    h('div', { style: { display: 'flex', flexDirection: 'column', padding: '24px 46px', borderTop: '8px solid #D81C22' } },
      h('div', { style: { fontSize: d.title.length > 65 ? 38 : 46, fontWeight: 700, lineHeight: 1.1, marginBottom: 10 } }, d.title),
      h('div', { style: { fontSize: 30, marginBottom: 7 } }, d.dateTime),
      h('div', { style: { fontSize: 28, fontWeight: 700, marginBottom: 5 } }, d.venue),
      h('div', { style: { fontSize: 25, color: '#e3e5ee' } }, d.address)));
}

module.exports = async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
  try {
    const event = await loadPublishedEvent(req.query.slug);
    res.setHeader('Cache-Control', 'no-store');
    if (!event) return res.status(404).end();
    const { ImageResponse } = await import('@vercel/og');
    const artwork = await loadArtwork(event);
    const result = new ImageResponse(card(event, artwork), { width: 1200, height: 630 });
    let bytes;
    try { bytes = await result.arrayBuffer(); }
    catch { bytes = await new ImageResponse(card(event, ''), { width: 1200, height: 630 }).arrayBuffer(); }
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(Buffer.from(bytes));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).end();
  }
};

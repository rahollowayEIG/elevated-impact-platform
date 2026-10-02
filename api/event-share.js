const fs = require('node:fs/promises');
const path = require('node:path');
const { loadPublishedEvent, metadata } = require('../server/event-share.cjs');

module.exports = async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
  try {
    const event = await loadPublishedEvent(req.query.slug);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Do not retain previews when an event is unpublished.
    res.setHeader('Cache-Control', 'no-store');
    if (!event) return res.status(404).send('<!doctype html><html><head><meta name="robots" content="noindex"><title>Event unavailable</title></head><body>This event website is not currently published.</body></html>');
    const shell = await fs.readFile(path.join(process.cwd(), 'dist/index.html'), 'utf8');
    const origin = 'https://elevated-impact-platform.vercel.app';
    res.status(200).send(shell.replace(/<title>[^<]*<\/title>/, metadata(event, origin)));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).send('Event preview is temporarily unavailable. Please try again.');
  }
};

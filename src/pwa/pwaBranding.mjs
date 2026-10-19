/**
 * PWA installation identities are build-time choices, NOT a runtime
 * impersonation switch. Sandbox must use the isolated Supabase project.
 * No service worker or private data cache is created by this module.
 */
const SANDBOX_URL = 'https://publruuuyvpggogrrgwp.supabase.co';

export function resolvePwaFlavor(env = {}) {
  const flag = env.VITE_ELEVATIONPILOT_SANDBOX;
  if (flag !== undefined && flag !== 'true' && flag !== 'false') {
    throw new Error('VITE_ELEVATIONPILOT_SANDBOX must be true, false or unset.');
  }
  const sandbox = flag === 'true';
  const projectUrl = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (sandbox && projectUrl !== SANDBOX_URL) {
    throw new Error('Refusing a Sandbox PWA built for any other Supabase project.');
  }
  if (!sandbox && projectUrl === SANDBOX_URL) {
    throw new Error('Refusing to label the isolated Sandbox PWA as a Live app.');
  }
  return sandbox ? 'sandbox' : 'live';
}

export function injectPwaHead(html, flavor) {
  if (flavor !== 'live' && flavor !== 'sandbox') {
    throw new Error('Unknown PWA identity.');
  }
  if (!html.includes('</head>') || !/<title>[^<]*<\/title>/.test(html) ||
      /<link[^>]+rel=["']manifest["']/i.test(html)) {
    throw new Error('Cannot safely inject exactly one PWA manifest.');
  }
  const sandbox = flavor === 'sandbox';
  const name = sandbox ? 'ElevationPilot Sandbox' : 'ElevationPilot';
  const tags = [
    '<link rel="manifest" href="/pwa/' + flavor + '.webmanifest" />',
    '<link rel="icon" type="image/png" sizes="192x192" href="/pwa/' + flavor + '-192.png" />',
    '<link rel="apple-touch-icon" sizes="192x192" href="/pwa/' + flavor + '-192.png" />',
    '<meta name="theme-color" content="#1D245D" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-title" content="' + name + '" />',
  ].join('\n    ');
  return html
    .replace(/<title>[^<]*<\/title>/, '<title>' + name + '</title>')
    .replace('</head>', '    ' + tags + '\n  </head>');
}

const EXPECTED_SANDBOX_HOST = 'publruuuyvpggogrrgwp.supabase.co';

/**
 * Fail closed if a sandbox build is accidentally pointed at production.
 * This protects the primary Supabase SDK and startup entry; integrations
 * with their own endpoints must be independently verified.
 */
export function assertSandboxSupabaseTarget(url, { enabled = false, key = '' } = {}) {
  if (!enabled) return true;
  if (!url) throw new Error('Sandbox Supabase URL is required.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid sandbox Supabase URL.'); }
  if (parsed.protocol !== 'https:' ||
      parsed.hostname !== EXPECTED_SANDBOX_HOST ||
      parsed.username || parsed.password || parsed.port ||
      !['', '/'].includes(parsed.pathname) || parsed.search || parsed.hash) {
    throw new Error('Sandbox refused to connect to a non-sandbox Supabase project.');
  }
  if (!key || key.startsWith('sb_secret_')) {
    throw new Error('Sandbox requires a public/publishable Supabase key, never a secret key.');
  }
  return true;
}

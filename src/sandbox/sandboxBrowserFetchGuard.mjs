import { EXPECTED_SANDBOX_HOST } from './sandboxSupabaseGate.mjs';

/**
 * Browser-only defense in depth for the isolated ElevationPilot Sandbox.
 * Only its own origin and the dedicated Sandbox Supabase API may be contacted
 * with fetch. This is NOT a replacement for server-side authorization,
 * RLS, provider test-mode credentials, CSP, or an integration review.
 */
export function isAllowedSandboxFetchTarget(input, { appOrigin, sandboxSupabaseUrl } = {}) {
  try {
    const app = new URL(appOrigin);
    const api = new URL(sandboxSupabaseUrl);
    if (app.protocol !== 'https:' ||
        !/^elevationpilot-sandbox(?:-[a-z0-9-]+)?\.vercel\.app$/.test(app.hostname) ||
        app.username || app.password || app.port ||
        api.protocol !== 'https:' || api.hostname !== EXPECTED_SANDBOX_HOST ||
        api.username || api.password ||
        api.port || !['', '/'].includes(api.pathname) || api.search || api.hash) {
      return false;
    }

    const address = typeof input === 'string' || input instanceof URL
      ? String(input)
      : input?.url;
    if (!address || typeof address !== 'string') return false;
    const target = new URL(address, app);
    if (target.username || target.password) return false;
    if (target.protocol === 'data:') return true; // local, not a network egress
    if (target.protocol === 'blob:') return target.origin === app.origin;
    if (target.protocol !== 'https:') return false;
    return target.origin === app.origin || target.origin === api.origin;
  } catch {
    return false;
  }
}

export function createSandboxGuardedFetch(originalFetch, options) {
  if (typeof originalFetch !== 'function' ||
      !isAllowedSandboxFetchTarget('/', options)) {
    throw new Error('Sandbox network configuration could not be verified.');
  }
  return function sandboxGuardedFetch(input, init) {
    if (!isAllowedSandboxFetchTarget(input, options)) {
      return Promise.reject(new Error('Sandbox blocked an external network request.'));
    }
    return originalFetch(input, init);
  };
}

export function installSandboxBrowserFetchGuard({
  enabled = false, windowObject, sandboxSupabaseUrl,
} = {}) {
  if (!enabled) return () => {};
  const win = windowObject ?? (typeof window !== 'undefined' ? window : null);
  if (!win?.location?.origin || typeof win.fetch !== 'function') {
    throw new Error('The Sandbox network guard could not start.');
  }
  const previous = win.fetch;
  const guarded = createSandboxGuardedFetch(previous.bind(win), {
    appOrigin: win.location.origin,
    sandboxSupabaseUrl,
  });
  win.fetch = guarded;
  return () => {
    if (win.fetch === guarded) win.fetch = previous;
  };
}

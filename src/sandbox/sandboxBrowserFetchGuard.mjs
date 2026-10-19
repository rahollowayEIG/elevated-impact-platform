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

/**
 * For the optional real-UI read-only pilot, keep only isolated Auth traffic,
 * published/own-data lookups, and the already-authorized role switching RPC.
 * Browser checks are defense in depth: database grants/RLS provide enforcement.
 */
export function isAllowedSandboxReadOnlyRequest(input, init, options) {
  if (!isAllowedSandboxFetchTarget(input, options)) return false;
  try {
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (!['GET','HEAD','POST'].includes(method)) return false;
    const address = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    const target = new URL(address, options.appOrigin);
    if (target.protocol === 'blob:' || target.protocol === 'data:') return method === 'GET';
    const app = new URL(options.appOrigin);
    const sandboxApi = new URL(options.sandboxSupabaseUrl);
    if (target.origin === app.origin) {
      return ['GET','HEAD'].includes(method) &&
        !target.pathname.startsWith('/api/');
    }
    if (target.origin !== sandboxApi.origin) return false;
    if (target.pathname.startsWith('/auth/v1/')) {
      if (['GET','HEAD'].includes(method)) return true;
      return method === 'POST' && [
        '/auth/v1/otp','/auth/v1/verify','/auth/v1/token',
        '/auth/v1/logout','/auth/v1/recover',
      ].includes(target.pathname);
    }
    if (target.pathname.startsWith('/rest/v1/rpc/')) {
      return method === 'POST' && [
        '/rest/v1/rpc/sandbox_practice_role_status',
        '/rest/v1/rpc/sandbox_switch_practice_role',
        // Existing server-guarded Budget READ. Its write counterpart remains blocked.
        '/rest/v1/rpc/read_eie_event_budget',
      ].includes(target.pathname);
    }
    if (target.pathname.startsWith('/rest/v1/')) {
      return ['GET','HEAD'].includes(method);
    }
    if (target.pathname.startsWith('/functions/v1/')) {
      return method === 'POST' && [
        '/functions/v1/public-event-squawks',
        '/functions/v1/golf-my-registrations',
      ].includes(target.pathname);
    }
    if (target.pathname.startsWith('/storage/v1/')) {
      return ['GET','HEAD'].includes(method);
    }
    return false;
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
    if (!(options?.readOnly
      ? isAllowedSandboxReadOnlyRequest(input, init, options)
      : isAllowedSandboxFetchTarget(input, options))) {
      return Promise.reject(new Error(options?.readOnly ? 'Sandbox blocked a restricted network request.' : 'Sandbox blocked an external network request.'));
    }
    return originalFetch(input, init);
  };
}

export function installSandboxBrowserFetchGuard({
  enabled = false, readOnly = false, windowObject, sandboxSupabaseUrl,
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
    readOnly,
  });
  win.fetch = guarded;
  return () => {
    if (win.fetch === guarded) win.fetch = previous;
  };
}

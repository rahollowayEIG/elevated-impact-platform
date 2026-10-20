import { isAllowedSandboxFetchTarget, isAllowedSandboxReadOnlyRequest } from './sandboxBrowserFetchGuard.mjs';

/**
 * Extra browser-side containment while testing the ORIGINAL ElevationPilot UI.
 * Neither this nor the fetch guard replaces Supabase grants, RLS or server
 * isolation. Applies only to the explicitly enabled Sandbox read-only preview.
 */
export function installSandboxReadOnlyActionsGuard({
  enabled = false, eventDetailsWriteEnabled = false,
  registrationDetailsWriteEnabled = false, windowObject, sandboxSupabaseUrl,
} = {}) {
  if (!enabled) return () => {};
  const win = windowObject ?? (typeof window !== 'undefined' ? window : null);
  if (!win?.location?.origin) throw new Error('Sandbox preview origin unavailable.');
  const options = {
    appOrigin: win.location.origin, sandboxSupabaseUrl,
    eventDetailsWriteEnabled, registrationDetailsWriteEnabled,
  };
  if (!isAllowedSandboxFetchTarget('/', options)) {
    throw new Error('Sandbox preview refused an unapproved origin.');
  }

  const originalOpen = win.open;
  const originalXhr = win.XMLHttpRequest;
  const originalSocket = win.WebSocket;
  const originalEventSource = win.EventSource;

  if (typeof originalOpen === 'function') {
    win.open = (url, ...args) => {
      try {
        const target = new URL(String(url), win.location.origin);
        if (target.protocol !== 'https:' || target.origin !== win.location.origin) return null;
        return originalOpen.call(win, url, ...args);
      } catch { return null; }
    };
  }

  if (typeof originalXhr === 'function') {
    win.XMLHttpRequest = class SandboxReadOnlyXHR extends originalXhr {
      open(method, url, ...args) {
        if (!isAllowedSandboxReadOnlyRequest(url, { method }, options)) {
          throw new Error('Sandbox read-only preview blocked an XMLHttpRequest.');
        }
        return super.open(method, url, ...args);
      }
    };
  }

  if (typeof originalSocket === 'function') {
    win.WebSocket = class SandboxReadOnlySocket extends originalSocket {
      constructor(url, ...args) {
        const target = new URL(String(url));
        const sandboxApiHost = new URL(sandboxSupabaseUrl).hostname;
        if (target.protocol !== 'wss:' || target.hostname !== sandboxApiHost ||
            target.username || target.password || target.port) {
          throw new Error('Sandbox read-only preview blocked a WebSocket.');
        }
        super(url, ...args);
      }
    };
  }

  if (typeof originalEventSource === 'function') {
    win.EventSource = class SandboxReadOnlyEventSource extends originalEventSource {
      constructor(url, ...args) {
        if (!isAllowedSandboxReadOnlyRequest(url, { method: 'GET' }, options)) {
          throw new Error('Sandbox read-only preview blocked an EventSource.');
        }
        super(url, ...args);
      }
    };
  }
  return () => {
    if (originalOpen && win.open !== originalOpen) win.open = originalOpen;
    if (originalXhr && win.XMLHttpRequest !== originalXhr) win.XMLHttpRequest = originalXhr;
    if (originalSocket && win.WebSocket !== originalSocket) win.WebSocket = originalSocket;
    if (originalEventSource && win.EventSource !== originalEventSource) win.EventSource = originalEventSource;
  };
}

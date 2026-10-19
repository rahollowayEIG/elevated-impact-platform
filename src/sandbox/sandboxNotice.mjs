/**
 * The notice is a usability safeguard, NEVER an authorization check.
 * Access still comes exclusively from checkSandboxAccess + Sandbox RLS.
 *
 * A tab-scoped acknowledgement avoids interrupting role switches and
 * refreshes, but is cleared on Sandbox SIGNED_OUT.
 */
export const SANDBOX_NOTICE_KEY = 'elevationpilot:sandbox:notice:v1';

function normalizedEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function hasAcknowledgedSandboxNotice(storage, email) {
  const normalized = normalizedEmail(email);
  if (!normalized) return false;
  try {
    return storage?.getItem(SANDBOX_NOTICE_KEY) === normalized;
  } catch {
    return false;
  }
}

export function acknowledgeSandboxNotice(storage, email) {
  const normalized = normalizedEmail(email);
  if (!normalized) return false;
  try {
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem(SANDBOX_NOTICE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

export function clearSandboxNotice(storage) {
  try {
    storage?.removeItem?.(SANDBOX_NOTICE_KEY);
  } catch {
    // Session storage can be unavailable in private or restricted browsers.
  }
}

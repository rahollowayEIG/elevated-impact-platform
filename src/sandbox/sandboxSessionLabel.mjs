/**
 * Presentation only: a friendly email handle and the role already approved by
 * the isolated Sandbox server. This never assigns or authorizes a role.
 */
export const SANDBOX_PRACTICE_ROLE_LABELS = Object.freeze({
  pilot: 'Pilot',
  co_pilot: 'Co-Pilot',
  atc: 'ATC Coordinator',
  passenger: 'Passenger',
});

export function getSandboxSessionLabel(email, activeRole) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ||
      !Object.hasOwn(SANDBOX_PRACTICE_ROLE_LABELS, activeRole)) {
    return null;
  }
  return Object.freeze({
    email: normalized,
    handle: normalized.slice(0, normalized.indexOf('@')),
    role: SANDBOX_PRACTICE_ROLE_LABELS[activeRole],
  });
}

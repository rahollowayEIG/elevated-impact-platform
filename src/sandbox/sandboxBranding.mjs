/**
 * Sandbox markings are deliberately opt-in: production never changes its
 * title, main header, or on-screen environment indicator.
 */
export function getSandboxBranding(enabled) {
  if (!enabled) return null;
  return Object.freeze({
    pageTitle: 'SANDBOX | ElevationPilot',
    homeSubtitle: 'ElevationPilot Sandbox',
    badgeLabel: 'SANDBOX',
    badgeDetail: 'Practice environment',
  });
}

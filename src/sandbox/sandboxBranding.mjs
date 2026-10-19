/**
 * Sandbox markings are deliberately opt-in: production never changes its
 * title or header. A persistent top-header label replaces the old floating badge.
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

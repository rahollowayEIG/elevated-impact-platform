// Read-only scorecard launch readiness evaluator for Build Lab.
// Evidence must be supplied by a trusted scanner or a verified reviewer.
// This module never infers implemented features from plans or marketing copy.
export const SCORECARD_CAPABILITIES = Object.freeze([
  { id: 'course-data', title: 'Verified course and tee data', group: 'print', priority: 'critical' },
  { id: 'score-grid', title: '18-hole scoring grid and totals', group: 'print', priority: 'critical' },
  { id: 'print-master', title: 'Editable precise-size print master, safe margins and bleed', group: 'print', priority: 'critical' },
  { id: 'print-export', title: 'Print-quality PDF export and home-print format', group: 'print', priority: 'critical' },
  { id: 'sponsor-placements', title: 'Approved sponsor placements and versioning', group: 'marketing', priority: 'high' },
  { id: 'qr-handoff', title: 'QR links to the correct public mobile scorecard', group: 'mobile', priority: 'critical' },
  { id: 'mobile-scorecard', title: 'Responsive score entry and auto-save', group: 'mobile', priority: 'high' },
  { id: 'saved-rounds', title: 'Authorized round history and reprinting', group: 'mobile', priority: 'high' },
  { id: 'shared-identity', title: 'Single ElevationPilot profile and session', group: 'platform', priority: 'high' },
  { id: 'ad-inventory', title: 'Web, mobile and print advertising inventory', group: 'marketing', priority: 'high' },
  { id: 'course-maps', title: 'Verified course map and yardages', group: 'gps', priority: 'medium' },
  { id: 'gps-validation', title: 'On-course GPS distance accuracy review', group: 'gps', priority: 'medium' },
  { id: 'flyovers', title: 'Approved hole-by-hole course flyovers', group: 'gps', priority: 'medium' },
  { id: 'hall-of-fame', title: 'Verified course records and champions', group: 'engagement', priority: 'medium' },
  { id: 'native-app-assessment', title: 'PWA versus native app assessment', group: 'mobile', priority: 'medium' },
  { id: 'rights-review', title: 'Licensed imagery, map data and supplier content rights', group: 'platform', priority: 'critical' },
]);
const STATES = new Set(['verified','partial','planned','missing','unknown']);
const reference = (x) => x && typeof x === 'object' && !Array.isArray(x) &&
  typeof x.source === 'string' && x.source.trim() &&
  (typeof x.locator === 'string' && x.locator.trim()) &&
  ['source','test','preview','review'].includes(x.kind);
export function evaluateScorecardReadiness(observations = []) {
  if (!Array.isArray(observations)) throw new Error('Observations must be an array');
  const byId = new Map();
  for (const observation of observations) {
    if (!observation || typeof observation !== 'object' || Array.isArray(observation) ||
        !SCORECARD_CAPABILITIES.some(c => c.id === observation.id) ||
        !STATES.has(observation.status) || byId.has(observation.id) ||
        !Array.isArray(observation.evidence) || observation.evidence.some(e => !reference(e)))
      throw new Error('Invalid or duplicate scorecard observation');
    if (observation.status === 'verified' && !observation.evidence.length)
      throw new Error('Verified capability must have source evidence');
    // A code snippet alone is not enough to claim actual interactive behavior.
    if (observation.status === 'verified' && !observation.evidence.some(e => e.kind === 'test' || e.kind === 'preview' || e.kind === 'review'))
      throw new Error('Verified capability requires testing or a documented human review');
    byId.set(observation.id, observation);
  }
  const findings = SCORECARD_CAPABILITIES.map(capability => {
    const observed = byId.get(capability.id);
    return { ...capability, status: observed?.status || 'unknown',
      evidence: observed ? observed.evidence.map(e => ({ ...e })) : [],
      nextAction: observed?.status === 'verified' ? 'keep_verified' :
        observed?.status === 'partial' ? 'finish_and_test' :
        observed?.status === 'planned' ? 'implement_and_test' :
        'inspect_existing_implementation',
    };
  });
  const launchGates = findings.filter(x => x.priority === 'critical');
  const printReady = launchGates.every(x => x.status === 'verified');
  return {
    reportType: 'eig_scorecard_readiness_v1',
    scope: 'Chapel Hill scorecard / InceptionApex / ElevationPilot',
    evidenceLevel: 'reviewed_observations_only',
    printReady,
    requiresHumanApproval: true,
    findings,
    priorityQueue: findings.filter(x => x.status !== 'verified').sort((a,b) =>
      ({critical:0,high:1,medium:2}[a.priority] - {critical:0,high:1,medium:2}[b.priority]) ||
      a.title.localeCompare(b.title)),
  };
}

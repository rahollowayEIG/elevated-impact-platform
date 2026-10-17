/**
 * EIG Build Lab change-impact assessment.
 * Pure and read-only: analyzes a proposed changed-file list, never reads live records,
 * writes databases, or authorizes deployments. All results require owner review.
 */
const RULES = [
  { id: 'payments', severity: 'critical', match: /(?:stripe|checkout|payment|refund|invoice|billing|webhook)/i, reason: 'Payments and reconciliation may be affected.' },
  { id: 'registration', severity: 'critical', match: /(?:registration|roster|team|checkin|check-in|ticket|event)/i, reason: 'Live events, registration, check-in, or ticket workflows may be affected.' },
  { id: 'identity', severity: 'critical', match: /(?:auth|identity|session|membership|permission|role|recovery|invite|rls)/i, reason: 'Account access or authorization may be affected.' },
  { id: 'database', severity: 'critical', match: /(?:^|\/)(?:migrations|supabase|database|schema)(?:\/|\.)|\.sql$/i, reason: 'Data compatibility or production schema may be affected.' },
  { id: 'deployment', severity: 'high', match: /(?:vercel\.json|package(?:-lock)?\.json|pnpm-lock|vite\.config|\.github\/workflows|api\/)/i, reason: 'Deployment, dependencies, or backend behavior may change.' },
  { id: 'shared-ui', severity: 'high', match: /(?:PlatformApp|src\/App\.|src\/main\.|styles\.css|src\/components\/)/i, reason: 'Shared UI may affect more than one application.' },
];
const VALID_STATUS = new Set(['added','modified','removed','renamed']);
const MAX_FILES = 5000;
function cleanPath(path) {
  if (typeof path !== 'string' || !path || path.length > 500 || path.includes('\\') || path.startsWith('/') || path.split('/').some(x => x === '..' || x === '.')) throw new Error('Invalid repository path');
  return path;
}
export function scanBuildChangeImpact({ repository, baseRef, headRef, files } = {}) {
  if (typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Repository must be owner/name');
  if (typeof baseRef !== 'string' || !baseRef || typeof headRef !== 'string' || !headRef) throw new Error('Source refs required');
  if (!Array.isArray(files) || files.length > MAX_FILES) throw new Error('Invalid changed-file list');
  const findings = [], touched = new Set();
  let unknownPaths = 0;
  for (const entry of files) {
    const path = cleanPath(entry?.path);
    if (!VALID_STATUS.has(entry?.status)) throw new Error('Invalid change status');
    if (touched.has(path)) throw new Error('Duplicate changed-file path');
    touched.add(path);
    const rules = RULES.filter(r => r.match.test(path));
    if (!rules.length) unknownPaths++;
    for (const r of rules) findings.push({
      id: r.id + ':' + path, category: r.id, severity: r.severity,
      path, status: entry.status, observation: 'inferred',
      reason: r.reason, evidence: [{ repository, baseRef, headRef, path }],
      needsVerification: true
    });
  }
  const critical = findings.some(f => f.severity === 'critical');
  const high = findings.some(f => f.severity === 'high');
  const requiredChecks = [
    'Owner review of the exact commit diff and affected runtime dependencies',
    'Run relevant automated tests using isolated data',
    'Verify existing event registrations, payments, tickets, and check-ins remain compatible',
    'Verify production database migrations are backward compatible and independently recoverable',
    'Verify rollback does not overwrite transactions created after deployment',
    'Observe staging health metrics and approve a controlled rollout'
  ];
  return {
    schemaVersion: 1, kind: 'build_change_impact', readOnly: true,
    repository, baseRef, headRef, fileCount: files.length, unknownPaths,
    findings, riskLevel: critical ? 'critical' : high || unknownPaths ? 'review' : 'low',
    deploymentDecision: 'blocked_pending_review',
    ownerApprovalRequired: true,
    productionDataAccessed: false,
    requiredChecks,
    limitations: [
      'Filename heuristics are not a substitute for code review, dependency analysis, or runtime testing.',
      'A low-risk result does not authorize any deployment.',
      'Does not inspect live customer records, create backups, apply migrations, or change deployments.'
    ]
  };
}

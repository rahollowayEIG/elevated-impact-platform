// Read-only Build Lab authorization for controlled preview or separately enabled production.
// Never grants authority to perform scanner, AI, repository or persistence actions.
// Production requires an explicit independent opt-in, the main Git ref, and
// the exact owner. All other environments and accounts fail closed.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPECTED_PREVIEW_BRANCH = "feature/build-lab-orchestrator-20261020";

function currentEIGAdmin(row, now) {
  if (row?.role !== "eig_admin" || row?.status !== "active" ||
      row.organization?.slug !== "elevated-impact-group") return false;
  const start = row.access_starts_at ? Date.parse(row.access_starts_at) : -Infinity;
  const end = row.access_ends_at ? Date.parse(row.access_ends_at) : Infinity;
  return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && end > now;
}
function serverReady(env) {
  const environment = env("VERCEL_ENV");
  const detectedRef = env("VERCEL_GIT_COMMIT_REF");
  // Preview remains restricted to the original owner-only branch.
  const approvedPreview = environment === "preview" &&
    env("EIG_BUILD_LAB_PREVIEW_BRANCH") === EXPECTED_PREVIEW_BRANCH &&
    (!detectedRef || detectedRef === EXPECTED_PREVIEW_BRANCH);
  // Production is a separate, explicit opt-in. A promoted preview or
  // unknown Git ref must NOT unlock protected Build Lab endpoints.
  const approvedProduction = environment === "production" &&
    env("EIG_BUILD_LAB_PRODUCTION_ENABLED") === "true" &&
    detectedRef === "main";
  return (approvedPreview || approvedProduction) &&
    env("EIG_BUILD_LAB_ACCESS_ENABLED") === "true" &&
    UUID.test((env("EIG_BUILD_LAB_OWNER_USER_ID") || "").trim());
}

function response(res, status, body) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Origin, Authorization");
  res.status(status).json(body);
}

// Reused by *every* protected Build Lab server operation. A positive result
// from the browser's panel gate is never authorization for a scanner read.
async function authorizeBuildLabPreviewOwner(req, { verifyUser, membershipsForUser, env, now = Date.now }) {
  const origin = req?.headers?.origin;
  const host = req?.headers?.host;
  if (!origin || !host || origin !== "https://" + host) return { allowed: false, status: 403 };
  if (req.method !== "POST") return { allowed: false, status: 405 };
  if (!serverReady(env)) return { allowed: false, status: 403 };
  const auth = req.headers.authorization || "";
  const match = typeof auth === "string" && /^Bearer\s+(.+)$/i.exec(auth);
  if (!match || match[1].length > 4096) return { allowed: false, status: 401 };
  try {
    const user = await verifyUser(match[1]);
    const owner = (env("EIG_BUILD_LAB_OWNER_USER_ID") || "").trim().toLowerCase();
    if (!user?.id || String(user.id).toLowerCase() !== owner)
      return { allowed: false, status: 403 };
    const result = await membershipsForUser(user.id, match[1]);
    if (result?.error || !(result?.data || []).some((m) => currentEIGAdmin(m, now())))
      return { allowed: false, status: 403 };
    return { allowed: true, status: 200 };
  } catch {
    return { allowed: false, status: 403 };
  }
}

function createBuildLabPreviewAccessHandler(deps) {
  return async (req, res) => {
    const grant = await authorizeBuildLabPreviewOwner(req, deps);
    return response(res, grant.status,
      grant.allowed ? { allowed: true, access: "build_lab_owner_only" } : { allowed: false });
  };
}

module.exports = { createBuildLabPreviewAccessHandler, authorizeBuildLabPreviewOwner, response };

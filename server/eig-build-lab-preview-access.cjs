// Read-only Build Lab authorization for the controlled Vercel branch preview.
// Never grants authority to perform scanner, AI, repository or persistence actions.
// On deployment, this handler is restricted to the preview environment and
// exact owner account; production and other accounts must fail closed.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPECTED_PREVIEW_BRANCH = "feature/universal-scan-foundation-20261013";

function currentEIGAdmin(row, now) {
  if (row?.role !== "eig_admin" || row?.status !== "active" ||
      row.organization?.slug !== "elevated-impact-group") return false;
  const start = row.access_starts_at ? Date.parse(row.access_starts_at) : -Infinity;
  const end = row.access_ends_at ? Date.parse(row.access_ends_at) : Infinity;
  return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && end > now;
}
function serverReady(env) {
  const detectedRef = env("VERCEL_GIT_COMMIT_REF");
  return env("VERCEL_ENV") === "preview" &&
    // The branch-specific server setting is required. If Vercel exposes the
    // Git ref at runtime, it must agree; otherwise stay branch-bound by the
    // Vercel environment-variable gitBranch selector.
    env("EIG_BUILD_LAB_PREVIEW_BRANCH") === EXPECTED_PREVIEW_BRANCH &&
    (!detectedRef || detectedRef === EXPECTED_PREVIEW_BRANCH) &&
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

function createBuildLabPreviewAccessHandler({ verifyUser, membershipsForUser, env, now = Date.now }) {
  return async (req, res) => {
    // A sibling Vercel API route should only accept same-origin browser calls.
    // No wildcard CORS; host is controlled by Vercel's deployment routing.
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (!origin || !host || origin !== "https://" + host)
      return response(res, 403, { allowed: false });
    if (req.method !== "POST") return response(res, 405, { allowed: false });
    if (!serverReady(env)) return response(res, 403, { allowed: false });
    const auth = req.headers.authorization || "";
    const match = typeof auth === "string" && /^Bearer\s+(.+)$/i.exec(auth);
    if (!match || match[1].length > 4096) return response(res, 401, { allowed: false });
    try {
      const user = await verifyUser(match[1]);
      const owner = (env("EIG_BUILD_LAB_OWNER_USER_ID") || "").trim().toLowerCase();
      if (!user?.id || String(user.id).toLowerCase() !== owner)
        return response(res, 403, { allowed: false });
      const result = await membershipsForUser(user.id, match[1]);
      if (result?.error || !(result?.data || []).some((m) => currentEIGAdmin(m, now())))
        return response(res, 403, { allowed: false });
      return response(res, 200, { allowed: true, access: "build_lab_owner_only" });
    } catch {
      return response(res, 403, { allowed: false });
    }
  };
}

module.exports = { createBuildLabPreviewAccessHandler };

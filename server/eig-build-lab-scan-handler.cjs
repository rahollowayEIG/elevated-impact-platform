// Owner-only source-scanner Vercel handler. Protects the source read itself,
// never just the React button. No file paths or arbitrary URLs from callers.
const {
  authorizeBuildLabPreviewOwner, response,
} = require("./eig-build-lab-preview-access.cjs");

function createBuildLabInceptionScanHandler({
  env, verifyUser, membershipsForUser, readSources, scan,
  now = Date.now,
}) {
  return async (req, res) => {
    const grant = await authorizeBuildLabPreviewOwner(
      req, { env, verifyUser, membershipsForUser, now });
    if (!grant.allowed) return response(res, grant.status, { ok: false });
    const body = req.body;
    if (body && (typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== "target") ||
        (body.target !== undefined && body.target !== "inception_apex"))) {
      return response(res, 400, { ok: false, message: "Unsupported scan target." });
    }
    try {
      const inputs = await readSources(); // only hardcoded first-party files
      const version = env("VERCEL_GIT_COMMIT_SHA") || "local-unversioned";
      const report = await scan(inputs, version);
      return response(res, 200, { ok: true, report });
    } catch {
      // A misconfigured Vercel function must fail closed and report that
      // scanning is unavailable, not silently invent a source inspection.
      return response(res, 503, { ok: false, message: "Source scanner unavailable. Try again after the preview is rebuilt." });
    }
  };
}

module.exports = { createBuildLabInceptionScanHandler };

// EIG Build Lab owner-only status gate.
// This function provides no data or storage access. Every future Build Lab API
// MUST independently repeat this server-side authorization; the browser UI
// flag is only a visibility control and is not a permission boundary.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ORIGIN = "https://elevated-impact-platform.vercel.app";

function currentEIGAdmin(row, now) {
  if (!row || row.role !== "eig_admin" || row.status !== "active" ||
      row.organization?.slug !== "elevated-impact-group") return false;
  const start = row.access_starts_at ? Date.parse(row.access_starts_at) : -Infinity;
  const end = row.access_ends_at ? Date.parse(row.access_ends_at) : Infinity;
  return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && end > now;
}

function verifiedSessionId(jwt) {
  try {
    // Only call AFTER admin.auth.getUser verifies the JWT.
    const raw = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(raw));
    return UUID.test(payload.session_id || "") ? payload.session_id : "";
  } catch { return ""; }
}

export function createEigBuildLabAccessHandler({ admin, env, now = () => Date.now() }) {
  return async (req) => {
    const origin = req.headers.get("Origin");
    // Include the exact approved preview origin in this SERVER-ONLY setting
    // before preview rollout. Never wildcard, reflect unknown origins, or trust
    // the Origin header instead of the Supabase identity/session checks.
    const allowedOrigins = (env("EIG_BUILD_LAB_ALLOWED_ORIGINS") || DEFAULT_ORIGIN)
      .split(",").map((s) => s.trim()).filter(Boolean);
    const cors = {
      ...(origin && allowedOrigins.includes(origin)
        ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
        : {}),
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const reply = (data, status = 200) => new Response(JSON.stringify(data), {
      status, headers: {
        ...cors, "Content-Type": "application/json",
        "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff",
      },
    });
    if (!origin || !allowedOrigins.includes(origin))
      return reply({ allowed: false, error: "Access not available." }, 403);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return reply({ allowed: false, error: "Method not allowed." }, 405);
    const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return reply({ allowed: false }, 401);

    try {
      // Feature and owner configuration are both mandatory, and fail closed.
      const ownerId = (env("EIG_BUILD_LAB_OWNER_USER_ID") || "").trim().toLowerCase();
      if (env("EIG_BUILD_LAB_ACCESS_ENABLED") !== "true" || !UUID.test(ownerId))
        return reply({ allowed: false }, 403);

      const { data: { user } = {}, error } = await admin.auth.getUser(token);
      if (error || !user) return reply({ allowed: false }, 401);
      // Check owner identity BEFORE making privileged membership queries.
      if (String(user.id).toLowerCase() !== ownerId)
        return reply({ allowed: false }, 403);

      const sessionId = verifiedSessionId(token);
      if (!sessionId) return reply({ allowed: false }, 403);
      const guard = await admin.rpc("platform_assert_active_admin", {
        p_actor_id: user.id, p_actor_session_id: sessionId,
      });
      if (guard.error || !guard.data) return reply({ allowed: false }, 403);

      const membership = await admin.from("organization_memberships")
        .select("role,status,access_starts_at,access_ends_at,organization:organizations(slug)")
        .eq("user_id", user.id).eq("role", "eig_admin").eq("status", "active");
      if (membership.error || !(membership.data || []).some((row) => currentEIGAdmin(row, now())))
        return reply({ allowed: false }, 403);

      // Do not return the owner identifier, session information, membership,
      // or any account/profile information to the browser.
      return reply({ allowed: true, access: "build_lab_owner_only" });
    } catch {
      return reply({ allowed: false }, 503);
    }
  };
}

import {
  buildOpenAIRequest, parseOpenAIExtraction, validateTextPreviewInput,
} from "./provider.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ORIGIN = "https://elevated-impact-platform.vercel.app";
class PublicError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function sessionIdFromVerifiedToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return UUID.test(payload.session_id || "") ? payload.session_id : "";
  } catch { return ""; }
}
function currentMembership(row, now) {
  return row?.role === "eig_admin" && row.status === "active" &&
    row.organization?.slug === "elevated-impact-group" &&
    (!row.access_starts_at || Date.parse(row.access_starts_at) <= now) &&
    (!row.access_ends_at || Date.parse(row.access_ends_at) > now);
}
async function readBoundedJSON(req) {
  const reader = req.body?.getReader();
  if (!reader) throw new PublicError("Provide JSON source text.");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8500) {
        await reader.cancel();
        throw new PublicError("Scan text is too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let index = 0;
  for (const chunk of chunks) { bytes.set(chunk, index); index += chunk.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new PublicError("Enter a valid JSON scan request."); }
}

export function createAiScanPreviewHandler({ admin, env, http = fetch, now = () => Date.now() }) {
  return async (req) => {
    const origin = req.headers.get("Origin");
    const allowed = (env("SCAN_ALLOWED_ORIGINS") || DEFAULT_ORIGIN).split(",").map((s) => s.trim());
    const cors = {
      ...(origin && allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
    if (origin && !allowed.includes(origin)) return json({ error: "Origin not authorized." }, 403);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
    try {
      const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) throw new PublicError("Sign in to EIG Studio.", 401);
      const { data: { user } = {}, error } = await admin.auth.getUser(token);
      if (error || !user) throw new PublicError("Sign in again.", 401);
      // Decode the session claim only after Supabase Auth verifies the token.
      const sessionId = sessionIdFromVerifiedToken(token);
      if (!sessionId) throw new PublicError("A current interactive session is required.", 403);
      const guard = await admin.rpc("platform_assert_active_admin", {
        p_actor_id: user.id, p_actor_session_id: sessionId,
      });
      if (guard.error) throw new PublicError("Active EIG administrator access required.", 403);
      const memberships = await admin.from("organization_memberships")
        .select("role,status,access_starts_at,access_ends_at,organization:organizations(slug)")
        .eq("user_id", user.id).eq("role", "eig_admin").eq("status", "active");
      if (memberships.error || !(memberships.data || []).some((m) => currentMembership(m, now())))
        throw new PublicError("Active EIG Studio access required.", 403);
      if (env("OPENAI_SCAN_PREVIEW_ENABLED") !== "true")
        throw new PublicError("AI scan preview is awaiting staging setup.", 503);
      const key = env("OPENAI_API_KEY");
      if (!key) throw new PublicError("EIG AI service is not configured.", 503);
      if (!(req.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json"))
        throw new PublicError("Use JSON for scan previews.", 415);
      let input;
      try { input = validateTextPreviewInput(await readBoundedJSON(req)); }
      catch (e) { if (e instanceof PublicError) throw e; throw new PublicError(e.message); }
      let upstream;
      try {
        upstream = await http("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildOpenAIRequest(input)),
          signal: AbortSignal.timeout(25000),
        });
      } catch { throw new PublicError("The AI provider is temporarily unavailable.", 503); }
      if (!upstream.ok)
        throw new PublicError("The AI provider could not complete this preview.", upstream.status === 429 ? 503 : 502);
      let payload;
      try { payload = await upstream.json(); }
      catch { throw new PublicError("The AI provider returned an invalid response.", 502); }
      let batch;
      try { batch = parseOpenAIExtraction(payload, input); }
      catch { throw new PublicError("The AI preview could not validate its source evidence.", 422); }
      return json({
        ...batch, preview_only: true, persisted: false, publication: "none",
        usage: {
          input_tokens: Number(payload.usage?.input_tokens) || 0,
          output_tokens: Number(payload.usage?.output_tokens) || 0,
        },
      });
    } catch (e) {
      return e instanceof PublicError
        ? json({ error: e.message }, e.status)
        : json({ error: "AI scanning is temporarily unavailable." }, 500);
    }
  };
}

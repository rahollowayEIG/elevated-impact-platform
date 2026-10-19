// SANDBOX-ONLY source port from deployed Live public-event-squawks.
// Live source SHA-256: 5140e0ad0b5d4d909df132afb665ff6e0152fe098adaae0a30e0bdc25b3486e2
// Sandbox-specific differences: backend pin and canonical origin CORS.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://elevationpilot-sandbox.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl !== "https://publruuuyvpggogrrgwp.supabase.co") {
    return json({ success: false, error: "Sandbox service is not configured." }, 503);
  }
  if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Public Squawk feed is not configured." }, 503);

  let body: { public_slug?: string } = {};
  try { body = await req.json(); } catch { return json({ success: false, error: "Event slug is required." }, 400); }
  const publicSlug = String(body.public_slug || "").trim();
  if (!publicSlug) return json({ success: false, error: "Event slug is required." }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: event, error: eventError } = await admin
    .from("golf_registration_events")
    .select("id,name,status,public_slug")
    .eq("public_slug", publicSlug)
    .eq("status", "published")
    .maybeSingle();

  if (eventError || !event) return json({ success: false, error: "Event not found or not published." }, 404);

  const { data: threads, error: threadError } = await admin
    .from("squawk_threads")
    .select("id")
    .eq("event_id", event.id)
    .eq("context_type", "event")
    .eq("status", "open");

  if (threadError) return json({ success: false, error: "Unable to load Event Squawks." }, 500);
  if (!threads?.length) return json({ success: true, event_name: event.name, items: [] });

  const { data: messages, error: messageError } = await admin
    .from("squawk_messages")
    .select("id,thread_id,message_kind,sent_at,created_at,metadata,squawk_message_content(subject,body,in_app_body)")
    .in("thread_id", threads.map((thread) => thread.id))
    .eq("status", "sent")
    .contains("metadata", { hub_visible: true })
    .order("sent_at", { ascending: false })
    .limit(25);

  if (messageError) return json({ success: false, error: "Unable to load Event Squawks." }, 500);

  const items = (messages || []).map((message) => {
    const content = Array.isArray(message.squawk_message_content)
      ? message.squawk_message_content[0]
      : message.squawk_message_content;
    return {
      id: message.id,
      kind: message.message_kind,
      subject: content?.subject || "Event update",
      body: content?.in_app_body || content?.body || "",
      sent_at: message.sent_at || message.created_at,
    };
  }).filter((item) => item.body);

  return json({ success: true, event_name: event.name, items });
});

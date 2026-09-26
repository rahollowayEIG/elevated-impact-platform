import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAccessWindowActive(row: any, nowMs = Date.now()) {
  if (!row || row.status !== "active") return false;
  const starts = row.access_starts_at ? new Date(row.access_starts_at).getTime() : null;
  const ends = row.access_ends_at ? new Date(row.access_ends_at).getTime() : null;
  return (starts === null || starts <= nowMs) && (ends === null || ends >= nowMs);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Squawk publishing is not configured." }, 503);
  if (!accessToken) return json({ success: false, error: "Authentication required." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  const user = userData?.user;
  if (userError || !user) return json({ success: false, error: "Your session is no longer valid." }, 401);

  let body: { message_id?: string } = {};
  try { body = await req.json(); } catch { return json({ success: false, error: "A message ID is required." }, 400); }
  const messageId = body.message_id?.trim();
  if (!messageId) return json({ success: false, error: "A message ID is required." }, 400);

  const { data: message, error: messageError } = await admin
    .from("squawk_messages")
    .select("id,thread_id,created_by,status,requires_review,reviewed_at,channels")
    .eq("id", messageId)
    .maybeSingle();

  if (messageError || !message) return json({ success: false, error: "Squawk message not found." }, 404);
  if (message.status !== "draft") return json({ success: false, error: "Only a draft Squawk can be published." }, 409);
  if (!message.channels?.includes("in_app")) return json({ success: false, error: "This Squawk is not configured for in-app delivery." }, 400);

  const { data: thread, error: threadError } = await admin
    .from("squawk_threads")
    .select("id,organization_id,event_id,context_label")
    .eq("id", message.thread_id)
    .maybeSingle();

  if (threadError || !thread) return json({ success: false, error: "Squawk context not found." }, 404);

  const [profileResult, membershipResult, assignmentResult] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("organization_memberships").select("role,status,access_starts_at,access_ends_at").eq("organization_id", thread.organization_id).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    thread.event_id
      ? admin.from("event_assignments").select("role,status,access_starts_at,access_ends_at").eq("event_id", thread.event_id).eq("user_id", user.id).eq("status", "active").maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const isEigAdmin = ["eig_admin", "super_admin"].includes(profileResult.data?.role || "");
  const organizationRole = isAccessWindowActive(membershipResult.data) ? (membershipResult.data?.role || "") : "";
  const canManageOrganization = ["organization_admin", "organization_staff"].includes(organizationRole);
  const isAssignedToEvent = isAccessWindowActive(assignmentResult.data);

  if (!isEigAdmin && !canManageOrganization && !isAssignedToEvent) {
    return json({ success: false, error: "You do not have permission to publish this Squawk." }, 403);
  }
  if (message.created_by !== user.id && !isEigAdmin && !canManageOrganization) {
    return json({ success: false, error: "Only the author or a Hangar administrator can publish this draft." }, 403);
  }
  if (message.requires_review && !message.reviewed_at && !isEigAdmin && organizationRole !== "organization_admin") {
    return json({ success: false, error: "This message requires Pilot review before publishing." }, 409);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("squawk_messages")
    .update({ status: "sent", sent_at: now, updated_at: now })
    .eq("id", messageId);

  if (updateError) return json({ success: false, error: "The Squawk could not be published." }, 500);

  await admin.from("squawk_message_recipients")
    .update({ delivery_status: "delivered", delivered_at: now, last_status_at: now, provider: "in_app" })
    .eq("message_id", messageId)
    .eq("channel", "in_app")
    .eq("delivery_status", "pending");

  await admin.from("squawk_audit_log").insert({
    organization_id: thread.organization_id,
    event_id: thread.event_id,
    thread_id: thread.id,
    message_id: messageId,
    actor_user_id: user.id,
    action: "in_app_published",
    details: { context_label: thread.context_label || null },
  });

  return json({ success: true, message_id: messageId, published_at: now });
});

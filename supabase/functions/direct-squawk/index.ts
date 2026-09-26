import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders, json, cleanUsername, cleanMessage, displayProfile } from "./helpers.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!supabaseUrl || !serviceRoleKey || !accessToken) return json({ success: false, error: "Authentication required." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  const user = userData?.user;
  if (userError || !user) return json({ success: false, error: "Your session is no longer valid." }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ success: false, error: "A JSON body is required." }, 400); }
  const action = String(body?.action || "");

  if (action === "search") {
    const query = cleanUsername(body?.query);
    if (!query || !/^[a-z0-9._-]+$/.test(query)) return json({ success: true, users: [] });
    const { data, error } = await admin.from("profiles")
      .select("id,username,display_name,first_name,last_name")
      .not("username", "is", null)
      .ilike("username", query + "%")
      .neq("id", user.id)
      .order("username")
      .limit(12);
    if (error) return json({ success: false, error: "Unable to search ElevationPilot users." }, 500);
    return json({ success: true, users: (data || []).map(displayProfile) });
  }

  if (action === "list") {
    const { data: ownRows, error: ownError } = await admin.from("squawk_thread_participants").select("thread_id").eq("user_id", user.id);
    if (ownError) return json({ success: false, error: "Unable to load direct Squawks." }, 500);
    const ids = [...new Set((ownRows || []).map((row: any) => row.thread_id).filter(Boolean))];
    if (!ids.length) return json({ success: true, threads: [] });

    const { data: threads, error: threadError } = await admin.from("squawk_threads")
      .select("id,updated_at").in("id", ids).eq("context_type", "direct").order("updated_at", { ascending: false }).limit(50);
    if (threadError) return json({ success: false, error: "Unable to load direct Squawks." }, 500);
    const threadIds = (threads || []).map((row: any) => row.id);
    if (!threadIds.length) return json({ success: true, threads: [] });

    const [{ data: participants }, { data: messages }] = await Promise.all([
      admin.from("squawk_thread_participants").select("thread_id,user_id").in("thread_id", threadIds),
      admin.from("squawk_messages")
        .select("id,thread_id,created_by,reply_to_message_id,sent_at,created_at,squawk_message_content(subject,body)")
        .in("thread_id", threadIds).eq("status", "sent").order("created_at", { ascending: true }).limit(500),
    ]);

    const userIds = [...new Set((participants || []).map((row: any) => row.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await admin.from("profiles").select("id,username,display_name,first_name,last_name").in("id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, displayProfile(profile)]));

    const participantMap = new Map();
    for (const row of participants || []) {
      const list = participantMap.get(row.thread_id) || [];
      list.push(row);
      participantMap.set(row.thread_id, list);
    }
    const messageMap = new Map();
    for (const row of messages || []) {
      const content = Array.isArray(row.squawk_message_content) ? row.squawk_message_content[0] : row.squawk_message_content;
      const list = messageMap.get(row.thread_id) || [];
      list.push({
        id: row.id,
        created_by: row.created_by,
        reply_to_message_id: row.reply_to_message_id,
        sent_at: row.sent_at || row.created_at,
        body: content?.body || "",
        mine: row.created_by === user.id,
      });
      messageMap.set(row.thread_id, list);
    }

    const result = (threads || []).map((thread: any) => {
      const other = (participantMap.get(thread.id) || []).find((row: any) => row.user_id !== user.id);
      return { id: thread.id, other_user: other ? profileMap.get(other.user_id) || null : null, messages: messageMap.get(thread.id) || [], updated_at: thread.updated_at };
    }).filter((thread: any) => thread.other_user);

    return json({ success: true, threads: result });
  }

  if (action !== "send") return json({ success: false, error: "Unsupported action." }, 400);

  const toUsername = cleanUsername(body?.to_username);
  const messageBody = cleanMessage(body?.message);
  const replyId = String(body?.reply_to_message_id || "").trim() || null;
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(toUsername)) return json({ success: false, error: "Choose a valid @username." }, 400);
  if (!messageBody) return json({ success: false, error: "Write a message before sending." }, 400);

  const [{ data: recipient }, { data: sender }] = await Promise.all([
    admin.from("profiles").select("id,username,display_name,first_name,last_name").ilike("username", toUsername).maybeSingle(),
    admin.from("profiles").select("id,username,display_name,first_name,last_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!recipient?.id) return json({ success: false, error: "That @username was not found." }, 404);
  if (recipient.id === user.id) return json({ success: false, error: "Choose another ElevationPilot user." }, 400);

  const { data: eigOrg } = await admin.from("organizations").select("id").eq("slug", "elevated-impact-group").maybeSingle();
  if (!eigOrg?.id) return json({ success: false, error: "EIG communication context is unavailable." }, 500);

  const directKey = [user.id, recipient.id].sort().join(":");
  let { data: thread } = await admin.from("squawk_threads").select("id").eq("direct_key", directKey).maybeSingle();
  if (!thread) {
    const inserted = await admin.from("squawk_threads").insert({
      organization_id: eigOrg.id, context_type: "direct", context_label: "Direct Squawk",
      created_by: user.id, status: "open", direct_key: directKey,
    }).select("id").single();
    if (inserted.error) {
      const raced = await admin.from("squawk_threads").select("id").eq("direct_key", directKey).maybeSingle();
      thread = raced.data;
    } else thread = inserted.data;
  }
  if (!thread?.id) return json({ success: false, error: "Unable to open the direct Squawk." }, 500);

  const participantResult = await admin.from("squawk_thread_participants").upsert([
    { thread_id: thread.id, user_id: user.id },
    { thread_id: thread.id, user_id: recipient.id },
  ], { onConflict: "thread_id,user_id" });
  if (participantResult.error) return json({ success: false, error: "Unable to connect the direct Squawk participants." }, 500);

  if (replyId) {
    const { data: reply } = await admin.from("squawk_messages").select("id,thread_id").eq("id", replyId).maybeSingle();
    if (!reply || reply.thread_id !== thread.id) return json({ success: false, error: "That reply target is not in this conversation." }, 400);
  }

  const now = new Date().toISOString();
  const { data: message, error: messageError } = await admin.from("squawk_messages").insert({
    thread_id: thread.id, created_by: user.id, message_kind: "direct_message", visibility: "direct",
    required_roles: [], safe_label: "Direct Squawk", requires_review: false, status: "sent",
    sent_at: now, audience_key: "direct_user", channels: ["in_app"], reply_to_message_id: replyId, metadata: { direct: true },
  }).select("id").single();
  if (messageError || !message?.id) return json({ success: false, error: "The Direct Squawk could not be created." }, 500);

  const senderName = sender?.username ? "@" + sender.username : "ElevationPilot";
  const contentResult = await admin.from("squawk_message_content").insert({
    message_id: message.id, subject: "Direct Squawk from " + senderName, body: messageBody, in_app_body: messageBody,
  });
  if (contentResult.error) return json({ success: false, error: "The Direct Squawk content could not be saved." }, 500);

  const recipientResult = await admin.from("squawk_message_recipients").insert({
    message_id: message.id, user_id: recipient.id, recipient_type: "user", channel: "in_app",
    destination_masked: "@" + recipient.username, delivery_status: "delivered", provider: "in_app",
    delivered_at: now, last_status_at: now,
  });
  if (recipientResult.error) return json({ success: false, error: "The Direct Squawk recipient could not be saved." }, 500);

  await admin.from("squawk_message_receipts").upsert({ message_id: message.id, user_id: user.id, read_at: now }, { onConflict: "message_id,user_id" });
  await admin.from("squawk_threads").update({ updated_at: now }).eq("id", thread.id);

  return json({ success: true, thread_id: thread.id, message_id: message.id, recipient: displayProfile(recipient), sent_at: now });
});

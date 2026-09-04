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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
}

function needsMergeField(value: string, field: "payment_link" | "invoice_link") {
  return new RegExp(`{{\\s*${field}\\s*}}`, "i").test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const authHeader = req.headers.get("Authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return json({ success: false, error: "Email delivery is not fully configured." }, 503);
  }
  if (!accessToken) return json({ success: false, error: "Authentication required." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  const user = userData?.user;
  if (userError || !user) return json({ success: false, error: "Your session is no longer valid." }, 401);

  let requestBody: { message_id?: string } = {};
  try {
    requestBody = await req.json();
  } catch {
    return json({ success: false, error: "A message ID is required." }, 400);
  }
  const messageId = requestBody.message_id?.trim();
  if (!messageId) return json({ success: false, error: "A message ID is required." }, 400);

  const { data: message, error: messageError } = await admin
    .from("squawk_messages")
    .select("id,thread_id,created_by,message_kind,status,channels,requires_review,reviewed_at,sent_at")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError || !message) return json({ success: false, error: "Squawk message not found." }, 404);
  if (!["draft", "partially_sent"].includes(message.status)) {
    return json({ success: false, error: "Only a draft or partially sent Squawk can be sent." }, 409);
  }
  if (!message.channels?.includes("email")) {
    return json({ success: false, error: "This Squawk is not configured for email." }, 400);
  }

  const { data: thread, error: threadError } = await admin
    .from("squawk_threads")
    .select("id,organization_id,event_id,context_label")
    .eq("id", message.thread_id)
    .maybeSingle();
  if (threadError || !thread) return json({ success: false, error: "Squawk context not found." }, 404);

  const [profileResult, membershipResult, assignmentResult] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("organization_memberships").select("role,status").eq("organization_id", thread.organization_id).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    thread.event_id
      ? admin.from("event_assignments").select("role,status").eq("event_id", thread.event_id).eq("user_id", user.id).eq("status", "active").maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const isEigAdmin = ["eig_admin", "super_admin"].includes(profileResult.data?.role || "");
  const organizationRole = membershipResult.data?.role || "";
  const canManageOrganization = ["organization_admin", "organization_staff"].includes(organizationRole);
  const isAssignedToEvent = Boolean(assignmentResult.data);
  if (!isEigAdmin && !canManageOrganization && !isAssignedToEvent) {
    return json({ success: false, error: "You do not have permission to send this Squawk." }, 403);
  }
  if (message.created_by !== user.id && !isEigAdmin && !canManageOrganization) {
    return json({ success: false, error: "Only the author or a Hangar administrator can send this draft." }, 403);
  }
  if (message.requires_review && !message.reviewed_at && !isEigAdmin && organizationRole !== "organization_admin") {
    return json({ success: false, error: "This message requires Pilot review before sending." }, 409);
  }

  const { data: connection } = await admin
    .from("squawk_channel_connections")
    .select("connection_status,provider")
    .eq("organization_id", thread.organization_id)
    .eq("channel", "email")
    .maybeSingle();
  if (connection?.provider !== "resend" || connection.connection_status !== "connected") {
    return json({ success: false, error: "Resend must be connected and verified before sending." }, 503);
  }

  const [{ data: content }, { data: recipientRows, error: recipientsError }] = await Promise.all([
    admin.from("squawk_message_content").select("subject,body,email_body").eq("message_id", messageId).maybeSingle(),
    admin.from("squawk_message_recipients")
      .select("id,registration_id,delivery_status,attempt_count")
      .eq("message_id", messageId)
      .eq("channel", "email")
      .in("delivery_status", ["pending", "failed"]),
  ]);
  if (!content?.email_body && !content?.body) return json({ success: false, error: "Email content is missing." }, 400);
  if (recipientsError || !recipientRows?.length) {
    return json({ success: false, error: "No unsent email recipients were selected." }, 400);
  }

  const registrationIds = recipientRows.map((row) => row.registration_id).filter(Boolean);
  const [{ data: registrations, error: registrationError }, { data: preferences }] = await Promise.all([
    admin.from("golf_registrations")
      .select("id,organization_id,event_id,event_name,first_name,last_name,email,registration_status,custom_fields")
      .in("id", registrationIds),
    admin.from("squawk_recipient_preferences")
      .select("registration_id,email_status,do_not_contact")
      .eq("organization_id", thread.organization_id)
      .in("registration_id", registrationIds),
  ]);
  if (registrationError) return json({ success: false, error: "Registration recipients could not be loaded." }, 500);

  const registrationById = new Map((registrations || []).map((registration) => [registration.id, registration]));
  const preferenceByRegistrationId = new Map((preferences || []).map((preference) => [preference.registration_id, preference]));
  const subjectTemplate = content.subject?.trim() || "Event update";
  const bodyTemplate = content.email_body || content.body;
  const prepared: Array<{ recipient: any; registration: any; subject: string; html: string; text: string }> = [];

  for (const recipient of recipientRows) {
    const registration = registrationById.get(recipient.registration_id);
    const preference = preferenceByRegistrationId.get(recipient.registration_id);
    const belongsToContext = registration && (!thread.event_id || registration.event_id === thread.event_id) && (!registration.organization_id || registration.organization_id === thread.organization_id);
    const allowed = belongsToContext && registration.registration_status === "active" && registration.email && !preference?.do_not_contact && preference?.email_status !== "unsubscribed";
    if (!allowed) {
      await admin.from("squawk_message_recipients").update({ delivery_status: "cancelled", last_status_at: new Date().toISOString(), error_code: "recipient_ineligible", error_message: "Recipient is no longer eligible for this message." }).eq("id", recipient.id);
      continue;
    }

    const customFields = registration.custom_fields && typeof registration.custom_fields === "object" ? registration.custom_fields : {};
    const values = {
      first_name: registration.first_name || "there",
      event_name: registration.event_name || thread.context_label || "your event",
      payment_link: typeof customFields.payment_link === "string" ? customFields.payment_link : "",
      invoice_link: typeof customFields.invoice_link === "string" ? customFields.invoice_link : "",
    };
    const combinedTemplate = `${subjectTemplate}\n${bodyTemplate}`;
    if ((needsMergeField(combinedTemplate, "payment_link") && !values.payment_link) || (needsMergeField(combinedTemplate, "invoice_link") && !values.invoice_link)) {
      return json({ success: false, error: "This template needs a verified payment or invoice link before it can be sent." }, 409);
    }
    const subject = renderTemplate(subjectTemplate, values);
    const text = renderTemplate(bodyTemplate, values);
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1D245D;white-space:pre-wrap">${escapeHtml(text)}</div>`;
    prepared.push({ recipient, registration, subject, html, text });
  }

  if (!prepared.length) return json({ success: false, error: "No eligible email recipients remain." }, 400);

  const now = new Date().toISOString();
  await admin.from("squawk_messages").update({ status: "queued", updated_at: now }).eq("id", messageId);
  await admin.from("squawk_message_recipients").update({ delivery_status: "queued", queued_at: now, last_status_at: now }).in("id", prepared.map((item) => item.recipient.id));

  const from = Deno.env.get("SQUAWK_FROM_EMAIL") || "ElevationPilot <squawk@elevatedimpactgroup.net>";
  const replyTo = Deno.env.get("SQUAWK_REPLY_TO_EMAIL") || "info@elevatedimpactgroup.net";
  const resendResponse = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `squawk-email/${messageId}`,
    },
    body: JSON.stringify(prepared.map((item) => ({
      from,
      to: [item.registration.email],
      reply_to: replyTo,
      subject: item.subject,
      html: item.html,
      text: item.text,
    }))),
  });

  const resendResult = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    const failureAt = new Date().toISOString();
    for (const item of prepared) {
      await admin.from("squawk_message_recipients").update({
        delivery_status: "failed",
        failed_at: failureAt,
        last_status_at: failureAt,
        provider: "resend",
        error_code: String(resendResult?.name || resendResponse.status),
        error_message: String(resendResult?.message || "Resend rejected the batch."),
        attempt_count: Number(item.recipient.attempt_count || 0) + 1,
      }).eq("id", item.recipient.id);
    }
    await admin.from("squawk_messages").update({ status: "draft", updated_at: failureAt }).eq("id", messageId);
    await admin.from("squawk_audit_log").insert({ organization_id: thread.organization_id, event_id: thread.event_id, thread_id: thread.id, message_id: messageId, actor_user_id: user.id, action: "email_send_failed", details: { provider: "resend", recipient_count: prepared.length, provider_error: String(resendResult?.name || resendResponse.status) } });
    return json({ success: false, error: String(resendResult?.message || "Resend could not send this email batch.") }, 502);
  }

  const providerRows = Array.isArray(resendResult?.data) ? resendResult.data : [];
  const sentAt = new Date().toISOString();
  for (let index = 0; index < prepared.length; index += 1) {
    const item = prepared[index];
    const providerMessageId = providerRows[index]?.id || null;
    await admin.from("squawk_message_recipients").update({
      delivery_status: "sent",
      provider: "resend",
      provider_message_id: providerMessageId,
      sent_at: sentAt,
      last_status_at: sentAt,
      error_code: null,
      error_message: null,
      attempt_count: Number(item.recipient.attempt_count || 0) + 1,
    }).eq("id", item.recipient.id);
    await admin.from("squawk_delivery_events").insert({ recipient_id: item.recipient.id, message_id: messageId, organization_id: thread.organization_id, provider: "resend", provider_event_id: providerMessageId, event_type: "sent", event_at: sentAt, details: { source: "send-squawk-email" } });
  }

  await admin.from("squawk_messages").update({ status: "sent", sent_at: sentAt, updated_at: sentAt }).eq("id", messageId);
  await admin.from("squawk_audit_log").insert({ organization_id: thread.organization_id, event_id: thread.event_id, thread_id: thread.id, message_id: messageId, actor_user_id: user.id, action: "email_sent", details: { provider: "resend", recipient_count: prepared.length } });

  return json({ success: true, sent_count: prepared.length, message_id: messageId });
});

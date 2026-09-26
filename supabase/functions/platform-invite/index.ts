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

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value: unknown, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    eig_admin: "EIG Admin",
    organization_admin: "Pilot",
    organization_staff: "Co-Pilot",
    event_coordinator: "ATC",
    event_staff: "Crew",
    passenger: "Passenger",
  };
  return labels[role] || role.replaceAll("_", " ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeRedirect(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const allowed =
      url.protocol === "https:" &&
      (host === "elevatedimpactgroup.net" ||
        host.endsWith(".elevatedimpactgroup.net") ||
        host.endsWith(".vercel.app"));
    const local = url.protocol === "http:" && (host === "localhost" || host === "127.0.0.1");
    return allowed || local ? url.toString() : "";
  } catch {
    return "";
  }
}

async function findUserByEmail(admin: any, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data?.users || []).find((item: any) => String(item.email || "").toLowerCase() === email) || null;
}

async function getCallerAccess(admin: any, userId: string, organizationId: string) {
  const [profileResult, eigMembershipResult, targetMembershipResult] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    admin.from("organization_memberships")
      .select("id,role,status")
      .eq("user_id", userId)
      .eq("role", "eig_admin")
      .eq("status", "active")
      .limit(1),
    admin.from("organization_memberships")
      .select("role,status")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (eigMembershipResult.error) throw eigMembershipResult.error;
  if (targetMembershipResult.error) throw targetMembershipResult.error;

  const isPlatformAdmin =
    profileResult.data?.role === "super_admin" ||
    Boolean(eigMembershipResult.data?.length);
  const targetRole = targetMembershipResult.data?.role || "";

  return { isPlatformAdmin, targetRole };
}

async function generateAuthLink(admin: any, email: string, existing: boolean, redirectTo: string) {
  const type = existing ? "magiclink" : "invite";
  const withRedirect: any = {
    type,
    email,
    ...(redirectTo ? { options: { redirectTo } } : {}),
  };

  let result = await admin.auth.admin.generateLink(withRedirect);
  if (result.error && redirectTo) {
    result = await admin.auth.admin.generateLink({ type, email } as any);
  }
  return result;
}

async function sendInviteEmail(resendApiKey: string, params: {
  email: string;
  inviteeName: string;
  inviterName: string;
  organizationName: string;
  eventName: string;
  role: string;
  actionLink: string;
}) {
  const hello = params.inviteeName ? `Hi ${escapeHtml(params.inviteeName)},` : "Hello,";
  const context = params.eventName
    ? `${escapeHtml(params.organizationName)} · ${escapeHtml(params.eventName)}`
    : escapeHtml(params.organizationName);
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1D245D;max-width:620px;margin:auto">
      <div style="padding:18px 0;font-weight:900;letter-spacing:.06em">ELEVATIONPILOT · EIG</div>
      <h1 style="margin:0 0 12px;font-size:28px">You're invited aboard.</h1>
      <p>${hello}</p>
      <p><strong>${escapeHtml(params.inviterName || "Elevated Impact Group")}</strong> invited you to join <strong>${context}</strong> as <strong>${escapeHtml(roleLabel(params.role))}</strong>.</p>
      <p>Use the secure button below to open ElevationPilot. New accounts will choose an @username and password before access is activated.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(params.actionLink)}" style="display:inline-block;background:#D81C22;color:#fff;text-decoration:none;font-weight:900;padding:13px 20px;border-radius:9px">Accept ElevationPilot Invite</a>
      </p>
      <p style="font-size:12px;color:#70727A">This invitation expires in 14 days. If you were not expecting it, you can ignore this email.</p>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("ELEVATIONPILOT_FROM_EMAIL") || "ElevationPilot <squawk@elevatedimpactgroup.net>",
      to: [params.email],
      reply_to: Deno.env.get("SQUAWK_REPLY_TO_EMAIL") || "info@elevatedimpactgroup.net",
      subject: `You're invited to ElevationPilot as ${roleLabel(params.role)}`,
      html,
    }),
  });

  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, body, status: response.status };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "Invitation service is not configured." }, 503);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json({ success: false, error: "Authentication required." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  const user = userData?.user;
  if (userError || !user) return json({ success: false, error: "Your session is no longer valid." }, 401);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "A JSON request body is required." }, 400);
  }
  const action = String(body?.action || "").trim();

  if (action === "mine") {
    const email = normalizeEmail(user.email);
    if (!email) return json({ success: false, error: "Your account does not have an email address." }, 400);

    await admin.from("platform_invitations")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .ilike("email", email);

    const { data: invitations, error: inviteError } = await admin
      .from("platform_invitations")
      .select("id,email,invitee_name,organization_id,event_id,role,status,recipient_was_existing,expires_at,created_at,organization:organizations(id,name,slug),event:golf_registration_events(id,name,course)")
      .ilike("email", email)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (inviteError) return json({ success: false, error: "Unable to load your invitations." }, 500);

    const { data: profile } = await admin
      .from("profiles")
      .select("id,first_name,last_name,display_name,username")
      .eq("id", user.id)
      .maybeSingle();

    if (invitations?.length) {
      await admin.from("platform_invitations")
        .update({ invited_user_id: user.id })
        .in("id", invitations.map((item: any) => item.id));
    }

    return json({ success: true, invitations: invitations || [], profile: profile || null });
  }

  if (action === "accept") {
    const inviteId = cleanText(body?.invite_id, 80);
    if (!inviteId) return json({ success: false, error: "Invitation ID is required." }, 400);

    const { data: invitation, error: inviteError } = await admin
      .from("platform_invitations")
      .select("*")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError || !invitation) return json({ success: false, error: "Invitation not found." }, 404);
    if (invitation.status === "accepted" && invitation.invited_user_id === user.id) {
      return json({ success: true, already_accepted: true, role: invitation.role });
    }
    if (invitation.status !== "pending") return json({ success: false, error: "This invitation is no longer active." }, 409);
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await admin.from("platform_invitations").update({ status: "expired" }).eq("id", invitation.id);
      return json({ success: false, error: "This invitation has expired." }, 410);
    }
    if (normalizeEmail(invitation.email) !== normalizeEmail(user.email)) {
      return json({ success: false, error: "This invitation belongs to a different email address." }, 403);
    }
    if (!user.email_confirmed_at) {
      return json({ success: false, error: "Confirm your email before accepting this invitation." }, 409);
    }

    const username = cleanText(body?.username, 30).toLowerCase();
    if (!username) return json({ success: false, error: "Choose an @username to continue." }, 400);
    const firstName = cleanText(body?.first_name, 80);
    const lastName = cleanText(body?.last_name, 80);
    const displayName = cleanText(body?.display_name, 120) || [firstName, lastName].filter(Boolean).join(" ") || username;

    const { error: profileError } = await admin.from("profiles").update({
      username,
      first_name: firstName || null,
      last_name: lastName || null,
      display_name: displayName,
    }).eq("id", user.id);

    if (profileError) {
      const message = String(profileError.message || "");
      if (message.toLowerCase().includes("duplicate") || String((profileError as any).code || "") === "23505") {
        return json({ success: false, error: "That @username is already taken." }, 409);
      }
      if (message.toLowerCase().includes("reserved")) {
        return json({ success: false, error: "That @username is reserved." }, 409);
      }
      return json({ success: false, error: message || "Unable to save your profile." }, 400);
    }

    if (["eig_admin", "organization_admin", "organization_staff"].includes(invitation.role)) {
      const { data: currentMembership } = await admin.from("organization_memberships")
        .select("id,role,status")
        .eq("organization_id", invitation.organization_id)
        .eq("user_id", user.id)
        .maybeSingle();

      const rank: Record<string, number> = { organization_staff: 1, organization_admin: 2, eig_admin: 3 };
      const currentRole = currentMembership?.role || "";
      const finalRole = (rank[currentRole] || 0) > (rank[invitation.role] || 0) ? currentRole : invitation.role;

      const { error: membershipError } = await admin.from("organization_memberships").upsert({
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: finalRole,
        status: "active",
        invited_by: invitation.invited_by,
      }, { onConflict: "organization_id,user_id" });
      if (membershipError) return json({ success: false, error: "Your organization access could not be activated." }, 500);

      if (invitation.role === "eig_admin") {
        const { error: superError } = await admin.from("profiles").update({ role: "super_admin" }).eq("id", user.id);
        if (superError) return json({ success: false, error: "Your EIG administrator access could not be activated." }, 500);
      }
    } else if (["event_coordinator", "event_staff"].includes(invitation.role)) {
      const { data: currentAssignment } = await admin.from("event_assignments")
        .select("id,role,status")
        .eq("event_id", invitation.event_id)
        .eq("user_id", user.id)
        .maybeSingle();
      const finalRole =
        currentAssignment?.role === "event_coordinator"
          ? "event_coordinator"
          : invitation.role;

      const { error: assignmentError } = await admin.from("event_assignments").upsert({
        event_id: invitation.event_id,
        user_id: user.id,
        role: finalRole,
        status: "active",
        assigned_by: invitation.invited_by,
      }, { onConflict: "event_id,user_id" });
      if (assignmentError) return json({ success: false, error: "Your event access could not be activated." }, 500);
    }

    const acceptedAt = new Date().toISOString();
    await admin.from("platform_invitations").update({
      status: "accepted",
      invited_user_id: user.id,
      accepted_at: acceptedAt,
      last_error: null,
    }).eq("id", invitation.id);

    return json({
      success: true,
      role: invitation.role,
      organization_id: invitation.organization_id,
      event_id: invitation.event_id,
      accepted_at: acceptedAt,
    });
  }

  if (action !== "send") return json({ success: false, error: "Unsupported invitation action." }, 400);

  const email = normalizeEmail(body?.email);
  const inviteeName = cleanText(body?.invitee_name, 120);
  const organizationId = cleanText(body?.organization_id, 80);
  const eventId = cleanText(body?.event_id, 80) || null;
  const role = cleanText(body?.role, 40);
  const redirectTo = safeRedirect(body?.redirect_to);
  const allowedRoles = ["eig_admin", "organization_admin", "organization_staff", "event_coordinator", "event_staff", "passenger"];

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ success: false, error: "Enter a valid email address." }, 400);
  if (!organizationId) return json({ success: false, error: "Choose an organization for this invitation." }, 400);
  if (!allowedRoles.includes(role)) return json({ success: false, error: "Choose a valid ElevationPilot role." }, 400);
  if (["event_coordinator", "event_staff"].includes(role) && !eventId) {
    return json({ success: false, error: "Choose an event for ATC or Crew access." }, 400);
  }

  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .select("id,name,slug,status")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgError || !organization) return json({ success: false, error: "Organization not found." }, 404);

  const { isPlatformAdmin, targetRole } = await getCallerAccess(admin, user.id, organizationId);
  const orgAdminCanGrant = ["organization_staff", "event_coordinator", "event_staff"].includes(role);
  if (!isPlatformAdmin && !(targetRole === "organization_admin" && orgAdminCanGrant)) {
    return json({ success: false, error: "You do not have permission to grant that role." }, 403);
  }
  if (role === "eig_admin" && organization.slug !== "elevated-impact-group") {
    return json({ success: false, error: "EIG Admin access can only be attached to the EIG Command Center." }, 400);
  }

  let event: any = null;
  if (eventId) {
    const { data, error } = await admin.from("golf_registration_events")
      .select("id,name,course,organization_id")
      .eq("id", eventId)
      .maybeSingle();
    if (error || !data) return json({ success: false, error: "Event not found." }, 404);
    if (data.organization_id !== organizationId) return json({ success: false, error: "That event does not belong to the selected Hangar." }, 400);
    event = data;
  }

  const now = new Date().toISOString();
  await admin.from("platform_invitations")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", now)
    .ilike("email", email);

  let pendingQuery = admin.from("platform_invitations")
    .select("*")
    .ilike("email", email)
    .eq("organization_id", organizationId)
    .eq("role", role)
    .eq("status", "pending");
  pendingQuery = eventId ? pendingQuery.eq("event_id", eventId) : pendingQuery.is("event_id", null);
  const { data: pendingRows, error: pendingError } = await pendingQuery.limit(1);
  if (pendingError) return json({ success: false, error: "Unable to prepare the invitation." }, 500);

  const existingUser = await findUserByEmail(admin, email);
  let invitation: any = pendingRows?.[0] || null;
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  if (invitation) {
    const { data, error } = await admin.from("platform_invitations").update({
      invitee_name: inviteeName || invitation.invitee_name,
      invited_by: user.id,
      invited_user_id: existingUser?.id || invitation.invited_user_id,
      recipient_was_existing: Boolean(existingUser),
      expires_at: expiresAt,
      revoked_at: null,
      last_error: null,
    }).eq("id", invitation.id).select("*").single();
    if (error) return json({ success: false, error: "Unable to refresh the invitation." }, 500);
    invitation = data;
  } else {
    const { data, error } = await admin.from("platform_invitations").insert({
      email,
      invitee_name: inviteeName || null,
      organization_id: organizationId,
      event_id: eventId,
      role,
      invited_by: user.id,
      invited_user_id: existingUser?.id || null,
      recipient_was_existing: Boolean(existingUser),
      expires_at: expiresAt,
    }).select("*").single();
    if (error) return json({ success: false, error: error.message || "Unable to create the invitation." }, 500);
    invitation = data;
  }

  const linkResult = await generateAuthLink(admin, email, Boolean(existingUser), redirectTo);
  if (linkResult.error || !linkResult.data?.properties?.action_link) {
    const message = linkResult.error?.message || "Unable to create a secure invitation link.";
    await admin.from("platform_invitations").update({ last_error: message }).eq("id", invitation.id);
    return json({ success: false, error: message }, 500);
  }

  const actionLink = linkResult.data.properties.action_link;
  const linkedUserId = linkResult.data.user?.id || existingUser?.id || null;
  if (linkedUserId && linkedUserId !== invitation.invited_user_id) {
    await admin.from("platform_invitations").update({ invited_user_id: linkedUserId }).eq("id", invitation.id);
  }

  const { data: inviterProfile } = await admin.from("profiles")
    .select("display_name,first_name,last_name,username")
    .eq("id", user.id)
    .maybeSingle();
  const inviterName =
    inviterProfile?.display_name ||
    [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(" ") ||
    (inviterProfile?.username ? "@" + inviterProfile.username : "") ||
    "Elevated Impact Group";

  let emailSent = false;
  let resendMessageId: string | null = null;
  let emailError = "";
  if (resendApiKey) {
    const delivery = await sendInviteEmail(resendApiKey, {
      email,
      inviteeName,
      inviterName,
      organizationName: organization.name,
      eventName: event?.name || "",
      role,
      actionLink,
    });
    emailSent = delivery.ok;
    resendMessageId = delivery.body?.id || null;
    if (!delivery.ok) emailError = String(delivery.body?.message || `Email provider returned ${delivery.status}`);
  } else {
    emailError = "Resend is not configured for invitation delivery.";
  }

  await admin.from("platform_invitations").update({
    sent_at: emailSent ? new Date().toISOString() : invitation.sent_at,
    resend_message_id: resendMessageId,
    last_error: emailError || null,
  }).eq("id", invitation.id);

  return json({
    success: true,
    invitation_id: invitation.id,
    email_sent: emailSent,
    invite_link: actionLink,
    recipient_was_existing: Boolean(existingUser),
    warning: emailError || null,
  });
});

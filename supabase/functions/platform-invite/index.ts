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
const ACCOUNT_GENDERS = new Set(["Male", "Female", "Prefer not to say"]);
function validAccountDob(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0,10) === value &&
    Number(value.slice(0,4)) >= 1900 &&
    value <= new Date().toISOString().slice(0,10);
}

function isAccessWindowActive(row: any, nowMs = Date.now()) {
  if (!row || row.status !== "active") return false;
  const starts = row.access_starts_at ? new Date(row.access_starts_at).getTime() : null;
  const ends = row.access_ends_at ? new Date(row.access_ends_at).getTime() : null;
  return (starts === null || starts <= nowMs) && (ends === null || ends >= nowMs);
}

function dateStartIso(value: unknown) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateEndIso(value: unknown) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + "T23:59:59.999Z");
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function addDaysDate(value: string, days: number) {
  const parsed = new Date(value + "T12:00:00.000Z");
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function resolveAccessWindow(body: any, event: any, role: string) {
  const eventRole = ["event_coordinator", "event_staff"].includes(role);
  const mode = cleanText(body?.access_mode, 30) || (eventRole ? "event_plus_7" : "indefinite");

  if (mode === "indefinite") {
    return { mode, startsAt: null, endsAt: null, error: "" };
  }

  if (mode === "event_plus_7") {
    if (!eventRole || !event) return { mode, startsAt: null, endsAt: null, error: "Event + 7 days is only available for event roles." };
    const dates = Array.isArray(event.event_dates) ? event.event_dates.map((item: unknown) => cleanText(item, 10)).filter(Boolean) : [];
    const eventEnd = dates[dates.length - 1] || dates[0] || "";
    if (!eventEnd) return { mode, startsAt: null, endsAt: null, error: "Add the event date before using Event + 7 days access." };
    return {
      mode,
      startsAt: new Date().toISOString(),
      endsAt: dateEndIso(addDaysDate(eventEnd, 7)),
      error: "",
    };
  }

  if (mode === "custom") {
    const startsAt = dateStartIso(body?.access_start_date);
    const endsAt = dateEndIso(body?.access_end_date);
    if (!startsAt || !endsAt) return { mode, startsAt: null, endsAt: null, error: "Choose both an access start date and end date." };
    if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      return { mode, startsAt: null, endsAt: null, error: "Access end date must be on or after the start date." };
    }
    return { mode, startsAt, endsAt, error: "" };
  }

  return { mode, startsAt: null, endsAt: null, error: "Choose a valid access duration." };
}

function mergeAccessWindow(current: any, startsAt: string | null, endsAt: string | null) {
  if (!current) return { startsAt, endsAt };
  const currentStart = current.access_starts_at || null;
  const currentEnd = current.access_ends_at || null;
  const mergedStart = currentStart === null || startsAt === null
    ? null
    : (new Date(currentStart).getTime() <= new Date(startsAt).getTime() ? currentStart : startsAt);
  const mergedEnd = currentEnd === null || endsAt === null
    ? null
    : (new Date(currentEnd).getTime() >= new Date(endsAt).getTime() ? currentEnd : endsAt);
  return { startsAt: mergedStart, endsAt: mergedEnd };
}

function accessDescription(startsAt: string | null, endsAt: string | null) {
  if (!endsAt) return "Indefinite access";
  const start = startsAt ? new Date(startsAt).toLocaleDateString("en-US", { timeZone: "UTC" }) : "Now";
  const end = new Date(endsAt).toLocaleDateString("en-US", { timeZone: "UTC" });
  return start + " through " + end;
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

async function callerIsPlatformAdmin(admin: any, userId: string) {
  const [profileResult, eigMembershipResult] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    admin.from("organization_memberships")
      .select("id,role,status,access_starts_at,access_ends_at")
      .eq("user_id", userId)
      .eq("role", "eig_admin")
      .eq("status", "active"),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (eigMembershipResult.error) throw eigMembershipResult.error;

  return (
    profileResult.data?.role === "super_admin" ||
    Boolean((eigMembershipResult.data || []).find((row: any) => isAccessWindowActive(row)))
  );
}

async function listAllAuthUsers(admin: any) {
  const users: any[] = [];
  const perPage = 1000;
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) return { users, truncated: false };
  }

  return { users, truncated: true };
}

async function getCallerAccess(admin: any, userId: string, organizationId: string) {
  const [profileResult, eigMembershipResult, targetMembershipResult] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    admin.from("organization_memberships")
      .select("id,role,status,access_starts_at,access_ends_at")
      .eq("user_id", userId)
      .eq("role", "eig_admin")
      .eq("status", "active")
      .limit(1),
    admin.from("organization_memberships")
      .select("role,status,access_starts_at,access_ends_at")
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
    Boolean((eigMembershipResult.data || []).find((row: any) => isAccessWindowActive(row)));
  const targetMembership = isAccessWindowActive(targetMembershipResult.data) ? targetMembershipResult.data : null;
  const targetRole = targetMembership?.role || "";

  return { isPlatformAdmin, targetRole };
}

async function callerCanManagePassengerInvite(admin: any, userId: string, organizationId: string, eventId: string | null) {
  const access = await getCallerAccess(admin, userId, organizationId);
  if (access.isPlatformAdmin || ["organization_admin", "organization_staff"].includes(access.targetRole)) return true;
  if (!eventId) return false;

  const { data: assignment, error } = await admin.from("event_assignments")
    .select("id,role,status,access_starts_at,access_ends_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("role", "event_coordinator")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return isAccessWindowActive(assignment);
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

async function syncRoster(supabaseUrl: string, serviceRoleKey: string, eventKey: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/sync-google-roster`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_key: eventKey }),
    });
  } catch {
    // Invitation delivery must not fail just because roster sync is temporarily unavailable.
  }
}

async function sendInviteEmail(resendApiKey: string, params: {
  email: string;
  inviteeName: string;
  inviterName: string;
  organizationName: string;
  eventName: string;
  role: string;
  actionLink: string;
  accessLabel: string;
  registrationInvite?: boolean;
}) {
  const hello = params.inviteeName ? `Hi ${escapeHtml(params.inviteeName)},` : "Hello,";
  const context = params.eventName
    ? `${escapeHtml(params.organizationName)} · ${escapeHtml(params.eventName)}`
    : escapeHtml(params.organizationName);
  const passengerCopy = params.registrationInvite;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1D245D;max-width:620px;margin:auto">
      <div style="padding:18px 0;font-weight:900;letter-spacing:.06em">ELEVATIONPILOT · EIG</div>
      <h1 style="margin:0 0 12px;font-size:28px">${passengerCopy ? "Your event registration is waiting." : "You're invited aboard."}</h1>
      <p>${hello}</p>
      <p>${passengerCopy
        ? `<strong>${escapeHtml(params.inviterName || "Elevated Impact Group")}</strong> added you to the roster for <strong>${context}</strong>. Your spot is saved. Claim your Passenger account to manage the registration and pay any balance online.`
        : `<strong>${escapeHtml(params.inviterName || "Elevated Impact Group")}</strong> invited you to join <strong>${context}</strong> as <strong>${escapeHtml(roleLabel(params.role))}</strong>.`}</p>
      ${passengerCopy ? "" : `<p><strong>Access:</strong> ${escapeHtml(params.accessLabel)}</p>`}
      <p>${passengerCopy
        ? "Use the secure button below. Existing EIG accounts will reconnect to this registration. New Passengers will choose an @username and password."
        : "Use the secure button below to open ElevationPilot. Existing accounts can accept the assignment directly. New accounts will choose an @username and password before access is activated."}</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(params.actionLink)}" style="display:inline-block;background:#D81C22;color:#fff;text-decoration:none;font-weight:900;padding:13px 20px;border-radius:9px">${passengerCopy ? "Claim Passenger Account" : "Accept ElevationPilot Invite"}</a>
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
      subject: params.registrationInvite && params.eventName
        ? `${params.eventName}: claim your EIG Passenger account`
        : `You're invited to ElevationPilot as ${roleLabel(params.role)}`,
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

  let admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  const user = userData?.user;
  if (userError || !user) return json({ success: false, error: "Your session is no longer valid." }, 401);

  // Actor header is added only after Auth validates this request's JWT.
  admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-eig-actor-id": user.id } },
  });
  let actorSessionId = "";
  try {
    const payload = accessToken.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    actorSessionId = JSON.parse(atob(payload)).session_id || "";
  } catch { /* New sensitive actions below reject missing session IDs. */ }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "A JSON request body is required." }, 400);
  }
  const action = String(body?.action || "").trim();

  if (["admin_session_signout", "admin_account_history"].includes(action)) {
    try {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const targetId = cleanText(body?.target_user_id, 80);
      if (!uuid.test(targetId) || !uuid.test(actorSessionId)) return json({ success: false, error: "A valid account and administrator session are required." }, 400);
      const { error: permissionError } = await admin.rpc("platform_assert_active_admin", { p_actor_id: user.id, p_actor_session_id: actorSessionId });
      if (permissionError) return json({ success: false, error: "An active, verified EIG administrator session is required." }, 403);
      if (action === "admin_session_signout") {
        const reason = String(body?.reason || "").trim();
        if (body?.confirmation !== targetId || !uuid.test(String(body?.request_id || "")) || !reason || reason.length > 500) {
          return json({ success: false, error: "Confirm the exact account and provide a reason and request ID." }, 400);
        }
        const { data, error } = await admin.rpc("platform_revoke_account_sessions", {
          p_actor_id: user.id, p_actor_session_id: actorSessionId, p_target_id: targetId,
          p_request_id: body.request_id, p_reason: reason,
        });
        if (error) return json({ success: false, error: error.code === "42501" ? "This session action is not permitted." : "Unable to revoke sessions. Review account history before another request." }, error.code === "42501" ? 403 : 500);
        return json({ success: true, ...data });
      }
      const { data, error } = await admin.from("platform_account_audit")
        .select("id,target_user_id,actor_user_id,action,outcome,reason,before_state,after_state,created_at")
        .eq("target_user_id", targetId).order("created_at", { ascending: false }).order("id").limit(101);
      if (error) return json({ success: false, error: "Unable to load account history." }, 500);
      const entries = (data || []).slice(0,100);
      const actorIds = [...new Set(entries.map((row: any) => row.actor_user_id).filter(Boolean))];
      let actorProfiles: any[] = [];
      if (actorIds.length) {
        const result = await admin.from("profiles").select("id,display_name,first_name,last_name,username").in("id",actorIds);
        if (result.error) return json({ success: false, error: "Unable to identify history actors." }, 500);
        actorProfiles = result.data || [];
      }
      const actorMap = new Map(actorProfiles.map((profile: any) => [profile.id,profile]));
      return json({ success: true, has_more: (data || []).length > 100, entries: entries.map((row: any) => {
        const profile: any = actorMap.get(row.actor_user_id);
        const label = cleanText(profile?.display_name) || [cleanText(profile?.first_name),cleanText(profile?.last_name)].filter(Boolean).join(" ") || (profile?.username ? "@" + profile.username : "");
        return { ...row, actor_label: label || (row.actor_user_id ? "Administrator " + row.actor_user_id : "System / legacy action") };
      }) });
    } catch (error) {
      console.error("Account security/history request failed", error);
      return json({ success: false, error: "Unable to complete the account security/history request." }, 500);
    }
  }

  if (action === "admin_users") {
    const isPlatformAdmin = await callerIsPlatformAdmin(admin, user.id);
    if (!isPlatformAdmin) {
      return json({ success: false, error: "EIG Admin access is required." }, 403);
    }

    try {
      const authResult = await listAllAuthUsers(admin);
      const [
        profilesResult,
        passengersResult,
        contactsResult,
        membershipsResult,
        assignmentsResult,
        invitationsResult,
      ] = await Promise.all([
        admin.from("profiles")
          .select("id,first_name,last_name,display_name,username,phone,created_at,updated_at,account_status"),
        admin.from("passengers")
          .select("id,auth_user_id,first_name,last_name,preferred_name,status,merged_into_passenger_id,claimed_at,created_at,updated_at"),
        admin.from("passenger_contacts")
          .select("id,passenger_id,contact_type,contact_value,is_primary,is_verified,verified_at,is_active"),
        admin.from("organization_memberships")
          .select("id,organization_id,user_id,role,status,invited_by,created_at,updated_at,access_starts_at,access_ends_at,organization:organizations(id,name,slug,organization_type)"),
        admin.from("event_assignments")
          .select("id,event_id,user_id,role,status,assigned_by,created_at,updated_at,access_starts_at,access_ends_at,event:golf_registration_events(id,name,organization_id,event_dates,status)"),
        admin.from("platform_invitations")
          .select("id,email,invitee_name,organization_id,event_id,role,status,invited_by,invited_user_id,recipient_was_existing,expires_at,sent_at,accepted_at,revoked_at,last_error,created_at,updated_at,access_starts_at,access_ends_at,organization:organizations(id,name,slug),event:golf_registration_events(id,name)"),
      ]);

      const loadError =
        profilesResult.error ||
        passengersResult.error ||
        contactsResult.error ||
        membershipsResult.error ||
        assignmentsResult.error ||
        invitationsResult.error;
      if (loadError) throw loadError;

      const profiles = profilesResult.data || [];
      const passengers = passengersResult.data || [];
      const contacts = contactsResult.data || [];
      const memberships = membershipsResult.data || [];
      const assignments = assignmentsResult.data || [];
      const invitations = invitationsResult.data || [];

      const profileMap = new Map(profiles.map((row: any) => [row.id, row]));
      const passengerMap = new Map(
        passengers.filter((row: any) => row.auth_user_id).map((row: any) => [row.auth_user_id, row])
      );
      const membershipsByUser = new Map<string, any[]>();
      const assignmentsByUser = new Map<string, any[]>();

      for (const row of memberships) {
        if (!membershipsByUser.has(row.user_id)) membershipsByUser.set(row.user_id, []);
        membershipsByUser.get(row.user_id)!.push(row);
      }
      for (const row of assignments) {
        if (!assignmentsByUser.has(row.user_id)) assignmentsByUser.set(row.user_id, []);
        assignmentsByUser.get(row.user_id)!.push(row);
      }

      const users = authResult.users.map((authUser: any) => ({
        id: authUser.id,
        email: authUser.email || null,
        email_confirmed_at: authUser.email_confirmed_at || null,
        created_at: authUser.created_at || null,
        last_sign_in_at: authUser.last_sign_in_at || null,
        banned_until: authUser.banned_until || null,
        is_test_account: authUser.app_metadata?.is_test_account === true,
        profile: profileMap.get(authUser.id) || null,
        passenger: passengerMap.get(authUser.id) || null,
        memberships: membershipsByUser.get(authUser.id) || [],
        assignments: assignmentsByUser.get(authUser.id) || [],
      }));

      const contactsByPassenger = new Map<string, any[]>();
      for (const row of contacts) {
        if (!contactsByPassenger.has(row.passenger_id)) contactsByPassenger.set(row.passenger_id, []);
        contactsByPassenger.get(row.passenger_id)!.push(row);
      }

      const unclaimed = passengers
        .filter((row: any) => !row.auth_user_id && row.status !== "merged")
        .map((row: any) => ({ ...row, contacts: contactsByPassenger.get(row.id) || [] }));
      const merged = passengers
        .filter((row: any) => row.status === "merged" || row.merged_into_passenger_id)
        .map((row: any) => ({ ...row, contacts: contactsByPassenger.get(row.id) || [] }));

      return json({
        success: true,
        users,
        invitations,
        identity_review: { unclaimed, merged },
        stats: {
          accounts: users.length,
          verified_accounts: users.filter((row: any) => Boolean(row.email_confirmed_at)).length,
          passenger_profiles: passengers.filter((row: any) => Boolean(row.auth_user_id)).length,
          unclaimed: unclaimed.length,
          pending_invitations: invitations.filter((row: any) => row.status === "pending").length,
        },
        truncated: authResult.truncated,
      });
    } catch (error) {
      console.error("Unable to load EIG user management directory", error);
      return json({ success: false, error: "Unable to load User Management." }, 500);
    }
  }

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
      .select("id,email,invitee_name,organization_id,event_id,role,status,recipient_was_existing,access_starts_at,access_ends_at,metadata,expires_at,created_at,organization:organizations(id,name,slug),event:golf_registration_events(id,name,course,event_dates)")
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

    const { data: currentProfile, error: currentProfileError } = await admin
      .from("profiles")
      .select("id,first_name,last_name,display_name,username")
      .eq("id", user.id)
      .maybeSingle();
    if (currentProfileError) return json({ success: false, error: "Unable to load your ElevationPilot profile." }, 500);

    // Existing users accepting additional roles are not asked to re-enroll.
    // Newly provisioned invitations require DOB and Gender before privileges
    // are granted. Their auth account may have been created at invite send.
    const requiresIdentityDetails = invitation.recipient_was_existing !== true;
    const dateOfBirth = cleanText(body?.date_of_birth, 10);
    const selectedGender = cleanText(body?.gender, 50);
    if (requiresIdentityDetails) {
      if (!validAccountDob(dateOfBirth)) return json({ success: false, error: "Enter a valid date of birth to finish account creation." }, 400);
      if (!ACCOUNT_GENDERS.has(selectedGender)) return json({ success: false, error: "Select Gender (or Prefer not to say) to finish account creation." }, 400);
    }

    const username = (cleanText(body?.username, 30) || cleanText(currentProfile?.username, 30)).toLowerCase();
    if (!username) return json({ success: false, error: "Choose an @username to continue." }, 400);
    const firstName = cleanText(body?.first_name, 80) || cleanText(currentProfile?.first_name, 80);
    const lastName = cleanText(body?.last_name, 80) || cleanText(currentProfile?.last_name, 80);
    const displayName = cleanText(body?.display_name, 120) || cleanText(currentProfile?.display_name, 120) || [firstName, lastName].filter(Boolean).join(" ") || username;

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

    if (requiresIdentityDetails) {
      // Persist identity for any newly invited Pilot, ATC, or Passenger, not
      // only roster participants. Never overwrite an existing person's DOB.
      const { data: passenger, error: existingPassengerError } = await admin
        .from("passengers").select("id,date_of_birth,gender").eq("auth_user_id", user.id).maybeSingle();
      if (existingPassengerError) return json({ success: false, error: "Unable to retrieve your Passenger profile." }, 500);
      if (passenger?.id) {
        const { error: updateIdentityError } = await admin.from("passengers")
          .update({
            date_of_birth: passenger.date_of_birth || dateOfBirth,
            gender: passenger.gender || selectedGender,
          }).eq("id", passenger.id);
        if (updateIdentityError) return json({ success: false, error: "Unable to save your DOB and Gender." }, 500);
      } else {
        const { error: insertIdentityError } = await admin.from("passengers")
          .insert({
            auth_user_id: user.id, first_name: firstName || null, last_name: lastName || null,
            date_of_birth: dateOfBirth, gender: selectedGender,
            status: "claimed", claimed_at: new Date().toISOString(),
          });
        if (insertIdentityError) return json({ success: false, error: "Unable to save your DOB and Gender." }, 500);
      }
    }

    if (["eig_admin", "organization_admin", "organization_staff"].includes(invitation.role)) {
      const { data: currentMembership } = await admin.from("organization_memberships")
        .select("id,role,status,access_starts_at,access_ends_at")
        .eq("organization_id", invitation.organization_id)
        .eq("user_id", user.id)
        .maybeSingle();

      const rank: Record<string, number> = { organization_staff: 1, organization_admin: 2, eig_admin: 3 };
      const currentRole = currentMembership?.role || "";
      const finalRole = (rank[currentRole] || 0) > (rank[invitation.role] || 0) ? currentRole : invitation.role;
      const membershipWindow = mergeAccessWindow(currentMembership, invitation.access_starts_at || null, invitation.access_ends_at || null);

      const { error: membershipError } = await admin.from("organization_memberships").upsert({
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: finalRole,
        status: "active",
        invited_by: invitation.invited_by,
        access_starts_at: membershipWindow.startsAt,
        access_ends_at: membershipWindow.endsAt,
      }, { onConflict: "organization_id,user_id" });
      if (membershipError) return json({ success: false, error: "Your organization access could not be activated." }, 500);

    } else if (["event_coordinator", "event_staff"].includes(invitation.role)) {
      const { data: currentAssignment } = await admin.from("event_assignments")
        .select("id,role,status,access_starts_at,access_ends_at")
        .eq("event_id", invitation.event_id)
        .eq("user_id", user.id)
        .maybeSingle();
      const finalRole =
        currentAssignment?.role === "event_coordinator"
          ? "event_coordinator"
          : invitation.role;
      const assignmentWindow = mergeAccessWindow(currentAssignment, invitation.access_starts_at || null, invitation.access_ends_at || null);

      const { error: assignmentError } = await admin.from("event_assignments").upsert({
        event_id: invitation.event_id,
        user_id: user.id,
        role: finalRole,
        status: "active",
        assigned_by: invitation.invited_by,
        access_starts_at: assignmentWindow.startsAt,
        access_ends_at: assignmentWindow.endsAt,
      }, { onConflict: "event_id,user_id" });
      if (assignmentError) return json({ success: false, error: "Your event access could not be activated." }, 500);
    }

    let claimedRegistration: any = null;
    let claimedEvent: any = null;
    const registrationId = cleanText(invitation?.metadata?.registration_id, 80);
    if (invitation.role === "passenger" && registrationId) {
      const { data: registrationRow, error: registrationError } = await admin.from("golf_registrations")
        .select("*")
        .eq("id", registrationId)
        .maybeSingle();
      if (registrationError || !registrationRow) {
        return json({ success: false, error: "The roster registration attached to this invitation could not be found." }, 404);
      }
      if (normalizeEmail(registrationRow.email) !== normalizeEmail(user.email)) {
        return json({ success: false, error: "This roster registration belongs to a different email address." }, 403);
      }
      if (invitation.event_id && registrationRow.event_id !== invitation.event_id) {
        return json({ success: false, error: "The roster registration no longer matches this event invitation." }, 409);
      }

      const { data: currentPassenger, error: currentPassengerError } = await admin.from("passengers")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (currentPassengerError) return json({ success: false, error: "Unable to load your Passenger identity." }, 500);

      let rosterPassenger: any = null;
      if (registrationRow.passenger_id) {
        const { data, error } = await admin.from("passengers")
          .select("*")
          .eq("id", registrationRow.passenger_id)
          .maybeSingle();
        if (error) return json({ success: false, error: "Unable to load the roster Passenger record." }, 500);
        rosterPassenger = data;
      }

      let passenger = currentPassenger || rosterPassenger;
      if (!passenger) {
        const { data: contactRows, error: contactError } = await admin.from("passenger_contacts")
          .select("passenger_id")
          .eq("contact_type", "email")
          .eq("normalized_value", normalizeEmail(user.email))
          .eq("is_active", true)
          .limit(1);
        if (contactError) return json({ success: false, error: "Unable to match your Passenger identity." }, 500);
        if (contactRows?.[0]?.passenger_id) {
          const { data, error } = await admin.from("passengers")
            .select("*")
            .eq("id", contactRows[0].passenger_id)
            .maybeSingle();
          if (error) return json({ success: false, error: "Unable to load your Passenger identity." }, 500);
          passenger = data;
        }
      }

      const claimedAt = new Date().toISOString();
      if (!passenger) {
        const { data, error } = await admin.from("passengers")
          .insert({
            auth_user_id: user.id,
            first_name: registrationRow.first_name || firstName || null,
            last_name: registrationRow.last_name || lastName || null,
            date_of_birth: registrationRow.date_of_birth || (requiresIdentityDetails ? dateOfBirth : null),
            gender: registrationRow.gender || (requiresIdentityDetails ? selectedGender : null),
            ghin_number: registrationRow.ghin_number || null,
            status: "claimed",
            claimed_at: claimedAt,
          })
          .select("*")
          .single();
        if (error) return json({ success: false, error: error.message || "Unable to create your Passenger identity." }, 500);
        passenger = data;
      } else if (!passenger.auth_user_id || passenger.auth_user_id === user.id) {
        const { data, error } = await admin.from("passengers")
          .update({
            auth_user_id: user.id,
            first_name: passenger.first_name || registrationRow.first_name || firstName || null,
            last_name: passenger.last_name || registrationRow.last_name || lastName || null,
            date_of_birth: passenger.date_of_birth || registrationRow.date_of_birth || (requiresIdentityDetails ? dateOfBirth : null),
            gender: passenger.gender || registrationRow.gender || (requiresIdentityDetails ? selectedGender : null),
            ghin_number: passenger.ghin_number || registrationRow.ghin_number || null,
            status: "claimed",
            claimed_at: passenger.claimed_at || claimedAt,
            updated_at: claimedAt,
          })
          .eq("id", passenger.id)
          .select("*")
          .single();
        if (error) return json({ success: false, error: error.message || "Unable to claim your Passenger identity." }, 500);
        passenger = data;
      } else if (passenger.auth_user_id !== user.id) {
        return json({ success: false, error: "This Passenger identity is already linked to another account." }, 409);
      }

      if (rosterPassenger && rosterPassenger.id !== passenger.id && !rosterPassenger.auth_user_id) {
        await admin.from("passengers").update({
          status: "merged",
          merged_into_passenger_id: passenger.id,
          updated_at: claimedAt,
        }).eq("id", rosterPassenger.id);
      }

      await admin.from("passenger_profiles").upsert(
        { passenger_id: passenger.id, updated_at: claimedAt },
        { onConflict: "passenger_id", ignoreDuplicates: true }
      );

      const contacts = [
        { type: "email", value: normalizeEmail(user.email), verified: Boolean(user.email_confirmed_at) },
        { type: "phone", value: cleanText(registrationRow.phone, 40), verified: false },
      ].filter((item) => item.value);

      for (const contact of contacts) {
        const normalized = contact.type === "email" ? contact.value.toLowerCase() : contact.value.replace(/\D/g, "");
        if (!normalized) continue;
        const { data: existingContact } = await admin.from("passenger_contacts")
          .select("id")
          .eq("passenger_id", passenger.id)
          .eq("contact_type", contact.type)
          .eq("normalized_value", normalized)
          .maybeSingle();
        if (!existingContact) {
          const { data: primaryContact } = await admin.from("passenger_contacts")
            .select("id")
            .eq("passenger_id", passenger.id)
            .eq("contact_type", contact.type)
            .eq("is_primary", true)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          await admin.from("passenger_contacts").insert({
            passenger_id: passenger.id,
            contact_type: contact.type,
            contact_value: contact.value,
            normalized_value: normalized,
            label: "Personal",
            is_primary: !primaryContact,
            is_verified: contact.verified,
            verified_at: contact.verified ? claimedAt : null,
            is_active: true,
            source: "roster_claim",
          });
        }
      }

      const { data: linkedRegistration, error: linkError } = await admin.from("golf_registrations")
        .update({
          user_id: user.id,
          passenger_id: passenger.id,
          passenger_claim_status: "claimed",
          passenger_claimed_at: claimedAt,
          date_of_birth: registrationRow.date_of_birth || passenger.date_of_birth || null,
          gender: registrationRow.gender || passenger.gender || null,
        })
        .eq("id", registrationRow.id)
        .select("*")
        .single();
      if (linkError) return json({ success: false, error: "Your account was created, but the roster registration could not be linked." }, 500);
      claimedRegistration = linkedRegistration;

      if (registrationRow.event_id) {
        const { data } = await admin.from("golf_registration_events")
          .select("id,name,public_slug,status")
          .eq("id", registrationRow.event_id)
          .maybeSingle();
        claimedEvent = data || null;
      }
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
      access_starts_at: invitation.access_starts_at || null,
      access_ends_at: invitation.access_ends_at || null,
      registration_id: claimedRegistration?.id || null,
      payment_status: claimedRegistration?.payment_status || null,
      public_slug: claimedEvent?.public_slug || null,
      passenger_claimed: Boolean(claimedRegistration),
    });
  }

  if (action === "admin_account_help") {
    const isPlatformAdmin = await callerIsPlatformAdmin(admin, user.id);
    if (!isPlatformAdmin) return json({ success: false, error: "EIG Admin access is required." }, 403);
    const targetUserId = cleanText(body?.target_user_id, 80);
    const operation = cleanText(body?.operation, 40);
    if (!targetUserId || !["reset_password", "resend_verification", "account_recovery"].includes(operation)) {
      return json({ success: false, error: "A valid account-help action is required." }, 400);
    }
    if (targetUserId === user.id && operation === "reset_password") {
      return json({ success: false, error: "Use the normal account recovery flow to reset your own password." }, 400);
    }
    const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
    const target = targetResult?.user;
    if (targetError || !target) return json({ success: false, error: "User account not found." }, 404);
    const email = normalizeEmail(target.email);
    if (!email) return json({ success: false, error: "This account does not have a usable email address." }, 400);
    if (!resendApiKey) return json({ success: false, error: "Email delivery is not configured." }, 503);

    let linkType: "recovery" | "signup" = "recovery";
    let subject = "ElevationPilot account recovery";
    let button = "Reset Your Password";
    let bodyCopy = "An EIG administrator requested a secure account recovery link for your ElevationPilot account. Use the button below to set a new password.";
    if (operation === "resend_verification") {
      if (target.email_confirmed_at) return json({ success: false, error: "This account is already verified." }, 400);
      linkType = "signup";
      subject = "Verify your ElevationPilot account";
      button = "Verify Your Account";
      bodyCopy = "An EIG administrator requested a new verification link for your ElevationPilot account. Use the button below to continue verification.";
    } else if (operation === "account_recovery") {
      subject = "ElevationPilot account recovery";
      button = "Recover Your Account";
      bodyCopy = "An EIG administrator requested a secure recovery link for your ElevationPilot account. Use the button below to recover access.";
    }

    const redirectTo = "https://elevated-impact-platform.vercel.app/?recovery=1&recovery_email=" + encodeURIComponent(email);
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: linkType, email, options: { redirectTo } });
    if (linkError || !linkData?.properties?.action_link) {
      return json({ success: false, error: linkError?.message || "Unable to create a secure account link." }, 500);
    }

    const verificationType = linkData.properties.verification_type || linkType;
    const hashedToken = linkData.properties.hashed_token;
    if (!hashedToken) return json({ success: false, error: "Unable to create a client-verifiable secure account link." }, 500);
    const recoveryLink = "https://elevated-impact-platform.vercel.app/?recovery=1&recovery_email=" + encodeURIComponent(email) + "&token_hash=" + encodeURIComponent(hashedToken) + "&type=" + encodeURIComponent(verificationType);

    const display = cleanText(target.user_metadata?.display_name, 120) || email.split("@")[0];
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1D245D;max-width:620px;margin:auto">
        <div style="padding:18px 0;font-weight:900;letter-spacing:.06em">ELEVATIONPILOT · EIG</div>
        <h1 style="margin:0 0 12px;font-size:28px">${escapeHtml(subject)}</h1>
        <p>Hi ${escapeHtml(display)},</p>
        <p>${escapeHtml(bodyCopy)}</p>
        <p style="margin:24px 0"><a href="${escapeHtml(recoveryLink)}" style="display:inline-block;background:#D81C22;color:#fff;text-decoration:none;font-weight:900;padding:13px 20px;border-radius:9px">${escapeHtml(button)}</a></p>
        <p style="font-size:12px;color:#70727A">This is a secure EIG account message. If you did not request help with your account, you can ignore this email.</p>
      </div>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("ELEVATIONPILOT_FROM_EMAIL") || "ElevationPilot <squawk@elevatedimpactgroup.net>",
        to: [email],
        reply_to: Deno.env.get("SQUAWK_REPLY_TO_EMAIL") || "info@elevatedimpactgroup.net",
        subject,
        html,
      }),
    });
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) return json({ success: false, error: responseBody?.message || "Email delivery failed." }, 502);
    return json({ success: true, operation, user_id: targetUserId, email, message_id: responseBody?.id || null });
  }

  if (action === "admin_security") {
    const isPlatformAdmin = await callerIsPlatformAdmin(admin, user.id);
    if (!isPlatformAdmin) return json({ success: false, error: "EIG Admin access is required." }, 403);
    const targetUserId = cleanText(body?.target_user_id, 80);
    const operation = cleanText(body?.operation, 40);
    if (!targetUserId || !["disable_account", "unlock_account", "deactivate_account", "reactivate_account"].includes(operation)) {
      return json({ success: false, error: "A valid security action is required." }, 400);
    }
    if (targetUserId === user.id) return json({ success: false, error: "You cannot disable or unlock your own EIG Admin account from this action." }, 400);

    const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
    const target = targetResult?.user;
    if (targetError || !target) return json({ success: false, error: "User account not found." }, 404);

    const securityRequestId = crypto.randomUUID();
    const { error: historyStartError } = await admin.from("platform_account_audit").insert({
      target_user_id: targetUserId, actor_user_id: user.id, action: operation,
      outcome: "requested", request_id: securityRequestId,
      before_state: { banned_until: target.banned_until || null },
    });
    if (historyStartError) return json({ success: false, error: "Unable to record the action. No security change was requested." }, 500);
    let updatedResult: any = null;
    if (operation === "disable_account" || operation === "unlock_account") {
      const banDuration = operation === "disable_account" ? "876000h" : "none";
      const result = await admin.auth.admin.updateUserById(targetUserId, { ban_duration: banDuration });
      if (result.error) return json({ success: false, error: result.error.message || "Unable to update account security state." }, 500);
      updatedResult = result.data;
    } else {
      const accountStatus = operation === "deactivate_account" ? "deactivated" : "active";
      const { error: profileError } = await admin.from("profiles").update({ account_status: accountStatus }).eq("id", targetUserId);
      if (profileError) return json({ success: false, error: profileError.message || "Unable to update account status." }, 500);
    }

    const { error: historyEndError } = await admin.from("platform_account_audit").insert({
      target_user_id: targetUserId, actor_user_id: user.id, action: operation,
      outcome: "completed", after_state: { request_id: securityRequestId, banned_until: updatedResult?.user?.banned_until || null,
        ...(operation === "deactivate_account" || operation === "reactivate_account" ? { account_status: operation === "deactivate_account" ? "deactivated" : "active" } : {}) },
    });
    if (historyEndError) return json({ success: false, error: "The change was applied, but completion history could not be recorded. Refresh the account before another action." }, 500);
    console.log(JSON.stringify({
      admin_action: operation,
      actor_id: user.id,
      target_user_id: targetUserId,
      target_email: target.email || null,
      created_at: new Date().toISOString(),
    }));

    return json({
      success: true,
      operation,
      user_id: targetUserId,
      banned_until: updatedResult?.user?.banned_until || null,
    });
  }

  if (action === "admin_audit") {
    const isPlatformAdmin = await callerIsPlatformAdmin(admin, user.id);
    if (!isPlatformAdmin) return json({ success: false, error: "EIG Admin access is required." }, 403);

    try {
      const authResult = await listAllAuthUsers(admin);
      const [profilesResult, passengersResult, membershipsResult, assignmentsResult, invitationsResult, sessionHistoryResult] = await Promise.all([
        admin.from("profiles").select("id,first_name,last_name,display_name,username,created_at,updated_at"),
        admin.from("passengers").select("id,auth_user_id,first_name,last_name,preferred_name,status,merged_into_passenger_id,claimed_at,created_at,updated_at"),
        admin.from("organization_memberships").select("id,organization_id,user_id,role,status,created_at,access_starts_at,access_ends_at,organization:organizations(id,name,slug)"),
        admin.from("event_assignments").select("id,event_id,user_id,role,status,created_at,access_starts_at,access_ends_at,event:golf_registration_events(id,name,organization_id)"),
        admin.from("platform_invitations").select("id,email,invitee_name,status,role,expires_at,sent_at,accepted_at,last_error,organization_id,event_id,invited_user_id"),
        admin.from("platform_account_audit").select("id,target_user_id,created_at", { count: "exact" }).eq("action","sessions_revoked").order("created_at", { ascending: false }).limit(100),
      ]);
      const loadError = profilesResult.error || passengersResult.error || membershipsResult.error || assignmentsResult.error || invitationsResult.error || sessionHistoryResult.error;
      if (loadError) throw loadError;

      const profiles = profilesResult.data || [];
      const passengers = passengersResult.data || [];
      const memberships = membershipsResult.data || [];
      const assignments = assignmentsResult.data || [];
      const invitations = invitationsResult.data || [];
      const authUsers = authResult.users || [];
      const userIds = new Set(authUsers.map((row: any) => row.id));

      const malformedEmails = authUsers.filter((row: any) => !row.email || !/^\S+@\S+\.\S+$/.test(String(row.email).trim()));
      const unverified = authUsers.filter((row: any) => !row.email_confirmed_at);
      const testAccounts = authUsers.filter((row: any) => row.app_metadata?.is_test_account === true);
      const orphanedProfiles = profiles.filter((row: any) => !userIds.has(row.id));
      const orphanedMemberships = memberships.filter((row: any) => !userIds.has(row.user_id));
      const orphanedAssignments = assignments.filter((row: any) => !userIds.has(row.user_id));
      const failedInvitations = invitations.filter((row: any) => row.last_error);
      const expiredInvitations = invitations.filter((row: any) => row.status === "expired" || (row.status === "pending" && row.expires_at && new Date(row.expires_at).getTime() < Date.now()));
      const pendingInvitations = invitations.filter((row: any) => row.status === "pending" && (!row.expires_at || new Date(row.expires_at).getTime() >= Date.now()));
      const duplicateEmailGroups = Object.entries(authUsers.reduce((map: Record<string, any[]>, row: any) => {
        const email = String(row.email || "").trim().toLowerCase();
        if (!email) return map;
        (map[email] ||= []).push(row);
        return map;
      }, {})).filter(([, rows]) => rows.length > 1).map(([email, rows]) => ({ email, users: rows.map((row: any) => ({ id: row.id, created_at: row.created_at })) }));

      const issues = [
        { key: "session_revocations", label: "Recorded session revocations", description: "Informational security history, not an account problem. Latest 100 actions link to the affected account's history.", count: sessionHistoryResult.count || 0, severity: "info", records: (sessionHistoryResult.data || []).map((row: any) => ({ id: row.id, user_id: row.target_user_id, label: row.target_user_id, detail: "Sessions revoked " + row.created_at })) },
        { key: "malformed_email", label: "Invalid / missing email", description: "Accounts whose auth email is missing or does not match the basic email format check.", count: malformedEmails.length, severity: malformedEmails.length ? "review" : "clear", records: malformedEmails.map((row: any) => ({ id: row.id, label: row.email || "Missing email", detail: row.created_at })) },
        { key: "unverified", label: "Unverified accounts", description: "Accounts that have not completed email verification.", count: unverified.length, severity: unverified.length ? "review" : "clear", records: unverified.map((row: any) => ({ id: row.id, label: row.email || row.id, detail: row.created_at })) },
        { key: "duplicate_email", label: "Duplicate auth emails", description: "Multiple auth accounts sharing the same normalized email.", count: duplicateEmailGroups.length, severity: duplicateEmailGroups.length ? "review" : "clear", records: duplicateEmailGroups },
        { key: "failed_invitation", label: "Failed invitations", description: "Invitation records with a recorded delivery or processing error.", count: failedInvitations.length, severity: failedInvitations.length ? "review" : "clear", records: failedInvitations },
        { key: "expired_invitation", label: "Expired invitations", description: "Invitation records that have expired and can be reviewed for cleanup.", count: expiredInvitations.length, severity: expiredInvitations.length ? "review" : "clear", records: expiredInvitations },
        { key: "orphaned_profile", label: "Orphaned profiles", description: "Profile records that no longer have a matching auth account.", count: orphanedProfiles.length, severity: orphanedProfiles.length ? "review" : "clear", records: orphanedProfiles },
        { key: "orphaned_membership", label: "Orphaned memberships", description: "Organization access records pointing to an auth user that no longer exists.", count: orphanedMemberships.length, severity: orphanedMemberships.length ? "review" : "clear", records: orphanedMemberships },
        { key: "orphaned_assignment", label: "Orphaned event access", description: "Event access records pointing to an auth user that no longer exists.", count: orphanedAssignments.length, severity: orphanedAssignments.length ? "review" : "clear", records: orphanedAssignments },
        { key: "test_account", label: "Test accounts", description: "Accounts explicitly marked as test accounts and eligible for the protected cleanup workflow.", count: testAccounts.length, severity: testAccounts.length ? "action" : "clear", records: testAccounts.map((row: any) => ({ id: row.id, label: row.email || row.id, detail: row.created_at })) },
      ];

      return json({
        success: true,
        generated_at: new Date().toISOString(),
        truncated: authResult.truncated,
        summary: {
          accounts: authUsers.length,
          issues: issues.filter((row) => row.severity !== "info").reduce((sum, row) => sum + row.count, 0),
          review_items: issues.filter((row) => row.severity === "review").reduce((sum, row) => sum + row.count, 0),
          test_accounts: testAccounts.length,
          pending_invitations: pendingInvitations.length,
        },
        issues,
      });
    } catch (error) {
      console.error("Unable to run EIG platform audit", error);
      return json({ success: false, error: "Unable to run Platform Audit." }, 500);
    }
  }

  if (action === "admin_test_account") {
    const targetUserId = cleanText(body?.target_user_id, 80);
    const operation = cleanText(body?.operation, 30);
    if (!targetUserId || !["mark_test", "remove_test"].includes(operation)) {
      return json({ success: false, error: "A valid test-account operation is required." }, 400);
    }
    const isPlatformAdmin = await callerIsPlatformAdmin(admin, user.id);
    if (!isPlatformAdmin) return json({ success: false, error: "EIG Admin access is required." }, 403);
    if (targetUserId === user.id) return json({ success: false, error: "You cannot remove your own account from User Management." }, 400);

    const { data: targetUser, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
    if (targetError || !targetUser?.user) return json({ success: false, error: "User account not found." }, 404);

    const currentMeta = targetUser.user.app_metadata || {};
    const isTestAccount = currentMeta.is_test_account === true;

    if (operation === "mark_test") {
      const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
        app_metadata: { ...currentMeta, is_test_account: true, test_marked_by: user.id, test_marked_at: new Date().toISOString() },
      });
      if (updateError) return json({ success: false, error: updateError.message || "Unable to mark test account." }, 500);
      return json({ success: true, operation, user_id: targetUserId, is_test_account: true });
    }

    if (!isTestAccount) {
      return json({ success: false, error: "This account is not marked as a test account. Mark it as test first, then remove it." }, 400);
    }

    const confirmation = cleanText(body?.confirmation, 40);
    if (confirmation !== "REMOVE TEST ACCOUNT") {
      return json({ success: false, error: "Type REMOVE TEST ACCOUNT to permanently remove this test account." }, 400);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
    if (deleteError) return json({ success: false, error: deleteError.message || "Unable to remove test account." }, 500);

    return json({ success: true, operation, user_id: targetUserId, removed: true });
  }

  if (action === "list_access") {
    const organizationId = cleanText(body?.organization_id, 80);
    if (!organizationId) return json({ success: false, error: "Organization is required." }, 400);
    const { isPlatformAdmin, targetRole } = await getCallerAccess(admin, user.id, organizationId);
    if (!isPlatformAdmin && targetRole !== "organization_admin") {
      return json({ success: false, error: "Pilot access is required to manage role dates." }, 403);
    }

    const [{ data: memberships, error: membershipsError }, { data: events, error: eventsError }] = await Promise.all([
      admin.from("organization_memberships")
        .select("id,user_id,role,status,access_starts_at,access_ends_at,created_at")
        .eq("organization_id", organizationId)
        .in("role", ["organization_staff", "organization_admin", "eig_admin"])
        .order("created_at", { ascending: true }),
      admin.from("golf_registration_events")
        .select("id,name,event_dates")
        .eq("organization_id", organizationId),
    ]);
    if (membershipsError || eventsError) return json({ success: false, error: "Unable to load access assignments." }, 500);

    const eventRows = events || [];
    const eventIds = eventRows.map((item: any) => item.id);
    let assignments: any[] = [];
    if (eventIds.length) {
      const { data, error } = await admin.from("event_assignments")
        .select("id,event_id,user_id,role,status,access_starts_at,access_ends_at,created_at")
        .in("event_id", eventIds)
        .in("role", ["event_coordinator", "event_staff"])
        .order("created_at", { ascending: true });
      if (error) return json({ success: false, error: "Unable to load event assignments." }, 500);
      assignments = data || [];
    }

    const userIds = [...new Set([...(memberships || []).map((item: any) => item.user_id), ...assignments.map((item: any) => item.user_id)].filter(Boolean))];
    let profiles: any[] = [];
    if (userIds.length) {
      const { data } = await admin.from("profiles")
        .select("id,username,display_name,first_name,last_name")
        .in("id", userIds);
      profiles = data || [];
    }
    const profileMap = new Map(profiles.map((item: any) => [item.id, item]));
    const eventMap = new Map(eventRows.map((item: any) => [item.id, item]));

    return json({
      success: true,
      memberships: (memberships || []).map((item: any) => ({ ...item, profile: profileMap.get(item.user_id) || null })),
      assignments: assignments.map((item: any) => ({ ...item, profile: profileMap.get(item.user_id) || null, event: eventMap.get(item.event_id) || null })),
    });
  }

  if (action === "update_access") {
    const organizationId = cleanText(body?.organization_id, 80);
    const assignmentId = cleanText(body?.assignment_id, 80);
    const assignmentType = cleanText(body?.assignment_type, 30);
    const mode = cleanText(body?.access_mode, 30) || "custom";
    const requestedRole = cleanText(body?.new_role, 40);
    const requestedStatus = cleanText(body?.access_status, 30);
    if (requestedRole && !["eig_admin", "organization_admin", "organization_staff", "event_coordinator", "event_staff"].includes(requestedRole)) return json({ success: false, error: "Invalid role." }, 400);
    if (requestedStatus && !["active", "revoked"].includes(requestedStatus)) return json({ success: false, error: "Invalid access status." }, 400);
    if (!organizationId || !assignmentId || !["organization", "event"].includes(assignmentType)) {
      return json({ success: false, error: "A valid access assignment is required." }, 400);
    }

    const { isPlatformAdmin, targetRole } = await getCallerAccess(admin, user.id, organizationId);
    if (!isPlatformAdmin && targetRole !== "organization_admin") {
      return json({ success: false, error: "Pilot access is required to change role dates." }, 403);
    }

    let startsAt: string | null = null;
    let endsAt: string | null = null;
    if (mode !== "indefinite") {
      startsAt = dateStartIso(body?.access_start_date);
      endsAt = dateEndIso(body?.access_end_date);
      if (!startsAt || !endsAt || new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
        return json({ success: false, error: "Choose a valid start and end date." }, 400);
      }
    }

    if (assignmentType === "organization") {
      const { data: row, error } = await admin.from("organization_memberships")
        .select("id,organization_id,role,user_id")
        .eq("id", assignmentId)
        .maybeSingle();
      if (error || !row || row.organization_id !== organizationId) return json({ success: false, error: "Organization assignment not found." }, 404);
      if (requestedRole && !isPlatformAdmin) return json({ success: false, error: "EIG Admin access is required to change organization roles." }, 403);
      if (!isPlatformAdmin && row.role !== "organization_staff") {
        return json({ success: false, error: "Pilots can change Co-Pilot access dates. EIG controls Pilot access." }, 403);
      }
      const updatePayload: any = { access_starts_at: startsAt, access_ends_at: endsAt };
      if (requestedStatus) updatePayload.status = requestedStatus;
      else updatePayload.status = "active";
      if (requestedRole) updatePayload.role = requestedRole;
      const { error: updateError } = await admin.from("organization_memberships")
        .update(updatePayload)
        .eq("id", row.id);
      if (updateError) return json({ success: false, error: "Unable to update organization access." }, 500);
    } else {
      const { data: row, error } = await admin.from("event_assignments")
        .select("id,event_id,role,user_id,event:golf_registration_events(id,organization_id)")
        .eq("id", assignmentId)
        .maybeSingle();
      if (error || !row || row.event?.organization_id !== organizationId) return json({ success: false, error: "Event assignment not found." }, 404);
      if (requestedRole && !isPlatformAdmin) return json({ success: false, error: "EIG Admin access is required to change event roles." }, 403);
      const updatePayload: any = { access_starts_at: startsAt, access_ends_at: endsAt };
      if (requestedStatus) updatePayload.status = requestedStatus;
      else updatePayload.status = "active";
      if (requestedRole) updatePayload.role = requestedRole;
      const { error: updateError } = await admin.from("event_assignments")
        .update(updatePayload)
        .eq("id", row.id);
      if (updateError) return json({ success: false, error: "Unable to update event access." }, 500);
    }

    return json({ success: true, assignment_id: assignmentId, access_starts_at: startsAt, access_ends_at: endsAt });
  }

  if (action !== "send") return json({ success: false, error: "Unsupported invitation action." }, 400);

  const email = normalizeEmail(body?.email);
  const inviteeName = cleanText(body?.invitee_name, 120);
  const organizationId = cleanText(body?.organization_id, 80);
  const eventId = cleanText(body?.event_id, 80) || null;
  const registrationId = cleanText(body?.registration_id, 80) || null;
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
  if (role === "passenger") {
    const canInvitePassenger = await callerCanManagePassengerInvite(admin, user.id, organizationId, eventId);
    if (!canInvitePassenger) {
      return json({ success: false, error: "Pilot, Co-Pilot, EIG, or assigned ATC access is required to invite a Passenger for this event." }, 403);
    }
  } else {
    const orgAdminCanGrant = ["organization_staff", "event_coordinator", "event_staff"].includes(role);
    if (!isPlatformAdmin && !(targetRole === "organization_admin" && orgAdminCanGrant)) {
      return json({ success: false, error: "You do not have permission to grant that role." }, 403);
    }
  }
  if (role === "eig_admin" && organization.slug !== "elevated-impact-group") {
    return json({ success: false, error: "EIG Admin access can only be attached to the EIG Command Center." }, 400);
  }

  let event: any = null;
  if (eventId) {
    const { data, error } = await admin.from("golf_registration_events")
      .select("id,name,course,organization_id,event_dates,public_slug")
      .eq("id", eventId)
      .maybeSingle();
    if (error || !data) return json({ success: false, error: "Event not found." }, 404);
    if (data.organization_id !== organizationId) return json({ success: false, error: "That event does not belong to the selected Hangar." }, 400);
    event = data;
  }

  let registration: any = null;
  if (registrationId) {
    if (role !== "passenger" || !eventId) {
      return json({ success: false, error: "Registration invitations must be Passenger invitations tied to an event." }, 400);
    }
    const { data, error } = await admin.from("golf_registrations")
      .select("id,event_id,event_key,email,first_name,last_name,phone,passenger_id,user_id,passenger_claim_status")
      .eq("id", registrationId)
      .maybeSingle();
    if (error || !data) return json({ success: false, error: "Registration not found." }, 404);
    if (data.event_id !== eventId) return json({ success: false, error: "That registration does not belong to the selected event." }, 400);
    if (normalizeEmail(data.email) !== email) return json({ success: false, error: "The invitation email must match the registration email." }, 400);
    registration = data;
  }

  const accessWindow = resolveAccessWindow(body, event, role);
  if (accessWindow.error) return json({ success: false, error: accessWindow.error }, 400);
  if (role === "eig_admin" && accessWindow.mode !== "indefinite") {
    return json({ success: false, error: "EIG Admin access is currently granted indefinitely. Use organization or event roles for time-limited access." }, 400);
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
  const invitationMetadata = {
    ...(invitation?.metadata || {}),
    access_mode: accessWindow.mode,
    ...(registrationId ? { registration_id: registrationId, source: "roster_registration" } : {}),
  };

  if (invitation) {
    const { data, error } = await admin.from("platform_invitations").update({
      invitee_name: inviteeName || invitation.invitee_name,
      invited_by: user.id,
      invited_user_id: existingUser?.id || invitation.invited_user_id,
      recipient_was_existing: Boolean(existingUser),
      expires_at: expiresAt,
      access_starts_at: accessWindow.startsAt,
      access_ends_at: accessWindow.endsAt,
      metadata: invitationMetadata,
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
      access_starts_at: accessWindow.startsAt,
      access_ends_at: accessWindow.endsAt,
      metadata: invitationMetadata,
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
    (inviterProfile?.username ? "@" + inviterProfile.username : "") ||
    inviterProfile?.display_name ||
    [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(" ") ||
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
      accessLabel: accessDescription(accessWindow.startsAt, accessWindow.endsAt),
      registrationInvite: Boolean(registrationId && role === "passenger"),
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

  if (registrationId && registration?.event_key) {
    await syncRoster(supabaseUrl, serviceRoleKey, registration.event_key);
  }

  return json({
    success: true,
    invitation_id: invitation.id,
    email_sent: emailSent,
    invite_link: actionLink,
    recipient_was_existing: Boolean(existingUser),
    access_starts_at: accessWindow.startsAt,
    access_ends_at: accessWindow.endsAt,
    access_mode: accessWindow.mode,
    warning: emailError || null,
  });
});


import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function clean(value: unknown) { return String(value ?? "").trim(); }
function inWindow(row: any) {
  if (!row || row.status !== "active") return false;
  const now = Date.now();
  return (!row.access_starts_at || new Date(row.access_starts_at).getTime() <= now) &&
    (!row.access_ends_at || new Date(row.access_ends_at).getTime() >= now);
}
function uuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
const OPERATIONS = new Set(["fill_tba", "edit_player", "swap", "move_to_tba", "transfer_captain"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ success: false, error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !secret) return reply({ success: false, error: "Server configuration unavailable" }, 503);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ success: false, error: "Sign in to manage a team" }, 401);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    const actor = auth?.user;
    if (authError || !actor) return reply({ success: false, error: "Session expired. Sign in again." }, 401);
    const body = await req.json();
    const eventId = clean(body.event_id);
    const action = clean(body.action || "list");
    if (!uuid(eventId)) return reply({ success: false, error: "Choose a valid event" }, 400);

    const { data: event, error: eventError } = await admin.from("golf_registration_events")
      .select("id,name,event_key,organization_id,field_settings").eq("id", eventId).maybeSingle();
    if (eventError || !event) return reply({ success: false, error: "Event not found" }, 404);
    if (event.field_settings?.registration_format !== "team") {
      return reply({ success: false, error: "This event does not use team registration" }, 400);
    }

    const [profileResult, membershipResult, assignmentResult] = await Promise.all([
      admin.from("profiles").select("role").eq("id", actor.id).maybeSingle(),
      admin.from("organization_memberships").select("role,status,access_starts_at,access_ends_at")
        .eq("organization_id", event.organization_id).eq("user_id", actor.id).eq("status", "active"),
      admin.from("event_assignments").select("role,status,access_starts_at,access_ends_at")
        .eq("event_id", eventId).eq("user_id", actor.id).eq("status", "active"),
    ]);
    if (profileResult.error || membershipResult.error || assignmentResult.error) {
      return reply({ success: false, error: "Unable to verify staff permissions" }, 503);
    }
    const authorized =
      ["super_admin", "eig_admin"].includes(profileResult.data?.role || "") ||
      (membershipResult.data || []).some((m: any) =>
        ["eig_admin", "organization_admin", "organization_staff"].includes(m.role) && inWindow(m)) ||
      (assignmentResult.data || []).some((a: any) =>
        a.role === "event_coordinator" && inWindow(a));
    if (!authorized) return reply({ success: false, error: "EIG, Pilot, Co-Pilot, or assigned ATC access required" }, 403);

    if (action === "list") {
      const [teamsResult, playersResult] = await Promise.all([
        admin.from("golf_registration_teams").select(
          "id,event_id,team_id,entry_number,team_name,team_size,status,captain_registration_id,captain_user_id,payment_mode"
        ).eq("event_id", eventId),
        admin.from("golf_registrations").select(
          "id,event_id,team_id,entry_number,first_name,last_name,email,phone,ghin_number,division,custom_fields,user_id,passenger_claim_status,registration_status,payment_status,price,amount_paid"
        ).eq("event_id", eventId).eq("registration_status", "active"),
      ]);
      if (teamsResult.error || playersResult.error) throw new Error("Unable to load event teams");
      return reply({ success: true, teams: teamsResult.data || [], registrations: playersResult.data || [] });
    }

    if (!OPERATIONS.has(action)) return reply({ success: false, error: "Unsupported action" }, 400);
    const registrationId = clean(body.registration_id);
    const otherId = clean(body.other_registration_id);
    if (!uuid(registrationId) || (["swap","move_to_tba","transfer_captain"].includes(action) && !uuid(otherId))) {
      return reply({ success: false, error: "Select the affected golfers" }, 400);
    }
    const fields = body.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields : {};
    if (["fill_tba","edit_player"].includes(action)) {
      if (["fill_tba"].includes(action) &&
          !["first_name","last_name","email"].every((f) => clean(fields[f]))) {
        return reply({ success: false, error: "First name, last name, and email are required" }, 400);
      }
      if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(fields.email))) {
        return reply({ success: false, error: "Enter a valid email address" }, 400);
      }
      for (const field of ["first_name","last_name","email","phone","ghin_number","division"]) {
        if (fields[field] !== undefined && clean(fields[field]).length > 250) {
          return reply({ success: false, error: "A golfer field is too long" }, 400);
        }
      }
    }
    const reason = clean(body.reason).slice(0, 1500);
    const { data: result, error: updateError } = await admin.rpc("eie_staff_team_roster_update", {
      p_event_id: eventId,
      p_action: action,
      p_registration_id: registrationId,
      p_other_registration_id: otherId || null,
      p_fields: fields,
      p_actor_user_id: actor.id,
      p_reason: reason || null,
    });
    if (updateError) return reply({ success: false, error: updateError.message || "Team update failed" }, 400);

    const warnings: string[] = [];
    // Existing team-member invite path: staff update does not invent another invitation/payment flow.
    // Resend only for new/unclaimed teammates. Claimed users retain the original Passenger link.
    if (["fill_tba","edit_player","swap","move_to_tba"].includes(action)) {
      const affected = [registrationId, otherId].filter(Boolean);
      const { data: updatedPlayers, error: playerError } = await admin.from("golf_registrations")
        .select("id,team_id,email,first_name,custom_fields,user_id,passenger_claim_status")
        .eq("event_id", eventId).in("id", affected);
      if (playerError) warnings.push("Updated roster saved, but invitations need attention");
      const { data: teams } = await admin.from("golf_registration_teams")
        .select("id,team_id,captain_registration_id").eq("event_id", eventId);
      for (const r of updatedPlayers || []) {
        const team = (teams || []).find((t: any) => t.team_id === r.team_id);
        if (!team || team.captain_registration_id === r.id ||
            !clean(r.email) || r.custom_fields?.reserved_tba === true ||
            clean(r.first_name).toUpperCase() === "TBA" ||
            r.user_id || r.passenger_claim_status === "claimed") continue;
        // Edit: do not resend unchanged addresses or already-invited passengers.
        if (action === "edit_player") {
          const { data: prior } = await admin.from("golf_team_invitations")
            .select("status").eq("registration_id", r.id).maybeSingle();
          if (prior?.status === "pending") continue;
        }
        try {
          const invite = await fetch(url + "/functions/v1/golf-team-member", {
            method: "POST",
            headers: { "Authorization": "Bearer " + secret, "apikey": secret, "Content-Type": "application/json" },
            body: JSON.stringify({ action: "invite", team_id: team.id, registration_id: r.id, app_origin: "https://golf.elevatedimpactgroup.net" }),
          });
          const payload = await invite.json().catch(() => ({}));
          if (!invite.ok || !payload.success || !payload.email_sent) {
            warnings.push("Invite for " + clean(r.first_name) + " may need resending");
          }
        } catch {
          warnings.push("An invitation needs resending");
        }
      }
    }
    try {
      const sync = await fetch(url + "/functions/v1/sync-google-roster", {
        method: "POST",
        headers: { "Authorization": "Bearer " + secret, "apikey": secret, "Content-Type": "application/json" },
        body: JSON.stringify({ event_key: event.event_key }),
      });
      if (!sync.ok) warnings.push("Google roster sync needs attention");
    } catch { warnings.push("Google roster sync needs attention"); }
    return reply({ success: true, action, result, warnings });
  } catch (error) {
    return reply({ success: false, error: error instanceof Error ? error.message : "Team management failed" }, 400);
  }
});
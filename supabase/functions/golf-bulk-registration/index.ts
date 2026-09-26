import { createClient } from "npm:@supabase/supabase-js@2.45.4";

type JsonRecord = Record<string, any>;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function isAccessWindowActive(row: any, nowMs = Date.now()) {
  if (!row || row.status !== "active") return false;
  const starts = row.access_starts_at ? new Date(row.access_starts_at).getTime() : null;
  const ends = row.access_ends_at ? new Date(row.access_ends_at).getTime() : null;
  return (starts === null || starts <= nowMs) && (ends === null || ends >= nowMs);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return response({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing server configuration.");

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return response({ success: false, error: "Authentication required." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return response({ success: false, error: "Invalid session." }, 401);

    const payload = await req.json();
    const action = text(payload?.action);
    const allowed = new Set(["paid_clubhouse", "comp", "withdraw", "cancel", "set_team"]);
    if (!allowed.has(action)) throw new Error("Unsupported bulk roster action.");

    const rawIds = Array.isArray(payload?.registration_ids) ? payload.registration_ids : [];
    const registrationIds = [...new Set(rawIds.map((id: unknown) => text(id)).filter(Boolean))];
    if (!registrationIds.length) throw new Error("Select at least one golfer.");
    if (registrationIds.length > 500) throw new Error("A maximum of 500 golfers can be updated at once.");

    const reason = nullableText(payload?.reason ?? payload?.admin_note);
    if (action === "comp" && !reason) throw new Error("A reason is required for comp players.");

    const teamId = action === "set_team" ? nullableText(payload?.team_id) : null;
    if (action === "set_team" && !teamId) throw new Error("Team ID is required.");

    const { data: registrations, error: registrationError } = await admin
      .from("golf_registrations")
      .select("*")
      .in("id", registrationIds);
    if (registrationError) throw registrationError;
    if (!registrations || registrations.length !== registrationIds.length) {
      throw new Error("One or more selected golfers could not be found. Refresh the roster and try again.");
    }

    const eventKeys = [...new Set(registrations.map((row: any) => text(row.event_key)).filter(Boolean))];
    if (eventKeys.length !== 1) throw new Error("Bulk actions can only be applied within one event.");

    const eventIds = [...new Set(registrations.map((row: any) => text(row.event_id)).filter(Boolean))];
    let eventQuery = admin.from("golf_registration_events").select("*");
    eventQuery = eventIds.length === 1
      ? eventQuery.eq("id", eventIds[0])
      : eventQuery.eq("event_key", eventKeys[0]);
    const { data: event, error: eventError } = await eventQuery.maybeSingle();
    if (eventError) throw eventError;
    if (!event) return response({ success: false, error: "Registration event not found." }, 404);

    const organizationId = text(event.organization_id);
    if (!organizationId) {
      return response({ success: false, error: "This event is not assigned to an organization." }, 409);
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    let authorized = profile?.role === "super_admin";
    if (!authorized) {
      const { data: membership, error: membershipError } = await admin
        .from("organization_memberships")
        .select("role,status,access_starts_at,access_ends_at")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("role", ["eig_admin", "organization_admin", "organization_staff"])
        .maybeSingle();
      if (membershipError) throw membershipError;
      authorized = isAccessWindowActive(membership);
    }
    if (!authorized) {
      const { data: assignment, error: assignmentError } = await admin
        .from("event_assignments")
        .select("id,role,status,access_starts_at,access_ends_at")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .eq("role", "event_coordinator")
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      authorized = isAccessWindowActive(assignment);
    }
    if (!authorized) {
      return response({ success: false, error: "Pilot or authorized ATC access is required." }, 403);
    }

    const now = new Date().toISOString();

    const updates = await Promise.all(registrations.map(async (registration: any) => {
      const update: JsonRecord = {
        admin_note: reason,
        admin_updated_at: now,
        admin_updated_by: user.id,
      };

      let auditAction = "";
      if (action === "paid_clubhouse") {
        update.payment_status = "paid";
        update.payment_reference = "clubhouse";
        update.amount_paid = Number(registration.price || 0);
        update.paid_at = now;
        update.refunded_at = null;
        auditAction = "marked_paid";
      } else if (action === "comp") {
        update.payment_status = "comp";
        update.payment_reference = "comp";
        update.amount_paid = 0;
        update.paid_at = now;
        update.refunded_at = null;
        auditAction = "comped";
      } else if (action === "withdraw") {
        update.registration_status = "withdrawn";
        auditAction = "withdrawn";
      } else if (action === "cancel") {
        update.registration_status = "cancelled";
        auditAction = "cancelled";
      } else if (action === "set_team") {
        update.team_id = teamId;
        auditAction = "team_assignment_updated";
      }

      const { data, error } = await admin
        .from("golf_registrations")
        .update(update)
        .eq("id", registration.id)
        .select("*")
        .single();
      if (error) throw error;

      return {
        registration: data,
        audit: {
          registration_id: data.id,
          organization_id: organizationId,
          event_id: event.id,
          action: auditAction,
          reason,
          previous_payment_status: registration.payment_status ?? null,
          new_payment_status: data.payment_status ?? null,
          previous_registration_status: registration.registration_status ?? "active",
          new_registration_status: data.registration_status ?? "active",
          acted_by: user.id,
          metadata: {
            source: "bulk_roster_maintenance",
            bulk_count: registrationIds.length,
          },
        },
      };
    }));

    const audits = updates.map((item) => item.audit);
    if (audits.length) {
      const { error: auditError } = await admin
        .from("golf_registration_admin_actions")
        .insert(audits);
      if (auditError) throw auditError;
    }

    let syncWarning: string | null = null;
    try {
      const syncResponse = await fetch(supabaseUrl + "/functions/v1/sync-google-roster", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + serviceRoleKey,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_key: event.event_key }),
      });
      if (!syncResponse.ok) {
        syncWarning = "Roster updated, but Google Sheet sync needs attention.";
      }
    } catch {
      syncWarning = "Roster updated, but Google Sheet sync needs attention.";
    }

    return response({
      success: true,
      updated_count: updates.length,
      registrations: updates.map((item) => item.registration),
      sync_warning: syncWarning,
    });
  } catch (error) {
    return response({
      success: false,
      error: error instanceof Error ? error.message : "Unable to update selected golfers.",
    }, 400);
  }
});

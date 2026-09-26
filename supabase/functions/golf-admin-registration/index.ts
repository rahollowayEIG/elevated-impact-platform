import { createClient } from "npm:@supabase/supabase-js@2.45.4";

type JsonRecord = Record<string, unknown>;

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

function validEmail(value: string | null) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function ageOn(dateOfBirth: string | null, eventDate: string | null) {
  if (!dateOfBirth || !eventDate) return null;
  const birth = dateOfBirth.split("-").map(Number);
  const event = eventDate.split("-").map(Number);
  if (birth.length !== 3 || event.length !== 3 || [...birth, ...event].some((part) => !Number.isFinite(part))) return null;
  let age = event[0] - birth[0];
  if (event[1] < birth[1] || (event[1] === birth[1] && event[2] < birth[2])) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function isAccessWindowActive(row: any, nowMs = Date.now()) {
  if (!row || row.status !== "active") return false;
  const starts = row.access_starts_at ? new Date(row.access_starts_at).getTime() : null;
  const ends = row.access_ends_at ? new Date(row.access_ends_at).getTime() : null;
  return (starts === null || starts <= nowMs) && (ends === null || ends >= nowMs);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ success: false, error: "Method not allowed." }, 405);

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

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    let registration: JsonRecord | null = null;
    let event: JsonRecord | null = null;

    if (action === "add_golfer_manually") {
      const eventId = text(payload?.event_id);
      const eventKey = text(payload?.event_key);
      if (!eventId && !eventKey) throw new Error("Event is required.");

      let eventQuery = admin.from("golf_registration_events").select("*");
      eventQuery = eventId ? eventQuery.eq("id", eventId) : eventQuery.eq("event_key", eventKey);
      const { data, error } = await eventQuery.maybeSingle();
      if (error) throw error;
      if (!data) return response({ success: false, error: "Event not found." }, 404);
      event = data;
    } else {
      const registrationId = text(payload?.registration_id);
      if (!registrationId) throw new Error("Registration ID is required.");

      const { data, error } = await admin
        .from("golf_registrations")
        .select("*")
        .eq("id", registrationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return response({ success: false, error: "Registration not found." }, 404);
      registration = data;

      let eventQuery = admin.from("golf_registration_events").select("*");
      eventQuery = data.event_id
        ? eventQuery.eq("id", data.event_id)
        : eventQuery.eq("event_key", data.event_key);
      const { data: eventData, error: eventError } = await eventQuery.maybeSingle();
      if (eventError) throw eventError;
      if (!eventData) return response({ success: false, error: "Registration event not found." }, 404);
      event = eventData;
    }

    const organizationId = text(event?.organization_id);
    if (!organizationId) return response({ success: false, error: "This event is not assigned to an organization." }, 409);

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
    let auditAction = "";
    let reason = nullableText(payload?.reason ?? payload?.admin_note);
    let previousPaymentStatus: string | null = registration ? text(registration.payment_status) : null;
    let previousRegistrationStatus: string | null = registration ? text(registration.registration_status || "active") : null;

    if (action === "add_golfer_manually") {
      const golfer = payload?.golfer || {};
      const firstName = text(golfer.first_name);
      const lastName = text(golfer.last_name);
      const email = nullableText(golfer.email)?.toLowerCase() ?? null;
      const phone = nullableText(golfer.phone);
      const membershipStatus = text(golfer.membership_status || "Member");
      const dateOfBirth = nullableText(golfer.date_of_birth);
      const gender = nullableText(golfer.gender);
      const division = nullableText(golfer.division);
      const ghinNumber = nullableText(golfer.ghin_number);
      const customFields =
        golfer.custom_fields && typeof golfer.custom_fields === "object"
          ? golfer.custom_fields
          : {};
      const settings =
        event?.field_settings && typeof event.field_settings === "object"
          ? event.field_settings
          : {};
      const comped = golfer.payment_status === "comp";

      if (!firstName || !lastName) throw new Error("First and last name are required.");
      if (!email) throw new Error("Email is required.");
      if (!phone) throw new Error("Phone is required.");
      if (!validEmail(email)) throw new Error("Enter a valid email address.");

      if (
        settings.membership !== "hidden" &&
        !["Member", "Non-Member"].includes(membershipStatus)
      ) {
        throw new Error("Choose a valid club membership status.");
      }

      const requiredValues: Record<string, string | null> = {
        dob: dateOfBirth,
        gender,
        division,
        membership: membershipStatus,
        ghin: ghinNumber,
      };
      const requiredLabels: Record<string, string> = {
        dob: "Date of Birth",
        gender: "Gender",
        division: "Division",
        membership: "Club Membership Status",
        ghin: "GHIN #",
      };

      for (const key of ["dob", "gender", "division", "membership", "ghin"]) {
        if (settings[key] === "required" && !text(requiredValues[key])) {
          throw new Error(`${requiredLabels[key]} is required for this event.`);
        }
      }

      for (const field of Array.isArray(settings.custom_fields) ? settings.custom_fields : []) {
        if (!field?.required) continue;
        const value = customFields[field.id];
        const missing =
          field.type === "checkbox"
            ? value !== true
            : !text(value);
        if (missing) throw new Error(`${field.label || "Required field"} is required for this event.`);
      }

      if (comped && !reason) throw new Error("A reason is required for a comp player.");

      let duplicateQuery = admin
        .from("golf_registrations")
        .select("id,first_name,last_name,email,phone,registration_status")
        .eq("event_key", text(event?.event_key))
        .neq("registration_status", "cancelled");
      if (email) duplicateQuery = duplicateQuery.eq("email", email);
      else duplicateQuery = duplicateQuery.eq("phone", phone);
      const { data: duplicates, error: duplicateError } = await duplicateQuery.limit(5);
      if (duplicateError) throw duplicateError;
      if (duplicates?.length && payload?.confirm_duplicate !== true) {
        return response({
          success: false,
          code: "possible_duplicate",
          error: "A possible matching golfer already exists for this event.",
          duplicates,
        }, 409);
      }

      const eventDates = Array.isArray(event?.event_dates) ? event.event_dates : [];
      const calculatedAge = ageOn(dateOfBirth, eventDates[0] || null);
      if (dateOfBirth && calculatedAge === null) throw new Error("Enter a valid date of birth.");

      const configuredPrice = membershipStatus === "Member" ? event?.member_price : event?.non_member_price;
      const suppliedPrice = golfer.price;
      const price = suppliedPrice === "" || suppliedPrice === null || suppliedPrice === undefined
        ? Number(configuredPrice || 0)
        : Number(suppliedPrice);
      if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid non-negative price.");

      const insert = {
        organization_id: organizationId,
        event_id: event?.id,
        event_key: event?.event_key,
        event_name: event?.name,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        age: calculatedAge,
        gender,
        division,
        membership_status: membershipStatus,
        price,
        email,
        phone,
        ghin_number: ghinNumber,
        custom_fields: customFields,
        payment_status: comped ? "comp" : "pending",
        payment_reference: comped ? "comp" : "admin_manual",
        amount_paid: comped ? 0 : null,
        paid_at: comped ? now : null,
        registration_status: "active",
        registration_source: "admin_manual",
        user_id: null,
        admin_note: reason,
        admin_updated_at: now,
        admin_updated_by: user.id,
      };

      const { data, error } = await admin
        .from("golf_registrations")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      registration = data;
      auditAction = "golfer_added_manually";
      previousPaymentStatus = null;
      previousRegistrationStatus = null;
    } else {
      const allowed = new Set(["pending", "paid_clubhouse", "comp", "failed", "withdraw", "cancel", "reactivate", "set_team"]);
      if (!allowed.has(action)) throw new Error("Unsupported roster maintenance action.");
      if (action === "comp" && !reason) throw new Error("A reason is required for a comp player.");

      const update: JsonRecord = {
        admin_note: reason,
        admin_updated_at: now,
        admin_updated_by: user.id,
      };

      if (action === "set_team") {
        const teamId = nullableText(payload?.team_id);
        update.team_id = teamId;
        auditAction = "team_assignment_updated";
      } else if (action === "paid_clubhouse") {
        update.payment_status = "paid";
        update.payment_reference = "clubhouse";
        update.amount_paid = Number(registration?.price || 0);
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
      } else if (action === "pending") {
        update.payment_status = "pending";
        update.payment_reference = "clubhouse";
        update.amount_paid = null;
        update.paid_at = null;
        update.refunded_at = null;
        auditAction = "marked_pending";
      } else if (action === "failed") {
        update.payment_status = "failed";
        update.amount_paid = null;
        update.paid_at = null;
        auditAction = "marked_failed";
      } else if (action === "withdraw") {
        update.registration_status = "withdrawn";
        auditAction = "withdrawn";
      } else if (action === "cancel") {
        update.registration_status = "cancelled";
        auditAction = "cancelled";
      } else if (action === "reactivate") {
        update.registration_status = "active";
        auditAction = "reactivated";
      }

      const { data, error } = await admin
        .from("golf_registrations")
        .update(update)
        .eq("id", registration?.id)
        .select("*")
        .single();
      if (error) throw error;
      registration = data;
    }

    const audit = {
      registration_id: registration?.id,
      organization_id: organizationId,
      event_id: event?.id,
      action: auditAction,
      reason,
      previous_payment_status: previousPaymentStatus,
      new_payment_status: registration?.payment_status ?? null,
      previous_registration_status: previousRegistrationStatus,
      new_registration_status: registration?.registration_status ?? "active",
      acted_by: user.id,
      metadata: action === "add_golfer_manually" ? { source: "roster_maintenance" } : {},
    };

    const { error: auditError } = await admin
      .from("golf_registration_admin_actions")
      .insert(audit);
    if (auditError) throw auditError;

    let syncWarning: string | null = null;
    try {
      const syncResponse = await fetch(supabaseUrl + "/functions/v1/sync-google-roster", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + serviceRoleKey,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_key: registration?.event_key }),
      });
      if (!syncResponse.ok) syncWarning = "Roster saved, but Google Sheet sync needs attention.";
    } catch {
      syncWarning = "Roster saved, but Google Sheet sync needs attention.";
    }

    return response({ success: true, registration, sync_warning: syncWarning });
  } catch (error) {
    return response({
      success: false,
      error: error instanceof Error ? error.message : "Unable to update registration.",
    }, 400);
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type JsonRecord = Record<string, any>;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const REGISTRATION_TAB = "Registration List";

function json(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function text(value: unknown) {
  return String(value ?? "").trim();
}
function nullable(value: unknown) {
  const v = text(value);
  return v || null;
}
function escapeSheetName(name: string) {
  return name.replace(/'/g, "''");
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
async function googleRequest(url: string, accessToken: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const bodyText = await response.text();
  let body: any = null;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = bodyText; }
  if (!response.ok) throw new Error(`Google API request failed (${response.status}).`);
  return body;
}

function isAccessWindowActive(row: any, nowMs = Date.now()) {
  if (!row || row.status !== "active") return false;
  const starts = row.access_starts_at ? new Date(row.access_starts_at).getTime() : null;
  const ends = row.access_ends_at ? new Date(row.access_ends_at).getTime() : null;
  return (starts === null || starts <= nowMs) && (ends === null || ends >= nowMs);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!supabaseUrl || !serviceRoleKey || !googleClientId || !googleClientSecret) {
      throw new Error("Server configuration is incomplete.");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ success: false, error: "Authentication required." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ success: false, error: "Invalid session." }, 401);

    const payload = await req.json();
    const eventKey = text(payload?.event_key);
    if (!eventKey) throw new Error("Event is required.");

    const { data: event, error: eventError } = await admin
      .from("golf_registration_events")
      .select("*")
      .eq("event_key", eventKey)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return json({ success: false, error: "Event not found." }, 404);

    const organizationId = text(event.organization_id);
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
    if (!authorized) return json({ success: false, error: "Pilot or authorized ATC access is required." }, 403);

    if (!event.google_sheet_id) {
      return json({ success: true, updated_count: 0, changed_rows: 0, message: "No Google roster workbook is connected yet." });
    }

    const { data: tokenRow, error: tokenError } = await admin
      .from("google_oauth_tokens")
      .select("*")
      .eq("provider", "google")
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenRow?.refresh_token) throw new Error("Google is not connected.");

    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: tokenRow.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const refreshData = await refreshResponse.json();
    if (!refreshResponse.ok || !refreshData.access_token) throw new Error("Unable to refresh Google authorization.");
    const accessToken = refreshData.access_token as string;

    const range = encodeURIComponent(`'${escapeSheetName(REGISTRATION_TAB)}'!A1:ZZZ1001`);
    const sheetData = await googleRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${event.google_sheet_id}/values/${range}`,
      accessToken
    );
    const values = Array.isArray(sheetData?.values) ? sheetData.values : [];
    if (!values.length) return json({ success: true, updated_count: 0, changed_rows: 0 });

    const headers = (values[0] || []).map((value: unknown) => text(value));
    const rows = values.slice(1);
    const indexOf = (name: string) => headers.findIndex((header: string) => header.toLowerCase() === name.toLowerCase());
    const idIndex = indexOf("Registration ID");
    if (idIndex < 0) throw new Error("The Registration List is missing the Registration ID column.");

    const coreColumns: Record<string, string> = {
      "Team Id": "team_id",
      "Email": "email",
      "Phone": "phone",
      "First Name": "first_name",
      "Last Name": "last_name",
      "DOB": "date_of_birth",
      "Gender": "gender",
      "Division": "division",
      "Member Type": "membership_status",
      "GHIN ID": "ghin_number",
    };

    const settings = event.field_settings && typeof event.field_settings === "object" ? event.field_settings : {};
    const customFields = Array.isArray(settings.custom_fields) ? settings.custom_fields : [];
    const customHeaderMap = new Map(
      customFields
        .filter((field: any) => field?.id && field?.label)
        .map((field: any) => [String(field.label).toLowerCase(), String(field.id)])
    );

    const ids = rows.map((row: any[]) => text(row?.[idIndex])).filter(Boolean);
    if (!ids.length) return json({ success: true, updated_count: 0, changed_rows: 0 });

    const { data: existing, error: existingError } = await admin
      .from("golf_registrations")
      .select("*")
      .eq("event_key", eventKey)
      .in("id", ids);
    if (existingError) throw existingError;
    const existingById = new Map((existing || []).map((row: any) => [row.id, row]));

    const eventDates = Array.isArray(event.event_dates) ? event.event_dates : [];
    const eventDate = text(eventDates[0]) || null;
    let updatedCount = 0;
    let changedRows = 0;

    for (const row of rows) {
      const registrationId = text(row?.[idIndex]);
      if (!registrationId) continue;
      const current = existingById.get(registrationId);
      if (!current) continue;

      const update: JsonRecord = {};
      const changedFields: string[] = [];

      for (const [header, dbField] of Object.entries(coreColumns)) {
        const columnIndex = indexOf(header);
        if (columnIndex < 0) continue;
        const nextValue = nullable(row?.[columnIndex]);
        const currentValue = current[dbField] === null || current[dbField] === undefined ? null : text(current[dbField]);
        if ((nextValue ?? null) !== (currentValue ?? null)) {
          update[dbField] = nextValue;
          changedFields.push(dbField);
        }
      }

      let nextCustom = current.custom_fields && typeof current.custom_fields === "object"
        ? { ...current.custom_fields }
        : {};
      let customChanged = false;
      headers.forEach((header: string, columnIndex: number) => {
        const customId = customHeaderMap.get(header.toLowerCase());
        if (!customId) return;
        const nextValue = nullable(row?.[columnIndex]);
        const currentValue = nextCustom[customId] === null || nextCustom[customId] === undefined ? null : text(nextCustom[customId]);
        if ((nextValue ?? null) !== (currentValue ?? null)) {
          nextCustom[customId] = nextValue;
          customChanged = true;
          changedFields.push(`custom_fields.${customId}`);
        }
      });
      if (customChanged) update.custom_fields = nextCustom;

      if ("date_of_birth" in update) {
        update.age = ageOn(update.date_of_birth, eventDate);
      }

      if (!changedFields.length) continue;

      update.admin_updated_at = new Date().toISOString();
      update.admin_updated_by = user.id;

      const { error: updateError } = await admin
        .from("golf_registrations")
        .update(update)
        .eq("id", registrationId)
        .eq("event_key", eventKey);
      if (updateError) throw updateError;

      const { error: auditError } = await admin
        .from("golf_registration_admin_actions")
        .insert({
          registration_id: registrationId,
          organization_id: organizationId,
          event_id: event.id,
          action: "google_roster_edit",
          reason: "Roster details updated from Google Registration List",
          previous_payment_status: current.payment_status ?? null,
          new_payment_status: current.payment_status ?? null,
          previous_registration_status: current.registration_status ?? "active",
          new_registration_status: current.registration_status ?? "active",
          acted_by: user.id,
          metadata: { source: "google_registration_list", changed_fields: changedFields },
        });
      if (auditError) throw auditError;

      updatedCount += 1;
      changedRows += 1;
    }

    return json({
      success: true,
      updated_count: updatedCount,
      changed_rows: changedRows,
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to pull Google roster edits.",
    }, 400);
  }
});
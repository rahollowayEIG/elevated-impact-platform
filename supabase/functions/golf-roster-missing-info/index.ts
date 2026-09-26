import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type JsonRecord = Record<string, any>;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const IMPORT_SOURCE_TAB = "Import Source";
const MAX_REQUESTS = 50;
const REQUEST_TTL_DAYS = 7;

const FIELD_DEFS: Record<string, { label: string; header: string; type: string; options?: string[] }> = {
  first_name: { label: "First Name", header: "First Name", type: "text" },
  last_name: { label: "Last Name", header: "Last Name", type: "text" },
  phone: { label: "Phone", header: "Phone", type: "tel" },
  date_of_birth: { label: "Date of Birth", header: "Date of Birth", type: "date" },
  gender: { label: "Gender", header: "Gender", type: "select", options: ["Male", "Female", "Other", "Prefer not to say"] },
  division: { label: "Division", header: "Division", type: "select" },
  membership_status: { label: "Club Membership Status", header: "Club Membership Status", type: "select", options: ["Member", "Non-Member"] },
  ghin_number: { label: "GHIN ID", header: "GHIN ID", type: "text" },
};

function eventFieldDefs(event: any) {
  const defs: Record<string, { label: string; header: string; type: string; options?: string[] }> = {
    ...FIELD_DEFS,
  };
  const settings = event?.field_settings && typeof event.field_settings === "object"
    ? event.field_settings
    : {};
  for (const field of Array.isArray(settings.custom_fields) ? settings.custom_fields : []) {
    if (!field?.id || !field?.label) continue;
    defs[`custom:${field.id}`] = {
      label: String(field.label),
      header: String(field.label),
      type: field.type === "phone" ? "tel" : field.type === "textarea" ? "text" : field.type || "text",
      options: Array.isArray(field.options) ? field.options.map((option: unknown) => String(option)) : undefined,
    };
  }
  return defs;
}

function json(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeSheetName(name: string) {
  return name.replace(/'/g, "''");
}

function columnLetter(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function googleRequest(url: string, accessToken: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const bodyText = await response.text();
  let body: any = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }

  if (!response.ok) {
    throw new Error(
      `Google API request failed (${response.status}): ${typeof body === "string" ? body : JSON.stringify(body)}`
    );
  }

  return body;
}

async function googleAccess(admin: any, event: any) {
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!googleClientId || !googleClientSecret) {
    throw new Error("Google Workspace is not fully configured.");
  }
  if (!event.google_sheet_id) {
    throw new Error("This event does not have a Google roster workbook yet.");
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
  if (!refreshResponse.ok || !refreshData.access_token) {
    throw new Error("Unable to refresh Google authorization.");
  }

  return {
    accessToken: refreshData.access_token as string,
    spreadsheetId: event.google_sheet_id as string,
  };
}

async function readImportSource(admin: any, event: any) {
  const workspace = await googleAccess(admin, event);
  const range = encodeURIComponent(
    `'${escapeSheetName(IMPORT_SOURCE_TAB)}'!A1:ZZZ501`
  );
  const sheetData = await googleRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${range}`,
    workspace.accessToken
  );
  const values = Array.isArray(sheetData?.values) ? sheetData.values : [];
  return {
    ...workspace,
    headers: Array.isArray(values[0]) ? values[0].map((value: unknown) => text(value)) : [],
    rows: values.slice(1),
  };
}

async function writeHeaders(workspace: any, headers: string[]) {
  const range = encodeURIComponent(
    `'${escapeSheetName(IMPORT_SOURCE_TAB)}'!A1`
  );
  await googleRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    workspace.accessToken,
    {
      method: "PUT",
      body: JSON.stringify({ majorDimension: "ROWS", values: [headers] }),
    }
  );
}

async function authorizeAdmin(admin: any, user: any, organizationId: string) {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role === "super_admin") return true;

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("role,status,access_starts_at,access_ends_at")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["eig_admin", "organization_admin", "organization_staff"])
    .maybeSingle();
  if (membershipError) throw membershipError;
  return isAccessWindowActive(membership);
}

function normalizeRequestedFields(value: unknown, defs: Record<string, any>) {
  if (!Array.isArray(value)) return [];
  return value
    .map((field) => text(field))
    .filter((field, index, list) => defs[field] && list.indexOf(field) === index);
}

function fieldLabels(fields: string[], defs: Record<string, any>) {
  return fields.map((field) => defs[field]?.label || field);
}

function findRowByEmail(
  headers: string[],
  rows: any[][],
  emailHeader: string,
  recipientEmail: string,
  fallbackRow: number
) {
  const emailIndex = headers.findIndex((header) => header === emailHeader);
  if (emailIndex < 0) {
    throw new Error("The email column changed. Ask the event coordinator to send a new request.");
  }

  const normalizedEmail = recipientEmail.toLowerCase();
  const matchIndex = rows.findIndex(
    (row) => text(row?.[emailIndex]).toLowerCase() === normalizedEmail
  );
  if (matchIndex >= 0) return matchIndex + 2;

  const fallbackIndex = fallbackRow - 2;
  if (
    fallbackIndex >= 0 &&
    fallbackIndex < rows.length &&
    text(rows[fallbackIndex]?.[emailIndex]).toLowerCase() === normalizedEmail
  ) {
    return fallbackRow;
  }

  throw new Error("We could not match this request to the current roster source. Please contact the event coordinator.");
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "Server configuration is incomplete." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const payload = await req.json();
    const action = text(payload?.action);

    if (action === "request") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        return json({ success: false, error: "Email delivery is not configured." }, 503);
      }

      const authHeader = req.headers.get("Authorization") || "";
      const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!accessToken) return json({ success: false, error: "Authentication required." }, 401);

      const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
      const user = userData?.user;
      if (userError || !user) {
        return json({ success: false, error: "Your session is no longer valid." }, 401);
      }

      const eventId = text(payload?.event_id);
      const eventKey = text(payload?.event_key);
      let eventQuery = admin.from("golf_registration_events").select("*");
      eventQuery = eventId ? eventQuery.eq("id", eventId) : eventQuery.eq("event_key", eventKey);
      const { data: event, error: eventError } = await eventQuery.maybeSingle();
      if (eventError) throw eventError;
      if (!event) return json({ success: false, error: "Event not found." }, 404);

      const organizationId = text(event.organization_id);
      if (!organizationId || !(await authorizeAdmin(admin, user, organizationId))) {
        return json({ success: false, error: "Pilot or authorized ATC access is required." }, 403);
      }

      const fieldDefs = eventFieldDefs(event);
      const requests = Array.isArray(payload?.requests) ? payload.requests.slice(0, MAX_REQUESTS) : [];
      if (!requests.length) {
        return json({ success: false, error: "Select at least one player with missing information." }, 400);
      }

      const columnMap = payload?.column_map && typeof payload.column_map === "object"
        ? payload.column_map
        : {};
      const source = await readImportSource(admin, event);
      const headers = [...source.headers];
      const resolvedHeaders: Record<string, string> = {};

      const emailHeader = text(columnMap.email);
      if (!emailHeader || !headers.includes(emailHeader)) {
        return json({ success: false, error: "Map the Email column before sending missing-info requests." }, 409);
      }
      resolvedHeaders.email = emailHeader;

      const allRequestedFields = Array.from(
        new Set(requests.flatMap((item: any) => normalizeRequestedFields(item?.requested_fields, fieldDefs)))
      );

      for (const field of allRequestedFields) {
        let header = text(columnMap[field]);
        if (!header || !headers.includes(header)) {
          header = fieldDefs[field].header;
          if (headers.includes(header)) {
            let suffix = 2;
            while (headers.includes(`${header} ${suffix}`)) suffix += 1;
            header = `${header} ${suffix}`;
          }
          headers.push(header);
        }
        resolvedHeaders[field] = header;
      }

      if (headers.length !== source.headers.length) {
        await writeHeaders(source, headers);
      }

      const requestOrigin = text(req.headers.get("origin")).replace(/\/+$/, "");
      const suppliedOrigin = text(payload?.app_origin).replace(/\/+$/, "");
      const configuredBaseUrl = text(Deno.env.get("EIE_APP_BASE_URL")).replace(/\/+$/, "");
      const baseUrl = requestOrigin || suppliedOrigin || configuredBaseUrl;
      if (
        !baseUrl ||
        (!baseUrl.startsWith("https://") && !/^http:\/\/localhost(?::\d+)?$/.test(baseUrl))
      ) {
        return json({ success: false, error: "A secure app URL is required for player completion links." }, 400);
      }

      const expiresAt = new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const prepared: any[] = [];

      for (const item of requests) {
        const email = text(item?.email).toLowerCase();
        const requestedFields = normalizeRequestedFields(item?.requested_fields, fieldDefs);
        const fallbackRow = Number(item?.source_row || 0);
        if (!validEmail(email) || !requestedFields.length || fallbackRow < 2) continue;

        const sourceRow = findRowByEmail(
          headers,
          source.rows,
          emailHeader,
          email,
          fallbackRow
        );

        await admin
          .from("golf_roster_info_requests")
          .update({ status: "superseded", updated_at: new Date().toISOString() })
          .eq("event_id", event.id)
          .eq("source_row", sourceRow)
          .eq("recipient_email", email)
          .eq("status", "pending");

        const token = randomToken();
        const tokenHash = await sha256Hex(token);
        const fieldHeaders: Record<string, string> = { email: emailHeader };
        for (const field of requestedFields) fieldHeaders[field] = resolvedHeaders[field];

        const firstName = text(item?.first_name);
        const lastName = text(item?.last_name);
        const { data: requestRow, error: insertError } = await admin
          .from("golf_roster_info_requests")
          .insert({
            organization_id: organizationId,
            event_id: event.id,
            source_row: sourceRow,
            recipient_email: email,
            participant_first_name: firstName || null,
            participant_last_name: lastName || null,
            requested_fields: requestedFields,
            field_headers: fieldHeaders,
            token_hash: tokenHash,
            status: "pending",
            expires_at: expiresAt,
            requested_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        const link = `${baseUrl}/roster-info?token=${encodeURIComponent(token)}`;
        const labels = fieldLabels(requestedFields, fieldDefs);
        const greeting = firstName ? `Hi ${firstName},` : "Hello,";
        const textBody = [
          greeting,
          "",
          `We are finishing the registration information for ${event.name} and need a few details from you:`,
          "",
          ...labels.map((label) => `• ${label}`),
          "",
          "Please use the secure link below to complete the missing information:",
          link,
          "",
          "This link is unique to you and expires in 7 days.",
          "",
          "Thank you,",
          "ElevationPilot",
        ].join("\n");

        const htmlBody = `
          <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1D245D">
            <p>${escapeHtml(greeting)}</p>
            <p>We are finishing the registration information for <strong>${escapeHtml(event.name)}</strong> and need a few details from you:</p>
            <ul>${labels.map((label) => `<li>${escapeHtml(label)}</li>`).join("")}</ul>
            <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#D81C22;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Complete Missing Information</a></p>
            <p style="font-size:13px;color:#70727A">This secure link is unique to you and expires in 7 days.</p>
            <p>Thank you,<br/>ElevationPilot</p>
          </div>`;

        prepared.push({
          requestId: requestRow.id,
          to: email,
          subject: `${event.name}: registration information needed`,
          html: htmlBody,
          text: textBody,
        });
      }

      if (!prepared.length) {
        return json({
          success: false,
          error: "None of the selected rows have a valid email address and player-completable missing fields.",
        }, 400);
      }

      const from = Deno.env.get("SQUAWK_FROM_EMAIL") || "ElevationPilot <squawk@elevatedimpactgroup.net>";
      const replyTo = Deno.env.get("SQUAWK_REPLY_TO_EMAIL") || "info@elevatedimpactgroup.net";
      const resendResponse = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `roster-missing-info/${event.id}/${crypto.randomUUID()}`,
        },
        body: JSON.stringify(
          prepared.map((item) => ({
            from,
            to: [item.to],
            reply_to: replyTo,
            subject: item.subject,
            html: item.html,
            text: item.text,
          }))
        ),
      });

      const resendResult = await resendResponse.json().catch(() => ({}));
      if (!resendResponse.ok) {
        const errorMessage = text(resendResult?.message) || "Resend could not send the email request.";
        await admin
          .from("golf_roster_info_requests")
          .update({ status: "send_failed", last_error: errorMessage, updated_at: new Date().toISOString() })
          .in("id", prepared.map((item) => item.requestId));
        return json({ success: false, error: errorMessage }, 502);
      }

      const providerRows = Array.isArray(resendResult?.data) ? resendResult.data : [];
      for (let index = 0; index < prepared.length; index += 1) {
        await admin
          .from("golf_roster_info_requests")
          .update({
            resend_message_id: providerRows[index]?.id || null,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", prepared[index].requestId);
      }

      return json({
        success: true,
        sent_count: prepared.length,
        skipped_count: requests.length - prepared.length,
      });
    }

    if (action === "get" || action === "submit") {
      const token = text(payload?.token);
      if (!token) return json({ success: false, error: "This completion link is invalid." }, 400);
      const tokenHash = await sha256Hex(token);

      const { data: requestRow, error: requestError } = await admin
        .from("golf_roster_info_requests")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (requestError) throw requestError;
      if (!requestRow) return json({ success: false, error: "This completion link is invalid." }, 404);

      const now = new Date();
      if (new Date(requestRow.expires_at) <= now && requestRow.status === "pending") {
        await admin
          .from("golf_roster_info_requests")
          .update({ status: "expired", updated_at: now.toISOString() })
          .eq("id", requestRow.id);
        requestRow.status = "expired";
      }

      if (requestRow.status === "superseded") {
        return json({ success: false, error: "A newer information request was sent for this registration. Please use the newest email link." }, 409);
      }
      if (requestRow.status === "send_failed") {
        return json({ success: false, error: "This request was not activated. Please contact the event coordinator." }, 409);
      }
      if (requestRow.status === "expired") {
        return json({ success: false, error: "This completion link has expired. Please contact the event coordinator for a new link." }, 410);
      }

      const { data: event, error: eventError } = await admin
        .from("golf_registration_events")
        .select("*")
        .eq("id", requestRow.event_id)
        .maybeSingle();
      if (eventError) throw eventError;
      if (!event) return json({ success: false, error: "Event not found." }, 404);

      if (requestRow.status === "completed") {
        return json({
          success: true,
          completed: true,
          event_name: event.name,
          participant_name: [requestRow.participant_first_name, requestRow.participant_last_name].filter(Boolean).join(" "),
        });
      }

      const fieldDefs = eventFieldDefs(event);
      const requestedFields = normalizeRequestedFields(requestRow.requested_fields, fieldDefs);
      const fieldHeaders = requestRow.field_headers && typeof requestRow.field_headers === "object"
        ? requestRow.field_headers
        : {};
      const source = await readImportSource(admin, event);
      const sourceRow = findRowByEmail(
        source.headers,
        source.rows,
        text(fieldHeaders.email),
        text(requestRow.recipient_email),
        Number(requestRow.source_row)
      );
      const row = source.rows[sourceRow - 2] || [];
      const currentValues: Record<string, string> = {};

      for (const field of requestedFields) {
        const header = text(fieldHeaders[field]);
        const columnIndex = source.headers.findIndex((value) => value === header);
        currentValues[field] = columnIndex >= 0 ? text(row[columnIndex]) : "";
      }

      if (action === "get") {
        return json({
          success: true,
          completed: false,
          event_name: event.name,
          participant_name: [requestRow.participant_first_name, requestRow.participant_last_name].filter(Boolean).join(" "),
          requested_fields: requestedFields.map((field) => ({
            key: field,
            label: fieldDefs[field].label,
            type: fieldDefs[field].type,
            options: field === "division"
              ? (Array.isArray(event.divisions) ? event.divisions : [])
              : fieldDefs[field].options || [],
          })),
          current_values: currentValues,
          expires_at: requestRow.expires_at,
        });
      }

      const submittedValues = payload?.values && typeof payload.values === "object"
        ? payload.values
        : {};
      const updates: Array<{ range: string; values: any[][] }> = [];

      for (const field of requestedFields) {
        const value = text(submittedValues[field]);
        if (!value) {
          return json({ success: false, error: `${fieldDefs[field].label} is required.` }, 400);
        }
        if (field === "date_of_birth" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return json({ success: false, error: "Enter a valid date of birth." }, 400);
        }

        const header = text(fieldHeaders[field]);
        const columnIndex = source.headers.findIndex((headerValue) => headerValue === header);
        if (columnIndex < 0) {
          return json({ success: false, error: `The ${fieldDefs[field].label} column changed. Please contact the event coordinator.` }, 409);
        }

        updates.push({
          range: `'${escapeSheetName(IMPORT_SOURCE_TAB)}'!${columnLetter(columnIndex)}${sourceRow}`,
          values: [[value]],
        });
      }

      await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}/values:batchUpdate`,
        source.accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: updates,
          }),
        }
      );

      await admin
        .from("golf_roster_info_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", requestRow.id);

      return json({
        success: true,
        completed: true,
        event_name: event.name,
      });
    }

    return json({ success: false, error: "Unsupported action." }, 400);
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to process this request.",
    }, 400);
  }
});

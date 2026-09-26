import { createClient } from "npm:@supabase/supabase-js@2.45.4";

type JsonRecord = Record<string, unknown>;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const BUCKET = "golf-roster-imports";
const IMPORT_SOURCE_TAB = "Import Source";
const MAX_ROWS = 500;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

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

function phoneKey(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120) || "roster";
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function ageOn(dateOfBirth: string | null, eventDate: string | null) {
  if (!dateOfBirth || !eventDate) return null;
  const birth = dateOfBirth.split("-").map(Number);
  const event = eventDate.split("-").map(Number);
  if (
    birth.length !== 3 ||
    event.length !== 3 ||
    [...birth, ...event].some((part) => !Number.isFinite(part))
  ) return null;

  let age = event[0] - birth[0];
  if (event[1] < birth[1] || (event[1] === birth[1] && event[2] < birth[2])) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
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
  let body: unknown = null;
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

  return body as any;
}

function escapeSheetName(name: string) {
  return name.replace(/'/g, "''");
}

async function ensureGoogleWorkspace(admin: any, event: any) {
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const driveFolderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

  if (!googleClientId || !googleClientSecret || !driveFolderId) {
    throw new Error("Google Workspace is not fully configured.");
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

  const accessToken = refreshData.access_token;

  let eventFolderId = event.google_drive_folder_id;
  let eventFolderUrl = event.google_drive_folder_url;

  if (!eventFolderId) {
    const createdFolder = await googleRequest(
      "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,webViewLink",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          name: event.name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [driveFolderId],
        }),
      }
    );

    eventFolderId = createdFolder.id;
    eventFolderUrl =
      createdFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${eventFolderId}`;

    const { error } = await admin
      .from("golf_registration_events")
      .update({
        google_drive_folder_id: eventFolderId,
        google_drive_folder_url: eventFolderUrl,
      })
      .eq("id", event.id);
    if (error) throw error;
  }

  let spreadsheetId = event.google_sheet_id;
  let spreadsheetUrl = event.google_sheet_url;

  if (!spreadsheetId) {
    const createdFile = await googleRequest(
      "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,webViewLink",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          name: `${event.name} - Registration Roster`,
          mimeType: "application/vnd.google-apps.spreadsheet",
          parents: [eventFolderId],
        }),
      }
    );

    spreadsheetId = createdFile.id;
    spreadsheetUrl =
      createdFile.webViewLink ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    const { error } = await admin
      .from("golf_registration_events")
      .update({
        google_sheet_id: spreadsheetId,
        google_sheet_url: spreadsheetUrl,
      })
      .eq("id", event.id);
    if (error) throw error;
  } else {
    try {
      const metadata = await googleRequest(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?supportsAllDrives=true&fields=parents,webViewLink`,
        accessToken
      );
      const parents = Array.isArray(metadata?.parents) ? metadata.parents : [];

      if (!parents.includes(eventFolderId)) {
        const params = new URLSearchParams({
          supportsAllDrives: "true",
          addParents: eventFolderId,
          fields: "id,webViewLink,parents",
        });
        if (parents.length) params.set("removeParents", parents.join(","));

        const moved = await googleRequest(
          `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?${params.toString()}`,
          accessToken,
          { method: "PATCH", body: JSON.stringify({}) }
        );
        spreadsheetUrl =
          moved.webViewLink ||
          spreadsheetUrl ||
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      }
    } catch (error) {
      console.warn("Unable to move workbook into event folder:", error);
    }
  }

  const spreadsheet = await googleRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    accessToken
  );
  const sheets = spreadsheet?.sheets || [];
  let importSourceSheet = sheets.find(
    (sheet: any) => sheet.properties?.title === IMPORT_SOURCE_TAB
  );

  if (!importSourceSheet) {
    const created = await googleRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: IMPORT_SOURCE_TAB } } }],
        }),
      }
    );
    const createdSheetId = created?.replies?.[0]?.addSheet?.properties?.sheetId;
    importSourceSheet = {
      properties: {
        title: IMPORT_SOURCE_TAB,
        sheetId: createdSheetId,
      },
    };
  }

  const resolvedSpreadsheetUrl =
    spreadsheetUrl ||
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const importSourceSheetId = importSourceSheet?.properties?.sheetId ?? null;
  const importSourceUrl = importSourceSheetId === null
    ? resolvedSpreadsheetUrl
    : `${resolvedSpreadsheetUrl.split("#")[0]}#gid=${importSourceSheetId}`;

  return {
    accessToken,
    eventFolderId,
    eventFolderUrl,
    spreadsheetId,
    spreadsheetUrl: resolvedSpreadsheetUrl,
    importSourceSheetId,
    importSourceUrl,
  };
}

async function sourceFingerprint(headers: unknown[], rows: unknown[][]) {
  const payload = JSON.stringify([headers, rows]);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const REQUIRED_TEMPLATE_TAB = "Roster Prep - Required";

function requiredRosterHeaders(event: any) {
  const settings =
    event?.field_settings && typeof event.field_settings === "object"
      ? event.field_settings
      : {};

  const headers = ["First Name", "Last Name", "Email", "Phone"];

  const standard = [
    ["dob", "Date of Birth"],
    ["gender", "Gender"],
    ["division", "Division"],
    ["membership", "Club Membership Status"],
    ["ghin", "GHIN"],
  ];

  for (const [key, label] of standard) {
    if (settings[key] === "required") headers.push(label);
  }

  for (const field of Array.isArray(settings.custom_fields) ? settings.custom_fields : []) {
    if (field?.required && field?.label) headers.push(String(field.label));
  }

  return headers;
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
    if (userError || !user) {
      return response({ success: false, error: "Invalid session." }, 401);
    }

    const payload = await req.json();
    const eventId = text(payload?.event_id);
    const eventKey = text(payload?.event_key);
    if (!eventId && !eventKey) throw new Error("Event is required.");

    let eventQuery = admin.from("golf_registration_events").select("*");
    eventQuery = eventId ? eventQuery.eq("id", eventId) : eventQuery.eq("event_key", eventKey);
    const { data: event, error: eventError } = await eventQuery.maybeSingle();
    if (eventError) throw eventError;
    if (!event) return response({ success: false, error: "Event not found." }, 404);

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

    const requestedAction = text(payload?.action || "import");

    if (requestedAction === "prepare_required_roster_template") {
      const workspace = await ensureGoogleWorkspace(admin, event);
      const requiredHeaders = requiredRosterHeaders(event);

      const spreadsheet = await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}?fields=sheets.properties(sheetId,title)`,
        workspace.accessToken
      );
      const sheets = Array.isArray(spreadsheet?.sheets) ? spreadsheet.sheets : [];
      let templateSheet = sheets.find(
        (sheet: any) => sheet.properties?.title === REQUIRED_TEMPLATE_TAB
      );

      if (!templateSheet) {
        const created = await googleRequest(
          `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}:batchUpdate`,
          workspace.accessToken,
          {
            method: "POST",
            body: JSON.stringify({
              requests: [
                { addSheet: { properties: { title: REQUIRED_TEMPLATE_TAB, gridProperties: { frozenRowCount: 1 } } } },
              ],
            }),
          }
        );
        templateSheet = {
          properties: created?.replies?.[0]?.addSheet?.properties || {},
        };
      }

      const headerRange = encodeURIComponent(
        `'${escapeSheetName(REQUIRED_TEMPLATE_TAB)}'!A1:ZZ1`
      );
      const existingData = await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${headerRange}`,
        workspace.accessToken
      );
      const existingHeaders = Array.isArray(existingData?.values?.[0])
        ? existingData.values[0].map((value: unknown) => text(value))
        : [];

      const nextHeaders = existingHeaders.length
        ? [
            ...existingHeaders,
            ...requiredHeaders.filter(
              (header) => !existingHeaders.some(
                (existing: string) => existing.toLowerCase() === header.toLowerCase()
              )
            ),
          ]
        : requiredHeaders;

      const writeRange = encodeURIComponent(
        `'${escapeSheetName(REQUIRED_TEMPLATE_TAB)}'!A1`
      );
      await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
        workspace.accessToken,
        {
          method: "PUT",
          body: JSON.stringify({
            majorDimension: "ROWS",
            values: [nextHeaders],
          }),
        }
      );

      const templateSheetId = templateSheet?.properties?.sheetId ?? null;

      const settings =
        event?.field_settings && typeof event.field_settings === "object"
          ? event.field_settings
          : {};
      const registrationFormat =
        settings.registration_format === "team" ? "team" : "individual";
      const teamSize = registrationFormat === "team"
        ? Math.max(2, Math.min(12, Number(settings.team_size || 4)))
        : 1;

      if (templateSheetId !== null) {
        const formatRequests: any[] = [];

        // Clear prior EIE team shading first so changing team size reflows cleanly.
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: templateSheetId,
              startRowIndex: 1,
              endRowIndex: 121,
              startColumnIndex: 0,
              endColumnIndex: Math.max(1, nextHeaders.length),
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 1, blue: 1 },
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        });

        if (registrationFormat === "team") {
          const blockCount = Math.ceil(120 / teamSize);

          for (let block = 0; block < blockCount; block += 1) {
            const startRowIndex = 1 + block * teamSize;
            const endRowIndex = Math.min(121, startRowIndex + teamSize);
            const shaded = block % 2 === 1;

            if (shaded) {
              formatRequests.push({
                repeatCell: {
                  range: {
                    sheetId: templateSheetId,
                    startRowIndex,
                    endRowIndex,
                    startColumnIndex: 0,
                    endColumnIndex: Math.max(1, nextHeaders.length),
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 0.92,
                        green: 0.92,
                        blue: 0.92,
                      },
                    },
                  },
                  fields: "userEnteredFormat.backgroundColor",
                },
              });
            }
          }
        }

        await googleRequest(
          `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}:batchUpdate`,
          workspace.accessToken,
          {
            method: "POST",
            body: JSON.stringify({ requests: formatRequests }),
          }
        );
      }

      const templateUrl = templateSheetId === null
        ? workspace.spreadsheetUrl
        : `${workspace.spreadsheetUrl.split("#")[0]}#gid=${templateSheetId}`;

      return response({
        success: true,
        headers: requiredHeaders,
        roster_template_url: templateUrl,
        google_sheet_url: workspace.spreadsheetUrl,
        google_drive_folder_url: workspace.eventFolderUrl,
        existing_headers_preserved: existingHeaders.length > 0,
        registration_format: registrationFormat,
        team_size: teamSize,
      });
    }

    if (requestedAction === "load_required_roster_template") {
      const workspace = await ensureGoogleWorkspace(admin, event);
      const requiredHeaders = requiredRosterHeaders(event);
      const prepRange = encodeURIComponent(
        `'${escapeSheetName(REQUIRED_TEMPLATE_TAB)}'!A1:ZZZ500`
      );
      const prepData = await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${prepRange}`,
        workspace.accessToken
      );
      const prepValues = Array.isArray(prepData?.values) ? prepData.values : [];
      const prepHeaders = Array.isArray(prepValues[0])
        ? prepValues[0].map((value: unknown) => text(value))
        : [];

      if (!prepHeaders.length) {
        throw new Error("The Required Roster Sheet does not have headers yet.");
      }

      const headerIndexes = requiredHeaders.map((header) =>
        prepHeaders.findIndex(
          (existing: string) => existing.toLowerCase() === header.toLowerCase()
        )
      );
      const missingHeaders = requiredHeaders.filter(
        (_header, index) => headerIndexes[index] < 0
      );
      if (missingHeaders.length) {
        throw new Error(
          `The Required Roster Sheet is missing: ${missingHeaders.join(", ")}. Reopen it from Registration Setup to refresh the template.`
        );
      }

      const selectedRows = prepValues
        .slice(1)
        .map((row: unknown[]) =>
          headerIndexes.map((columnIndex) => row?.[columnIndex] ?? "")
        )
        .filter((row: unknown[]) => row.some((value) => text(value)));

      if (selectedRows.length > MAX_ROWS) {
        throw new Error(`A maximum of ${MAX_ROWS} golfers can be loaded at once.`);
      }

      const clearRange = encodeURIComponent(
        `'${escapeSheetName(IMPORT_SOURCE_TAB)}'!A:ZZZ`
      );
      await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${clearRange}:clear`,
        workspace.accessToken,
        { method: "POST", body: JSON.stringify({}) }
      );

      const writeRange = encodeURIComponent(
        `'${escapeSheetName(IMPORT_SOURCE_TAB)}'!A1`
      );
      await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
        workspace.accessToken,
        {
          method: "PUT",
          body: JSON.stringify({
            majorDimension: "ROWS",
            values: [requiredHeaders, ...selectedRows],
          }),
        }
      );

      const sourceHash = await sourceFingerprint(requiredHeaders, selectedRows);

      return response({
        success: true,
        source_hash: sourceHash,
        google_sheet_url: workspace.spreadsheetUrl,
        import_source_url: workspace.importSourceUrl,
        google_drive_folder_url: workspace.eventFolderUrl,
        headers: requiredHeaders,
        rows: selectedRows,
        source_type: "required_roster_sheet",
      });
    }

    if (requestedAction === "save_source_sheet") {
      if (payload?.replace_source !== true) {
        throw new Error("This source can only be replaced by a new roster upload.");
      }

      const sourceSheet = payload?.source_sheet || {};
      const sourceHeaders = Array.isArray(sourceSheet.headers) ? sourceSheet.headers : [];
      const sourceRows = Array.isArray(sourceSheet.rows) ? sourceSheet.rows : [];

      if (!sourceHeaders.length) {
        throw new Error("The roster needs column headers before it can be saved.");
      }
      if (sourceRows.length > MAX_ROWS) {
        throw new Error(`A maximum of ${MAX_ROWS} golfers can be saved at once.`);
      }

      const workspace = await ensureGoogleWorkspace(admin, event);
      const clearRange = encodeURIComponent(
        `'${escapeSheetName(IMPORT_SOURCE_TAB)}'!A:ZZZ`
      );
      await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${clearRange}:clear`,
        workspace.accessToken,
        { method: "POST", body: JSON.stringify({}) }
      );

      const writeRange = encodeURIComponent(
        `'${escapeSheetName(IMPORT_SOURCE_TAB)}'!A1`
      );
      await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
        workspace.accessToken,
        {
          method: "PUT",
          body: JSON.stringify({
            majorDimension: "ROWS",
            values: [sourceHeaders, ...sourceRows],
          }),
        }
      );

      const sourceHash = await sourceFingerprint(sourceHeaders, sourceRows);

      return response({
        success: true,
        saved_count: sourceRows.length,
        source_hash: sourceHash,
        google_sheet_url: workspace.spreadsheetUrl,
        import_source_url: workspace.importSourceUrl,
        google_drive_folder_url: workspace.eventFolderUrl,
      });
    }

    if (requestedAction === "load_source_sheet") {
      const workspace = await ensureGoogleWorkspace(admin, event);
      const range = encodeURIComponent(
        `'${escapeSheetName(IMPORT_SOURCE_TAB)}'!A1:ZZZ500`
      );
      const sheetData = await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${range}`,
        workspace.accessToken
      );
      const values = Array.isArray(sheetData?.values) ? sheetData.values : [];

      const loadedHeaders = values[0] || [];
      const loadedRows = values.slice(1);
      const sourceHash = await sourceFingerprint(loadedHeaders, loadedRows);

      return response({
        success: true,
        source_hash: sourceHash,
        google_sheet_url: workspace.spreadsheetUrl,
        import_source_url: workspace.importSourceUrl,
        google_drive_folder_url: workspace.eventFolderUrl,
        headers: loadedHeaders,
        rows: loadedRows,
      });
    }

    const sourceType = text(payload?.source_type || "upload");
    const file = payload?.file || {};
    const hasLocalFile = !["google_sheet", "required_roster_sheet"].includes(sourceType);
    const fileName = hasLocalFile
      ? safeFileName(text(file.name))
      : sourceType === "required_roster_sheet"
        ? "EIE Required Roster Sheet"
        : "Import Source (Google Sheet)";
    const mimeType = text(file.type).toLowerCase() || "application/octet-stream";
    const fileSize = Number(file.size || 0);
    const base64 = text(file.base64);

    if (hasLocalFile) {
      if (!fileName || !base64) throw new Error("Roster source file is required.");
      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_BYTES) {
        throw new Error("Roster files must be 5 MB or smaller.");
      }

      const extension = fileName.split(".").pop()?.toLowerCase();
      if (!["csv", "xlsx"].includes(extension || "")) {
        throw new Error("Choose a CSV or XLSX roster file.");
      }
      if (mimeType !== "application/octet-stream" && !ALLOWED_MIME.has(mimeType)) {
        throw new Error("Unsupported roster file type.");
      }
    }

    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    if (!rows.length) throw new Error("There are no approved rows to import.");
    if (rows.length > MAX_ROWS) throw new Error(`A maximum of ${MAX_ROWS} golfers can be imported at once.`);

    const allowDuplicates = payload?.allow_duplicates === true;
    const now = new Date().toISOString();

    const { data: existingRows, error: existingError } = await admin
      .from("golf_registrations")
      .select("email,phone,registration_status")
      .eq("event_key", text(event.event_key));
    if (existingError) throw existingError;

    const existingEmails = new Set(
      (existingRows || [])
        .filter((row) => text(row.registration_status || "active") !== "cancelled")
        .map((row) => text(row.email).toLowerCase())
        .filter(Boolean)
    );
    const existingPhones = new Set(
      (existingRows || [])
        .filter((row) => text(row.registration_status || "active") !== "cancelled")
        .map((row) => phoneKey(row.phone))
        .filter(Boolean)
    );

    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const candidates: JsonRecord[] = [];
    const candidateSourceRows: number[] = [];
    let duplicateCount = 0;
    let invalidCount = 0;

    const eventDates = Array.isArray(event.event_dates) ? event.event_dates : [];
    const eventDate = text(eventDates[0]) || null;
    const eventSettings =
      event?.field_settings && typeof event.field_settings === "object"
        ? event.field_settings
        : {};
    const registrationFormat =
      eventSettings.registration_format === "team" ? "team" : "individual";
    const teamSize = registrationFormat === "team"
      ? Math.max(2, Math.min(12, Number(eventSettings.team_size || 4)))
      : 1;

    for (const entry of rows) {
      const golfer = entry?.golfer || {};
      const firstName = text(golfer.first_name);
      const lastName = text(golfer.last_name);
      const email = nullableText(golfer.email)?.toLowerCase() ?? null;
      const phone = nullableText(golfer.phone);
      const normalizedPhone = phoneKey(phone);
      const membershipStatus = text(golfer.membership_status || "Member");
      const paymentStatus = text(golfer.payment_status || "pending").toLowerCase();
      const compReason = nullableText(golfer.comp_reason);
      const dateOfBirth = nullableText(golfer.date_of_birth);
      const gender = nullableText(golfer.gender);
      const division = nullableText(golfer.division);
      const ghinNumber = nullableText(golfer.ghin_number);
      const customFields =
        golfer.custom_fields && typeof golfer.custom_fields === "object"
          ? golfer.custom_fields
          : {};
      const settings = eventSettings;

      let invalid = false;
      if (
        !firstName ||
        !lastName ||
        !email ||
        !phone ||
        !validEmail(email) ||
        !["pending", "paid", "comp"].includes(paymentStatus) ||
        (paymentStatus === "comp" && !compReason)
      ) invalid = true;

      if (
        settings.membership !== "hidden" &&
        !["Member", "Non-Member"].includes(membershipStatus)
      ) invalid = true;

      const requiredValues: Record<string, string | null> = {
        dob: dateOfBirth,
        gender,
        division,
        membership: membershipStatus,
        ghin: ghinNumber,
      };

      for (const key of ["dob", "gender", "division", "membership", "ghin"]) {
        if (settings[key] === "required" && !text(requiredValues[key])) {
          invalid = true;
        }
      }

      for (const field of Array.isArray(settings.custom_fields) ? settings.custom_fields : []) {
        if (!field?.required) continue;
        const value = customFields[field.id];
        const missing =
          field.type === "checkbox"
            ? value !== true
            : !text(value);
        if (missing) invalid = true;
      }

      if (invalid) {
        invalidCount += 1;
        continue;
      }

      const duplicate =
        (email && existingEmails.has(email)) ||
        (normalizedPhone && existingPhones.has(normalizedPhone)) ||
        (email && seenEmails.has(email)) ||
        (normalizedPhone && seenPhones.has(normalizedPhone));

      if (duplicate && !allowDuplicates) {
        duplicateCount += 1;
        continue;
      }

      if (email) seenEmails.add(email);
      if (normalizedPhone) seenPhones.add(normalizedPhone);

      const calculatedAge = ageOn(dateOfBirth, eventDate);
      if (dateOfBirth && calculatedAge === null) {
        invalidCount += 1;
        continue;
      }

      const configuredPrice =
        membershipStatus === "Member" ? event.member_price : event.non_member_price;
      const suppliedPrice = golfer.price;
      const price =
        suppliedPrice === "" || suppliedPrice === null || suppliedPrice === undefined
          ? Number(configuredPrice || 0)
          : Number(suppliedPrice);

      if (!Number.isFinite(price) || price < 0) {
        invalidCount += 1;
        continue;
      }

      const sourceRowNumber = Number(entry?.source_row || 0);
      const inferredTeamId =
        sourceType === "required_roster_sheet" &&
        registrationFormat === "team" &&
        sourceRowNumber >= 2
          ? String(Math.floor((sourceRowNumber - 2) / teamSize) + 1)
          : null;

      candidates.push({
        organization_id: organizationId,
        entry_number: nullableText(golfer.entry_number),
        team_id: nullableText(golfer.team_id) || inferredTeamId,
        event_id: event.id,
        event_key: event.event_key,
        event_name: event.name,
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
        payment_status: paymentStatus,
        payment_reference: "roster_upload",
        amount_paid: paymentStatus === "paid" ? price : paymentStatus === "comp" ? 0 : null,
        paid_at: paymentStatus === "paid" || paymentStatus === "comp" ? now : null,
        registration_status: "active",
        registration_source: "import",
        user_id: null,
        admin_note:
          paymentStatus === "comp"
            ? compReason
            : `Imported from ${fileName}`,
        admin_updated_at: now,
        admin_updated_by: user.id,
      });
      candidateSourceRows.push(Number(entry?.source_row || 0));
    }

    const workspace = await ensureGoogleWorkspace(admin, event);
    const expectedSourceHash = text(payload?.source_hash);
    if (!expectedSourceHash) {
      throw new Error("Reload the Google Import Source before importing.");
    }

    const currentRange = encodeURIComponent(
      `'${escapeSheetName(IMPORT_SOURCE_TAB)}'!A1:ZZZ500`
    );
    const currentSheetData = await googleRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheetId}/values/${currentRange}`,
      workspace.accessToken
    );
    const currentValues = Array.isArray(currentSheetData?.values)
      ? currentSheetData.values
      : [];
    const currentHeaders = currentValues[0] || [];
    const currentRows = currentValues.slice(1);
    const currentSourceHash = await sourceFingerprint(currentHeaders, currentRows);

    if (currentSourceHash !== expectedSourceHash) {
      throw new Error(
        "The Google Import Source changed since this preview. Reload from Google Sheet before importing."
      );
    }

    if (!candidates.length) {
      return response({
        success: true,
        imported_count: 0,
        duplicate_count: duplicateCount,
        invalid_count: invalidCount,
        file_path: null,
        google_sheet_url: workspace.spreadsheetUrl,
        google_drive_folder_url: workspace.eventFolderUrl,
        sync_warning: null,
      });
    }

    const { data: bucketList, error: bucketListError } = await admin.storage.listBuckets();
    if (bucketListError) throw bucketListError;
    if (!(bucketList || []).some((bucket) => bucket.id === BUCKET)) {
      const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: [
          "text/csv",
          "application/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
      });
      if (bucketError) throw bucketError;
    }

    let objectPath: string | null = null;

    if (hasLocalFile) {
      const bytes = decodeBase64(base64);
      if (bytes.byteLength > MAX_BYTES) throw new Error("Roster files must be 5 MB or smaller.");

      objectPath = `${organizationId}/${event.id}/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(objectPath, bytes, {
          contentType: mimeType,
          upsert: false,
        });
      if (uploadError) throw uploadError;
    }

    let inserted: JsonRecord[] = [];
    try {
      const { data, error } = await admin
        .from("golf_registrations")
        .insert(candidates)
        .select("*");
      if (error) throw error;
      inserted = data || [];
    } catch (error) {
      if (objectPath) await admin.storage.from(BUCKET).remove([objectPath]);
      throw error;
    }

    if (inserted.length) {
      const audits = inserted.map((registration, index) => ({
        registration_id: registration.id,
        organization_id: organizationId,
        event_id: event.id,
        action: "golfer_added_manually",
        reason:
          text(registration.payment_status) === "comp"
            ? nullableText(registration.admin_note)
            : null,
        previous_payment_status: null,
        new_payment_status: registration.payment_status ?? null,
        previous_registration_status: null,
        new_registration_status: registration.registration_status ?? "active",
        acted_by: user.id,
        metadata: {
          source: "roster_upload",
          source_file_bucket: objectPath ? BUCKET : null,
          source_file_path: objectPath,
          source_file_name: fileName,
          source_google_sheet_url: ["google_sheet", "required_roster_sheet"].includes(sourceType) ? workspace.importSourceUrl : null,
          source_row: candidateSourceRows[index] || null,
        },
      }));

      const { error: auditError } = await admin
        .from("golf_registration_admin_actions")
        .insert(audits);
      if (auditError) throw auditError;
    }

    let syncWarning: string | null = null;
    try {
      const syncResponse = await fetch(
        supabaseUrl + "/functions/v1/sync-google-roster",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + serviceRoleKey,
            apikey: serviceRoleKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ event_key: event.event_key }),
        }
      );
      if (!syncResponse.ok) {
        syncWarning = "Roster imported, but Google Sheet sync needs attention.";
      }
    } catch {
      syncWarning = "Roster imported, but Google Sheet sync needs attention.";
    }

    return response({
      success: true,
      imported_count: inserted.length,
      duplicate_count: duplicateCount,
      invalid_count: invalidCount,
      file_path: objectPath,
      file_bucket: BUCKET,
      google_sheet_url: workspace.spreadsheetUrl,
      import_source_url: workspace.importSourceUrl,
      google_drive_folder_url: workspace.eventFolderUrl,
      sync_warning: syncWarning,
    });
  } catch (error) {
    return response(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to import roster.",
      },
      400
    );
  }
});

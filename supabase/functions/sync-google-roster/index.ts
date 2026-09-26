import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_EVENT_KEY = "chapel-hill-2026-club-championships";
const REGISTRATION_TAB = "Registration List";
const CONFIRMED_TAB = "Confirmed Roster";
const IMPORT_SOURCE_TAB = "Import Source";

function prettyLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    console.error("Google API error:", body);
    throw new Error(`Google API request failed (${response.status}): ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

function escapeSheetName(name: string) {
  return name.replace(/'/g, "''");
}

function isAccessWindowActive(row: any, nowMs = Date.now()) {
  if (!row || row.status !== "active") return false;
  const starts = row.access_starts_at ? new Date(row.access_starts_at).getTime() : null;
  const ends = row.access_ends_at ? new Date(row.access_ends_at).getTime() : null;
  return (starts === null || starts <= nowMs) && (ends === null || ends >= nowMs);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const driveFolderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

    if (!supabaseUrl || !serviceRoleKey || !googleClientId || !googleClientSecret || !driveFolderId) {
      throw new Error("Missing required server configuration.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new Error("Authentication required.");
    const internalServiceCall = token === serviceRoleKey;
    let callerUser: any = null;
    if (!internalServiceCall) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      callerUser = userData?.user || null;
      if (userError || !callerUser) throw new Error("Invalid session.");
    }

    let requestedEventKey = DEFAULT_EVENT_KEY;
    if (req.method === "POST") {
      try {
        const payload = await req.json();
        if (payload?.event_key) requestedEventKey = String(payload.event_key);
      } catch {}
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from("google_oauth_tokens")
      .select("*")
      .eq("provider", "google")
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenRow?.refresh_token) throw new Error("Google is not connected. No refresh token was found.");

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
    const accessToken = refreshData.access_token;
    const expiresIn = Number(refreshData.expires_in || 3600);
    await supabase.from("google_oauth_tokens").update({
      access_token: accessToken,
      expires_in: expiresIn,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);

    const { data: event, error: eventError } = await supabase
      .from("golf_registration_events")
      .select("*")
      .eq("event_key", requestedEventKey)
      .single();
    if (eventError || !event) throw new Error(`Event not found for event_key: ${requestedEventKey}`);

    if (!internalServiceCall) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", callerUser.id)
        .maybeSingle();
      if (profileError) throw profileError;

      let authorized = profile?.role === "super_admin";
      if (!authorized) {
        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("role,status,access_starts_at,access_ends_at")
          .eq("organization_id", event.organization_id)
          .eq("user_id", callerUser.id)
          .eq("status", "active")
          .in("role", ["eig_admin", "organization_admin", "organization_staff"])
          .maybeSingle();
        if (membershipError) throw membershipError;
        authorized = isAccessWindowActive(membership);
      }
      if (!authorized) {
        const { data: assignment, error: assignmentError } = await supabase
          .from("event_assignments")
          .select("id,status,access_starts_at,access_ends_at")
          .eq("event_id", event.id)
          .eq("user_id", callerUser.id)
          .eq("status", "active")
          .eq("role", "event_coordinator")
          .maybeSingle();
        if (assignmentError) throw assignmentError;
        authorized = isAccessWindowActive(assignment);
      }
      if (!authorized) throw new Error("Pilot or assigned ATC access is required.");
    }

    const { data: registrations, error: registrationError } = await supabase
      .from("golf_registrations")
      .select("*")
      .eq("event_key", requestedEventKey)
      .order("created_at", { ascending: true });
    if (registrationError) throw registrationError;

    const golfers = registrations || [];
    const confirmed = golfers.filter((golfer: any) => ["paid", "comp"].includes(String(golfer.payment_status || "")));

    const customKeys = Array.from(new Set(golfers.flatMap((golfer: any) => {
      const fields = golfer.custom_fields && typeof golfer.custom_fields === "object" ? golfer.custom_fields : {};
      return Object.keys(fields);
    })));

    const headers = [
      "Team Id", "Entry Number", "Email", "Phone", "First Name", "Last Name", "DOB", "Gender", "Tee", "Division", "Member Type", "GHIN ID",
      ...customKeys.map(prettyLabel),
      "Age", "Price", "Payment Status", "Admin Note", "Registration Date", "Registration ID",
    ];

    function buildRows(source: any[]) {
      return source.map((golfer: any, index: number) => {
        const customFields = golfer.custom_fields && typeof golfer.custom_fields === "object" ? golfer.custom_fields : {};
        return [
          golfer.team_id ?? "",
          golfer.entry_number ?? index + 1,
          golfer.email ?? "",
          golfer.phone ?? "",
          golfer.first_name ?? "",
          golfer.last_name ?? "",
          golfer.date_of_birth ?? "",
          golfer.gender ?? "",
          golfer.tee ?? "",
          golfer.division ?? "",
          golfer.membership_status ?? "",
          golfer.ghin_number ?? "",
          ...customKeys.map((key) => customFields[key] ?? ""),
          golfer.age ?? "",
          golfer.price ?? "",
          golfer.payment_status ?? "",
          golfer.admin_note ?? "",
          golfer.created_at ?? "",
          golfer.id ?? "",
        ];
      });
    }

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
        },
      );

      eventFolderId = createdFolder.id;
      eventFolderUrl =
        createdFolder.webViewLink ||
        `https://drive.google.com/drive/folders/${eventFolderId}`;

      const { error: folderUpdateError } = await supabase
        .from("golf_registration_events")
        .update({
          google_drive_folder_id: eventFolderId,
          google_drive_folder_url: eventFolderUrl,
        })
        .eq("id", event.id);
      if (folderUpdateError) throw folderUpdateError;
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
        },
      );
      spreadsheetId = createdFile.id;
      spreadsheetUrl =
        createdFile.webViewLink ||
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      const { error: eventUpdateError } = await supabase
        .from("golf_registration_events")
        .update({
          google_sheet_id: spreadsheetId,
          google_sheet_url: spreadsheetUrl,
        })
        .eq("id", event.id);
      if (eventUpdateError) throw eventUpdateError;
    } else {
      try {
        const fileMetadata = await googleRequest(
          `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?supportsAllDrives=true&fields=parents,webViewLink`,
          accessToken,
        );
        const parents = Array.isArray(fileMetadata?.parents)
          ? fileMetadata.parents
          : [];

        if (!parents.includes(eventFolderId)) {
          const removeParents = parents.filter(Boolean).join(",");
          const params = new URLSearchParams({
            supportsAllDrives: "true",
            addParents: eventFolderId,
            fields: "id,webViewLink,parents",
          });
          if (removeParents) params.set("removeParents", removeParents);

          const movedFile = await googleRequest(
            `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?${params.toString()}`,
            accessToken,
            {
              method: "PATCH",
              body: JSON.stringify({}),
            },
          );

          spreadsheetUrl =
            movedFile.webViewLink ||
            spreadsheetUrl ||
            `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
        }
      } catch (moveError) {
        console.warn("Unable to move existing roster workbook into the event folder:", moveError);
      }
    }

    let spreadsheet = await googleRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
      accessToken,
    );
    let sheets = spreadsheet?.sheets || [];
    const firstSheet = sheets[0];
    const hasRegistration = sheets.some((sheet: any) => sheet.properties.title === REGISTRATION_TAB);
    const hasConfirmed = sheets.some((sheet: any) => sheet.properties.title === CONFIRMED_TAB);
    const batchRequests: any[] = [];

    if (!hasRegistration && firstSheet) {
      batchRequests.push({ updateSheetProperties: {
        properties: { sheetId: firstSheet.properties.sheetId, title: REGISTRATION_TAB },
        fields: "title",
      }});
    } else if (!hasRegistration && !firstSheet) {
      batchRequests.push({ addSheet: { properties: { title: REGISTRATION_TAB } } });
    }
    if (!hasConfirmed) batchRequests.push({ addSheet: { properties: { title: CONFIRMED_TAB } } });

    if (batchRequests.length) {
      await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, accessToken, {
        method: "POST",
        body: JSON.stringify({ requests: batchRequests }),
      });
    }

    for (const tab of [REGISTRATION_TAB, CONFIRMED_TAB]) {
      const clearRange = encodeURIComponent(`'${escapeSheetName(tab)}'!A:ZZZ`);
      await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`, accessToken, {
        method: "POST",
        body: JSON.stringify({}),
      });
    }

    const writes = [
      { tab: REGISTRATION_TAB, values: [headers, ...buildRows(golfers)] },
      { tab: CONFIRMED_TAB, values: [headers, ...buildRows(confirmed)] },
    ];

    for (const write of writes) {
      const range = encodeURIComponent(`'${escapeSheetName(write.tab)}'!A1`);
      await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ majorDimension: "ROWS", values: write.values }),
      });
    }

    if (golfers.length > 0) {
      const ids = golfers.map((golfer: any) => golfer.id);
      const { error: syncUpdateError } = await supabase.from("golf_registrations").update({
        google_sheet_synced_at: new Date().toISOString(),
      }).in("id", ids);
      if (syncUpdateError) throw syncUpdateError;
    }

    return new Response(JSON.stringify({
      success: true,
      event: event.name,
      registrations_synced: golfers.length,
      confirmed_synced: confirmed.length,
      registration_tab: REGISTRATION_TAB,
      confirmed_tab: CONFIRMED_TAB,
      custom_columns: customKeys.map(prettyLabel),
      google_sheet_id: spreadsheetId,
      google_sheet_url: spreadsheetUrl,
      google_drive_folder_id: eventFolderId,
      google_drive_folder_url: eventFolderUrl,
      import_source_tab: IMPORT_SOURCE_TAB,
    }, null, 2), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("Roster sync failed:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown synchronization error.",
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
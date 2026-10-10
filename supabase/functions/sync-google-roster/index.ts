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
      .eq("registration_status", "active")
      .not("spot_hold_status", "in", "(released,expired)")
      .order("created_at", { ascending: true });
    if (registrationError) throw registrationError;

    const golfers = registrations || [];
    const paidTeamKeys = new Set(
      golfers
        .filter((golfer: any) => golfer.team_id && ["paid", "comp"].includes(String(golfer.payment_status || "")))
        .map((golfer: any) => String(golfer.team_id))
    );
    const confirmed = golfers.filter((golfer: any) => {
      if (golfer.team_id) return paidTeamKeys.has(String(golfer.team_id));
      return ["paid", "comp"].includes(String(golfer.payment_status || ""));
    });
    const configuredTeamSize = Math.max(1, Number(event.field_settings?.team_size || 4));

    // Match EIE's read-only golfer numbering convention in both Google tabs:
    // Team 1 -> 1..4, Team 2 -> 5..8, etc. Never update the DB's
    // team/entry identifiers or any financial allocation.
    const entryNumbers = new Map<string, number>();
    const compareSlot = (a: any, b: any) =>
      String(a.created_at || "").localeCompare(String(b.created_at || "")) ||
      String(a.id || "").localeCompare(String(b.id || ""));
    const isTeamRoster = String(event.field_settings?.registration_format || "").toLowerCase() === "team";
    if (isTeamRoster) {
      const byTeam = new Map<string, any[]>();
      for (const golfer of golfers) {
        const teamKey = String(golfer.team_id ?? "").trim();
        if (!byTeam.has(teamKey)) byTeam.set(teamKey, []);
        byTeam.get(teamKey)!.push(golfer);
      }
      for (const [teamKey, members] of byTeam) {
        const teamNumber = /^[1-9]\d*$/.test(teamKey) ? Number(teamKey) : NaN;
        if (!Number.isSafeInteger(teamNumber) || teamNumber < 1 ||
            !Number.isSafeInteger(configuredTeamSize) || members.length > configuredTeamSize) continue;
        members.sort(compareSlot).forEach((member, index) => {
          entryNumbers.set(String(member.id), (teamNumber - 1) * configuredTeamSize + index + 1);
        });
      }
    } else {
      golfers.slice().sort(compareSlot).forEach((golfer: any, index: number) => {
        entryNumbers.set(String(golfer.id), index + 1);
      });
    }

    const customKeys = Array.from(new Set(golfers.flatMap((golfer: any) => {
      const fields = golfer.custom_fields && typeof golfer.custom_fields === "object" ? golfer.custom_fields : {};
      return Object.keys(fields).filter((key) => key !== "reserved_tba");
    })));

    const headers = [
      "Team Id", "Entry Number", "Email", "Phone", "First Name", "Last Name", "DOB", "Gender", "Tee", "Division", "Member Type", "GHIN ID",
      ...customKeys.map(prettyLabel),
      "Age", "Price", "Payment Status", "Admin Note", "Registration Date", "Registration ID",
    ];

    function sortRoster(source: any[]) {
      return [...source].sort((a: any, b: any) => {
        const aEntry = Number.parseInt(String(a.team_id || a.entry_number || ""), 10);
        const bEntry = Number.parseInt(String(b.team_id || b.entry_number || ""), 10);
        const aHasEntry = Number.isFinite(aEntry);
        const bHasEntry = Number.isFinite(bEntry);
        if (aHasEntry && bHasEntry && aEntry !== bEntry) return aEntry - bEntry;
        if (aHasEntry !== bHasEntry) return aHasEntry ? -1 : 1;

        const aKey = String(a.team_id || a.entry_number || "");
        const bKey = String(b.team_id || b.entry_number || "");
        if (aKey !== bKey) return aKey.localeCompare(bKey, undefined, { numeric: true });

        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      });
    }

    function buildRows(source: any[]) {
      return source.map((golfer: any, index: number) => {
        const customFields = golfer.custom_fields && typeof golfer.custom_fields === "object" ? golfer.custom_fields : {};
        return [
          golfer.team_id ?? "",
          entryNumbers.get(String(golfer.id)) ?? golfer.entry_number ?? index + 1,
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

    function rosterBlocks(source: any[]) {
      const blocks: Array<{ start: number; end: number; index: number }> = [];
      let currentKey = "";
      let blockStart = 0;
      let blockIndex = 0;

      source.forEach((golfer: any, index: number) => {
        const explicitTeamKey = String(golfer.team_id || golfer.entry_number || "").trim();
        const key = explicitTeamKey || `size-block-${Math.floor(index / configuredTeamSize)}`;

        if (index === 0) {
          currentKey = key;
          blockStart = 0;
          return;
        }

        if (key !== currentKey) {
          blocks.push({ start: blockStart, end: index, index: blockIndex });
          blockIndex += 1;
          currentKey = key;
          blockStart = index;
        }
      });

      if (source.length) {
        blocks.push({ start: blockStart, end: source.length, index: blockIndex });
      }
      return blocks;
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

    const registrationRows = sortRoster(golfers);
    const confirmedRows = sortRoster(confirmed);
    const writes = [
      { tab: REGISTRATION_TAB, source: registrationRows, values: [headers, ...buildRows(registrationRows)] },
      { tab: CONFIRMED_TAB, source: confirmedRows, values: [headers, ...buildRows(confirmedRows)] },
    ];

    for (const write of writes) {
      const range = encodeURIComponent(`'${escapeSheetName(write.tab)}'!A1`);
      await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ majorDimension: "ROWS", values: write.values }),
      });
    }

    spreadsheet = await googleRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
      accessToken,
    );
    sheets = spreadsheet?.sheets || [];

    const formatRequests: any[] = [];
    const columnCount = headers.length;

    for (const write of writes) {
      const sheet = sheets.find((item: any) => item.properties.title === write.tab);
      if (!sheet) continue;
      const sheetId = sheet.properties.sheetId;

      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.114, green: 0.141, blue: 0.365 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      });

      for (const block of rosterBlocks(write.source)) {
        const even = block.index % 2 === 0;
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: block.start + 1,
              endRowIndex: block.end + 1,
              startColumnIndex: 0,
              endColumnIndex: columnCount,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: even
                  ? { red: 0.94, green: 0.96, blue: 0.99 }
                  : { red: 1, green: 1, blue: 1 },
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        });
      }

      formatRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: { frozenRowCount: 1 },
          },
          fields: "gridProperties.frozenRowCount",
        },
      });
    }

    if (formatRequests.length) {
      await googleRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({ requests: formatRequests }),
        },
      );
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
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const MAX_BYTES = 50 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/zip": ".zip",
};
class PublicError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
function checkDb(result) {
  if (result.error) throw new Error("Database operation failed");
  return result.data;
}
export function activeMembership(row, now = Date.now()) {
  return (
    row?.role === "eig_admin" &&
    row.status === "active" &&
    row.organization?.slug === "elevated-impact-group" &&
    (!row.access_starts_at || Date.parse(row.access_starts_at) <= now) &&
    (!row.access_ends_at || Date.parse(row.access_ends_at) > now)
  );
}
export function validSignature(bytes, type) {
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/webp")
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  return (
    type === "application/zip" &&
    bytes[0] === 80 &&
    bytes[1] === 75 &&
    bytes[2] === 3 &&
    bytes[3] === 4
  );
}
async function readBoundedForm(req) {
  if (!req.body) throw new PublicError("Choose an export to upload.");
  const reader = req.body.getReader(),
    chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES + 65536) {
        await reader.cancel();
        throw new PublicError("Drive exports must be 50 MB or less.", 413);
      }
      chunks.push(value);
    }
    return await new Response(new Blob(chunks), {
      headers: { "Content-Type": req.headers.get("Content-Type") || "" },
    }).formData();
  } finally {
    reader.releaseLock();
  }
}
export function createDriveHandler({
  admin,
  env,
  fetch: http = fetch,
  crypto: crypt = crypto,
  now = () => Date.now(),
}) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (!["POST", "GET"].includes(req.method))
      return json({ error: "Method not allowed." }, 405);
    try {
      const token = req.headers
        .get("Authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
      if (!token)
        throw new PublicError("Sign in to save to EIG Google Drive.", 401);
      const { data: { user } = {}, error: authError } =
        await admin.auth.getUser(token);
      if (authError || !user)
        throw new PublicError("Your session has expired. Sign in again.", 401);
      let sessionId;
      try {
        const payload = token
          .split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        sessionId = JSON.parse(atob(payload)).session_id;
      } catch {
        /* Claims are decoded only after Auth verified the token. */
      }
      if (!UUID.test(sessionId || ""))
        throw new PublicError(
          "A current interactive EIG session is required.",
          403,
        );
      const guard = await admin.rpc("platform_assert_active_admin", {
        p_actor_id: user.id,
        p_actor_session_id: sessionId,
      });
      if (guard.error)
        throw new PublicError(
          "An active, verified EIG administrator session is required.",
          403,
        );
      const memberships = checkDb(
        await admin
          .from("organization_memberships")
          .select(
            "organization_id,role,status,access_starts_at,access_ends_at,organization:organizations(id,name,slug)",
          )
          .eq("user_id", user.id)
          .eq("role", "eig_admin")
          .eq("status", "active"),
      );
      const membership = memberships?.find((m) => activeMembership(m, now()));
      if (!membership)
        throw new PublicError(
          "This Drive tool is currently for active EIG team members.",
          403,
        );
      const root = env("GOOGLE_DRIVE_FOLDER_ID"),
        clientId = env("GOOGLE_CLIENT_ID"),
        clientSecret = env("GOOGLE_CLIENT_SECRET");
      if (!root || !clientId || !clientSecret)
        throw new PublicError(
          "The EIG Google Drive connection needs setup. Your download is still available.",
          503,
        );
      const path = `Hangars / ${membership.organization.name} / InceptionApex / Resized Images`;
      if (req.method === "GET") {
        const connection = checkDb(
          await admin
            .from("google_oauth_tokens")
            .select("refresh_token")
            .eq("provider", "google")
            .maybeSingle(),
        );
        return json({
          connected: !!connection?.refresh_token,
          destination: path,
        });
      }
      if (Number(req.headers.get("Content-Length") || 0) > MAX_BYTES + 65536)
        throw new PublicError("Drive exports must be 50 MB or less.", 413);
      const form = await readBoundedForm(req),
        file = form.get("file"),
        requestId = form.get("request_id");
      if (!UUID.test(requestId || ""))
        throw new PublicError("A valid export request ID is required.");
      if (
        !(file instanceof Blob) ||
        !file.name ||
        !MIME_EXT[file.type] ||
        !file.size ||
        file.size > MAX_BYTES
      )
        throw new PublicError(
          "Choose a resized PNG, JPEG, WebP or ZIP up to 50 MB.",
          413,
        );
      const filename = file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9_.-]/g, "-")
        .slice(0, 180);
      if (!filename.toLowerCase().endsWith(MIME_EXT[file.type]))
        throw new PublicError(
          "The export filename must match its image or ZIP format.",
        );
      if (
        !validSignature(
          new Uint8Array(await file.slice(0, 12).arrayBuffer()),
          file.type,
        )
      )
        throw new PublicError("The export content does not match its format.");
      const sha256 = Array.from(
        new Uint8Array(
          await crypt.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      let record = checkDb(
        await admin
          .from("inception_drive_exports")
          .select("*")
          .eq("request_id", requestId)
          .maybeSingle(),
      );
      if (
        record &&
        (record.actor_user_id !== user.id ||
          record.organization_id !== membership.organization_id)
      )
        throw new PublicError(
          "This export request belongs to another account.",
          403,
        );
      if (
        record &&
        (record.sha256 !== sha256 ||
          record.filename !== filename ||
          record.mime_type !== file.type ||
          record.byte_size !== file.size)
      )
        throw new PublicError(
          "This request ID was already used for a different export.",
          409,
        );
      const connection = checkDb(
        await admin
          .from("google_oauth_tokens")
          .select("refresh_token")
          .eq("provider", "google")
          .maybeSingle(),
      );
      if (!connection?.refresh_token)
        throw new PublicError(
          "Reconnect EIG Google Drive before saving. Your download is still available.",
          503,
        );
      const refresh = await http("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: connection.refresh_token,
          grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(20000),
      });
      const credentials = await refresh.json();
      if (!refresh.ok || !credentials.access_token)
        throw new PublicError(
          "EIG Google Drive authorization needs attention. Your download is still available.",
          503,
        );
      const headers = { Authorization: `Bearer ${credentials.access_token}` };
      const google = async (url, options = {}) => {
        const res = await http(url, {
          ...options,
          headers: { ...headers, ...options.headers },
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok)
          throw new PublicError(
            "Google Drive could not complete the export. Keep your download and retry the same file.",
            502,
          );
        return res.json();
      };
      const generateId = async () =>
        (
          await google(
            "https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files",
          )
        ).ids?.[0];
      const metadata = async (id) => {
        const res = await http(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,parents,size,sha256Checksum,trashed,appProperties`,
          { headers, signal: AbortSignal.timeout(20000) },
        );
        if (res.status === 404) return null;
        if (!res.ok)
          throw new PublicError(
            "Drive could not verify this file. Keep your download and retry.",
            502,
          );
        return res.json();
      };
      if (!record) {
        const id = await generateId();
        if (!id) throw new Error("Missing generated ID");
        const insert = await admin.from("inception_drive_exports").insert({
          request_id: requestId,
          actor_user_id: user.id,
          organization_id: membership.organization_id,
          filename,
          mime_type: file.type,
          byte_size: file.size,
          sha256,
          google_file_id: id,
        });
        if (insert.error && insert.error.code !== "23505")
          throw new Error("Could not reserve export");
        record = checkDb(
          await admin
            .from("inception_drive_exports")
            .select("*")
            .eq("request_id", requestId)
            .single(),
        );
        if (
          !record ||
          record.actor_user_id !== user.id ||
          record.sha256 !== sha256 ||
          record.filename !== filename ||
          record.byte_size !== file.size ||
          record.mime_type !== file.type
        )
          throw new PublicError(
            "This export request was changed. Try again.",
            409,
          );
      }
      const ensureFolder = async (
        key,
        parent,
        label,
        orgId = membership.organization_id,
      ) => {
        let mapped = checkDb(
          await admin
            .from("platform_google_drive_folders")
            .select("*")
            .eq("folder_key", key)
            .maybeSingle(),
        );
        if (!mapped) {
          const id = await generateId();
          if (!id) throw new Error("Missing folder ID");
          const insert = await admin
            .from("platform_google_drive_folders")
            .insert({
              folder_key: key,
              organization_id: orgId,
              google_folder_id: id,
              parent_folder_id: parent,
              label,
            });
          if (insert.error && insert.error.code !== "23505")
            throw new Error("Could not reserve folder");
          mapped = checkDb(
            await admin
              .from("platform_google_drive_folders")
              .select("*")
              .eq("folder_key", key)
              .single(),
          );
        }
        if (
          mapped.parent_folder_id !== parent ||
          mapped.organization_id !== orgId
        )
          throw new Error("Folder mapping mismatch");
        let folder = await metadata(mapped.google_folder_id);
        if (!folder) {
          const res = await http(
            "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
            {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                id: mapped.google_folder_id,
                name: label,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parent],
                appProperties: { eigFolderKey: key },
              }),
              signal: AbortSignal.timeout(20000),
            },
          );
          if (!res.ok && res.status !== 409)
            throw new PublicError(
              "EIG’s Drive folder could not be created. Your download is still available.",
              502,
            );
          folder = await metadata(mapped.google_folder_id);
        }
        if (
          !folder ||
          folder.trashed ||
          folder.mimeType !== "application/vnd.google-apps.folder" ||
          !folder.parents?.includes(parent)
        )
          throw new PublicError(
            "The EIG Drive folder was moved or changed. Ask EIG to check its destination.",
            409,
          );
        return mapped.google_folder_id;
      };
      const hangars = await ensureFolder(
        `root:${root}:hangars`,
        root,
        "Hangars",
        null,
      );
      const orgId = membership.organization_id;
      const hangar = await ensureFolder(
        `hangar:${root}:${orgId}`,
        hangars,
        membership.organization.name,
      );
      const app = await ensureFolder(
        `app:${root}:${orgId}:inception-apex`,
        hangar,
        "InceptionApex",
      );
      const folderId = await ensureFolder(
        `exports:${root}:${orgId}:inception-apex`,
        app,
        "Resized Images",
      );
      if (record.google_folder_id && record.google_folder_id !== folderId)
        throw new PublicError(
          "This export belongs to a previous Drive destination. Download it or start a new export.",
          409,
        );
      checkDb(
        await admin
          .from("inception_drive_exports")
          .update({ google_folder_id: folderId })
          .eq("request_id", requestId),
      );
      let saved = await metadata(record.google_file_id);
      if (!saved) {
        const start = await http(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id",
          {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json; charset=UTF-8",
              "X-Upload-Content-Type": file.type,
              "X-Upload-Content-Length": String(file.size),
            },
            body: JSON.stringify({
              id: record.google_file_id,
              name: filename,
              mimeType: file.type,
              parents: [folderId],
              appProperties: { inceptionExportRequest: requestId },
            }),
            signal: AbortSignal.timeout(20000),
          },
        );
        if (start.ok) {
          const uploadUrl = start.headers.get("Location");
          if (
            !uploadUrl ||
            new URL(uploadUrl).origin !== "https://www.googleapis.com"
          )
            throw new Error("Invalid resumable destination");
          const upload = await http(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type,
              "Content-Length": String(file.size),
            },
            body: file,
            signal: AbortSignal.timeout(90000),
          });
          if (!upload.ok)
            throw new PublicError(
              "Drive upload was interrupted. Your download is still available; retry this same export.",
              502,
            );
        } else if (start.status !== 409)
          throw new PublicError(
            "Google Drive could not start the upload. Your download is still available.",
            502,
          );
        saved = await metadata(record.google_file_id);
      }
      if (
        !saved ||
        saved.id !== record.google_file_id ||
        saved.trashed ||
        saved.name !== filename ||
        saved.mimeType !== file.type ||
        Number(saved.size) !== file.size ||
        saved.sha256Checksum !== sha256 ||
        !saved.parents?.includes(folderId) ||
        saved.appProperties?.inceptionExportRequest !== requestId
      )
        throw new PublicError(
          "Drive has not verified the complete export. Keep your download and retry the same file.",
          502,
        );
      checkDb(
        await admin
          .from("inception_drive_exports")
          .update({
            status: "uploaded",
            uploaded_at: new Date(now()).toISOString(),
          })
          .eq("request_id", requestId),
      );
      return json({
        file_id: saved.id,
        url: `https://drive.google.com/file/d/${encodeURIComponent(saved.id)}/view`,
        destination: path,
      });
    } catch (e) {
      return json(
        {
          error:
            e instanceof PublicError
              ? e.message
              : "The Drive export could not be completed. Your download is still available; retry the same file.",
        },
        e instanceof PublicError ? e.status : 500,
      );
    }
  };
}

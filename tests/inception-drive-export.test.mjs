import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createDriveHandler,
  activeMembership,
  validSignature,
} from "../supabase/functions/inception-drive-export/handler.mjs";
const userId = "11111111-1111-4111-8111-111111111111",
  orgId = "22222222-2222-4222-8222-222222222222",
  sessionId = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";
const token = `header.${Buffer.from(JSON.stringify({ session_id: sessionId })).toString("base64url")}.verified-by-fixture`;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
function fixture() {
  const state = {
    verified: true,
    fresh: true,
    connection: true,
    outage: false,
    failAuditOnce: false,
    uploads: 0,
    calls: [],
    ids: 0,
    cloud: new Map(),
    membership: {
      organization_id: orgId,
      role: "eig_admin",
      status: "active",
      organization: {
        id: orgId,
        slug: "elevated-impact-group",
        name: "Elevated Impact Group",
      },
    },
    tables: { inception_drive_exports: [], platform_google_drive_folders: [] },
  };
  const admin = {
    auth: {
      getUser: async () =>
        state.verified ? { data: { user: { id: userId } } } : { error: true },
    },
    rpc: async (name, args) => {
      assert.equal(name, "platform_assert_active_admin");
      assert.equal(args.p_actor_session_id, sessionId);
      return { error: state.fresh ? null : true };
    },
    from(table) {
      let filters = [],
        op = "select",
        values,
        single = false;
      const query = {
        select() {
          return query;
        },
        eq(key, val) {
          filters.push([key, val]);
          return query;
        },
        maybeSingle() {
          single = true;
          return query;
        },
        single() {
          single = true;
          return query;
        },
        insert(v) {
          op = "insert";
          values = v;
          return query;
        },
        update(v) {
          op = "update";
          values = v;
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(() => {
              const rows =
                table === "organization_memberships"
                  ? [state.membership]
                  : table === "google_oauth_tokens"
                    ? state.connection
                      ? [
                          {
                            provider: "google",
                            refresh_token: "private-refresh",
                          },
                        ]
                      : []
                    : state.tables[table];
              const filtered =
                table === "organization_memberships"
                  ? rows
                  : rows.filter((r) =>
                      filters.every(([key, val]) => r[key] === val),
                    );
              if (op === "insert") {
                const key =
                  table === "inception_drive_exports"
                    ? "request_id"
                    : "folder_key";
                if (rows.some((r) => r[key] === values[key]))
                  return { error: { code: "23505" } };
                rows.push({ ...values, status: "pending" });
              }
              if (op === "update") {
                if (values.status === "uploaded" && state.failAuditOnce) {
                  state.failAuditOnce = false;
                  return { error: { code: "audit-fixture" } };
                }
                filtered.forEach((r) => Object.assign(r, values));
              }
              return {
                data: single ? filtered[0] || null : filtered,
                error: null,
              };
            })
            .then(resolve, reject);
        },
      };
      return query;
    },
  };
  const http = async (url, options = {}) => {
    state.calls.push({ url, method: options.method || "GET" });
    if (state.outage)
      return new Response(
        JSON.stringify({
          error: "private-access private-refresh private-client",
        }),
        { status: 500 },
      );
    if (url === "https://oauth2.googleapis.com/token")
      return Response.json({ access_token: "private-access" });
    if (url.includes("generateIds"))
      return Response.json({ ids: [`google-${++state.ids}`] });
    if (url.includes("uploadType=resumable")) {
      state.uploadMetadata = JSON.parse(options.body);
      return new Response(null, {
        headers: {
          Location: "https://www.googleapis.com/upload/fixture-session",
        },
      });
    }
    if (url === "https://www.googleapis.com/upload/fixture-session") {
      const blob = options.body,
        sha256Checksum = Buffer.from(
          await webcrypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
        ).toString("hex");
      state.uploads++;
      state.cloud.set(state.uploadMetadata.id, {
        ...state.uploadMetadata,
        size: blob.size,
        sha256Checksum,
      });
      return Response.json({ id: state.uploadMetadata.id });
    }
    if (
      options.method === "POST" &&
      url.startsWith("https://www.googleapis.com/drive/v3/files?")
    ) {
      const folder = JSON.parse(options.body);
      if (state.cloud.has(folder.id))
        return new Response(null, { status: 409 });
      state.cloud.set(folder.id, folder);
      return Response.json(folder);
    }
    const id = new URL(url).pathname.split("/").at(-1),
      saved = state.cloud.get(id);
    return saved ? Response.json(saved) : new Response(null, { status: 404 });
  };
  const env = (name) =>
    ({
      GOOGLE_CLIENT_ID: "private-client",
      GOOGLE_CLIENT_SECRET: "private-secret",
      GOOGLE_DRIVE_FOLDER_ID: "fixed-eig-root",
    })[name];
  const handle = createDriveHandler({
    admin,
    env,
    fetch: http,
    crypto: webcrypto,
  });
  async function send({
    id = requestId,
    body = png,
    type = "image/png",
    filename = "art.png",
    authorized = true,
    folderId,
  } = {}) {
    const form = new FormData();
    form.append("file", new Blob([body], { type }), filename);
    form.append("request_id", id);
    if (folderId) form.append("folder_id", folderId);
    const res = await handle(
      new Request("https://fixture/functions/drive", {
        method: "POST",
        headers: authorized ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }),
    );
    return { status: res.status, data: await res.json() };
  }
  return { state, handle, send };
}

test("Drive rejects anonymous, unverified, revoked and expired users before touching Google", async () => {
  for (const change of [
    (s) => (s.verified = false),
    (s) => (s.fresh = false),
    (s) => (s.membership.role = "organization_admin"),
    (s) => (s.membership.status = "revoked"),
    (s) => (s.membership.access_ends_at = "2000-01-01"),
    (s) => (s.membership.organization.slug = "another-hangar"),
  ]) {
    const f = fixture();
    change(f.state);
    const res = await f.send();
    assert.ok([401, 403].includes(res.status));
    assert.equal(f.state.calls.length, 0);
  }
  const f = fixture();
  assert.equal((await f.send({ authorized: false })).status, 401);
  assert.equal(f.state.calls.length, 0);
});
test("Export creates Hangar-down folders, verifies content, audits actor, and ignores client folder", async () => {
  const f = fixture(),
    res = await f.send({ folderId: "untrusted-client-folder" });
  assert.equal(res.status, 200);
  assert.match(res.data.url, /^https:\/\/drive.google.com\/file\/d\//);
  const folders = f.state.tables.platform_google_drive_folders;
  assert.deepEqual(
    folders.map((r) => r.label),
    ["Hangars", "Elevated Impact Group", "InceptionApex", "Resized Images"],
  );
  assert.equal(folders[0].parent_folder_id, "fixed-eig-root");
  for (let i = 1; i < folders.length; i++)
    assert.equal(folders[i].parent_folder_id, folders[i - 1].google_folder_id);
  const row = f.state.tables.inception_drive_exports[0];
  assert.equal(row.actor_user_id, userId);
  assert.equal(row.organization_id, orgId);
  assert.equal(row.status, "uploaded");
  assert.equal(row.google_folder_id, folders[3].google_folder_id);
  assert.equal(f.state.uploads, 1);
  assert.doesNotMatch(
    JSON.stringify(res.data),
    /private-|refresh|secret|upload\/fixture-session/,
  );
});
test("Retries reuse folders and cloud file; altered or foreign request IDs cannot replay", async () => {
  const f = fixture();
  assert.equal((await f.send()).status, 200);
  assert.equal((await f.send()).status, 200);
  assert.equal(f.state.uploads, 1);
  assert.equal(f.state.tables.platform_google_drive_folders.length, 4);
  assert.equal(
    (await f.send({ body: new Uint8Array([...png, 4]) })).status,
    409,
  );
  f.state.tables.inception_drive_exports[0].actor_user_id = "someone-else";
  assert.equal((await f.send()).status, 403);
  assert.equal(f.state.uploads, 1);
});
test("An upload followed by a database failure is recovered without creating a duplicate", async () => {
  const f = fixture();
  f.state.failAuditOnce = true;
  assert.equal((await f.send()).status, 500);
  assert.equal(f.state.uploads, 1);
  assert.equal((await f.send()).status, 200);
  assert.equal(f.state.uploads, 1);
  assert.equal(f.state.tables.inception_drive_exports[0].status, "uploaded");
});
test("Moved folders and mismatched cloud checksum never report a successful export", async () => {
  const f = fixture();
  await f.send();
  const row = f.state.tables.inception_drive_exports[0];
  f.state.cloud.get(row.google_file_id).sha256Checksum = "wrong";
  assert.equal((await f.send()).status, 502);
  const folder = f.state.tables.platform_google_drive_folders[3];
  f.state.cloud.get(folder.google_folder_id).parents = ["another-hangar"];
  assert.equal((await f.send()).status, 409);
  assert.equal(f.state.uploads, 1);
});
test("Connection failures preserve downloads and never leak provider errors or credentials", async () => {
  const f = fixture();
  f.state.outage = true;
  const res = await f.send();
  assert.equal(res.status, 503);
  assert.match(res.data.error, /download/);
  assert.doesNotMatch(res.data.error, /private-/);
  const g = fixture();
  g.state.connection = false;
  assert.equal((await g.send()).status, 503);
});
test("Only supported formats with matching signatures, filenames and valid request IDs are uploaded", async () => {
  const f = fixture();
  for (const input of [
    { id: "bad" },
    { body: "<svg/>", type: "image/svg+xml", filename: "art.svg" },
    { body: "not-a-png" },
    { filename: "art.zip" },
  ])
    assert.ok((await f.send(input)).status >= 400);
  assert.equal(f.state.calls.length, 0);
  assert.equal(
    validSignature(new Uint8Array([80, 75, 3, 4]), "application/zip"),
    true,
  );
  assert.equal(
    activeMembership({ ...f.state.membership, access_starts_at: "invalid" }),
    false,
  );
  const res = await f.send({
    id: "55555555-5555-4555-8555-555555555555",
    body: new Uint8Array([80, 75, 3, 4, 0, 1]),
    type: "application/zip",
    filename: "batch.zip",
  });
  assert.equal(res.status, 200);
  assert.equal(
    f.state.tables.inception_drive_exports[0].mime_type,
    "application/zip",
  );
});
test("Connection status is authenticated and does not create folders or return credentials", async () => {
  const f = fixture();
  const res = await f.handle(
    new Request("https://fixture/functions/drive", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.connected, true);
  assert.match(data.destination, /Hangars.*InceptionApex/);
  assert.equal(f.state.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(data), /private-/);
});

test("Folder mappings and export audits are service-only with RLS and constrained provenance", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { readFile } = await import("node:fs/promises");
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; create table public.organizations(id uuid primary key); create table public.profiles(id uuid primary key);",
    );
    const sql = await readFile(
      new URL(
        "../supabase/migrations/20261007052358_inception_drive_exports.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sql);
    for (const table of [
      "inception_drive_exports",
      "platform_google_drive_folders",
    ]) {
      const result = await db.query(
        "select relrowsecurity,has_table_privilege('authenticated',$1,'SELECT') as authenticated_read,has_table_privilege('anon',$1,'INSERT') as anon_write,has_table_privilege('service_role',$1,'INSERT') as service_write from pg_class where oid=$1::regclass",
        [`public.${table}`],
      );
      assert.deepEqual(result.rows[0], {
        relrowsecurity: true,
        authenticated_read: false,
        anon_write: false,
        service_write: true,
      });
    }
    await db.query("insert into public.organizations values ($1)", [orgId]);
    await db.query("insert into public.profiles values ($1)", [userId]);
    await assert.rejects(
      db.query(
        "insert into public.inception_drive_exports(request_id,actor_user_id,organization_id,filename,mime_type,byte_size,sha256,google_file_id) values($1,$2,$3,'art.png','image/png',1,'invalid','cloud')",
        [requestId, userId, orgId],
      ),
      /check constraint/,
    );
  } finally {
    await db.close();
  }
});

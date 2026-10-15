import test from "node:test";
import assert from "node:assert/strict";
import { createEigBuildLabAccessHandler } from "../supabase/functions/eig-build-lab-access/handler.mjs";
import { ownerPreviewVisible, requestOwnerBuildLabAccess } from "../src/lib/eigBuildLabGate.mjs";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER_ADMIN = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const ORIGIN = "https://build-preview.eig.example";
const NOW = new Date("2026-10-15T14:00:00Z").getTime();
const TOKEN = "header." + Buffer.from(JSON.stringify({ session_id: SESSION_ID })).toString("base64url") + ".signature";

function fixture(overrides = {}) {
  const state = {
    signedInUserId: OWNER, verified: true, sessionActive: true, membership: [{
      role: "eig_admin", status: "active",
      access_starts_at: null, access_ends_at: null,
      organization: { slug: "elevated-impact-group" },
    }],
    membershipError: false, featureEnabled: true, ownerConfigured: OWNER,
    allowedOrigins: ORIGIN, authCalls: 0, rpcCalls: 0, membershipCalls: 0,
    ...overrides,
  };
  const admin = {
    auth: { getUser: async () => {
      state.authCalls++;
      return state.verified && state.signedInUserId
        ? { data: { user: { id: state.signedInUserId } }, error: null }
        : { data: { user: null }, error: { message: "Invalid token." } };
    }},
    rpc: async (name, params) => {
      state.rpcCalls++;
      assert.equal(name, "platform_assert_active_admin");
      assert.equal(params.p_actor_id, OWNER);
      assert.equal(params.p_actor_session_id, SESSION_ID);
      // The real Postgres function returns VOID on success, so data is null.
      return state.sessionActive ? { data: null, error: null } : { data: null, error: { message: "Revoked." } };
    },
    from(table) {
      state.membershipCalls++;
      assert.equal(table, "organization_memberships");
      const q = {
        select() { return q; },
        eq() { return q; },
        then(callback) {
          return Promise.resolve({
            data: state.membership,
            error: state.membershipError ? { message: "DB error" } : null,
          }).then(callback);
        },
      };
      return q;
    },
  };
  const env = (name) => ({
    EIG_BUILD_LAB_ACCESS_ENABLED: state.featureEnabled ? "true" : "false",
    EIG_BUILD_LAB_OWNER_USER_ID: state.ownerConfigured,
    EIG_BUILD_LAB_ALLOWED_ORIGINS: state.allowedOrigins,
  })[name];
  const handle = createEigBuildLabAccessHandler({ admin, env, now: () => NOW });
  const send = async ({ origin = ORIGIN, token = TOKEN, method = "POST" } = {}) => {
    const headers = new Headers();
    if (origin) headers.set("Origin", origin);
    if (token) headers.set("Authorization", "Bearer " + token);
    const r = await handle(new Request("https://functions.example/eig-build-lab-access", { method, headers }));
    const body = method === "OPTIONS" ? null : await r.json();
    return { status: r.status, body, headers: r.headers };
  };
  return { state, send };
}

test("only the configured owner with a live EIG admin membership can enter Build Lab", async () => {
  const f = fixture();
  const { status, body, headers } = await f.send();
  assert.equal(status, 200);
  assert.deepEqual(body, { allowed: true, access: "build_lab_owner_only" });
  assert.equal(headers.get("Cache-Control"), "no-store, private");
  assert.equal(f.state.authCalls, 1);
  assert.equal(f.state.rpcCalls, 1);
  assert.equal(f.state.membershipCalls, 1);
  assert.ok(!JSON.stringify(body).includes(OWNER));
});

test("even other active EIG admins are denied without session/membership evaluation", async () => {
  const f = fixture({ signedInUserId: OTHER_ADMIN });
  const result = await f.send();
  assert.equal(result.status, 403);
  assert.equal(result.body.allowed, false);
  assert.equal(f.state.rpcCalls, 0);
  assert.equal(f.state.membershipCalls, 0);
});

test("missing or incorrect owner configuration always fails closed", async () => {
  for (const settings of [
    { ownerConfigured: "" }, { ownerConfigured: "not-a-uuid" },
    { ownerConfigured: OTHER_ADMIN }, { featureEnabled: false },
  ]) {
    const f = fixture(settings);
    const result = await f.send();
    assert.equal(result.status, 403);
    assert.equal(result.body.allowed, false);
  }
});

test("revoked session, missing identity or invalid session claim is denied", async () => {
  for (const settings of [
    { verified: false }, { sessionActive: false },
    { signedInUserId: null },
  ]) {
    const f = fixture(settings);
    const result = await f.send();
    assert.ok([401, 403].includes(result.status));
    assert.equal(result.body.allowed, false);
  }
  const f = fixture();
  assert.equal((await f.send({ token: "" })).status, 401);
  assert.equal((await f.send({ token: "bad-value" })).status, 403);
});

test("staff, external organization and expired/future memberships are denied", async () => {
  const valid = {
    role: "eig_admin", status: "active",
    access_starts_at: null, access_ends_at: null,
    organization: { slug: "elevated-impact-group" },
  };
  const variants = [
    { ...valid, role: "organization_admin" },
    { ...valid, status: "disabled" },
    { ...valid, organization: { slug: "other-hangar" } },
    { ...valid, access_starts_at: "2026-10-16T00:00:00Z" },
    { ...valid, access_ends_at: "2026-10-14T00:00:00Z" },
    { ...valid, access_starts_at: "invalid-date" },
  ];
  for (const membership of variants) {
    const f = fixture({ membership: [membership] });
    const result = await f.send();
    assert.equal(result.status, 403);
    assert.equal(result.body.allowed, false);
  }
  const error = fixture({ membershipError: true });
  assert.equal((await error.send()).status, 403);
});

test("unapproved/missing origin and unsupported methods fail closed", async () => {
  const f = fixture();
  assert.equal((await f.send({ origin: "https://unapproved.example" })).status, 403);
  assert.equal((await f.send({ origin: null })).status, 403);
  assert.equal((await f.send({ method: "GET" })).status, 405);
  const preflight = await f.send({ method: "OPTIONS", token: "" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("client navigation requires the exact current session and successful server grant", () => {
  const standard = {
    previewEnabled: true, eigWorkspace: true, activeEIGAdmin: true,
    userId: OWNER, serverGrant: { userId: OWNER, allowed: true },
  };
  assert.equal(ownerPreviewVisible(standard), true);
  for (const changes of [
    { previewEnabled: false }, { eigWorkspace: false },
    { activeEIGAdmin: false }, { serverGrant: null },
    { serverGrant: { userId: OTHER_ADMIN, allowed: true } },
    { serverGrant: { userId: OWNER, allowed: false } },
    { userId: OTHER_ADMIN },
  ]) assert.equal(ownerPreviewVisible({ ...standard, ...changes }), false);
});

test("client treats absent/failing/forged backend responses as denied", async () => {
  assert.equal(await requestOwnerBuildLabAccess(null), false);
  assert.equal(await requestOwnerBuildLabAccess({ functions: { invoke: async () => ({ error: new Error("error"), data: { allowed: true } }) } }), false);
  assert.equal(await requestOwnerBuildLabAccess({ functions: { invoke: async () => ({ data: { allowed: true } }) } }), false);
  assert.equal(await requestOwnerBuildLabAccess({ functions: { invoke: async () => { throw new Error("down"); } } }), false);
  assert.equal(await requestOwnerBuildLabAccess({ functions: { invoke: async (name, opts) => {
    assert.equal(name, "eig-build-lab-access");
    assert.deepEqual(opts.body, { action: "check" });
    return { data: { allowed: true, access: "build_lab_owner_only" } };
  } } }), true);
});

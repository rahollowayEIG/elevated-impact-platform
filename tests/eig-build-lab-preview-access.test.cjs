const test = require("node:test");
const assert = require("node:assert/strict");
const { createBuildLabPreviewAccessHandler } = require("../server/eig-build-lab-preview-access.cjs");
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER_ADMIN = "22222222-2222-4222-8222-222222222222";
const when = Date.parse("2026-10-15T14:00:00Z");

function sample(options = {}) {
  const state = {
    owner: OWNER, role: "eig_admin", status: "active",
    organization: "elevated-impact-group",
    since: null, until: null, memberError: false,
    enabled: true, vercelEnv: "preview",
    branch: "feature/build-intelligence-impact-20261017",
    configuredBranch: "feature/build-intelligence-impact-20261017",
    ownerConfig: OWNER, authCalls: 0, memberCalls: 0, failAuth: false,
    ...options,
  };
  const env = (key) => ({
    VERCEL_ENV: state.vercelEnv,
    VERCEL_GIT_COMMIT_REF: state.branch,
    EIG_BUILD_LAB_PREVIEW_BRANCH: state.configuredBranch,
    EIG_BUILD_LAB_ACCESS_ENABLED: state.enabled ? "true" : "false",
    EIG_BUILD_LAB_OWNER_USER_ID: state.ownerConfig,
  })[key];
  const handle = createBuildLabPreviewAccessHandler({
    env, now: () => when,
    verifyUser: async () => {
      state.authCalls++;
      if (state.failAuth) throw new Error("Supabase Auth not available");
      return { id: state.owner };
    },
    membershipsForUser: async (userId, token) => {
      state.memberCalls++;
      assert.equal(userId, OWNER);
      assert.equal(token, "test-access-token");
      return {
        error: state.memberError ? { message: "RLS failure" } : null,
        data: [{
          role: state.role, status: state.status,
          access_starts_at: state.since, access_ends_at: state.until,
          organization: { slug: state.organization },
        }],
      };
    },
  });
  const call = async ({ method = "POST", origin = "https://preview.example",
    host = "preview.example", token = "Bearer test-access-token" } = {}) => {
    const req = { method, headers: { origin, host, authorization: token } };
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v; return this; },
      status(status) { this.statusCode = status; return this; },
      json(data) { this.body = data; return this; },
    };
    await handle(req, res);
    return { status: res.statusCode, body: res.body, headers: res.headers };
  };
  return { call, state };
}

test("preview allows only specified owner with active EIG membership", async () => {
  const f = sample(), res = await f.call();
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { allowed: true, access: "build_lab_owner_only" });
  assert.equal(res.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(f.state.authCalls, 1);
  assert.equal(f.state.memberCalls, 1);
  assert.doesNotMatch(JSON.stringify(res.body), /11111111/);
});

test("a second EIG admin cannot access the owner preview", async () => {
  const f = sample({ owner: OTHER_ADMIN });
  assert.equal((await f.call()).status, 403);
  assert.equal(f.state.memberCalls, 0);
});

test("production, wrong branch, unconfigured or disabled owner grants fail closed", async () => {
  for (const o of [
    { vercelEnv: "production" },
    { vercelEnv: "development" },
    { branch: "main" },
    { configuredBranch: "main" },
    { branch: undefined, configuredBranch: "" },
    { enabled: false },
    { ownerConfig: "" },
    { ownerConfig: "not-a-uuid" },
  ]) {
    const f = sample(o);
    assert.equal((await f.call()).status, 403, JSON.stringify(o));
    assert.equal(f.state.authCalls, 0);
  }
});

test("non-EIG staff, disabled and expired access are denied", async () => {
  for (const o of [
    { role: "organization_admin" }, { status: "disabled" },
    { organization: "other-hangar" },
    { since: "2026-10-16T00:00:00Z" },
    { until: "2026-10-14T00:00:00Z" },
    { since: "invalid" }, { memberError: true }, { failAuth: true },
  ]) {
    const f = sample(o);
    const r = await f.call();
    assert.equal(r.status, 403, JSON.stringify(o));
  }
});

test("cross-origin, missing bearer token and unsupported verbs never enter", async () => {
  const f = sample();
  for (const input of [
    { origin: "https://evil.example" },
    { origin: undefined, host: "attacker.example" },
    { token: "" }, { token: "Bearer " },
    { method: "GET" }, { method: "OPTIONS" },
  ]) assert.notEqual((await f.call(input)).status, 200);
});

test("Vercel preview branch binding still works if runtime Git ref is hidden", async () => {
  assert.equal((await sample({ branch: undefined }).call()).status, 200);
});

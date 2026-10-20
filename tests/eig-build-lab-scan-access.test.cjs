const test = require("node:test");
const assert = require("node:assert/strict");
const { createBuildLabInceptionScanHandler } = require("../server/eig-build-lab-scan-handler.cjs");
const { readAllowlistedInceptionSource, scanInceptionSource } = require("../server/eig-inception-source-scan.cjs");

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const BRANCH = "feature/build-lab-orchestrator-20261020";
function fixture(overrides = {}) {
  const state = {
    userId: OWNER, memberRole: "eig_admin", org: "elevated-impact-group", memberStatus: "active",
    memberError: false, enabled: true, environment: "preview", branch: BRANCH,
    ownerConfig: OWNER, failScan: false, sourceReads: 0, scanCalls: 0,
    verifyCalls: 0, membershipsCalls: 0, ...overrides,
  };
  const env = (name) => ({
    EIG_BUILD_LAB_OWNER_USER_ID: state.ownerConfig,
    EIG_BUILD_LAB_ACCESS_ENABLED: state.enabled ? "true" : "false",
    EIG_BUILD_LAB_PREVIEW_BRANCH: BRANCH,
    VERCEL_GIT_COMMIT_REF: state.branch,
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_ENV: state.environment,
  })[name];
  const handle = createBuildLabInceptionScanHandler({
    env,
    verifyUser: async (token) => {
      state.verifyCalls++;
      if (token !== "synthetic-token") throw Error("not signed in");
      return { id: state.userId };
    },
    membershipsForUser: async () => {
      state.membershipsCalls++;
      return { error: state.memberError ? Error("RLS unavailable") : null, data: [{
        role: state.memberRole, status: state.memberStatus,
        access_starts_at: null, access_ends_at: null,
        organization: { slug: state.org },
      }] };
    },
    readSources: async () => {
      state.sourceReads++;
      if (state.failScan) throw Error("Local sources not bundled in Vercel");
      return readAllowlistedInceptionSource();
    },
    scan: async (...args) => {
      state.scanCalls++;
      return scanInceptionSource(...args);
    },
  });
  const send = async ({
    origin = "https://preview.example", host = "preview.example",
    method = "POST", authorization = "Bearer synthetic-token",
    body = { target: "inception_apex" },
  } = {}) => {
    const req = { headers: { origin, host, authorization }, method, body };
    const res = {
      statusCode: 200, headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(status) { this.statusCode = status; return this; },
      json(payload) { this.payload = payload; return this; },
    };
    await handle(req, res);
    return { status: res.statusCode, body: res.payload, headers: res.headers };
  };
  return { send, state };
}

test("owner-only scan uses real source evidence after verifying active owner", async () => {
  const f = fixture();
  const result = await f.send();
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.report.findings.length, 6);
  assert.equal(result.body.report.sourceVersion, "a".repeat(40));
  assert.equal(result.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(f.state.verifyCalls, 1);
  assert.equal(f.state.membershipsCalls, 1);
  assert.equal(f.state.sourceReads, 1);
  assert.equal(f.state.scanCalls, 1);
  assert.ok(!JSON.stringify(result.body).includes(OWNER));
});

test("no file access for all unauthorized identities, environments, methods or targets", async () => {
  const variants = [
    [{ userId: OTHER }, {}],
    [{ environment: "production" }, {}],
    [{ branch: "main" }, {}],
    [{ ownerConfig: "" }, {}],
    [{ enabled: false }, {}],
    [{ memberRole: "organization_admin" }, {}],
    [{ memberStatus: "disabled" }, {}],
    [{ org: "another-organization" }, {}],
    [{ memberError: true }, {}],
    [{}, { origin: "https://attacker.example" }],
    [{}, { origin: undefined, host: "different.example" }],
    [{}, { authorization: "" }],
    [{}, { method: "GET" }],
    [{}, { body: { target: "../../private-supabase.env" } }],
    [{}, { body: { target: "inception_apex", path: ".env" } }],
  ];
  for (const [state, req] of variants) {
    const f = fixture(state);
    const result = await f.send(req);
    assert.notEqual(result.status, 200, JSON.stringify({ state, req }));
    assert.equal(f.state.sourceReads, 0, JSON.stringify({ state, req }));
    assert.equal(f.state.scanCalls, 0);
    assert.ok(!JSON.stringify(result.body).includes(OWNER));
  }
});

test("missing bundled source causes explicit unavailable response, no invented report", async () => {
  const f = fixture({ failScan: true });
  const result = await f.send();
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    ok: false, message: "Source scanner unavailable. Try again after the preview is rebuilt.",
  });
  assert.equal(f.state.sourceReads, 1);
  assert.equal(f.state.scanCalls, 0);
});

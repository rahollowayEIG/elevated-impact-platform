import test from "node:test";
import assert from "node:assert/strict";
import {
  requestInceptionSourceScan, validateInceptionSourceReport,
} from "../src/lib/eigBuildLabScanClient.mjs";

const report = () => ({
  schemaVersion: 1, kind: "eig_build_lab_code_scan", target: "inception_apex",
  targetLabel: "InceptionApex", sourceVersion: "a".repeat(40), sourceFingerprint: "b".repeat(64),
  inspectedAt: "2026-10-15T14:00:00.000Z", scannerVersion: "inception-code-v1",
  files: [{ path: "src/components/InceptionApex.jsx", lines: 1361 }],
  findings: [{
    id: "ia-native-confirm", category: "Workflow", priority: "medium",
    title: "Review native confirmation dialogs",
    observation: "The code calls window.confirm.", recommendation: "Compare with EIG shared UI.",
    evidence: [{ path: "src/components/InceptionApex.jsx", line: 232, excerpt: "window.confirm(" }],
    provenance: "observed_in_first_party_source", review: "pending",
  }],
  limitations: "Source-only.", safety: { readOnly: true, liveChanges: false, autoApproved: false },
});
const client = {
  auth: { getSession: async () => ({
    data: { session: { access_token: "example-test-session" } }, error: null,
  }) },
};

test("authorized browser client sends same-origin JWT request, validates returned report", async () => {
  const result = await requestInceptionSourceScan(client, async (path, options) => {
    assert.equal(path, "/api/eig-build-lab-scan");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, "Bearer example-test-session");
    assert.deepEqual(JSON.parse(options.body), { target: "inception_apex" });
    return { ok: true, json: async () => ({ ok: true, report: report() }) };
  });
  assert.equal(result.findings[0].evidence[0].line, 232);
});

test("no auth or denied response never returns source report", async () => {
  await assert.rejects(requestInceptionSourceScan(null), /verified Build Lab login/);
  await assert.rejects(requestInceptionSourceScan({
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
  }), /Sign in again/);
  await assert.rejects(requestInceptionSourceScan(client, async () => ({ ok: false, status: 403 })), /owner permission/);
  await assert.rejects(requestInceptionSourceScan(client, async () => { throw Error("network"); }), /network/);
});

test("forged report, unverifiable evidence and unsafe server result are rejected", () => {
  for (const changes of [
    { target: "eie" }, { sourceFingerprint: "abc" }, { safety: { readOnly: false, liveChanges: true } },
    { findings: [{ ...report().findings[0], evidence: [{ path: "../../.env", line: 1, excerpt: "secret" }] }] },
    { findings: [{ ...report().findings[0], provenance: "verified_in_production" }] },
  ]) assert.throws(() => validateInceptionSourceReport({ ...report(), ...changes }), /report|evidence/);
});

test('rule check metadata and verification criteria are bounded and cannot claim test execution',()=>{
 const base=report(),check={id:'ia-native-confirm',title:'Review confirmation callers',status:'source_pattern_found',findingType:'verification_needed',runtimeVerified:false,evidence:base.findings[0].evidence,nextCheck:'Verify cancel and continue with synthetic data.'};
 assert.equal(validateInceptionSourceReport({...base,ruleChecks:[check]}).ruleChecks.length,1);
 for(const invalid of [{...check,runtimeVerified:true},{...check,status:'passed'},{...check,evidence:[{path:'../../secret',line:1,excerpt:'x'}]},{...check,nextCheck:'x'.repeat(1501)}])assert.throws(()=>validateInceptionSourceReport({...base,ruleChecks:[invalid]}),/rule checks/);
 assert.throws(()=>validateInceptionSourceReport({...base,ruleChecks:[check,check]}),/rule checks/);
 assert.throws(()=>validateInceptionSourceReport({...base,findings:[{...base.findings[0],verify:'x'.repeat(1501)}]}),/verification criteria/);
});

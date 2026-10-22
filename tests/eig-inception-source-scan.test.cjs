const test = require("node:test");
const assert = require("node:assert/strict");
const {
  readAllowlistedInceptionSource, scanInceptionSource, FILE_PATHS,
} = require("../server/eig-inception-source-scan.cjs");

test("actually scans allowlisted first-party InceptionApex source with traceable lines", () => {
  const source = readAllowlistedInceptionSource();
  assert.deepEqual(Object.keys(source), FILE_PATHS);
  const report = scanInceptionSource(source, "a".repeat(40), "2026-10-15T14:00:00.000Z");
  assert.equal(report.kind, "eig_build_lab_code_scan");
  assert.equal(report.target, "inception_apex");
  assert.equal(report.sourceVersion, "a".repeat(40));
  assert.match(report.sourceFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(report.safety.readOnly, true);
  assert.equal(report.safety.liveChanges, false);
  assert.equal(report.safety.autoApproved, false);
  assert.equal(report.files.length, 4);
  const expected = [
    "ia-native-confirm", "ia-form-focus", "ia-design-tabs",
    "ia-image-keyboard", "ia-review-test-coverage",
  ];
  assert.deepEqual(report.findings.map((item) => item.id), expected);
  assert.deepEqual(report.coverageChecks[0].observedWidths, [949, 950, 951]);
  assert.equal(report.coverageChecks[0].status, "markers_found");
  assert.equal(report.coverageChecks[0].runtimeVerified, false);
  for (const finding of report.findings) {
    assert.equal(finding.provenance, "observed_in_first_party_source");
    assert.equal(finding.review, "pending");
    assert.ok(finding.evidence.length >= 1);
    for (const e of finding.evidence) {
      assert.ok(FILE_PATHS.includes(e.path));
      assert.ok(e.line > 0);
      assert.equal(source[e.path].split("\n")[e.line - 1].trim().slice(0, 160), e.excerpt);
    }
  }
  assert.match(report.limitations, /not proof of live UI defects/);
  assert.ok(!JSON.stringify(report).includes("supabase_service_role"));
});

test("change detection uses actual source fingerprint, never a fabricated scan", () => {
  const source = readAllowlistedInceptionSource();
  const original = scanInceptionSource(source);
  const repeated = scanInceptionSource(source);
  assert.equal(original.sourceFingerprint, repeated.sourceFingerprint);
  const changed = scanInceptionSource({
    ...source, "src/components/InceptionApex.jsx":
      source["src/components/InceptionApex.jsx"].replaceAll("window.confirm(", "window.modalCandidate("),
  });
  assert.notEqual(changed.sourceFingerprint, original.sourceFingerprint);
  assert.ok(!changed.findings.some((item) => item.id === "ia-native-confirm"));
  assert.equal(changed.findings.length, original.findings.length - 1);
  assert.throws(() => scanInceptionSource({ ...source, "src/components/FlyerEditor.jsx": undefined }), /missing/);
  assert.throws(() => scanInceptionSource(source, "user supplied fake commit"), /Invalid source version/);
  assert.throws(() => scanInceptionSource({ ...source, "tests/inception-apex-browser.cjs": "x".repeat(100001) }), /exceeds limit/);
});

test("scanner ignores unexpected source filenames rather than scanning arbitrary paths", () => {
  const source = readAllowlistedInceptionSource();
  const report = scanInceptionSource({ ...source, "../../secret.json": "secret contents" });
  assert.equal(report.files.length, FILE_PATHS.length);
  assert.ok(!JSON.stringify(report).includes("../../secret.json"));
  assert.ok(!JSON.stringify(report).includes("secret contents"));
});

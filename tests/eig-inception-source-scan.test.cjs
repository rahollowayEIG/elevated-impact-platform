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

test('confirmation review lists every observed caller and keeps verification scoped to cancellation and unsaved data',()=>{
 const source=readAllowlistedInceptionSource(),report=scanInceptionSource(source);
 const native=report.findings.find(f=>f.id==='ia-native-confirm');
 assert.equal(native.evidence.length,2);assert.match(native.observation,/2 window.confirm call sites/);
 assert.match(native.verify,/cancel and continue/);assert.match(native.recommendation,/all affected callers/);
 assert.equal(new Set(native.evidence.map(e=>e.line)).size,2);
 const check=report.ruleChecks.find(c=>c.id===native.id);assert.equal(check.runtimeVerified,false);
 assert.deepEqual(check.evidence,native.evidence);assert.equal(report.ruleChecks.length,6);
});

test('comments and quoted examples do not manufacture confirmation or local focus observations',()=>{
 const source=readAllowlistedInceptionSource();
 source['src/components/InceptionApex.jsx']='// window.confirm("comment");\n/* window.confirm("block"); */\nconst example="window.confirm()";\nconst template=`window.confirm()`;';
 source['src/components/inception-apex.css']='/* .ia-app button:focus-visible { outline: 3px solid red; } */\n.ia-app input:not([type="checkbox"]) { color: white; }';
 const report=scanInceptionSource(source);
 assert.ok(!report.findings.some(f=>['ia-native-confirm','ia-form-focus'].includes(f.id)));
 assert.equal(report.ruleChecks.find(c=>c.id==='ia-native-confirm').status,'not_observed_in_sample');
 assert.equal(report.ruleChecks.find(c=>c.id==='ia-form-focus').status,'partial_pattern');
 const commented=scanInceptionSource({...readAllowlistedInceptionSource(),'src/components/InceptionApex.jsx':'/*\n'+readAllowlistedInceptionSource()['src/components/InceptionApex.jsx'].replaceAll('*/','* /')+'\n*/'});
 assert.ok(!commented.findings.some(f=>['ia-native-confirm','ia-design-tabs'].includes(f.id)));
});

test('navigation evidence must occur within the same editor navigation block',()=>{
 const source=readAllowlistedInceptionSource();
 source['src/components/InceptionApex.jsx']=source['src/components/InceptionApex.jsx'].replace('aria-pressed={panel === id}','data-selected={panel === id}')+'\nconst unrelated = <button aria-pressed={panel === id}>Other tool</button>;';
 const report=scanInceptionSource(source);
 assert.ok(!report.findings.some(f=>f.id==='ia-design-tabs'));
 assert.equal(report.ruleChecks.find(c=>c.id==='ia-design-tabs').status,'partial_pattern');
});

test('save/reopen strengths require actual locator references and a reload call rather than matching prose',()=>{
 const source=readAllowlistedInceptionSource();
 source['tests/inception-apex-browser.cjs']='const note = `getByRole("button", { name: "Save to My Designs" }); getByRole("button", { name: "Save & approve design" }); page.reload();`;';
 const report=scanInceptionSource(source);
 assert.ok(!report.findings.some(f=>f.id==='ia-review-test-coverage'));
 assert.equal(report.ruleChecks.find(c=>c.id==='ia-review-test-coverage').status,'not_observed_in_sample');
});

test('viewport markers alone cannot establish declared regression coverage or a passing test',()=>{
 const source=readAllowlistedInceptionSource();
 source['tests/inception-apex-browser.cjs']='for (const width of [949, 950, 951]) { await page.setViewportSize({ width, height: 900 }); }';
 const report=scanInceptionSource(source);
 assert.deepEqual(report.coverageChecks[0].observedWidths,[949,950,951]);
 assert.deepEqual(report.coverageChecks[0].assertionSignals,{overflow:false,controls:false});
 assert.ok(report.findings.some(f=>f.id==='ia-responsive-coverage'));
 assert.equal(report.coverageChecks[0].runtimeVerified,false);
 assert.match(report.findings.find(f=>f.id==='ia-responsive-coverage').observation,/Overflow assertion marker: not observed/);
});

test('equivalent literal-loop viewport calls retain coverage markers without claiming execution',()=>{
 const source=readAllowlistedInceptionSource();
 source['tests/inception-apex-browser.cjs']=source['tests/inception-apex-browser.cjs'].replace(/^\s*await page\.setViewportSize\(\{ width: (?:949|950|951), height: 900 \}\);$/gm,'')+'\nfor (const w of [949,950,951]) { await page.setViewportSize({ height: 900, width: w }); }';
 const report=scanInceptionSource(source);
 assert.deepEqual(report.coverageChecks[0].observedWidths,[949,950,951]);
 assert.equal(report.coverageChecks[0].status,'markers_found');
 assert.equal(report.ruleChecks.find(c=>c.id==='ia-responsive-coverage').status,'coverage_markers_found');
 assert.ok(report.ruleChecks.every(c=>c.runtimeVerified===false));
 assert.ok(!report.findings.some(f=>f.id==='ia-responsive-coverage'));
});

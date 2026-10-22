// Phase 1: genuine read-only first-party source inspection for InceptionApex.
// This is deterministic pattern analysis, NOT a full UI/functional scan, AI
// model, dynamic crawler or proof of live behavior. No network calls or writes.
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const path = require("node:path");

const FILE_PATHS = Object.freeze([
  "src/components/InceptionApex.jsx",
  "src/components/FlyerEditor.jsx",
  "src/components/inception-apex.css",
  "tests/inception-apex-browser.cjs",
]);

// Rule catalog is deliberately small and evidence-based. A matched line proves
// only what the source/test declares, not that a runtime action passed.
const RULES = Object.freeze([
  {
    id: "ia-native-confirm", category: "Workflow", priority: "medium",
    title: "Review native confirmation dialogs for consistency",
    observation: "The InceptionApex component invokes the browser's native confirmation dialog before at least one navigation action.",
    recommendation: "Compare this with shared EIG confirmation UX; if a consistent accessible in-app confirmation is useful, prototype and regression-test it without weakening unsaved-change protection.",
    checks: [{ file: "src/components/InceptionApex.jsx", needle: "window.confirm(" }],
  },
  {
    id: "ia-form-focus", category: "Accessibility", priority: "medium",
    title: "Check keyboard focus indicators for editor fields",
    observation: "The InceptionApex stylesheet explicitly defines button focus-visible styling and separate input/textarea/select styling.",
    recommendation: "Use an authorized browser walkthrough to check visible focus states on fields, buttons, dialogs and editing tools. Site-wide styles may already cover inputs; do not call this a defect without testing.",
    checks: [
      { file: "src/components/inception-apex.css", needle: ".ia-app button:focus-visible" },
      { file: "src/components/inception-apex.css", needle: ".ia-app input:not([type=" },
    ],
  },
  {
    id: "ia-design-tabs", category: "Navigation", priority: "medium",
    title: "Verify editor step navigation and screen-reader clarity",
    observation: "The design workflow renders custom tab-like buttons and uses aria-pressed to reflect the selected editor panel.",
    recommendation: "Check that Design, Details, and Preview & approve remain clear using keyboard and assistive technology; decide whether a navigation-button group or formal tab semantics best reflects the observed behavior.",
    checks: [
      { file: "src/components/InceptionApex.jsx", needle: 'className="ia-editor-tabs"' },
      { file: "src/components/InceptionApex.jsx", needle: "aria-pressed={panel === id}" },
    ],
  },
  {
    id: "ia-responsive-coverage", category: "Responsive UI", priority: "low",
    title: "Add explicit tablet-breakpoint regression checks",
    observation: "InceptionApex defines a 950px breakpoint, but explicit viewport calls at 949, 950 and 951px were not all observed in the sampled test script. Equivalent parameterized tests may exist elsewhere.",
    recommendation: "Locate equivalent existing tablet tests first. If this gap is confirmed, add explicit synthetic viewport checks at 949, 950 and 951px, asserting no horizontal page overflow and that editor controls remain reachable. Run the browser test and rescan; source markers alone do not prove a passing test.",
    checks: [
      { file: "src/components/inception-apex.css", needle: "@media (max-width: 950px)" },
      { file: "tests/inception-apex-browser.cjs", needle: "setViewportSize(" },
    ],
  },
  {
    id: "ia-image-keyboard", category: "Accessibility", priority: "low",
    title: "Preserve keyboard artwork positioning across shared editors",
    observation: "The flyer editor includes keyboard-driven image positioning, and the browser test sends an ArrowRight key to a selected image.",
    recommendation: "Treat keyboard artwork movement as an existing reusable pattern to preserve in new creative editors; recheck its behavior on supported browsers and after future canvas changes.",
    checks: [
      { file: "src/components/FlyerEditor.jsx", needle: "ArrowRight: [5, 0]" },
      { file: "tests/inception-apex-browser.cjs", needle: 'press("ArrowRight")' },
    ],
  },
  {
    id: "ia-review-test-coverage", category: "Regression", priority: "low",
    title: "Keep save, reopen, and approval flows in regression coverage",
    observation: "The InceptionApex browser test contains explicit steps for saving designs and approving artwork.",
    recommendation: "Keep these protected workflows in regression tests when changing project storage, approval states, versions or product handoffs. Check current CI results separately before asserting tests have passed.",
    checks: [
      { file: "tests/inception-apex-browser.cjs", needle: '"Save to My Designs"' },
      { file: "tests/inception-apex-browser.cjs", needle: '"Save & approve design"' },
    ],
  },
]);

const TABLET_WIDTHS=Object.freeze([949,950,951]);
function maskTestCommentsAndStrings(source){
 let state="code",quote="",out="";
 for(let i=0;i<source.length;i++){
  const c=source[i],n=source[i+1];
  if(state==="line"){if(c==="\n"){state="code";out+="\n";}else out+=" ";continue;}
  if(state==="block"){if(c==="*"&&n==="/"){out+="  ";i++;state="code";}else out+=c==="\n"?"\n":" ";continue;}
  if(state==="string"){if(c==="\\"){out+="  ";i++;}else{out+=c==="\n"?"\n":" ";if(c===quote)state="code";}continue;}
  if(c==="/"&&n==="/"){state="line";out+="  ";i++;}
  else if(c==="/"&&n==="*"){state="block";out+="  ";i++;}
  else if(c==='"'||c==="'"||c==='`'){state="string";quote=c;out+=" ";}
  else out+=c;
 }
 return out;
}
function tabletViewportSignals(source){
 // Recognize explicit, standalone Playwright viewport calls, not numbers in prose.
 // This bounded recognizer is not a JavaScript parser or proof tests executed.
 const widths=[];
 const pattern=/^\s*await\s+page\.setViewportSize\(\{\s*width:\s*(949|950|951)\s*,[^}]*\}\);?/gm;
 for(const match of maskTestCommentsAndStrings(source).matchAll(pattern))widths.push(Number(match[1]));
 return [...new Set(widths)].sort((a,b)=>a-b);
}

function readAllowlistedInceptionSource() {
  const result = {};
  for (const relative of FILE_PATHS) {
    // The file names are code-owned literals, never provided by the caller.
    // Vercel's function includes these via vercel.json includeFiles.
    const full = path.resolve(__dirname, "..", relative);
    const contents = fs.readFileSync(full, "utf8");
    if (!contents || contents.length > 100000)
      throw new Error("InceptionApex source not available for bounded inspection");
    result[relative] = contents;
  }
  return result;
}

function evidenceAt(contents, needle, sourcePath) {
  if (typeof contents !== "string") return null;
  const position = contents.indexOf(needle);
  if (position < 0) return null;
  const before = contents.slice(0, position);
  const line = before.split("\n").length;
  const actualLine = contents.split("\n")[line - 1].trim();
  return {
    path: sourcePath, line, // 1-based, original committed source line
    excerpt: actualLine.slice(0, 160),
  };
}

function scanInceptionSource(sourceMap, sourceVersion = "local-unversioned", inspectedAt = new Date().toISOString()) {
  if (!sourceMap || typeof sourceMap !== "object") throw new Error("Source map required");
  if (typeof sourceVersion !== "string" ||
      !(sourceVersion === "local-unversioned" || /^[a-f0-9]{40}$/i.test(sourceVersion)))
    throw new Error("Invalid source version");
  const files = FILE_PATHS.map((file) => {
    const content = sourceMap[file];
    if (typeof content !== "string" || !content.trim() || content.length > 100000)
      throw new Error("Required InceptionApex file missing or exceeds limit: " + file);
    return { path: file, lines: content.split("\n").length };
  });
  // Stable fingerprint lets future scans identify actual source changes even
  // when Vercel's runtime does not expose the Git commit SHA.
  const sourceFingerprint = createHash("sha256");
  for (const file of FILE_PATHS) {
    sourceFingerprint.update(file + "\0");
    sourceFingerprint.update(sourceMap[file] + "\0");
  }
  sourceFingerprint.update(JSON.stringify(RULES)+"\0tablet-literal-check-v1\0");
  const tabletWidths=tabletViewportSignals(sourceMap["tests/inception-apex-browser.cjs"]);
  const findings = [];
  for (const rule of RULES) {
    if(rule.id==="ia-responsive-coverage"&&TABLET_WIDTHS.every(width=>tabletWidths.includes(width)))continue;
    const evidence = rule.checks.map((check) =>
      evidenceAt(sourceMap[check.file], check.needle, check.file));
    // Never claim an observation unless EVERY required source match exists.
    if (evidence.some((item) => item === null)) continue;
    findings.push({
      id: rule.id, category: rule.category, priority: rule.priority,
      findingType:["ia-image-keyboard","ia-review-test-coverage"].includes(rule.id)?"preserve_existing":rule.id==="ia-responsive-coverage"?"coverage_gap":"verification_needed",
      title: rule.title, observation: rule.observation,
      recommendation: rule.recommendation, evidence,
      provenance: "observed_in_first_party_source", review: "pending",
    });
  }
  return {
    schemaVersion: 1, kind: "eig_build_lab_code_scan",
    target: "inception_apex", targetLabel: "InceptionApex",
    sourceVersion, sourceFingerprint: sourceFingerprint.digest("hex"), inspectedAt,
    scannerVersion: "inception-directed-pilot-v2",
    coverageChecks:[{id:"ia-tablet-breakpoints",requiredWidths:[...TABLET_WIDTHS],observedWidths:tabletWidths,status:TABLET_WIDTHS.every(width=>tabletWidths.includes(width))?"markers_found":"not_observed_in_sample",runtimeVerified:false}],
    files,
    findings,
    limitations: "First-party static source and test-script inspection only. Findings are not proof of live UI defects, test results or user behavior. No third-party app, private customer record, screenshot, runtime session or external AI model was scanned.",
    safety: { readOnly: true, liveChanges: false, autoApproved: false },
  };
}

module.exports = {
  readAllowlistedInceptionSource, scanInceptionSource, FILE_PATHS, tabletViewportSignals,
};

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
    recommendation: "Compare every observed confirmation call with shared EIG confirmation UX. If an in-app replacement is approved, cover all affected callers, cancellation and continuation, Escape, visible keyboard focus and focus restoration; preserve unsaved-change and deletion protection. A native dialog alone is not a defect.",
    verify: "Walk through every listed confirmation caller using synthetic designs. Record cancel and continue behavior, keyboard access and preserved unsaved data. If replacing dialogs, regression-test all affected callers and retain the exact-commit browser results.",
    checks: [{ file: "src/components/InceptionApex.jsx", needle: "window.confirm(" }],
  },
  {
    id: "ia-form-focus", category: "Accessibility", priority: "medium",
    title: "Check keyboard focus indicators for editor fields",
    observation: "The InceptionApex stylesheet explicitly defines button focus-visible styling and separate input/textarea/select styling.",
    recommendation: "Use an authorized browser walkthrough to check visible focus states on fields, buttons, dialogs and editing tools. Site-wide styles may already cover inputs; do not call this a defect without testing.",
    verify: "Tab and Shift+Tab through editor fields, buttons, dialogs and editing tools with synthetic data. Record visible focus, clipping and focus restoration. Include inherited/site-wide styles before deciding whether a change is needed; an unobserved local selector is not a defect.",
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
    verify: "Verify keyboard reachability, selected-panel announcements and panel changes for Design, Details and Preview & approve. Choose semantics matching the observed interaction; aria-pressed on navigation buttons is not automatically incorrect. Preserve the design while moving between panels.",
    checks: [
      { file: "src/components/InceptionApex.jsx", needle: 'className="ia-editor-tabs"' },
      { file: "src/components/InceptionApex.jsx", needle: "aria-pressed={panel === id}" },
    ],
  },
  {
    id: "ia-responsive-coverage", category: "Responsive UI", priority: "low",
    title: "Verify tablet-breakpoint regression coverage",
    observation: "InceptionApex defines a 950px breakpoint, but the sampled script does not contain all recognized viewport and assertion markers. Equivalent tests may exist outside this bounded recognizer.",
    recommendation: "Locate equivalent existing tablet tests first. If this gap is confirmed, add explicit synthetic viewport checks at 949, 950 and 951px, asserting no horizontal page overflow and that editor controls remain reachable. Run the browser test and rescan; source markers alone do not prove a passing test.",
    verify: "Find equivalent coverage first. Confirm overflow and editor-control reachability are asserted at 949, 950 and 951px; run the affected test on the exact commit and attach its results. Source definitions and marker matches never establish a passing run.",
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
    verify: "Preserve keyboard positioning and run the synthetic artwork-movement regression on the exact changed commit. A defined key handler and key press do not prove the resulting position was verified.",
    checks: [
      { file: "src/components/FlyerEditor.jsx", needle: "ArrowRight: [5, 0]" },
      { file: "tests/inception-apex-browser.cjs", needle: 'press("ArrowRight")' },
    ],
  },
  {
    id: "ia-review-test-coverage", category: "Regression", priority: "low",
    title: "Keep save, reopen, and approval flows in regression coverage",
    observation: "The InceptionApex browser test contains save and approval button references and a page reload call. These definitions do not prove persistence, reopening or approval passed.",
    recommendation: "Keep these protected workflows in regression tests when changing project storage, approval states, versions or product handoffs. Check current CI results separately before asserting tests have passed.",
    verify: "Retain assertions for saved content after reload/reopen, version state and approval. Run the exact-commit synthetic tests and attach the results separately from this source scan.",
    checks: [
      { file: "tests/inception-apex-browser.cjs", needle: '"Save to My Designs"' },
      { file: "tests/inception-apex-browser.cjs", needle: '"Save & approve design"' },
      { file: "tests/inception-apex-browser.cjs", needle: "page.reload(" },
    ],
  },
]);

const TABLET_WIDTHS=Object.freeze([949,950,951]);
function maskTestCommentsAndStrings(source,{keepStrings=false,lineComments=true}={}){
 let state="code",quote="",out="";
 for(let i=0;i<source.length;i++){
  const c=source[i],n=source[i+1];
  if(state==="line"){if(c==="\n"){state="code";out+="\n";}else out+=" ";continue;}
  if(state==="block"){if(c==="*"&&n==="/"){out+="  ";i++;state="code";}else out+=c==="\n"?"\n":" ";continue;}
  if(state==="string"){if(c==="\\"){out+=keepStrings?c+(n||''):"  ";i++;}else{out+=keepStrings||c==="\n"?c:" ";if(c===quote)state="code";}continue;}
  if(lineComments&&c==="/"&&n==="/"){state="line";out+="  ";i++;}
  else if(c==="/"&&n==="*"){state="block";out+="  ";i++;}
  else if(c==='"'||c==="'"||c==='`'){state="string";quote=c;out+=keepStrings?c:" ";}
  else out+=c;
 }
 return out;
}
function tabletViewportSignals(source){
 // Recognize explicit, standalone Playwright viewport calls, not numbers in prose.
 // This bounded recognizer is not a JavaScript parser or proof tests executed.
 const widths=[];
 const code=maskTestCommentsAndStrings(source);
 const pattern=/\bawait\s+page\.setViewportSize\(\s*\{[^{}]*\bwidth\s*:\s*(949|950|951)\b[^{}]*\}\s*\)/g;
 for(const match of code.matchAll(pattern))widths.push(Number(match[1]));
 // A deliberately bounded equivalent form: literal integer array, directly
 // iterated by a for-of loop with an awaited viewport call. No evaluation.
 const loop=/\bfor\s*\(\s*const\s+(\w+)\s+of\s+\[([\d,\s]+)\]\s*\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
 for(const match of code.matchAll(loop)){
  const values=match[2].split(',').map(x=>x.trim()).filter(Boolean).map(Number);
  const escaped=match[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const viewport=new RegExp('\\bawait\\s+page\\.setViewportSize\\(\\s*\\{[^{}]*\\bwidth\\s*(?::\\s*'+escaped+'\\s*)?(?=[,}])[^{}]*\\}\\s*\\)');
  // Shorthand is recognized only when the actual loop variable is width.
  const explicit=new RegExp('\\bwidth\\s*:\\s*'+escaped+'\\b');
  if(viewport.test(match[3])&&(match[1]==='width'||explicit.test(match[3])))widths.push(...values.filter(x=>TABLET_WIDTHS.includes(x)));
 }
 return [...new Set(widths)].sort((a,b)=>a-b);
}

function evidenceForMatch(contents,position,sourcePath){
 const line=contents.slice(0,position).split('\n').length;
 return {path:sourcePath,line,excerpt:contents.split('\n')[line-1].trim().slice(0,160)};
}

function callStringEvidence(contents,sourcePath,literals,method='getByRole'){
 const code=maskTestCommentsAndStrings(contents),text=maskTestCommentsAndStrings(contents,{keepStrings:true});
 for(const match of code.matchAll(/\.\s*(?:getByRole|press)\s*\(/g)){
  if(!match[0].includes(method))continue;
  const start=match.index+match[0].length;let depth=1,end=start;
  for(;end<code.length&&end-start<1000&&depth;end++){if(code[end]==='(')depth++;else if(code[end]===')')depth--;}
  if(depth)continue;
  const args=text.slice(start,end-1);
  if(literals.every(value=>args.includes('"'+value+'"')||args.includes("'"+value+"'")))return evidenceForMatch(contents,match.index,sourcePath);
 }
 return null;
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
  if(needle.startsWith('"Save '))return callStringEvidence(contents,sourcePath,['button',needle.slice(1,-1)]);
  if(needle==='press("ArrowRight")')return callStringEvidence(contents,sourcePath,['ArrowRight'],'press');
  const css=sourcePath.endsWith('.css');
  const text=maskTestCommentsAndStrings(contents,{keepStrings:true,lineComments:!css});
  const code=maskTestCommentsAndStrings(contents,{lineComments:!css});
  let position=text.indexOf(needle);
  // Non-CSS source anchors must begin outside a quoted example.
  while(position>=0&&!css&&code[position]===' ')position=text.indexOf(needle,position+needle.length);
  if (position < 0) return null;
  return evidenceForMatch(contents,position,sourcePath);
}

function navigationEvidence(contents){
 const file='src/components/InceptionApex.jsx',text=maskTestCommentsAndStrings(contents,{keepStrings:true}),code=maskTestCommentsAndStrings(contents);
 for(const match of text.matchAll(/<nav\b[^>]*className=["']ia-editor-tabs["'][^>]*>[\s\S]*?<\/nav>/g)){
  if(code[match.index]!=='<')continue;
  let pressed=match[0].indexOf('aria-pressed={panel === id}');
  while(pressed>=0&&code[match.index+pressed]===' ')pressed=match[0].indexOf('aria-pressed={panel === id}',pressed+1);
  return [evidenceForMatch(contents,match.index,file),pressed<0?null:evidenceForMatch(contents,match.index+pressed,file)];
 }
 return [null,null];
}

function tabletAssertionSignals(source){
 const code=maskTestCommentsAndStrings(source);
 return {
  overflow:/\bassert\.ok\(\s*await\s+page\.evaluate\(\s*\(\)\s*=>\s*document\.documentElement\.scrollWidth\s*<=\s*(?:window\.)?innerWidth\b/.test(code),
  controls:/\bassert\.ok\(\s*await\s+page\.getByRole\([\s\S]{0,250}?\)\.isVisible\(\)/.test(code),
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
  sourceFingerprint.update(JSON.stringify(RULES)+"\0inception-bounded-rules-v3\0");
  const tabletWidths=tabletViewportSignals(sourceMap["tests/inception-apex-browser.cjs"]);
  const tabletAssertions=tabletAssertionSignals(sourceMap['tests/inception-apex-browser.cjs']);
  const tabletMarkersComplete=TABLET_WIDTHS.every(width=>tabletWidths.includes(width))&&tabletAssertions.overflow&&tabletAssertions.controls;
  const confirmFile='src/components/InceptionApex.jsx';
  const nativeCalls=[...maskTestCommentsAndStrings(sourceMap[confirmFile]).matchAll(/\bwindow\s*\.\s*confirm\s*\(/g)];
  const findings = [],ruleChecks=[];
  for (const rule of RULES) {
    let evidence = rule.checks.map((check) =>
      evidenceAt(sourceMap[check.file], check.needle, check.file));
    if(rule.id==='ia-native-confirm')evidence=nativeCalls.slice(0,4).map(m=>evidenceForMatch(sourceMap[confirmFile],m.index,confirmFile));
    if(rule.id==='ia-design-tabs')evidence=navigationEvidence(sourceMap[confirmFile]);
    const matched=evidence.filter(Boolean),complete=matched.length>0&&evidence.every(Boolean);
    const findingType=['ia-image-keyboard','ia-review-test-coverage'].includes(rule.id)?'preserve_existing':rule.id==='ia-responsive-coverage'?'coverage_gap':'verification_needed';
    ruleChecks.push({id:rule.id,title:rule.title,status:rule.id==='ia-responsive-coverage'&&tabletMarkersComplete?'coverage_markers_found':complete?'source_pattern_found':matched.length?'partial_pattern':'not_observed_in_sample',findingType,runtimeVerified:false,evidence:matched,
      nextCheck:rule.verify});
    if(rule.id==='ia-responsive-coverage'&&tabletMarkersComplete)continue;
    // Never claim an observation unless EVERY required source match exists.
    if (!complete) continue;
    findings.push({
      id: rule.id, category: rule.category, priority: rule.priority,
      findingType,
      title: rule.title, observation: rule.id==='ia-native-confirm'?`The sampled component contains ${nativeCalls.length} window.confirm call sites. Evidence lists up to four locations; their runtime behavior and the need for replacement have not been verified.`:rule.id==='ia-responsive-coverage'?`Recognized tablet widths: ${tabletWidths.join(', ')||'none'}. Overflow assertion marker: ${tabletAssertions.overflow?'found':'not observed'}. Editor-control visibility assertion marker: ${tabletAssertions.controls?'found':'not observed'}. Equivalent tests may exist outside this bounded recognizer.`:rule.observation,
      recommendation: rule.recommendation, verify:rule.verify, evidence:matched,
      provenance: "observed_in_first_party_source", review: "pending",
    });
  }
  return {
    schemaVersion: 1, kind: "eig_build_lab_code_scan",
    target: "inception_apex", targetLabel: "InceptionApex",
    sourceVersion, sourceFingerprint: sourceFingerprint.digest("hex"), inspectedAt,
    scannerVersion: "inception-directed-pilot-v3",
    ruleChecks,
    coverageChecks:[{id:"ia-tablet-breakpoints",requiredWidths:[...TABLET_WIDTHS],observedWidths:tabletWidths,assertionSignals:tabletAssertions,status:tabletMarkersComplete?"markers_found":"not_observed_in_sample",runtimeVerified:false}],
    files,
    findings,
    limitations: "First-party static source and test-script inspection only, using bounded pattern recognizers rather than a complete syntax, control-flow or CSS-cascade analysis. Comments and quoted examples are excluded from code-call checks; unsupported syntax and tests elsewhere may be missed. Findings are not proof of live UI defects, test results or user behavior. No third-party app, private customer record, screenshot, runtime session or external AI model was scanned.",
    safety: { readOnly: true, liveChanges: false, autoApproved: false },
  };
}

module.exports = {
  readAllowlistedInceptionSource, scanInceptionSource, FILE_PATHS, tabletViewportSignals,
};

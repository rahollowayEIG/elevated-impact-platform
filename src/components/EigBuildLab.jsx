import {prepareInceptionPilotBlueprint} from "../lib/buildLabInceptionPilot.mjs";
import {managerStorageKey} from "../lib/buildLabMissionOrchestrator.mjs";
import {readScanHistory} from "../lib/buildLabScanHistory.mjs";
import ScannerDirectionsDisclosure from "./ScannerDirectionsDisclosure.jsx";
import BuildLabScanDestination, {BuildLabReportBackup} from "./BuildLabScanDestination.jsx";
import BuildLabWorkBuckets from "./BuildLabWorkBuckets.jsx";
import BuildLabManager from "./BuildLabManager.jsx";
import BuildLabScanPlans from "./BuildLabScanPlans.jsx";
import BuildLabScanHistory from "./BuildLabScanHistory.jsx";
import useBuildLabScanHistory from "./useBuildLabScanHistory.jsx";
import ScannerToolsDisclosure from "./ScannerToolsDisclosure.jsx";
import React, { useEffect, useRef, useState } from "react";
import {
  BUILD_LAB_MODES, BUILD_LAB_REUSE, createBuildBlueprint,
  renderBuildBlueprintMarkdown, restoreBuildBlueprint, reviewBuildSuggestion, suggestBuildRevision,
} from "../lib/eigBuildArchitect.mjs";
import { BL_EMPTY_BRIEF, loadBuildLabDraft, saveBuildLabDraft } from "../lib/eigBuildLabDraft.mjs";
import { requestInceptionSourceScan } from "../lib/eigBuildLabScanClient.mjs";
import "./eig-build-lab.css";
import BuildImpactReview from "./BuildImpactReview.jsx";
import BuildLabAiConnection from "./BuildLabAiConnection.jsx";
import BuildLabMasterScanner from "./BuildLabMasterScanner.jsx";
import BuildLabImprovementRadar from "./BuildLabImprovementRadar.jsx";
import EpDiscoveryPilot from "./EpDiscoveryPilot.jsx";
import EpInvoicePilot from "./EpInvoicePilot.jsx";
import ResearchTargetPlanner from "./ResearchTargetPlanner.jsx";

const LAB_TOOLS = [
  ["master", "Master Scanner"], ["radar", "Upgrade Radar"],
  ["ai", "AI Review"], ["history", "Scan History"], ["inspector", "IA Inspector"],
  ["research", "Research"], ["impact", "Impact Review"],
  ["discoveries", "Discoveries"], ["invoices", "Invoices"],
  ["buckets", "Work Buckets"], ["manager", "Manager"], ["architect", "Project Architect"], ["plans", "Scan Plans"],
];

const LAB_GROUPS = [
  ["scanners", "Scanners", ["master", "radar", "inspector", "impact"]],
  ["intelligence", "AI & Research", ["ai", "research"]],
  ["planning", "Planning", ["buckets", "manager", "plans", "architect"]],
  ["prototypes", "Prototypes", ["discoveries", "invoices"]],
  ["history", "History", ["history"]],
];
const ADVANCED_TOOLS = ["manager", "architect", "plans", "research", "discoveries", "invoices"];
const groupForTool = tool => LAB_GROUPS.find(([, , tools]) => tools.includes(tool))?.[0] || "scanners";

const EIG_PILOT = {
  name: "InceptionApex UI & Workflow Improvement",
  goal: "Make the flyer studio easier for an EIG administrator to understand, customize, save, approve and reopen on desktop and phone.",
  audience: "EIG creative team and future small-business users",
  currentProcess: "The flyer editing and My Designs approval workflow works. We want to review its navigation, visual polish, accessibility, and reusable patterns.",
  referenceNotes: "Use our first-party InceptionApex code and authorized UI walkthroughs. Actual app functionality must be verified separately.",
  mode: "ui_review", reuse: "many",
};

function saveLocalText(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeFilename(title) {
  return String(title || "eig-project").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 55) || "eig-project";
}
function SectionHeading({ number, title, description }) {
  return <div className="bl-heading"><span className="bl-number">{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>;
}

export default function EigBuildLab({ ownerUserId, supabaseClient, onBack, onDirtyChange, focusedMode = false, onToggleFocus }) {
  const viewKey = "eig-build-lab-tool:v2:" + ownerUserId;
  const [activeTool, setActiveTool] = useState(() => {
    try {
      const saved = window.sessionStorage.getItem(viewKey);
      return LAB_TOOLS.some(([id]) => id === saved) ? saved : "master";
    } catch { return "master"; }
  });
  const [managerVersion,setManagerVersion]=useState(0);
  const [advancedTools,setAdvancedTools]=useState(()=>ADVANCED_TOOLS.includes(activeTool));
  const [legacyReview,setLegacyReview]=useState(()=>{try{return window.sessionStorage.getItem(viewKey+":legacy")==="true";}catch{return false;}});
  useEffect(()=>{try{window.sessionStorage.setItem(viewKey+":legacy",String(legacyReview));}catch{}},[viewKey,legacyReview]);
  function viewBuckets(){setActiveGroup("planning");setActiveTool("buckets");}
  const [activeGroup, setActiveGroup] = useState(() => groupForTool(activeTool));
  useEffect(() => {
    try { window.sessionStorage.setItem(viewKey, activeTool); } catch { /* Navigation works without storage. */ }
  }, [viewKey, activeTool]);
  const [restoredDraft] = useState(() => {
    try { return loadBuildLabDraft(window.localStorage, ownerUserId); }
    catch { return null; }
  });
  const [brief, setBrief] = useState(() => restoredDraft?.brief || { ...BL_EMPTY_BRIEF });
  const [blueprint, setBlueprint] = useState(() => restoredDraft?.blueprint || null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() =>
    restoredDraft ? "Restored your browser-saved draft, including earlier review decisions." : "");
  const [editing, setEditing] = useState(() => restoredDraft?.editing || "");
  const [editValue, setEditValue] = useState(() => restoredDraft?.editValue || "");
  const [scanReport, setScanReport] = useState(() => restoredDraft?.scanReport || null);
  const [scanReviews, setScanReviews] = useState(() => restoredDraft?.scanReviews || {});
  const [scanEditing, setScanEditing] = useState(() => restoredDraft?.scanEditing || "");
  const [scanEditValue, setScanEditValue] = useState(() => restoredDraft?.scanEditValue || "");
  const [scanRunning, setScanRunning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanNotice, setScanNotice] = useState("");
  const [scanQuery, setScanQuery] = useState("");
  const [scanSort, setScanSort] = useState("priority");
  const [saveStatus, setSaveStatus] = useState("pending");
  const scanHistory=useBuildLabScanHistory(ownerUserId,"inspector",scanReport?{report:scanReport,reviews:scanReviews}:null,"inception-apex",scanReport?.sourceVersion||scanReport?.sourceFingerprint);
  const uploadRef = useRef(null);
  const needsBackup = saveStatus === "error";

  function saveSnapshot() {
    try {
      saveBuildLabDraft(window.localStorage, ownerUserId, { brief, blueprint, editing, editValue, scanReport, scanReviews, scanEditing, scanEditValue });
      setSaveStatus("saved");
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }

  // Persist every change in browser storage under the current owner's login.
  // This is independent of JSON export and survives leaving the React page,
  // refreshing, or opening this *same preview origin* in a new tab.
  useEffect(() => {
    saveSnapshot();
  }, [brief, blueprint, editing, editValue, scanReport, scanReviews, scanEditing, scanEditValue, ownerUserId]);

  useEffect(() => {
    onDirtyChange?.(needsBackup);
    return () => onDirtyChange?.(false);
  }, [needsBackup, onDirtyChange]);

  useEffect(() => {
    const beforeUnload = (event) => {
      try {
        saveBuildLabDraft(window.localStorage, ownerUserId, { brief, blueprint, editing, editValue, scanReport, scanReviews, scanEditing, scanEditValue });
      } catch {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [brief, blueprint, editing, editValue, scanReport, scanReviews, scanEditing, scanEditValue, ownerUserId]);

  function handleBack() {
    if (!saveSnapshot()) {
      setNotice("Browser autosave is unavailable. Download reusable JSON before leaving.");
      return;
    }
    onBack?.();
  }

  function update(field, value) {
    setBrief((current) => ({ ...current, [field]: value }));
    setNotice(""); setError("");
  }
  function hasWorkToReplace() {
    return Boolean(blueprint) || Object.entries(brief).some(([key, value]) =>
      key !== "mode" && key !== "reuse" && typeof value === "string" && value.trim().length > 0);
  }
  function startExample() {
    if (hasWorkToReplace() &&
        !window.confirm("Replace your current browser-saved draft with the InceptionApex example? Download reusable JSON first if you want to keep the current project.")) return;
    setBrief(EIG_PILOT);
    setBlueprint(null);
    setEditing(""); setEditValue("");
    setNotice("EIG-owned pilot example loaded and will be saved in this browser.");
    setError("");
  }
  function startFresh() {
    if (hasWorkToReplace() &&
        !window.confirm("Start a new Build Lab project? This replaces your current locally saved draft. Download reusable JSON first if you want to keep it.")) return;
    setBrief({ ...BL_EMPTY_BRIEF });
    setBlueprint(null); setEditing(""); setEditValue("");
    setNotice("New empty project created. Your changes will save in this browser.");
    setError("");
  }
  function generate(event) {
    event.preventDefault();
    try {
      const next = createBuildBlueprint(brief, { revision: (blueprint?.version || 0) + 1 });
      setBlueprint(next); setEditing(""); setEditValue("");
      setError(""); setNotice("Draft blueprint created. Review every proposed improvement before using it.");
    } catch (e) { setError(e.message); setNotice(""); }
  }
  function decide(id, action, value = "") {
    try {
      setBlueprint(reviewBuildSuggestion(blueprint, id, action, value));
      setEditing(""); setError(""); setNotice("");
    } catch (e) { setError(e.message); }
  }
  function exportFile(format) {
    if (!blueprint) return;
    const name = safeFilename(blueprint.brief.name) + "-blueprint-v" + blueprint.version;
    const content = format === "json"
      ? JSON.stringify(blueprint, null, 2)
      : renderBuildBlueprintMarkdown(blueprint);
    saveLocalText(content, name + (format === "json" ? ".json" : ".md"), format === "json" ? "application/json" : "text/markdown");
    setNotice(format === "json"
      ? "JSON backup downloaded. Your working draft is also saved in this browser."
      : "Readable blueprint downloaded. Use reusable JSON as a backup for another browser, device or preview link.");
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 60000) throw new Error("Choose a Build Lab JSON file smaller than 60 KB.");
      const restored = restoreBuildBlueprint(await file.text());
      setBrief(restored.brief); setBlueprint(restored);
      setEditing(""); setEditValue("");
      setError(""); setNotice("Blueprint reopened. It will now be saved automatically in this browser.");
    } catch (e) { setError(e.message || "Unable to reopen this file."); setNotice(""); }
  }
  function createPilotBlueprint(findingId){
    try {
      const key=managerStorageKey(ownerUserId);if(!key)throw Error("Owner account required.");
      if(window.localStorage.getItem(key)&&!window.confirm("Replace the current Manager blueprint with this one-finding pilot? Download the current blueprint first to keep it."))return;
      const archive=readScanHistory(window.localStorage,ownerUserId).find(x=>x.type==="inspector"&&x.snapshot?.report?.sourceFingerprint===scanReport?.sourceFingerprint&&x.snapshot.report.inspectedAt===scanReport.inspectedAt);
      if(!archive)throw Error("Save the scan to history before preparing its blueprint. Check browser storage and retry.");
      const plan=prepareInceptionPilotBlueprint(archive,findingId);
      window.localStorage.setItem(key,JSON.stringify(plan));
      setManagerVersion(n=>n+1);setActiveGroup("planning");setActiveTool("manager");setScanError("");
    }catch(e){setScanError(e.message||"Unable to prepare the pilot blueprint.");}
  }

  async function runSourceScan() {
    if (scanRunning) return;
    setScanRunning(true); setScanError(""); setScanNotice("");
    try {
      const report = await requestInceptionSourceScan(supabaseClient);
      const changed = scanReport?.sourceFingerprint !== report.sourceFingerprint;
      scanHistory.begin();setScanReport(report);
      if (changed) {
        setScanReviews({}); setScanEditing(""); setScanEditValue("");
      }
      setScanNotice(changed
        ? "Read-only source scan completed. New source version detected; review findings before accepting."
        : "Read-only source scan completed. Existing decisions for unchanged source were preserved.");
    } catch (problem) {
      setScanError(problem?.message || "Unable to inspect InceptionApex source.");
    } finally {
      setScanRunning(false);
    }
  }
  function decideScan(id, action, editedDetail = "") {
    if (!scanReport?.findings.some((finding) => finding.id === id) ||
        !["accept", "edit", "reject"].includes(action)) return;
    const text = editedDetail.trim();
    if (action === "edit" && (!text || text.length > 1500)) {
      setScanError("Enter a revised recommendation of up to 1500 characters.");
      return;
    }
    setScanReviews((current) => ({
      ...current,
      [id]: {
        review: action,
        // Approval/rejection is independent of the owner's revised wording.
        editedDetail: action === "edit" ? text : (current[id]?.editedDetail || null),
      },
    }));
    setScanEditing(""); setScanEditValue(""); setScanError("");
  }
  function exportScanReport() {
    if (!scanReport) return;
    const payload = {
      ...scanReport,
      findings: scanReport.findings.map((finding) => ({
        ...finding, ...scanReviews[finding.id],
      })),
    };
    saveLocalText(JSON.stringify(payload, null, 2),
      "InceptionApex-source-scan-" + scanReport.sourceFingerprint.slice(0, 12) + ".json", "application/json");
    setScanNotice("Source findings downloaded. This does not create tasks or modify any app.");
  }
  const visibleFindings = (scanReport?.findings || [])
    .filter((finding) => {
      const term = scanQuery.trim().toLowerCase();
      return !term || [
        finding.title, finding.category, finding.observation,
        finding.recommendation, ...finding.evidence.map((item) => item.path),
      ].join(" ").toLowerCase().includes(term);
    })
    .sort((left, right) => {
      if (scanSort === "title") return left.title.localeCompare(right.title);
      if (scanSort === "category") return left.category.localeCompare(right.category) || left.title.localeCompare(right.title);
      return ({ high: 0, medium: 1, low: 2 }[left.priority] ?? 3) -
        ({ high: 0, medium: 1, low: 2 }[right.priority] ?? 3) || left.title.localeCompare(right.title);
    });

  const acceptedCount = blueprint?.suggestions.filter((x) => ["accept", "edit"].includes(x.review)).length || 0;
  const pendingCount = blueprint?.suggestions.filter((x) => x.review === "pending").length || 0;

  return <main className="platform-page bl-app" aria-label="EIG Build Lab">
    <header className="platform-hero bl-hero">
      <div><p className="platform-eyebrow">EIG COMMAND CENTER / PRIVATE PILOT</p>
        <h1>Build Lab <span className="bl-subtitle">Scanners &amp; Tools</span></h1>
        <p>Run your scanners, then review the findings together in Work Buckets.</p>
      </div>
      <div className="bl-hero-actions">
        <span className="bl-draft-tag">{saveStatus === "saved" ? "Browser autosave on" : needsBackup ? "Backup required" : "Preparing local draft"}</span>
        {onToggleFocus && <button type="button" className="platform-secondary-button" onClick={onToggleFocus}>{focusedMode ? "Show full navigation" : "Focus window"}</button>}
        {!focusedMode && <button type="button" className="platform-secondary-button" onClick={handleBack}>← EIG Command Center</button>}
      </div>
    </header>

    <nav className="bl-tool-nav" aria-label="Build Lab groups">
      {LAB_GROUPS.filter(([id])=>id!=="prototypes").map(([id,label,tools])=><button key={id} type="button" aria-pressed={activeGroup===id}
        onClick={()=>{setActiveGroup(id);if(!tools.includes(activeTool))setActiveTool(tools[0]);}}>{label}</button>)}
    </nav>
    <nav className="bl-tool-nav bl-tool-subnav" aria-label="Build Lab tools">
      {LAB_TOOLS.filter(([id])=>!ADVANCED_TOOLS.includes(id)).map(([id, label]) => <button key={id} id={"bl-tool-" + id} type="button"
        hidden={groupForTool(id)!==activeGroup}
        aria-pressed={activeTool === id} aria-controls={"bl-panel-" + id}
        onClick={() => setActiveTool(id)}>{label}</button>)}
    </nav>

    <details className="bl-advanced-tools" open={advancedTools} onToggle={e=>setAdvancedTools(e.currentTarget.open)}>
      <summary>Advanced tools</summary>
      <nav className="bl-tool-nav bl-tool-subnav" aria-label="Advanced Build Lab tools">{LAB_TOOLS.filter(([id])=>ADVANCED_TOOLS.includes(id)).map(([id,label])=><button key={id} id={"bl-tool-"+id} type="button" aria-controls={"bl-panel-"+id} aria-pressed={activeTool===id} onClick={()=>{setActiveGroup(groupForTool(id));setActiveTool(id);}}>{label}</button>)}</nav>
      <label><input type="checkbox" checked={legacyReview} onChange={e=>setLegacyReview(e.target.checked)} /> Show legacy scanner review controls</label>
      <p className="bl-quiet">Compatibility tools for earlier drafts. The normal workflow is run scanners, then review Work Buckets.</p>
    </details>

    <details className="bl-about"><summary>About Build Lab &amp; saved work</summary>
    <p className="bl-disclosure" role="note">
      <strong>What this pilot does:</strong> Turns your description into a deterministic planning checklist and editable review.
      The Master Scanner checks approved source, test scripts and dated environment metadata. Essentials & Wow Radar uses those same owner-authorized sources to propose upgrades. The InceptionApex Source Inspector remains as an early pilot.
      Source scanners do not browse external websites or change live apps. AI Review makes a separate, owner-requested analysis of scanner metadata. Upgrade candidates are not proven gaps.
      Source observations are not proof of bugs or live behavior. Drafts autosave in this browser only.
      Do not enter passwords, private customer information or API secrets.
    </p>

    </details>

    <p className={"bl-save-note" + (needsBackup ? " bl-save-error" : "")} role="status">
      {needsBackup
        ? "Browser autosave is unavailable. Download reusable JSON to keep your work."
        : "Your project and review decisions save automatically in this browser. Use JSON export for another device or preview link."}
    </p>

    <div className="bl-tool-panel" id="bl-panel-history" role="region" aria-labelledby="bl-tool-history" hidden={activeTool !== "history"}><BuildLabScanHistory ownerUserId={ownerUserId} /></div>

    <div className="bl-tool-panel" id="bl-panel-plans" role="region" aria-labelledby="bl-tool-plans" hidden={activeTool !== "plans"}><BuildLabScanPlans ownerUserId={ownerUserId} /></div>

    <div className="bl-tool-panel" id="bl-panel-buckets" role="region" aria-labelledby="bl-tool-buckets" hidden={activeTool !== "buckets"}><BuildLabWorkBuckets key={ownerUserId} ownerUserId={ownerUserId} onOpenManager={()=>{setAdvancedTools(true);setManagerVersion(n=>n+1);setActiveGroup("planning");setActiveTool("manager");}} /></div>

    <div className="bl-tool-panel" id="bl-panel-manager" role="region" aria-labelledby="bl-tool-manager" hidden={activeTool !== "manager"}><BuildLabManager key={managerVersion} ownerUserId={ownerUserId} supabaseClient={supabaseClient} /></div>

    {/* Keep panels mounted so switching tools preserves forms, results and in-flight requests. */}
    <div className="bl-tool-panel" id="bl-panel-master" role="region" aria-labelledby="bl-tool-master" hidden={activeTool !== "master"}><BuildLabMasterScanner ownerUserId={ownerUserId} supabaseClient={supabaseClient} legacyReview={legacyReview} onViewBuckets={viewBuckets} /></div>
    <div className="bl-tool-panel" id="bl-panel-radar" role="region" aria-labelledby="bl-tool-radar" hidden={activeTool !== "radar"}><BuildLabImprovementRadar ownerUserId={ownerUserId} supabaseClient={supabaseClient} legacyReview={legacyReview} onViewBuckets={viewBuckets} /></div>
    <div className="bl-tool-panel" id="bl-panel-discoveries" role="region" aria-labelledby="bl-tool-discoveries" hidden={activeTool !== "discoveries"}><EpDiscoveryPilot /></div>
    <div className="bl-tool-panel" id="bl-panel-invoices" role="region" aria-labelledby="bl-tool-invoices" hidden={activeTool !== "invoices"}><EpInvoicePilot /></div>

    <div className="bl-tool-panel" id="bl-panel-inspector" role="region" aria-labelledby="bl-tool-inspector" hidden={activeTool !== "inspector"}>

    <section className="platform-section-card bl-source-scanner" aria-labelledby="bl-source-title">
      <div className="bl-scan-heading">
        <div>
          <div className="bl-scanner-title"><h2 id="bl-source-title">Original IA Pilot · Source Inspector</h2><ScannerToolsDisclosure kind="inspector" /></div>
          <p>Original InceptionApex-only test scanner, kept for comparison. To scan any other module, use the Master Scanner above.</p>
        </div>
        <button type="button" className="platform-primary-button" disabled={scanRunning}
          onClick={runSourceScan}>
          {scanRunning ? "Inspecting source…" : scanReport ? "Scan this source version again" : "Inspect InceptionApex source →"}
        </button>
      </div>
      <ScannerDirectionsDisclosure kind="inspector" moduleId="inception" />
      <p className="bl-quiet">The scanner examines code from this deployed preview. It does not visit your live app, scan customer designs, or run an AI model.</p>
      {scanHistory.error && <p role="alert" className="platform-error">{scanHistory.error}</p>}
      {scanError && <p className="platform-error" role="alert">{scanError}</p>}
      {scanNotice && <p className="bl-notice" role="status">{scanNotice}</p>}
      {scanReport && <>
        <BuildLabScanDestination onViewBuckets={viewBuckets} />
        <div className="bl-scan-meta">
          <span><strong>{scanReport.files.length}</strong> source files</span>
          <span><strong>{scanReport.findings.length}</strong> source-backed findings</span>
          <span>Source fingerprint: <code>{scanReport.sourceFingerprint.slice(0, 12)}</code></span>
          <span>Inspected: {new Date(scanReport.inspectedAt).toLocaleString()}</span>
        </div>
        <div className="bl-scan-controls">
          <label>Search findings
            <input type="search" value={scanQuery} onChange={(e) => setScanQuery(e.target.value)}
              placeholder="Search issues, source files, categories…" />
          </label>
          <label>Sort findings
            <select value={scanSort} onChange={(e) => setScanSort(e.target.value)}>
              <option value="priority">Priority</option>
              <option value="category">Category</option>
              <option value="title">Title</option>
            </select>
          </label>
          <BuildLabReportBackup legacyReview={legacyReview}><button type="button" className="platform-secondary-button" onClick={exportScanReport}>Download source report JSON</button></BuildLabReportBackup>
        </div>
        <p className="bl-quiet">Showing {visibleFindings.length} of {scanReport.findings.length} findings. Evidence means the pattern was found in code, not that the suggested improvement is verified as necessary.</p>
        <div className="bl-scan-results">
          {visibleFindings.map((finding) => {
            const review = scanReviews[finding.id];
            return <article className="bl-scan-finding" key={finding.id}>
              <div className="bl-suggestion-top">
                <span className="bl-phase">{finding.category} · {finding.priority} priority</span>
                {legacyReview&&<span className={"bl-review-state state-" + (review?.review || "pending")}>
                  {review?.review === "accept" ? "Accepted" : review?.review === "edit" ? "Edited" :
                    review?.review === "reject" ? "Rejected" : "Not reviewed"}
                </span>}
              </div>
              <h3>{finding.title}</h3>
              {finding.findingType&&<p><strong>Finding type:</strong> {finding.findingType.replaceAll("_"," ")}</p>}
              <p><strong>Observed in source:</strong> {finding.observation}</p>
              <p><strong>Suggested check:</strong> {review?.editedDetail || finding.recommendation}</p>
              <details className="bl-evidence">
                <summary>View code evidence ({finding.evidence.length})</summary>
                <ul>{finding.evidence.map((evidence, index) =>
                  <li key={finding.id + "-" + index}>
                    <code>{evidence.path}:{evidence.line}</code>
                    <code className="bl-source-excerpt">{evidence.excerpt}</code>
                  </li>)}</ul>
              </details>
              {legacyReview&&<div className="bl-review-actions">
                {finding.findingType!=="preserve_existing"&&<button type="button" className="platform-primary-button" onClick={()=>createPilotBlueprint(finding.id)}>Create blueprint for this finding</button>}
                <button type="button" className="platform-secondary-button"
                  onClick={() => decideScan(finding.id, "accept")}>Accept</button>
                <button type="button" className="platform-secondary-button"
                  onClick={() => {
                    setScanEditing(finding.id);
                    setScanEditValue(review?.editedDetail || finding.recommendation);
                  }}>Revise</button>
                <button type="button" className="platform-secondary-button"
                  onClick={() => decideScan(finding.id, "reject")}>Reject</button>
              </div>}
              {legacyReview&&scanEditing === finding.id && <div className="bl-revise">
                <label htmlFor={"bl-scan-edit-" + finding.id}>Revised scan recommendation</label>
                <textarea id={"bl-scan-edit-" + finding.id} rows="3" maxLength={1500}
                  value={scanEditValue} onChange={(e) => setScanEditValue(e.target.value)} />
                <div className="bl-review-actions">
                  <button type="button" className="platform-primary-button"
                    onClick={() => decideScan(finding.id, "edit", scanEditValue)}>Save revision</button>
                  <button type="button" className="platform-secondary-button"
                    onClick={() => setScanEditing("")}>Cancel</button>
                </div>
              </div>}
            </article>;
          })}
          {visibleFindings.length === 0 && <p className="bl-quiet">No findings match this search.</p>}
        </div>
        <p className="bl-quiet">{scanReport.limitations}</p>
        <p className="bl-quiet">Review requirements and choose work in Work Buckets. Scanning does not change application code.</p>
      </>}
    </section>

    </div>
    <div className="bl-tool-panel" id="bl-panel-ai" role="region" aria-labelledby="bl-tool-ai" hidden={activeTool !== "ai"}><BuildLabAiConnection ownerUserId={ownerUserId} supabaseClient={supabaseClient} onViewBuckets={viewBuckets} /></div>
    <div className="bl-tool-panel" id="bl-panel-research" role="region" aria-labelledby="bl-tool-research" hidden={activeTool !== "research"}><ResearchTargetPlanner /></div>
    <div className="bl-tool-panel" id="bl-panel-impact" role="region" aria-labelledby="bl-tool-impact" hidden={activeTool !== "impact"}><BuildImpactReview ownerUserId={ownerUserId} legacyReview={legacyReview} onViewBuckets={viewBuckets} /></div>

    <div className="bl-tool-panel" id="bl-panel-architect" role="region" aria-labelledby="bl-tool-architect" hidden={activeTool !== "architect"}>
    <div className="bl-two-column">
      <form className="platform-section-card bl-brief" onSubmit={generate}>
        <SectionHeading number="01" title="Define the mission" description="What are we trying to accomplish, and who does it help?"/>
        <div className="bl-inputs">
          <label htmlFor="bl-project-name">Project name
            <input id="bl-project-name" maxLength={100} required placeholder="Example: Universal Scorecard Generator"
              value={brief.name} onChange={(e) => update("name", e.target.value)}/>
          </label>
          <div className="bl-input-pair">
            <label htmlFor="bl-mode">What are we doing?
              <select id="bl-mode" value={brief.mode} onChange={(e) => update("mode", e.target.value)}>
                {BUILD_LAB_MODES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
            <label htmlFor="bl-reuse">Who could reuse it?
              <select id="bl-reuse" value={brief.reuse} onChange={(e) => update("reuse", e.target.value)}>
                {BUILD_LAB_REUSE.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
          </div>
          <label htmlFor="bl-goal">Goal and definition of success
            <textarea id="bl-goal" rows="5" maxLength={2000} required
              placeholder="Describe what the business or user should be able to do."
              value={brief.goal} onChange={(e) => update("goal", e.target.value)}/>
          </label>
          <label htmlFor="bl-audience">Who is this for?
            <input id="bl-audience" maxLength={300} required placeholder="Pilots, small businesses, EIG staff..."
              value={brief.audience} onChange={(e) => update("audience", e.target.value)}/>
          </label>
          <label htmlFor="bl-current">Current process or problem (optional)
            <textarea id="bl-current" rows="3" maxLength={1500}
              placeholder="What takes too long? What is confusing or duplicated?"
              value={brief.currentProcess} onChange={(e) => update("currentProcess", e.target.value)}/>
          </label>
          <label htmlFor="bl-references">Reference apps, screenshots or ideas (notes only)
            <textarea id="bl-references" rows="3" maxLength={1500}
              placeholder="List what to examine. No scanning takes place yet."
              value={brief.referenceNotes} onChange={(e) => update("referenceNotes", e.target.value)}/>
          </label>
        </div>
        <div className="bl-form-actions">
          <button className="platform-primary-button" type="submit">{blueprint ? "Regenerate as next draft version" : "Create draft blueprint →"}</button>
          <button className="platform-secondary-button" type="button" onClick={startExample}>Load InceptionApex pilot</button>
          <button className="platform-secondary-button" type="button" onClick={startFresh}>New project</button>
        </div>
        <div className="bl-upload-row">
          <span>Already have a Build Lab export?</span>
          <input ref={uploadRef} type="file" accept=".json,application/json" hidden onChange={importFile} aria-label="Import Build Lab JSON"/>
          <button type="button" className="platform-secondary-button" onClick={() => uploadRef.current?.click()}>Reopen JSON blueprint</button>
        </div>
      </form>

      <div className="bl-results" aria-live="polite">
        {error && <div className="platform-error" role="alert">{error}</div>}
        {notice && <p className="bl-notice" role="status">{notice}</p>}
        {!blueprint ? <section className="platform-section-card bl-empty">
          <div className="bl-symbol" aria-hidden="true">◈</div>
          <h2>Your blueprint appears here</h2>
          <p>Start from a business problem or load the InceptionApex example. We'll first decide whether to build a feature directly or develop a reusable tool that helps future projects.</p>
          <p className="bl-quiet">Every recommendation will be labeled as proposed until verified and reviewed.</p>
        </section> : <>
          <section className="platform-section-card bl-strategy">
            <SectionHeading number="02" title="Build strategy" description={"Draft blueprint · version " + blueprint.version}/>
            <strong className="bl-strategy-title">{blueprint.strategy.choice === "evaluate_reusable_tool_first" ? "Evaluate a reusable tool first" : "Start with a focused feature"}</strong>
            <p>{blueprint.strategy.explanation}</p>
            <h3>Platform modules to investigate</h3>
            <div className="bl-chips">{blueprint.registryCandidates.map((item) =>
              <span className="bl-chip" key={item.id} title="Suggested match; not verified">{item.label} · check</span>)}
            </div>
          </section>
          <section className="platform-section-card bl-suggestions">
            <SectionHeading number="03" title="Review proposed work" description={acceptedCount + " accepted or edited · " + pendingCount + " awaiting review"}/>
            <p className="bl-quiet">These are planning suggestions, not observed app behavior or executed tasks.</p>
            {blueprint.suggestions.map((item) =>
              <article key={item.id} className="bl-suggestion">
                <div className="bl-suggestion-top"><span className="bl-phase">{item.phase}</span><span className={"bl-review-state state-" + item.review}>{item.review === "pending" ? "Not reviewed" : item.review === "edit" ? "Edited" : item.review === "accept" ? "Accepted" : "Rejected"}</span></div>
                <h3>{item.title}</h3>
                <p>{item.review === "edit" ? item.editedDetail : item.detail}</p>
                <div className="bl-review-actions">
                  <button type="button" className="platform-secondary-button" onClick={() => decide(item.id, "accept")} aria-label={"Accept " + item.title}>Accept</button>
                  <button type="button" className="platform-secondary-button" onClick={() => { setEditing(item.id); setEditValue(item.editedDetail || suggestBuildRevision(blueprint, item.id)); }}>Revise</button>
                  <button type="button" className="platform-secondary-button" onClick={() => decide(item.id, "reject")} aria-label={"Reject " + item.title}>Reject</button>
                </div>
                {editing === item.id && <div className="bl-revise">
                  <label htmlFor={"bl-edit-" + item.id}>Revised requirement</label>
                  <p className="bl-autofill-hint">Auto-filled from your project goal. Edit the description before saving.</p>
                  <textarea id={"bl-edit-" + item.id} rows="3" maxLength={2000} value={editValue} onChange={(e) => setEditValue(e.target.value)}/>
                  <div className="bl-review-actions">
                    <button type="button" className="platform-primary-button" onClick={() => decide(item.id, "edit", editValue)}>Save revision</button>
                    <button type="button" className="platform-secondary-button" onClick={() => setEditing("")}>Cancel</button>
                  </div>
                </div>}
              </article>)}
          </section>
          <section className="platform-section-card bl-questions">
            <SectionHeading number="04" title="Questions before implementation" description="Resolve these with the relevant EIG app owner."/>
            <ul>{blueprint.questions.map((question) => <li key={question}>{question}</li>)}</ul>
            <p className="bl-quiet">No feature is authorized for building, importing data, or publishing by this document alone.</p>
          </section>
          <section className="platform-section-card bl-exports">
            <SectionHeading number="05" title="Take your blueprint forward" description="Export a safe draft for discussion and review."/>
            <div className="bl-form-actions">
              <button type="button" className="platform-primary-button" onClick={() => exportFile("md")}>Download readable blueprint</button>
              <button type="button" className="platform-secondary-button" onClick={() => exportFile("json")}>Download reusable JSON</button>
            </div>
            <p className="bl-quiet">{needsBackup
              ? "Autosave failed. Download a reusable JSON backup before leaving."
              : "Your current working draft is stored only in this browser. Download reusable JSON for portable backup."}</p>
          </section>
        </>}
      </div>
    </div>
    </div>
  </main>;
}

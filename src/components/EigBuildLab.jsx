import React, { useEffect, useRef, useState } from "react";
import {
  BUILD_LAB_MODES, BUILD_LAB_REUSE, createBuildBlueprint,
  renderBuildBlueprintMarkdown, restoreBuildBlueprint, reviewBuildSuggestion, suggestBuildRevision,
} from "../lib/eigBuildArchitect.mjs";
import "./eig-build-lab.css";

const EMPTY_BRIEF = {
  name: "", goal: "", audience: "", currentProcess: "",
  referenceNotes: "", mode: "new_feature", reuse: "several",
};
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

export default function EigBuildLab({ onBack, onDirtyChange }) {
  const [brief, setBrief] = useState(EMPTY_BRIEF);
  const [blueprint, setBlueprint] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState("");
  const [editValue, setEditValue] = useState("");
  const [changeCount, setChangeCount] = useState(0);
  const [exportedCount, setExportedCount] = useState(0);
  const uploadRef = useRef(null);
  const dirty = changeCount !== exportedCount;

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function update(field, value) {
    setBrief((current) => ({ ...current, [field]: value }));
    setChangeCount((n) => n + 1);
    setNotice(""); setError("");
  }
  function startExample() {
    setBrief(EIG_PILOT);
    setBlueprint(null);
    setEditing("");
    setChangeCount((n) => n + 1);
    setNotice("EIG-owned pilot example loaded. Generate a blueprint to begin.");
    setError("");
  }
  function generate(event) {
    event.preventDefault();
    try {
      const next = createBuildBlueprint(brief, { revision: (blueprint?.version || 0) + 1 });
      setBlueprint(next); setEditing("");
      setChangeCount((n) => n + 1);
      setError(""); setNotice("Draft blueprint created. Review every proposed improvement before using it.");
    } catch (e) { setError(e.message); setNotice(""); }
  }
  function decide(id, action, value = "") {
    try {
      setBlueprint(reviewBuildSuggestion(blueprint, id, action, value));
      setChangeCount((n) => n + 1);
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
    if (format === "json") setExportedCount(changeCount);
    setNotice(format === "json"
      ? "Reusable JSON blueprint exported to your computer. This pilot does not save to a server."
      : "Readable blueprint exported. Download reusable JSON too if you want to reopen and edit this version later.");
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 60000) throw new Error("Choose a Build Lab JSON file smaller than 60 KB.");
      const restored = restoreBuildBlueprint(await file.text());
      setBrief(restored.brief); setBlueprint(restored);
      setEditing(""); setChangeCount(0); setExportedCount(0);
      setError(""); setNotice("Blueprint reopened from your local file. Review and regenerate if you change the goal.");
    } catch (e) { setError(e.message || "Unable to reopen this file."); setNotice(""); }
  }
  const acceptedCount = blueprint?.suggestions.filter((x) => ["accept", "edit"].includes(x.review)).length || 0;
  const pendingCount = blueprint?.suggestions.filter((x) => x.review === "pending").length || 0;

  return <main className="platform-page bl-app" aria-label="EIG Build Lab">
    <header className="platform-hero bl-hero">
      <div><p className="platform-eyebrow">EIG COMMAND CENTER / PRIVATE PILOT</p>
        <h1>Build Lab <span className="bl-subtitle">Project Architect</span></h1>
        <p>Define the goal. Find reusable tools. Review a blueprint before building.</p>
      </div>
      <div className="bl-hero-actions">
        <span className="bl-draft-tag">Local-only draft</span>
        <button type="button" className="platform-secondary-button" onClick={onBack}>← EIG Command Center</button>
      </div>
    </header>

    <p className="bl-disclosure" role="note">
      <strong>What this pilot does:</strong> Turns your description into a deterministic planning checklist and editable review.
      It does not scan websites, inspect code automatically, run AI, create issues, save to Supabase or change live apps.
      Do not enter passwords, private customer information or API secrets.
    </p>

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
            <p className="bl-quiet">{dirty ? "Unsaved changes in this browser. Download a new copy before leaving." : "Your current version has been exported or reopened from your computer."}</p>
          </section>
        </>}
      </div>
    </div>
  </main>;
}

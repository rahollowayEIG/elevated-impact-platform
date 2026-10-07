import React, { useEffect, useMemo, useRef, useState } from "react";
import FlyerEditor, { downloadCreative } from "./FlyerEditor.jsx";
import EventPacketStudio from "./EventPacketStudio.jsx";
import { inceptionStore } from "../lib/inceptionStore.js";
import {
  MATERIALS,
  FACT_FIELDS,
  materialById,
  materialDesign,
  newProject,
  cleanProjectData,
  projectBrief,
  projectHandoff,
  visibleProjects,
} from "../lib/inceptionProject.mjs";
import {
  eventFlyerFacts,
  flyerSvg,
  flyerOverflow,
} from "../lib/eventCreative.mjs";
import "./inception-apex.css";

const AutoResizer = React.lazy(() => import("./AutoResizer.jsx"));

const LABELS = {
  name: "Headline",
  date: "Date",
  time: "Time",
  venue: "Venue",
  address: "Address",
  description: "Description",
  food: "Food & beverage",
  prizes: "Gifts & prizes",
  contact: "Contact",
  registration: "Registration link",
};
function DesignPreview({ project }) {
  return (
    <img
      className="ia-thumbnail"
      alt={project.name + " artwork preview"}
      src={
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          flyerSvg(
            project.data.design,
            project.data.facts,
            project.status === "approved" ? "" : "DRAFT DESIGN",
          ),
        )
      }
    />
  );
}
function ArtworkPreview({ project, unsaved, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="ia-preview-dialog"
      aria-labelledby="ia-preview-title"
      onClose={onClose}
    >
      <header className="ia-preview-heading">
        <div>
          <h2 id="ia-preview-title">{project.name}</h2>
          <p>
            {materialById(project.material).label} · {project.data.design.width}{" "}
            × {project.data.design.height} pixels
          </p>
        </div>
        <button
          type="button"
          className="platform-secondary-button"
          onClick={() => dialog.current.close()}
          autoFocus
        >
          Close preview
        </button>
      </header>
      <p className="ia-preview-state">
        {unsaved
          ? "Unsaved preview. Save to My Designs to keep these changes."
          : project.status === "approved"
            ? "Approved design · Version " + project.version
            : "Saved draft · Version " + project.version}
      </p>
      <div className="ia-preview-artwork">
        <DesignPreview project={project} />
      </div>
    </dialog>
  );
}
function backup(project) {
  downloadCreative(
    JSON.stringify(
      {
        schema_version: 1,
        name: project.name,
        material: project.material,
        data: cleanProjectData(project.data),
      },
      null,
      2,
    ),
    "InceptionApex-Project.json",
    "application/json",
  );
}

export default function InceptionApex({
  initialEventId = "",
  store = inceptionStore,
  onBack,
  onDirtyChange,
  canUseResizer = false,
}) {
  const [resizerOpen, setResizerOpen] = useState(false);
  const [libraryOnly, setLibraryOnly] = useState(false);
  const [preview, setPreview] = useState(null);
  const [projects, setProjects] = useState([]),
    [events, setEvents] = useState([]),
    [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ field: "updated_at", ascending: false }),
    [newType, setNewType] = useState(""),
    [eventId, setEventId] = useState(initialEventId);
  const [name, setName] = useState(""),
    [planner, setPlanner] = useState(null),
    [plannerDirty, setPlannerDirty] = useState(false),
    [panel, setPanel] = useState("design");
  const inflight = useRef(false),
    revision = useRef(0),
    importInput = useRef(null);
  const hasUnsaved = dirty || plannerDirty;
  useEffect(() => {
    onDirtyChange?.(hasUnsaved);
    return () => onDirtyChange?.(false);
  }, [hasUnsaved, onDirtyChange]);
  useEffect(() => {
    const protect = (e) => {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [hasUnsaved]);
  useEffect(() => {
    let stopped = false;
    Promise.allSettled([store.list(), store.events()]).then(
      ([saved, accessible]) => {
        if (stopped) return;
        if (saved.status === "fulfilled") setProjects(saved.value);
        if (accessible.status === "fulfilled") setEvents(accessible.value);
        const failed = [saved, accessible].find((r) => r.status === "rejected");
        if (failed)
          setError(
            failed.reason.message || "Unable to load your design workspace.",
          );
        setLoading(false);
      },
    );
    return () => {
      stopped = true;
    };
  }, [store]);
  useEffect(() => {
    if (initialEventId) setEventId(initialEventId);
  }, [initialEventId]);
  const projectEvent = events.find((e) => e.id === project?.event_id);
  const contextEvent = events.find((e) => e.id === eventId);
  const eventNames = useMemo(
    () => new Map(events.map((e) => [e.id, e.name])),
    [events],
  );
  const visible = useMemo(
    () =>
      visibleProjects(
        projects.map((p) => ({
          ...p,
          event_name: eventNames.get(p.event_id) || "",
        })),
        query,
        filter,
        sort,
      ),
    [projects, query, filter, sort, eventNames],
  );
  function leave() {
    return (
      !hasUnsaved ||
      window.confirm(
        "Leave without saving your changes? Download a backup first if you want to keep them.",
      )
    );
  }
  function changeData(next) {
    revision.current++;
    setProject((p) => ({
      ...p,
      status: "draft",
      approved_at: null,
      data: next,
    }));
    setDirty(true);
    setNotice("");
    setError("");
  }
  function changeName(next) {
    revision.current++;
    setProject((p) => ({
      ...p,
      name: next,
      status: "draft",
      approved_at: null,
    }));
    setDirty(true);
    setNotice("");
  }
  async function open(p, previewOnly = false) {
    if (inflight.current || !leave()) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = store.read ? await store.read(p.id) : p;
      const opened = { ...saved, data: cleanProjectData(saved.data) };
      if (previewOnly) setPreview({ project: opened, unsaved: false });
      else {
        setProject(opened);
        setDirty(false);
        setPanel("design");
      }
    } catch (problem) {
      setError(problem.message || "Unable to open this project.");
    } finally {
      setBusy(false);
      inflight.current = false;
    }
  }
  function begin(type) {
    setNewType(type);
    setName("");
    setNotice("");
  }
  function create(e) {
    e.preventDefault();
    if (eventId && !contextEvent) {
      setError(
        "That event is unavailable. Choose an event you can manage or a personal project.",
      );
      return;
    }
    if (newType === "planner") {
      setPlanner(contextEvent);
      setNewType("");
      return;
    }
    const p = newProject(
      newType,
      contextEvent ? eventFlyerFacts(contextEvent, window.location.origin) : {},
    );
    p.name = name.trim() || p.name;
    p.event_id = contextEvent?.id || null;
    setProject(p);
    setDirty(true);
    setPanel("design");
    setNewType("");
    setError("");
  }
  async function persist(status = "draft") {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const started = revision.current,
      snapshot = { ...project, data: cleanProjectData(project.data) };
    try {
      if (!snapshot.name.trim()) throw new Error("Give your project a name.");
      if (
        status === "approved" &&
        (!snapshot.data.design.boxes.length ||
          flyerOverflow(snapshot.data.design, snapshot.data.facts).length)
      )
        throw new Error(
          "Give every text box enough space before approving the design.",
        );
      const saved = await store.save(snapshot, status);
      setProjects((rows) => [saved, ...rows.filter((r) => r.id !== saved.id)]);
      if (revision.current === started) {
        setProject(saved);
        setDirty(false);
      } else
        setProject((p) => ({ ...p, version: saved.version, status: "draft" }));
      setNotice(
        (status === "approved" ? "Design approved" : "Saved to My Designs") +
          ". Version " +
          saved.version +
          ".",
      );
    } catch (problem) {
      setError(
        problem.message ||
          "Unable to save. Download a project backup to keep your work.",
      );
    } finally {
      setBusy(false);
      inflight.current = false;
    }
  }
  async function attach() {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (dirty || project.status !== "approved")
        throw new Error(
          "Save and approve your latest design before attaching it.",
        );
      const result = await store.attach(project);
      setNotice(
        "Approved design attached to the event packet. Packet version " +
          result.packet_version +
          ".",
      );
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
      inflight.current = false;
    }
  }
  async function importBackup(e) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 4500000)
        throw new Error("Use a project backup under 4.5 MB.");
      const value = JSON.parse(await file.text());
      if (value.schema_version !== 1)
        throw new Error("Choose an InceptionApex project backup.");
      materialById(value.material);
      const data = cleanProjectData(value.data);
      const p = newProject(value.material);
      p.name = String(value.name || "Imported design").slice(0, 160);
      p.data = data;
      if (!leave()) return;
      setProject(p);
      setDirty(true);
      setPanel("design");
      setNotice(
        "Imported as a new personal project. Save to keep it in your workspace.",
      );
      setError("");
    } catch (problem) {
      setError(problem.message || "Unable to import this backup.");
    } finally {
      e.target.value = "";
    }
  }
  function sortBy(field) {
    setSort((s) => ({
      field,
      ascending: s.field === field ? !s.ascending : true,
    }));
  }
  function closeProject() {
    if (!leave()) return;
    setLibraryOnly(true);
    setNewType("");
    setProject(null);
    setResizerOpen(false);
    setDirty(false);
    setPlanner(null);
    setPlannerDirty(false);
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="platform-page ia-app">
      <header className="ia-header">
        <div className="ia-wordmark">
          <span className="ia-mark" aria-hidden="true">
            IA
          </span>
          <div>
            <p>Elevated Impact Group</p>
            <h1>InceptionApex</h1>
          </div>
        </div>
        <div className="ia-actions">
          {libraryOnly && !project && !planner && !resizerOpen && (
            <button
              type="button"
              className="platform-primary-button"
              onClick={() => setLibraryOnly(false)}
            >
              New design
            </button>
          )}
          <button
            type="button"
            className="platform-secondary-button"
            disabled={busy}
            onClick={closeProject}
            aria-pressed={libraryOnly && !project && !planner && !resizerOpen}
          >
            My Designs
          </button>
          {onBack && (
            <button
              type="button"
              className="platform-secondary-button"
              disabled={busy}
              onClick={() => {
                if (leave()) onBack();
              }}
            >
              Back to workspace
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="platform-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="ia-notice" role="status">
          {notice}
        </p>
      )}
      {loading && <p role="status">Opening your design workspace…</p>}
      {busy && !project && <p role="status">Opening design…</p>}
      {resizerOpen && canUseResizer ? (
        <React.Suspense fallback={<p role="status">Opening Auto Resizer…</p>}>
          <AutoResizer allowed={canUseResizer} />
        </React.Suspense>
      ) : planner ? (
        <EventPacketStudio event={planner} onDirtyChange={setPlannerDirty} />
      ) : project ? (
        <>
          <section className="ia-project-bar">
            <label>
              Project name
              <input
                value={project.name}
                maxLength={160}
                onChange={(e) => changeName(e.target.value)}
              />
            </label>
            <div className="ia-project-state">
              <span>
                {materialById(project.material).label} ·{" "}
                {projectEvent?.name ||
                  (project.event_id ? "Event project" : "Personal project")}
              </span>
              <strong>
                {dirty
                  ? "Unsaved changes"
                  : project.status === "approved"
                    ? "Approved · Version " + project.version
                    : "Saved · Version " + project.version}
              </strong>
            </div>
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() => setPreview({ project, unsaved: dirty })}
            >
              View Preview
            </button>
            <button
              type="button"
              className="platform-primary-button"
              disabled={busy || (!dirty && project.version > 0)}
              onClick={() => persist()}
            >
              Save to My Designs
            </button>
          </section>
          <nav className="ia-editor-tabs" aria-label="Design workspace">
            {[
              ["design", "Design"],
              ["details", "Details & creative direction"],
              ["proof", "Preview & approve"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={panel === id}
                onClick={() => setPanel(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          {panel === "design" && (
            <FlyerEditor
              key={project.id}
              design={project.data.design}
              facts={project.data.facts}
              onChange={(design) => changeData({ ...project.data, design })}
              createTemplate={(theme) =>
                materialDesign(project.material, theme)
              }
              artifactLabel={materialById(project.material).label.toLowerCase()}
              draftLabel={
                project.status === "approved" && !dirty ? "" : "DRAFT DESIGN"
              }
              brief={projectBrief(project)}
            />
          )}
          {panel === "details" && (
            <section className="ia-details">
              <div>
                <h2>What should this design say?</h2>
                {projectEvent && (
                  <button
                    type="button"
                    className="platform-secondary-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Refresh the text from the event? This replaces your project text, while keeping its layout.",
                        )
                      )
                        changeData({
                          ...project.data,
                          facts: eventFlyerFacts(
                            projectEvent,
                            window.location.origin,
                          ),
                        });
                    }}
                  >
                    Refresh event details
                  </button>
                )}
                <div className="ia-fields">
                  {FACT_FIELDS.map((key) => (
                    <label key={key}>
                      {LABELS[key]}
                      <textarea
                        rows={key === "description" ? 3 : 1}
                        maxLength={1500}
                        aria-label={LABELS[key]}
                        value={project.data.facts[key] || ""}
                        onChange={(e) =>
                          changeData({
                            ...project.data,
                            facts: {
                              ...project.data.facts,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h2>Make it your own</h2>
                <label>
                  Creative direction
                  <textarea
                    rows={5}
                    maxLength={4000}
                    aria-label="Creative direction"
                    placeholder="Style, colors, mood, and details you love"
                    value={project.data.brief}
                    onChange={(e) =>
                      changeData({ ...project.data, brief: e.target.value })
                    }
                  />
                </label>
                <label>
                  Product or output
                  <input
                    maxLength={160}
                    placeholder="Tee sign, shirt artwork, invitation…"
                    value={project.data.production.product}
                    onChange={(e) =>
                      changeData({
                        ...project.data,
                        production: {
                          ...project.data.production,
                          product: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Finished size / imprint area
                  <input
                    maxLength={160}
                    placeholder="Enter the supplier's actual dimensions"
                    value={project.data.production.size}
                    onChange={(e) =>
                      changeData({
                        ...project.data,
                        production: {
                          ...project.data.production,
                          size: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Production notes
                  <textarea
                    rows={3}
                    maxLength={1500}
                    value={project.data.production.notes}
                    onChange={(e) =>
                      changeData({
                        ...project.data,
                        production: {
                          ...project.data.production,
                          notes: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="ia-check">
                  <input
                    type="checkbox"
                    checked={project.data.favorite}
                    onChange={(e) =>
                      changeData({
                        ...project.data,
                        favorite: e.target.checked,
                      })
                    }
                  />{" "}
                  Save as a favorite
                </label>
                {project.material === "book" && (
                  <p>
                    This project is the book cover. Interior pages and multipage
                    editing are still being set up.
                  </p>
                )}
                {project.material === "swag" && (
                  <p>
                    This is your imprint artwork. Product photographs and
                    supplier proofs will be available when the product catalog
                    is connected.
                  </p>
                )}
                <p>
                  AI generation is being connected. You can download the
                  creative brief and upload finished artwork now.
                </p>
                <button
                  type="button"
                  className="platform-secondary-button"
                  onClick={() =>
                    downloadCreative(
                      projectBrief(project),
                      "InceptionApex-Creative-Brief.txt",
                      "text/plain",
                    )
                  }
                >
                  Download creative brief
                </button>
              </div>
            </section>
          )}
          {panel === "proof" && (
            <section className="ia-proof">
              <DesignPreview project={project} />
              <div>
                <h2>Preview your artwork</h2>
                <p>
                  {project.data.design.width} × {project.data.design.height}{" "}
                  pixels
                </p>
                <p>
                  Check wording, logos, placement and the supplier's finished
                  size before approving.
                </p>
                {!!flyerOverflow(project.data.design, project.data.facts)
                  .length && (
                  <p role="alert">
                    Some text needs more space. Adjust it in the designer before
                    approval.
                  </p>
                )}
                <button
                  type="button"
                  className="platform-primary-button"
                  disabled={
                    busy ||
                    (!dirty && project.status === "approved") ||
                    !project.data.design.boxes.length ||
                    !!flyerOverflow(project.data.design, project.data.facts)
                      .length
                  }
                  onClick={() => persist("approved")}
                >
                  Save & approve design
                </button>
                {project.event_id && (
                  <button
                    type="button"
                    className="platform-secondary-button"
                    disabled={busy || dirty || project.status !== "approved"}
                    onClick={attach}
                  >
                    Attach to event packet
                  </button>
                )}
                <button
                  type="button"
                  className="platform-secondary-button"
                  disabled={dirty || project.status !== "approved"}
                  onClick={() => {
                    try {
                      downloadCreative(
                        JSON.stringify(projectHandoff(project), null, 2),
                        "InceptionApex-Order-Request.json",
                        "application/json",
                      );
                    } catch (problem) {
                      setError(problem.message);
                    }
                  }}
                >
                  Download production request
                </button>
                <p>
                  Production requests are saved plans. Ordering and payment will
                  become available when the store is connected.
                </p>
              </div>
            </section>
          )}
          <div className="ia-backup">
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() => backup(project)}
            >
              Download project backup
            </button>
            <span>
              Keep a copy of your current work, including unsaved edits.
            </span>
          </div>
        </>
      ) : (
        !loading && (
          <>
            {!libraryOnly && (
              <>
                <section className="ia-start">
                  <div>
                    <p className="ia-kicker">CREATE SOMETHING YOU LOVE</p>
                    <h2>What are we designing?</h2>
                  </div>
                  <button
                    type="button"
                    className="platform-secondary-button"
                    onClick={() => importInput.current.click()}
                  >
                    Import project backup
                  </button>
                </section>
                <input
                  ref={importInput}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  aria-label="Import project backup file"
                  onChange={importBackup}
                />
                <section className="ia-materials" aria-label="Start a design">
                  {MATERIALS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={"ia-material ia-material-" + m.id}
                      onClick={() => begin(m.id)}
                    >
                      <span className="ia-material-code" aria-hidden="true">
                        {m.code}
                      </span>
                      <strong>{m.label}</strong>
                      <span>{m.detail}</span>
                      <b>Customize</b>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="ia-material ia-planner"
                    onClick={() => begin("planner")}
                  >
                    <span className="ia-material-code" aria-hidden="true">
                      MP
                    </span>
                    <strong>Maps & venue layouts</strong>
                    <span>Plan on your actual venue</span>
                    <b>Open event planner</b>
                  </button>
                </section>
                {newType && (
                  <form className="ia-new-project" onSubmit={create}>
                    <h2>
                      {newType === "planner"
                        ? "Choose an event to plan"
                        : "Start your " +
                          materialById(newType).label.toLowerCase()}
                    </h2>
                    <label>
                      Connect to an event
                      <select
                        aria-label="Connect to an event"
                        value={eventId}
                        onChange={(e) => setEventId(e.target.value)}
                        required={newType === "planner"}
                      >
                        <option value="">
                          {newType === "planner"
                            ? "Choose an event"
                            : "Personal project · no event"}
                        </option>
                        {events.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {newType !== "planner" && (
                      <label>
                        Project name
                        <input
                          maxLength={160}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Optional · we can fill this in"
                        />
                      </label>
                    )}
                    <div className="ia-actions">
                      <button
                        type="submit"
                        className="platform-primary-button"
                        disabled={newType === "planner" && !contextEvent}
                      >
                        {newType === "planner"
                          ? "Open planner"
                          : "Open designer"}
                      </button>
                      <button
                        type="button"
                        className="platform-secondary-button"
                        onClick={() => setNewType("")}
                      >
                        Cancel
                      </button>
                    </div>
                    {newType === "planner" && !events.length && (
                      <p>
                        An event you are authorized to manage is required for
                        course pins and venue layouts.
                      </p>
                    )}
                  </form>
                )}
                {canUseResizer && (
                  <section
                    className="ia-team-tools"
                    aria-label="EIG team tools"
                  >
                    <div>
                      <p className="ia-kicker">EIG TEAM TOOLS</p>
                      <h2>Auto Resizer</h2>
                      <p>
                        Prepare images for Shopify, the EIG website and
                        displays.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="platform-primary-button"
                      onClick={() => {
                        setResizerOpen(true);
                        setNotice("");
                        setError("");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Open Auto Resizer
                    </button>
                  </section>
                )}
              </>
            )}
            <section className="ia-library" aria-label="My Designs">
              <div className="ia-library-heading">
                <div>
                  <p className="ia-kicker">YOUR WORKSPACE</p>
                  <h2>My Designs</h2>
                </div>
                <span>
                  {visible.length} of {projects.length} saved designs
                </span>
              </div>
              <div className="ia-library-controls">
                <label>
                  Search designs
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Project, event, or material"
                  />
                </label>
                <label>
                  Show
                  <select
                    aria-label="Show"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All designs</option>
                    <option value="draft">Drafts</option>
                    <option value="approved">Approved</option>
                    <option value="favorites">Favorites</option>
                  </select>
                </label>
              </div>
              {visible.length ? (
                <div className="ia-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          ["name", "Project"],
                          ["material", "Material"],
                          ["status", "Status"],
                          ["updated_at", "Updated"],
                        ].map(([field, label]) => (
                          <th
                            key={field}
                            aria-sort={
                              sort.field === field
                                ? sort.ascending
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                          >
                            <button type="button" onClick={() => sortBy(field)}>
                              {label}
                              {sort.field === field
                                ? sort.ascending
                                  ? " ↑"
                                  : " ↓"
                                : ""}
                            </button>
                          </th>
                        ))}
                        <th>Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <button
                              type="button"
                              className="ia-project-link"
                              disabled={busy}
                              onClick={() => open(p)}
                            >
                              <span
                                className="ia-library-code"
                                aria-hidden="true"
                              >
                                {materialById(p.material).code}
                              </span>
                              <span>
                                <strong>{p.name}</strong>
                                <small>
                                  {p.event_name || "Personal project"}
                                  {p.data.favorite ? " · Favorite" : ""}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td>{materialById(p.material).label}</td>
                          <td>
                            <span className={"ia-status " + p.status}>
                              {p.status}
                            </span>
                          </td>
                          <td>{new Date(p.updated_at).toLocaleDateString()}</td>
                          <td>
                            <button
                              type="button"
                              className="platform-secondary-button"
                              disabled={busy}
                              aria-label={"View Preview of " + p.name}
                              onClick={() => open(p, true)}
                            >
                              View Preview
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="ia-empty">
                  <strong>
                    {projects.length
                      ? "No matching designs."
                      : "Your next idea starts here."}
                  </strong>
                  <p>
                    {projects.length
                      ? "Try a different search or filter."
                      : libraryOnly
                        ? "Choose New design to get started. Your saved designs will appear here."
                        : "Choose a material above. Your saved designs will appear here."}
                  </p>
                </div>
              )}
            </section>
            <footer className="ia-connections">
              <strong>Creative tools</strong>
              <span>OpenAI · connection pending</span>
              <span>Adobe · connection pending</span>
              <span>Canva · connection pending</span>
              <span>Ordering · connection pending</span>
            </footer>
          </>
        )
      )}
      {preview && (
        <ArtworkPreview
          project={preview.project}
          unsaved={preview.unsaved}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

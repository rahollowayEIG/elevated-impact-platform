import React, { useEffect, useRef, useState } from "react";
import {
  RESIZE_PRESETS,
  resizeDimensions,
  imagePlacement,
} from "../lib/imageResize.mjs";
import "./auto-resizer.css";

import {
  openResizeImage,
  encodeResizeImage,
  buildResizeBatch,
  changeInstructions,
  downloadResizeFile,
  MAX_IMAGES,
  MAX_INPUT_BYTES,
} from "../lib/imageResizeBrowser.mjs";
import { saveResizeToDrive } from "../lib/inceptionDrive.js";
const GROUPS = [...new Set(RESIZE_PRESETS.map((p) => p.group))];

export default function AutoResizer({
  allowed = false,
  drive = saveResizeToDrive,
}) {
  const [images, setImages] = useState([]),
    [selectedId, setSelectedId] = useState("");
  const [image, setImage] = useState(null),
    [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState(null);
  const [presetId, setPresetId] = useState("shopify-product"),
    [customWidth, setCustomWidth] = useState("1200"),
    [customHeight, setCustomHeight] = useState("1200");
  const [mode, setMode] = useState("fit"),
    [format, setFormat] = useState("png"),
    [transparent, setTransparent] = useState(true),
    [background, setBackground] = useState("#ffffff"),
    [quality, setQuality] = useState(0.9);
  const [output, setOutput] = useState(null),
    [encoding, setEncoding] = useState(false),
    [error, setError] = useState("");
  const [batch, setBatch] = useState(null),
    [savingDrive, setSavingDrive] = useState(false),
    [driveResult, setDriveResult] = useState(null);
  const selected = images.find((i) => i.id === selectedId);
  const focal = selected?.focal || { x: 0.5, y: 0.5 },
    zoom = selected?.zoom || 1,
    changeNotes = selected?.notes || "";
  const originalCanvas = useRef(null),
    uploadEpoch = useRef(0),
    outputEpoch = useRef(0),
    batchAbort = useRef(null),
    alive = useRef(true),
    driveRequests = useRef(new Map());
  const busy = uploading || !!batch || savingDrive;
  function updateSelected(field, value) {
    setImages((items) =>
      items.map((i) =>
        i.id === selectedId
          ? {
              ...i,
              [field]: typeof value === "function" ? value(i[field]) : value,
            }
          : i,
      ),
    );
  }
  const setFocal = (value) => updateSelected("focal", value),
    setZoom = (value) => updateSelected("zoom", value),
    setChangeNotes = (value) => updateSelected("notes", value);
  const preset = RESIZE_PRESETS.find((p) => p.id === presetId);
  const width = presetId === "custom" ? customWidth : preset.width,
    height = presetId === "custom" ? customHeight : preset.height;
  let dimensions = null,
    dimensionsError = "";
  try {
    dimensions = resizeDimensions(width, height);
  } catch (e) {
    dimensionsError = e.message;
  }
  const settings = {
    width: Number(width),
    height: Number(height),
    presetId,
    mode,
    format,
    transparent,
    background,
    quality,
    destination: `${preset.group} / ${preset.label}`,
  };
  const placement =
    image && dimensions
      ? imagePlacement(
          image.width,
          image.height,
          dimensions.width,
          dimensions.height,
          mode,
          focal.x,
          focal.y,
          zoom,
        )
      : null;
  const visible = images.filter((i) =>
    i.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  if (sort)
    visible.sort(
      (a, b) =>
        sort.direction *
        (sort.key === "name"
          ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          : a.file.size - b.file.size),
    );
  function sortBy(key) {
    setSort((current) => ({
      key,
      direction: current?.key === key ? -current.direction : 1,
    }));
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      uploadEpoch.current++;
      outputEpoch.current++;
      batchAbort.current?.abort();
    };
  }, []);
  useEffect(
    () => () => {
      image?.bitmap.close();
    },
    [image],
  );
  useEffect(
    () => () => {
      if (output?.url) URL.revokeObjectURL(output.url);
    },
    [output],
  );
  useEffect(() => {
    let cancelled = false;
    setImage(null);
    if (!allowed || !selected) return;
    openResizeImage(selected.file)
      .then((bitmap) => {
        if (cancelled) bitmap.close();
        else
          setImage({
            bitmap,
            id: selected.id,
            name: selected.name,
            width: bitmap.width,
            height: bitmap.height,
          });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, selectedId, selected?.file]);
  useEffect(() => {
    if (!allowed || !image || !originalCanvas.current) return;
    const canvas = originalCanvas.current,
      scale = Math.min(1, 500 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas
      .getContext("2d")
      .drawImage(image.bitmap, 0, 0, canvas.width, canvas.height);
  }, [image, allowed]);
  useEffect(() => {
    const epoch = ++outputEpoch.current;
    setOutput(null);
    if (!allowed || !image || image.id !== selectedId || !dimensions) {
      setEncoding(false);
      return;
    }
    setEncoding(true);
    encodeResizeImage(image.bitmap, settings, selected)
      .then((result) => {
        if (epoch !== outputEpoch.current) return;
        setOutput({ ...result, url: URL.createObjectURL(result.blob) });
        setEncoding(false);
      })
      .catch((e) => {
        if (epoch === outputEpoch.current) {
          setError(e.message);
          setEncoding(false);
        }
      });
    return () => {
      outputEpoch.current++;
    };
  }, [
    allowed,
    image,
    selectedId,
    width,
    height,
    mode,
    focal.x,
    focal.y,
    zoom,
    format,
    transparent,
    background,
    quality,
    presetId,
  ]);

  async function upload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!allowed || !files.length || busy) return;
    const epoch = ++uploadEpoch.current;
    setUploading(true);
    setError("");
    setDriveResult(null);
    try {
      if (files.length > MAX_IMAGES)
        throw new Error("Choose up to 20 images at a time.");
      if (files.reduce((sum, f) => sum + f.size, 0) > MAX_INPUT_BYTES)
        throw new Error("Choose a batch of 100 MB or less.");
      const valid = [],
        skipped = [];
      for (const file of files) {
        let bitmap;
        try {
          bitmap = await openResizeImage(file);
          if (epoch !== uploadEpoch.current) return;
          valid.push({
            id: crypto.randomUUID(),
            file,
            name: file.name,
            width: bitmap.width,
            height: bitmap.height,
            focal: { x: 0.5, y: 0.5 },
            zoom: 1,
            notes: "",
          });
        } catch (e) {
          skipped.push(`${file.name}: ${e.message}`);
        } finally {
          bitmap?.close();
        }
      }
      if (epoch !== uploadEpoch.current) return;
      if (valid.length) {
        setImages(valid);
        setSelectedId(valid[0].id);
        setSearch("");
        setSort(null);
      }
      if (skipped.length)
        setError(
          `Skipped ${skipped.length} file${skipped.length === 1 ? "" : "s"}. ${skipped.join(" ")}`,
        );
    } catch (e) {
      if (epoch === uploadEpoch.current) setError(e.message);
    } finally {
      if (epoch === uploadEpoch.current) setUploading(false);
    }
  }
  function removeImage(id) {
    const remaining = images.filter((i) => i.id !== id);
    setImages(remaining);
    if (selectedId === id) setSelectedId(remaining[0]?.id || "");
  }
  async function makeBatch() {
    const controller = new AbortController();
    batchAbort.current = controller;
    setBatch({ completed: 0, total: images.length, name: "" });
    try {
      return await buildResizeBatch(images, settings, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (alive.current) setBatch(progress);
        },
      });
    } finally {
      batchAbort.current = null;
      if (alive.current) setBatch(null);
    }
  }
  async function exportBatch(toDrive = false) {
    if (busy || !dimensions || images.length < 2) return;
    setError("");
    setDriveResult(null);
    try {
      const archive = await makeBatch();
      if (!alive.current) return;
      if (toDrive) await saveDrive(archive);
      else downloadResizeFile(archive);
    } catch (e) {
      if (alive.current && e.name !== "AbortError") setError(e.message);
    }
  }
  async function saveDrive(file = output) {
    if (!file || !allowed) return;
    setSavingDrive(true);
    setDriveResult(null);
    setError("");
    try {
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.blob.arrayBuffer()),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      const key = `${file.filename}:${digest}`;
      // Reuse the request ID after an uncertain result so retry never silently creates a second Drive file.
      if (!driveRequests.current.has(key))
        driveRequests.current.set(key, crypto.randomUUID());
      const result = await drive({
        ...file,
        requestId: driveRequests.current.get(key),
      });
      if (alive.current) setDriveResult({ ...result, filename: file.filename });
    } catch (e) {
      if (alive.current)
        setError(
          e.message ||
            "Google Drive could not save this file. Your download is still available.",
        );
    } finally {
      if (alive.current) setSavingDrive(false);
    }
  }
  function choosePreset(value) {
    const next = RESIZE_PRESETS.find((p) => p.id === value);
    setPresetId(value);
    setMode(next.mode);
    setImages((items) => items.map((i) => ({ ...i, zoom: 1 })));
    setError("");
  }
  function chooseFocal(event) {
    const rect = originalCanvas.current.getBoundingClientRect();
    setFocal({
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    });
  }
  function moveFocal(event) {
    const delta = {
      ArrowLeft: [-0.02, 0],
      ArrowRight: [0.02, 0],
      ArrowUp: [0, -0.02],
      ArrowDown: [0, 0.02],
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    setFocal((p) => ({
      x: Math.max(0, Math.min(1, p.x + delta[0])),
      y: Math.max(0, Math.min(1, p.y + delta[1])),
    }));
  }
  function download() {
    if (!allowed || busy || encoding || !output || dimensionsError) return;
    downloadResizeFile(output);
  }
  function downloadNotes() {
    if (!output || busy || encoding || !changeNotes.trim()) return;
    downloadResizeFile({
      blob: new Blob([changeInstructions(selected, output, settings)], {
        type: "text/plain;charset=utf-8",
      }),
      filename: output.filename.replace(/\.[^.]+$/, "_changes.txt"),
    });
  }
  if (!allowed) return null;
  return (
    <section className="ia-resizer" aria-labelledby="resizer-title">
      <div className="ia-resizer-title">
        <div>
          <p className="ia-kicker">EIG TEAM TOOLS</p>
          <h2 id="resizer-title">Auto Resizer</h2>
          <p>One image or a whole batch. Ready for your destination.</p>
        </div>
        <span className="ia-resizer-badge">EIG access</span>
      </div>
      <div className="ia-resizer-grid">
        <fieldset className="ia-resizer-controls" disabled={busy}>
          <label>
            Upload images
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
            />
          </label>
          <p className="ia-resizer-help">
            PNG, JPEG or WebP · up to 20 images, 20 MB / 25 MP each, 100 MB
            total. Selecting files replaces the current batch. Resizing happens
            in your browser; files are uploaded only when you choose Google
            Drive. Animated files become still images.
          </p>
          {images.length > 0 && (
            <div className="ia-resizer-queue">
              <p>
                <strong>
                  {images.length} image{images.length === 1 ? "" : "s"}
                </strong>{" "}
                · Shared destination and format; crop and notes are per image.
              </p>
              {images.length > 1 && (
                <label>
                  Find an image
                  <input
                    type="search"
                    aria-label="Find an image"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              )}
              <div className="ia-resizer-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th
                        aria-sort={
                          sort?.key === "name"
                            ? sort.direction === 1
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button type="button" onClick={() => sortBy("name")}>
                          Image{" "}
                          {sort?.key === "name" &&
                            (sort.direction === 1 ? "↑" : "↓")}
                        </button>
                      </th>
                      <th
                        aria-sort={
                          sort?.key === "size"
                            ? sort.direction === 1
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button type="button" onClick={() => sortBy("size")}>
                          Size{" "}
                          {sort?.key === "size" &&
                            (sort.direction === 1 ? "↑" : "↓")}
                        </button>
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <button
                            type="button"
                            aria-pressed={i.id === selectedId}
                            onClick={() => setSelectedId(i.id)}
                          >
                            {i.name}
                          </button>
                          <small>
                            {i.width} × {i.height}
                          </small>
                        </td>
                        <td>{(i.file.size / 1024).toFixed(0)} KB</td>
                        <td>
                          <button
                            type="button"
                            aria-label={`Remove ${i.name}`}
                            onClick={() => removeImage(i.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ia-resizer-help">
                {visible.length} of {images.length} shown. Batch exports include
                all {images.length} images, including those hidden by search.
              </p>
              {!visible.length && <p>No images match your search.</p>}
            </div>
          )}
          <label>
            Where will this image be used?
            <select
              aria-label="Image destination"
              value={presetId}
              onChange={(e) => choosePreset(e.target.value)}
            >
              {GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {RESIZE_PRESETS.filter((p) => p.group === group).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <p className="ia-resizer-help">
            {preset.note}{" "}
            {preset.source && (
              <a href={preset.source} target="_blank" rel="noreferrer">
                Shopify size guide
              </a>
            )}
          </p>
          {presetId === "custom" ? (
            <div className="ia-resizer-pair">
              <label>
                Width (pixels)
                <input
                  type="number"
                  min="1"
                  max="4096"
                  step="1"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                />
              </label>
              <label>
                Height (pixels)
                <input
                  type="number"
                  min="1"
                  max="4096"
                  step="1"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <strong>
              {width} × {height} pixels
            </strong>
          )}
          {dimensionsError && (
            <p role="alert" className="platform-error">
              {dimensionsError}
            </p>
          )}
          <label>
            Image framing
            <select
              aria-label="Image framing"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="fit">Fit entire image — add padding</option>
              <option value="crop">Fill the frame — crop edges</option>
            </select>
          </label>
          {mode === "crop" && (
            <>
              <p className="ia-resizer-help">
                Click the focal point on the original, use its arrow keys, or
                adjust these sliders.
              </p>
              <label>
                Horizontal focal point ({Math.round(focal.x * 100)}%)
                <input
                  aria-label="Horizontal focal point"
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={focal.x}
                  onChange={(e) =>
                    setFocal((p) => ({ ...p, x: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                Vertical focal point ({Math.round(focal.y * 100)}%)
                <input
                  aria-label="Vertical focal point"
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={focal.y}
                  onChange={(e) =>
                    setFocal((p) => ({ ...p, y: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                Zoom ({Number(zoom).toFixed(1)}×)
                <input
                  aria-label="Crop zoom"
                  type="range"
                  min="1"
                  max="3"
                  step=".1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                className="platform-secondary-button"
                onClick={() => {
                  setFocal({ x: 0.5, y: 0.5 });
                  setZoom(1);
                }}
              >
                Reset crop
              </button>
            </>
          )}
          <label>
            Export format
            <select
              aria-label="Export format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="png">PNG — logos and transparency</option>
              <option value="jpeg">JPEG — smaller photo files</option>
              <option value="webp">WebP — compact website images</option>
            </select>
          </label>
          {format !== "jpeg" && (
            <label className="ia-check">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              Keep transparency
            </label>
          )}
          {(!transparent || format === "jpeg") && (
            <label>
              Padding / background color
              <input
                type="color"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
              />
            </label>
          )}
          {format !== "png" && (
            <label>
              Export quality ({Math.round(quality * 100)}%)
              <input
                aria-label="Export quality"
                type="range"
                min=".4"
                max="1"
                step=".05"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </label>
          )}
          <label>
            Describe the changes you want
            <textarea
              aria-label="Describe the changes you want"
              rows="4"
              maxLength="3000"
              disabled={!selected}
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="Keep the whole logo, move the focus to Ella and the dogs, leave room for sponsor text…"
            />
          </label>
          <p className="ia-resizer-help">
            Use these notes for the next edit. Resize and crop with the controls
            above. AI edits: connection pending.
          </p>
          {error && (
            <div className="platform-error" role="alert">
              {error}
            </div>
          )}
          <button
            type="button"
            className="platform-primary-button"
            disabled={!output || encoding || busy || !!dimensionsError}
            onClick={download}
          >
            Download resized image
          </button>
          <button
            type="button"
            className="platform-secondary-button"
            disabled={
              !output ||
              encoding ||
              uploading ||
              !!dimensionsError ||
              !changeNotes.trim()
            }
            onClick={downloadNotes}
          >
            Download change instructions
          </button>
          <button
            type="button"
            className="platform-secondary-button"
            disabled={!output || encoding || busy || !!dimensionsError}
            onClick={() => saveDrive()}
          >
            Add to Google Drive
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                className="platform-primary-button"
                disabled={!dimensions || busy}
                onClick={() => exportBatch()}
              >
                Download batch ZIP ({images.length} images)
              </button>
              <button
                type="button"
                className="platform-secondary-button"
                disabled={!dimensions || busy}
                onClick={() => exportBatch(true)}
              >
                Add batch to Google Drive
              </button>
            </>
          )}
          <p className="ia-resizer-help">
            Drive saves to EIG’s connected shared folder: Hangars / Elevated
            Impact Group / InceptionApex / Resized Images. Batch ZIPs include
            change notes and a size manifest; up to 50 MB per ZIP. My Designs
            holds editable projects.
          </p>
        </fieldset>
        <div className="ia-resizer-previews" aria-live="polite">
          {batch && (
            <div className="ia-resizer-job">
              <p role="status">
                Preparing batch {batch.completed} / {batch.total} · {batch.name}
              </p>
              <progress value={batch.completed} max={batch.total} />
              <button
                type="button"
                className="platform-secondary-button"
                onClick={() => batchAbort.current?.abort()}
              >
                Cancel batch
              </button>
            </div>
          )}
          {savingDrive && <p role="status">Saving to EIG Google Drive…</p>}
          {driveResult && (
            <div className="ia-resizer-job" role="status">
              <strong>Saved to Google Drive</strong>
              <p className="ia-resizer-filename">{driveResult.filename}</p>
              <a href={driveResult.url} target="_blank" rel="noreferrer">
                Open in Google Drive
              </a>
            </div>
          )}
          {uploading && <p role="status">Opening image…</p>}
          {image ? (
            <>
              <div className="ia-resizer-original">
                <h3>
                  {image.name} · Original · {image.width} × {image.height}
                </h3>
                <button
                  type="button"
                  className="ia-focal-image"
                  aria-label="Choose focal point on original image"
                  disabled={mode !== "crop" || busy}
                  onClick={chooseFocal}
                  onKeyDown={moveFocal}
                >
                  <canvas ref={originalCanvas} />
                  {mode === "crop" && (
                    <span
                      className="ia-focal-marker"
                      style={{
                        left: `${focal.x * 100}%`,
                        top: `${focal.y * 100}%`,
                      }}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  )}
                </button>
              </div>
              <div>
                <h3>Destination preview</h3>
                {encoding && <p role="status">Preparing resized image…</p>}
                {output && (
                  <>
                    <img
                      className="ia-resized-image"
                      src={output.url}
                      alt="Resized image preview"
                    />
                    <p>
                      {output.width} × {output.height} pixels ·{" "}
                      {(output.blob.size / 1024).toFixed(0)} KB ·{" "}
                      {format.toUpperCase()}
                    </p>
                    <p className="ia-resizer-filename">{output.filename}</p>
                  </>
                )}
                {placement?.scale > 1 && (
                  <p className="ia-resizer-help">
                    This size enlarges the original. Resizing cannot restore
                    missing detail; use a larger source for a sharper result.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="ia-resizer-empty">
              <strong>Upload an image to begin.</strong>
              <p>
                Choose its destination and check the preview before downloading.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

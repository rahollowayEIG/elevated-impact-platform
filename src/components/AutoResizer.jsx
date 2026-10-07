import React, { useEffect, useRef, useState } from "react";
import {
  RESIZE_PRESETS,
  resizeDimensions,
  imagePlacement,
  resizeFilename,
} from "../lib/imageResize.mjs";
import "./auto-resizer.css";

const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
const GROUPS = [...new Set(RESIZE_PRESETS.map((p) => p.group))];

export default function AutoResizer({ allowed = false }) {
  const [image, setImage] = useState(null),
    [uploading, setUploading] = useState(false);
  const [presetId, setPresetId] = useState("shopify-product"),
    [customWidth, setCustomWidth] = useState("1200"),
    [customHeight, setCustomHeight] = useState("1200");
  const [mode, setMode] = useState("fit"),
    [format, setFormat] = useState("png"),
    [transparent, setTransparent] = useState(true),
    [background, setBackground] = useState("#ffffff");
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 }),
    [zoom, setZoom] = useState(1),
    [quality, setQuality] = useState(0.9);
  const [output, setOutput] = useState(null),
    [encoding, setEncoding] = useState(false),
    [error, setError] = useState("");
  const [changeNotes, setChangeNotes] = useState("");
  const originalCanvas = useRef(null),
    uploadEpoch = useRef(0),
    outputEpoch = useRef(0);
  const preset = RESIZE_PRESETS.find((p) => p.id === presetId);
  const width = presetId === "custom" ? customWidth : preset.width;
  const height = presetId === "custom" ? customHeight : preset.height;
  let dimensions = null,
    dimensionsError = "";
  try {
    dimensions = resizeDimensions(width, height);
  } catch (e) {
    dimensionsError = e.message;
  }
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

  useEffect(
    () => () => {
      uploadEpoch.current++;
      outputEpoch.current++;
    },
    [],
  );
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
    if (!allowed || !image || !dimensions) {
      setEncoding(false);
      return;
    }
    setEncoding(true);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d");
    if (!transparent || format === "jpeg") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const p = imagePlacement(
      image.width,
      image.height,
      canvas.width,
      canvas.height,
      mode,
      focal.x,
      focal.y,
      zoom,
    );
    ctx.drawImage(image.bitmap, p.x, p.y, p.drawWidth, p.drawHeight);
    canvas.toBlob(
      (blob) => {
        if (epoch !== outputEpoch.current) return;
        setEncoding(false);
        if (!blob || blob.type !== MIME[format]) {
          setError(
            "This browser cannot export that format. Choose PNG or JPEG.",
          );
          return;
        }
        if (blob.size >= 20 * 1024 * 1024) {
          setError(
            "This export exceeds 20 MB. Choose JPEG/WebP, reduce quality or use smaller dimensions.",
          );
          return;
        }
        setError("");
        setOutput({
          blob,
          url: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
          filename: resizeFilename(
            image.name,
            presetId,
            canvas.width,
            canvas.height,
            format,
          ),
        });
      },
      MIME[format],
      quality,
    );
    return () => {
      outputEpoch.current++;
    };
  }, [
    allowed,
    image,
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
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!allowed || !file) return;
    const epoch = ++uploadEpoch.current;
    setUploading(true);
    setError("");
    let bitmap;
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 20 * 1024 * 1024
      )
        throw new Error(
          "Choose a PNG, JPEG or WebP image up to 20 MB. Animated files are exported as a still image.",
        );
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 25000000)
        throw new Error("Use an image of 25 megapixels or less.");
      if (epoch !== uploadEpoch.current) {
        bitmap.close();
        return;
      }
      setImage({
        bitmap,
        name: file.name,
        width: bitmap.width,
        height: bitmap.height,
      });
      bitmap = null;
      setFocal({ x: 0.5, y: 0.5 });
      setZoom(1);
    } catch (e) {
      bitmap?.close();
      if (epoch === uploadEpoch.current)
        setError(e.message || "That image could not be opened.");
    } finally {
      if (epoch === uploadEpoch.current) setUploading(false);
    }
  }
  function choosePreset(value) {
    const next = RESIZE_PRESETS.find((p) => p.id === value);
    setPresetId(value);
    setMode(next.mode);
    setZoom(1);
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
    if (!allowed || uploading || encoding || !output || dimensionsError) return;
    const link = document.createElement("a");
    link.href = output.url;
    link.download = output.filename;
    link.click();
  }
  function downloadNotes() {
    if (!allowed || !output || encoding || uploading || !changeNotes.trim())
      return;
    const text = `InceptionApex — image change request\n\nImage: ${output.filename}\nDestination: ${preset.group} / ${preset.label}\nSize: ${output.width} x ${output.height} pixels\nFraming: ${mode === "fit" ? "Fit entire image" : "Crop to fill"}\nFormat: ${format.toUpperCase()}\n\nRequested changes:\n${changeNotes.trim()}\n\nResize/crop controls determine this image export. Other requested edits still need to be performed and reviewed.\n`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = output.filename.replace(/\.[^.]+$/, "_changes.txt");
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!allowed) return null;
  return (
    <section className="ia-resizer" aria-labelledby="resizer-title">
      <div className="ia-resizer-title">
        <div>
          <p className="ia-kicker">EIG TEAM TOOLS</p>
          <h2 id="resizer-title">Auto Resizer</h2>
          <p>One image. The right size for every destination.</p>
        </div>
        <span className="ia-resizer-badge">EIG access</span>
      </div>
      <div className="ia-resizer-grid">
        <div className="ia-resizer-controls">
          <label>
            Upload image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
            />
          </label>
          <p className="ia-resizer-help">
            PNG, JPEG or WebP · up to 20 MB / 25 MP. Processing stays in your
            browser. The original file stays intact.
          </p>
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
            disabled={!output || encoding || uploading || !!dimensionsError}
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
          <p className="ia-resizer-help">
            Download only. Upload the finished file to your chosen website or
            store when ready.
          </p>
        </div>
        <div className="ia-resizer-previews" aria-live="polite">
          {uploading && <p role="status">Opening image…</p>}
          {image ? (
            <>
              <div className="ia-resizer-original">
                <h3>
                  Original · {image.width} × {image.height}
                </h3>
                <button
                  type="button"
                  className="ia-focal-image"
                  aria-label="Choose focal point on original image"
                  disabled={mode !== "crop"}
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

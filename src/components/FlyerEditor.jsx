import React, { useRef, useState } from "react";
import CreativeLinkControls from "./CreativeLinkControls.jsx";
import { creativeLinkSvg, creativeLinkProblem } from "../lib/creativeLink.mjs";
import {
  FLYER_FIELDS,
  creativeBrief,
  flyerOverflow,
  flyerTemplate,
  flyerSvg,
  newFlyer,
  sanitizeFlyer,
  wrapText,
} from "../lib/eventCreative.mjs";

export function downloadCreative(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FlyerEditor({
  design,
  facts,
  onChange,
  createTemplate = newFlyer,
  artifactLabel = "flyer",
  brief = "",
  draftLabel = facts.status !== "published"
    ? "DRAFT · EVENT NOT PUBLISHED"
    : "",
}) {
  const [selected, setSelected] = useState(design.boxes[0]?.id),
    [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const imageBox = (design.images || []).find(
    (image) => image.id === selectedImage,
  );
  function updateImage(change) {
    onChange({
      ...design,
      images: (design.images || []).map((image) =>
        image.id === selectedImage ? { ...image, ...change } : image,
      ),
    });
  }
  const canvas = useRef(null),
    drag = useRef(null);
  const box = design.boxes.find((b) => b.id === selected),
    overflow = flyerOverflow(design, facts);
  const linkProblem = creativeLinkProblem(
    design.link,
    design.width,
    design.height,
  );
  function updateBox(change) {
    onChange({
      ...design,
      boxes: design.boxes.map((b) =>
        b.id === selected ? { ...b, ...change } : b,
      ),
    });
  }
  function pointerDown(e, item, resize = false) {
    e.preventDefault();
    e.stopPropagation();
    if (item.src) {
      setSelectedImage(item.id);
      setSelected(null);
    } else {
      setSelected(item.id);
      setSelectedImage(null);
    }
    const bounds = canvas.current.getBoundingClientRect();
    drag.current = {
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      item: { ...item },
      scale: design.width / bounds.width,
      resize,
      collection: item.src ? "images" : "boxes",
    };
    canvas.current.setPointerCapture(e.pointerId);
  }
  function move(e) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) * d.scale,
      dy = (e.clientY - d.startY) * d.scale;
    const next = d.resize
      ? {
          width: Math.max(
            30,
            Math.min(design.width - d.item.x, d.item.width + dx),
          ),
          height: Math.max(
            30,
            Math.min(design.height - d.item.y, d.item.height + dy),
          ),
        }
      : {
          x: Math.max(0, Math.min(design.width - d.item.width, d.item.x + dx)),
          y: Math.max(
            0,
            Math.min(design.height - d.item.height, d.item.y + dy),
          ),
        };
    onChange({
      ...design,
      [d.collection]: (design[d.collection] || []).map((b) =>
        b.id === d.id ? { ...b, ...next } : b,
      ),
    });
  }
  function end(e) {
    drag.current = null;
    if (canvas.current?.hasPointerCapture(e.pointerId))
      canvas.current.releasePointerCapture(e.pointerId);
  }
  async function importTemplate(e) {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 4500000) throw new Error("Template is too large.");
      onChange(sanitizeFlyer(JSON.parse(await file.text())));
      setSelected(null);
      setError("");
    } catch (problem) {
      setError(problem.message);
    } finally {
      e.target.value = "";
    }
  }
  async function uploadLogo(e) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 15000000
      )
        throw new Error("Use PNG, JPEG or WebP under 15 MB.");
      if ((design.images || []).length >= 12)
        throw new Error("A design can hold up to 12 logos or photos.");
      const bitmap = await createImageBitmap(file),
        scale = Math.min(1, 1000 / bitmap.width, 1000 / bitmap.height);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bitmap.width * scale));
      c.height = Math.max(1, Math.round(bitmap.height * scale));
      c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
      bitmap.close();
      const width = Math.min(250, design.width * 0.3),
        height = Math.min(design.height * 0.3, (width * c.height) / c.width);
      const image = {
        id: crypto.randomUUID(),
        label: file.name.slice(0, 120),
        src: c.toDataURL("image/png"),
        x: 40,
        y: 90,
        width,
        height,
      };
      onChange({ ...design, images: [...(design.images || []), image] });
      setSelectedImage(image.id);
      setSelected(null);
      setError("");
    } catch (problem) {
      setError(problem.message || "Unable to add this image.");
    } finally {
      e.target.value = "";
    }
  }
  function addBox() {
    const item = {
      id: crypto.randomUUID(),
      source: "custom",
      text: "Your creative text",
      x: 70,
      y: 70,
      width: 500,
      height: 100,
      fontSize: 30,
      color: "#ffffff",
      align: "left",
      bold: false,
    };
    onChange({ ...design, boxes: [...design.boxes, item] });
    setSelected(item.id);
  }
  async function uploadArt(e) {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 15000000
      )
        throw new Error("Use PNG, JPEG or WebP artwork under 15 MB.");
      const image = await createImageBitmap(file);
      const c = document.createElement("canvas"),
        scale = Math.min(1, 1600 / image.width, 1600 / image.height);
      c.width = image.width * scale;
      c.height = image.height * scale;
      c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
      image.close();
      onChange({ ...design, backgroundImage: c.toDataURL("image/jpeg", 0.88) });
      setError("");
    } catch (problem) {
      setError(problem.message);
    } finally {
      e.target.value = "";
    }
  }
  return (
    <div className="creative-editor-grid">
      <div>
        <div className="creative-toolbar">
          <label>
            Starter template
            <select
              defaultValue="classic"
              onChange={(e) => {
                if (
                  window.confirm(
                    "Apply this template and replace the current flyer layout?",
                  )
                ) {
                  onChange({
                    ...createTemplate(e.target.value),
                    link: design.link,
                  });
                  setSelected(null);
                }
              }}
            >
              <option value="classic">Classic EIG</option>
              <option value="fairway">Fairway</option>
              <option value="celebration">Celebration</option>
            </select>
          </label>
          <button
            type="button"
            disabled={design.boxes.length >= 40}
            onClick={addBox}
          >
            + Text box
          </button>
        </div>
        <svg
          ref={canvas}
          className="flyer-canvas"
          viewBox={`0 0 ${design.width} ${design.height}`}
          aria-label="Editable event flyer"
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <rect width="100%" height="100%" fill={design.background} />
          {design.backgroundImage && (
            <image
              href={design.backgroundImage}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          <rect width="100%" height="24" fill={design.accent} />
          {draftLabel && (
            <text x="35" y="60" fill="#fff" fontSize="20">
              {draftLabel}
            </text>
          )}
          {(design.images || []).map((image) => (
            <g
              key={image.id}
              tabIndex="0"
              role="button"
              aria-label={image.label + " image"}
              onFocus={() => {
                setSelectedImage(image.id);
                setSelected(null);
              }}
              onPointerDown={(e) => pointerDown(e, image)}
              onKeyDown={(e) => {
                const vector = {
                  ArrowLeft: [-5, 0],
                  ArrowRight: [5, 0],
                  ArrowUp: [0, -5],
                  ArrowDown: [0, 5],
                }[e.key];
                if (!vector) return;
                e.preventDefault();
                onChange({
                  ...design,
                  images: (design.images || []).map((v) =>
                    v.id === image.id
                      ? {
                          ...v,
                          x: Math.max(
                            0,
                            Math.min(design.width - v.width, v.x + vector[0]),
                          ),
                          y: Math.max(
                            0,
                            Math.min(design.height - v.height, v.y + vector[1]),
                          ),
                        }
                      : v,
                  ),
                });
              }}
            >
              <image
                href={image.src}
                x={image.x}
                y={image.y}
                width={image.width}
                height={image.height}
                preserveAspectRatio="xMidYMid meet"
              />
              {selectedImage === image.id && (
                <>
                  <rect
                    x={image.x}
                    y={image.y}
                    width={image.width}
                    height={image.height}
                    fill="transparent"
                    stroke="#67ccff"
                    strokeWidth="3"
                  />
                  <rect
                    x={image.x + image.width - 14}
                    y={image.y + image.height - 14}
                    width="22"
                    height="22"
                    fill="#67ccff"
                    aria-label="Resize image"
                    onPointerDown={(e) => pointerDown(e, image, true)}
                  />
                </>
              )}
            </g>
          ))}
          {design.boxes.map((b) => (
            <g
              key={b.id}
              tabIndex="0"
              role="button"
              aria-label={`${b.source} text box`}
              onFocus={() => setSelected(b.id)}
              onPointerDown={(e) => pointerDown(e, b)}
              onKeyDown={(e) => {
                const vectors = {
                  ArrowLeft: [-5, 0],
                  ArrowRight: [5, 0],
                  ArrowUp: [0, -5],
                  ArrowDown: [0, 5],
                };
                if (vectors[e.key]) {
                  e.preventDefault();
                  setSelected(b.id);
                  const [dx, dy] = vectors[e.key];
                  onChange({
                    ...design,
                    boxes: design.boxes.map((v) =>
                      v.id === b.id
                        ? {
                            ...v,
                            x: Math.max(
                              0,
                              Math.min(design.width - v.width, v.x + dx),
                            ),
                            y: Math.max(
                              0,
                              Math.min(design.height - v.height, v.y + dy),
                            ),
                          }
                        : v,
                    ),
                  });
                }
              }}
            >
              <rect
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                fill="transparent"
                stroke={selected === b.id ? "#67ccff" : "#ffffff35"}
                strokeWidth="2"
                strokeDasharray={selected === b.id ? "" : "7 4"}
              />
              <text
                fill={b.color}
                fontFamily="Arial,sans-serif"
                fontSize={b.fontSize}
                fontWeight={b.bold ? "700" : "400"}
                textAnchor={
                  { left: "start", center: "middle", right: "end" }[b.align]
                }
                pointerEvents="none"
              >
                {wrapText(
                  b.source === "custom" ? b.text : facts[b.source] || "",
                  b,
                ).map((line, i) => (
                  <tspan
                    key={i}
                    x={
                      b.align === "center"
                        ? b.x + b.width / 2
                        : b.align === "right"
                          ? b.x + b.width
                          : b.x
                    }
                    y={b.y + b.fontSize + i * b.fontSize * 1.2}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
              {selected === b.id && (
                <rect
                  x={b.x + b.width - 14}
                  y={b.y + b.height - 14}
                  width="22"
                  height="22"
                  fill="#67ccff"
                  aria-label="Resize text box"
                  onPointerDown={(e) => pointerDown(e, b, true)}
                />
              )}
            </g>
          ))}
          <g
            pointerEvents="none"
            dangerouslySetInnerHTML={{
              __html: creativeLinkSvg(design.link, design.width, design.height),
            }}
          />
        </svg>
        <p>
          Drag a box to place it. Drag its corner to resize it. Arrow keys move
          the selected box.
        </p>
      </div>
      <aside className="creative-inspector">
        <CreativeLinkControls
          value={design.link}
          width={design.width}
          height={design.height}
          suggestedLink={facts.registration}
          onChange={(link) => onChange({ ...design, link })}
        />
        <h3>Logos & photos</h3>
        <label>
          Add logo or photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={(design.images || []).length >= 12}
            onChange={uploadLogo}
          />
        </label>
        {!!(design.images || []).length && (
          <label>
            Select image
            <select
              aria-label="Select image"
              value={selectedImage || ""}
              onChange={(e) => {
                setSelectedImage(e.target.value);
                setSelected(null);
              }}
            >
              <option value="">Choose an image</option>
              {design.images.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {imageBox && (
          <>
            <div className="creative-pair">
              {[
                ["x", "Image X"],
                ["y", "Image Y"],
                ["width", "Image width"],
                ["height", "Image height"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    value={Math.round(imageBox[key])}
                    min={key === "x" || key === "y" ? 0 : 30}
                    max={
                      key === "x"
                        ? design.width - imageBox.width
                        : key === "y"
                          ? design.height - imageBox.height
                          : key === "width"
                            ? design.width - imageBox.x
                            : design.height - imageBox.y
                    }
                    onChange={(e) => {
                      const max =
                        key === "x"
                          ? design.width - imageBox.width
                          : key === "y"
                            ? design.height - imageBox.height
                            : key === "width"
                              ? design.width - imageBox.x
                              : design.height - imageBox.y;
                      updateImage({
                        [key]: Math.max(
                          key === "x" || key === "y" ? 0 : 30,
                          Math.min(max, Number(e.target.value) || 0),
                        ),
                      });
                    }}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onChange({
                  ...design,
                  images: design.images.filter(
                    (image) => image.id !== selectedImage,
                  ),
                });
                setSelectedImage(null);
              }}
            >
              Remove selected image
            </button>
          </>
        )}
        <h3>Text boxes</h3>
        <label>
          Select text box
          <select
            aria-label="Select text box"
            value={selected || ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a box</option>
            {design.boxes.map((b, i) => (
              <option key={b.id} value={b.id}>
                {i + 1}. {b.source}
              </option>
            ))}
          </select>
        </label>
        {box && (
          <>
            <label>
              Pull text from
              <select
                value={box.source}
                onChange={(e) => updateBox({ source: e.target.value })}
              >
                {FLYER_FIELDS.map((field) => (
                  <option key={field}>{field}</option>
                ))}
              </select>
            </label>
            {box.source === "custom" ? (
              <label>
                Creative text
                <textarea
                  value={box.text}
                  maxLength="1500"
                  onChange={(e) => updateBox({ text: e.target.value })}
                />
              </label>
            ) : (
              <p className="creative-source-text">
                {facts[box.source] ||
                  "Add this information in Event Details or the Hub."}
              </p>
            )}
            <div className="form-grid two">
              {[
                ["X", "x", 0, design.width - box.width],
                ["Y", "y", 0, design.height - box.height],
                ["Box width", "width", 30, design.width - box.x],
                ["Box height", "height", 30, design.height - box.y],
                ["Font size", "fontSize", 8, 160],
              ].map(([label, key, min, max]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={Math.round(box[key])}
                    onChange={(e) =>
                      updateBox({
                        [key]: Math.max(
                          min,
                          Math.min(max, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Text color
                <input
                  type="color"
                  value={box.color}
                  onChange={(e) => updateBox({ color: e.target.value })}
                />
              </label>
            </div>
            <label>
              Alignment
              <select
                value={box.align}
                onChange={(e) => updateBox({ align: e.target.value })}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label className="builder-checkbox">
              <input
                type="checkbox"
                checked={box.bold}
                onChange={(e) => updateBox({ bold: e.target.checked })}
              />
              Bold
            </label>
            <button
              type="button"
              onClick={() => {
                onChange({
                  ...design,
                  boxes: design.boxes.filter((b) => b.id !== selected),
                });
                setSelected(null);
              }}
            >
              Remove text box
            </button>
          </>
        )}
        <div className="form-grid two">
          <label>
            Background
            <input
              type="color"
              value={design.background}
              onChange={(e) =>
                onChange({ ...design, background: e.target.value })
              }
            />
          </label>
          <label>
            Accent
            <input
              type="color"
              value={design.accent}
              onChange={(e) => onChange({ ...design, accent: e.target.value })}
            />
          </label>
        </div>
        <label>
          Creative / AI background artwork
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={uploadArt}
          />
        </label>
        {design.backgroundImage && (
          <button
            type="button"
            onClick={() => onChange({ ...design, backgroundImage: "" })}
          >
            Remove background artwork
          </button>
        )}
        {!!overflow.length && (
          <p role="alert">
            {overflow.length} text boxes need more room. Resize the boxes or
            reduce their font size before exporting.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="creative-toolbar">
          <button
            type="button"
            disabled={!!overflow.length || !!linkProblem}
            onClick={() =>
              downloadCreative(
                flyerSvg(design, facts, draftLabel),
                "Design-" + artifactLabel.replace(/[^a-z0-9]/gi, "-") + ".svg",
                "image/svg+xml",
              )
            }
          >
            Download {artifactLabel} SVG
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCreative(
                JSON.stringify(flyerTemplate(design), null, 2),
                "Flyer-Template.json",
                "application/json",
              )
            }
          >
            Share template
          </button>
          <label>
            Load shared template
            <input
              type="file"
              accept="application/json,.json"
              onChange={importTemplate}
            />
          </label>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  brief || creativeBrief(facts),
                );
                setError("");
              } catch {
                setError(
                  "Clipboard unavailable. Download the AI brief instead.",
                );
              }
            }}
          >
            Copy AI creative brief
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCreative(
                brief || creativeBrief(facts),
                "Flyer-AI-Brief.txt",
                "text/plain",
              )
            }
          >
            Download AI brief
          </button>
        </div>
        <p>
          Templates keep the text sources and layout. Each project supplies its
          own facts. Download the brief to use with your creative tools.
        </p>
      </aside>
    </div>
  );
}

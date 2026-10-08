import React from "react";
import {
  cleanCreativeLink,
  creativeLinkProblem,
  linkDestination,
  qrMarkup,
} from "../lib/creativeLink.mjs";
import "./creative-link.css";

export default function CreativeLinkControls({
  value,
  onChange,
  width = 850,
  height = 1100,
  placement = true,
  suggestedLink = "",
  note = "",
}) {
  const link = cleanCreativeLink(value, width, height);
  const problem = creativeLinkProblem(link, width, height);
  function change(patch) {
    onChange(cleanCreativeLink({ ...link, ...patch }, width, height));
  }
  function downloadQr() {
    const url = URL.createObjectURL(
      new Blob([qrMarkup(link.url)], { type: "image/svg+xml" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "InceptionApex-QR.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <fieldset className="creative-link-controls">
      <legend>Link & QR code</legend>
      <label>
        Destination link
        <input
          aria-label="Destination link"
          type="url"
          maxLength={600}
          placeholder="https://…"
          value={link.url}
          onChange={(e) => change({ url: e.target.value })}
        />
      </label>
      {suggestedLink && linkDestination(suggestedLink) && (
        <button type="button" onClick={() => change({ url: suggestedLink })}>
          Use event link
        </button>
      )}
      <label className="creative-link-check">
        <input
          type="checkbox"
          checked={link.showQr}
          onChange={(e) => change({ showQr: e.target.checked })}
        />
        Show QR code
      </label>
      <label className="creative-link-check">
        <input
          type="checkbox"
          checked={link.showLink}
          onChange={(e) => change({ showLink: e.target.checked })}
        />
        Show link text
      </label>
      {link.showLink && (
        <label>
          Link text
          <input
            aria-label="Link text"
            maxLength={80}
            value={link.label}
            onChange={(e) => change({ label: e.target.value })}
          />
        </label>
      )}
      {placement && (link.showQr || link.showLink) && (
        <>
          <label>
            Placement
            <select
              aria-label="Link placement"
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const bottom =
                  height -
                  (link.showQr ? link.size : 0) -
                  (link.showLink ? 40 : 0) -
                  30;
                change({
                  x: e.target.value.endsWith("right")
                    ? width - link.size - 30
                    : 30,
                  y: e.target.value.startsWith("bottom") ? bottom : 80,
                });
              }}
            >
              <option value="">Choose a corner or adjust below</option>
              {["top-left", "top-right", "bottom-left", "bottom-right"].map(
                (p) => (
                  <option key={p} value={p}>
                    {p.replace("-", " ")}
                  </option>
                ),
              )}
            </select>
          </label>
          <div className="creative-link-pair">
            {[
              ["x", "Link X", 0, width - link.size],
              [
                "y",
                "Link Y",
                0,
                height -
                  (link.showQr ? link.size : 0) -
                  (link.showLink ? 40 : 0),
              ],
              [
                "size",
                "Link / QR size",
                80,
                Math.min(width, height - (link.showLink ? 40 : 0)),
              ],
            ].map(([key, label, min, max]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={label}
                  type="number"
                  min={min}
                  max={max}
                  value={Math.round(link[key])}
                  onChange={(e) => change({ [key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
        </>
      )}
      {problem && <p role="alert">{problem}</p>}
      {linkDestination(link.url) && !problem && (
        <>
          <a
            href={linkDestination(link.url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open destination ↗
          </a>
          <button type="button" onClick={downloadQr}>
            Download QR SVG
          </button>
          {link.showQr && (
            <div
              className="creative-link-preview"
              aria-label="QR code preview"
              dangerouslySetInnerHTML={{ __html: qrMarkup(link.url) }}
            />
          )}
        </>
      )}
      <p>
        {note ||
          "QR codes remain scannable in artwork. Clickable links work in standalone SVG and HTML; image files need a link when published. Scan-test your finished print or product."}
      </p>
    </fieldset>
  );
}

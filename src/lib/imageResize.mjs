export const RESIZE_PRESETS = [
  {
    id: "shopify-product",
    group: "Shopify",
    label: "Product / collection square",
    width: 2048,
    height: 2048,
    mode: "fit",
    note: "Recommended square product size. Check your theme's framing before uploading.",
    source:
      "https://help.shopify.com/en/manual/products/product-media/product-media-types",
  },
  {
    id: "eig-hero",
    group: "EIG Website",
    label: "Website hero / banner",
    width: 1920,
    height: 1080,
    mode: "crop",
    note: "A 16:9 starter size. Your page layout may crop differently on mobile.",
  },
  {
    id: "eig-card",
    group: "EIG Website",
    label: "Website card",
    width: 1200,
    height: 800,
    mode: "crop",
    note: "A 3:2 starter size for website cards.",
  },
  {
    id: "eig-logo",
    group: "EIG Website",
    label: "Logo / brand mark",
    width: 512,
    height: 512,
    mode: "fit",
    note: "Keep the full logo and export PNG or WebP to retain transparency.",
  },
  {
    id: "eig-hub-art",
    group: "EIG Website",
    label: "Event Hub share-card artwork",
    width: 1200,
    height: 340,
    mode: "fit",
    note: "Fits the artwork area inside EIG's generated event share card; event wording is added separately.",
  },
  {
    id: "eig-share",
    group: "EIG Website",
    label: "Website share image",
    width: 1200,
    height: 630,
    mode: "crop",
    note: "Landscape share-image canvas. Downloading does not publish it or change event share settings.",
  },
  {
    id: "eig-display",
    group: "EIG Displays",
    label: "Landscape screen",
    width: 1920,
    height: 1080,
    mode: "fit",
    note: "A Full HD starter size. Confirm the actual display's dimensions.",
  },
  {
    id: "hometown-front",
    group: "Hometown Magazine (EIG)",
    label: "Front Page · 7.875 × 8.75 in",
    width: 2363,
    height: 2625,
    inches: { width: 7.875, height: 8.75 },
    dpi: 300,
    mode: "fit",
    note: "EIG-only Hometown Magazine print size. Printer bleed and safe margins must be confirmed before final production.",
  },
  {
    id: "hometown-back",
    group: "Hometown Magazine (EIG)",
    label: "Back Page · 7.875 × 8 in",
    width: 2363,
    height: 2400,
    inches: { width: 7.875, height: 8 },
    dpi: 300,
    mode: "fit",
    note: "EIG-only Hometown Magazine print size. Printer bleed and safe margins must be confirmed before final production.",
  },
  {
    id: "hometown-full",
    group: "Hometown Magazine (EIG)",
    label: "Full Page · 7.875 × 9.3125 in",
    width: 2363,
    height: 2794,
    inches: { width: 7.875, height: 9.3125 },
    dpi: 300,
    mode: "fit",
    note: "EIG-only Hometown Magazine print size. Printer bleed and safe margins must be confirmed before final production.",
  },
  {
    id: "hometown-half",
    group: "Hometown Magazine (EIG)",
    label: "Half Page · 7.875 × 4.8125 in",
    width: 2363,
    height: 1444,
    inches: { width: 7.875, height: 4.8125 },
    dpi: 300,
    mode: "fit",
    note: "EIG-only Hometown Magazine print size. Printer bleed and safe margins must be confirmed before final production.",
  },
  {
    id: "hometown-third",
    group: "Hometown Magazine (EIG)",
    label: "Third Page · 7.875 × 3.125 in",
    width: 2363,
    height: 938,
    inches: { width: 7.875, height: 3.125 },
    dpi: 300,
    mode: "fit",
    note: "EIG-only Hometown Magazine print size. Printer bleed and safe margins must be confirmed before final production.",
  },
  {
    id: "hometown-quarter-extended",
    group: "Hometown Magazine (EIG)",
    label: "Quarter Extended · 7.875 × 2.3125 in",
    width: 2363,
    height: 694,
    inches: { width: 7.875, height: 2.3125 },
    dpi: 300,
    mode: "fit",
    note: "EIG-only Hometown Magazine print size. Printer bleed and safe margins must be confirmed before final production.",
  },
  {
    id: "hometown-quarter-box",
    group: "Hometown Magazine (EIG)",
    label: "Quarter Box · 3.3125 × 4.3125 in",
    width: 994,
    height: 1294,
    inches: { width: 3.3125, height: 4.3125 },
    dpi: 300,
    mode: "fit",
    note: "EIG-only Hometown Magazine print size. Printer bleed and safe margins must be confirmed before final production.",
  },
  {
    id: "custom",
    group: "Custom",
    label: "Custom dimensions",
    width: 1200,
    height: 1200,
    mode: "fit",
    note: "Enter the exact pixel dimensions required by the destination.",
  },
];

// EIG rollout gate; Drive saving also verifies this membership on the server.
export function canUseAutoResizer(memberships, now = Date.now()) {
  return (memberships || []).some((m) => {
    const starts = m.access_starts_at
      ? Date.parse(m.access_starts_at)
      : -Infinity;
    const ends = m.access_ends_at ? Date.parse(m.access_ends_at) : Infinity;
    return (
      m.organization?.slug === "elevated-impact-group" &&
      m.role === "eig_admin" &&
      m.status === "active" &&
      starts <= now &&
      ends > now
    );
  });
}

export function resizeDimensions(width, height) {
  const w = Number(width),
    h = Number(height);
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    w > 4096 ||
    h > 4096
  )
    throw new Error("Enter whole-number dimensions from 1 to 4096 pixels.");
  return { width: w, height: h };
}

export function imagePlacement(
  sourceWidth,
  sourceHeight,
  width,
  height,
  mode = "fit",
  focalX = 0.5,
  focalY = 0.5,
  zoom = 1,
) {
  resizeDimensions(width, height);
  if (![sourceWidth, sourceHeight].every((n) => Number.isFinite(n) && n > 0))
    throw new Error("Choose a valid image.");
  const crop = mode === "crop";
  const scale =
    (crop
      ? Math.max(width / sourceWidth, height / sourceHeight)
      : Math.min(width / sourceWidth, height / sourceHeight)) *
    (crop ? Math.max(1, Math.min(3, Number(zoom) || 1)) : 1);
  const drawWidth = sourceWidth * scale,
    drawHeight = sourceHeight * scale;
  const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));
  // Center the selected source point in the crop, clamped to the image edges.
  const x = crop
    ? Math.max(
        width - drawWidth,
        Math.min(0, width / 2 - drawWidth * clamp(focalX)),
      )
    : (width - drawWidth) / 2;
  const y = crop
    ? Math.max(
        height - drawHeight,
        Math.min(0, height / 2 - drawHeight * clamp(focalY)),
      )
    : (height - drawHeight) / 2;
  return { x, y, drawWidth, drawHeight, scale };
}

export function resizeFilename(name, preset, width, height, format) {
  const base =
    String(name || "image")
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "image";
  return `${base}_${preset}_${width}x${height}.${format === "jpeg" ? "jpg" : format}`;
}

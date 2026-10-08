import QRCode from "qrcode";

const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const clamp = (v, min, max, fallback) =>
  Number.isFinite(Number(v))
    ? Math.max(min, Math.min(max, Number(v)))
    : Math.min(max, fallback);
export function linkDestination(value) {
  try {
    const raw = String(value || "").trim();
    if (raw.length > 600 || /[\u0000-\u0020]/.test(raw)) return "";
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password ? raw : "";
  } catch {
    return "";
  }
}
export function cleanCreativeLink(value = {}, width = 850, height = 1100) {
  const showQr = value?.showQr === true,
    showLink = value?.showLink === true;
  const max = Math.max(30, Math.min(width, height - (showLink ? 40 : 0)));
  const size = clamp(value?.size, 30, max, Math.min(180, max));
  const cardHeight = (showQr ? size : 0) + (showLink ? 40 : 0);
  return {
    url: typeof value?.url === "string" ? value.url.slice(0, 600) : "",
    label:
      typeof value?.label === "string"
        ? value.label.slice(0, 80)
        : "Scan to learn more",
    showQr,
    showLink,
    size,
    x: clamp(
      value?.x,
      0,
      Math.max(0, width - size),
      Math.max(0, width - size - 30),
    ),
    y: clamp(
      value?.y,
      0,
      Math.max(0, height - cardHeight),
      Math.max(0, height - cardHeight - 30),
    ),
  };
}
export function creativeLinkProblem(value, width = 850, height = 1100) {
  if (!value) return "";
  if (!value.url && !value.showQr && !value.showLink) return "";
  if (!linkDestination(value.url))
    return "Enter a complete HTTPS destination link without spaces or login credentials.";
  if (value.showQr) {
    if (width < 80 || height < 80 || value.size < 80)
      return "Give the QR code at least 80 pixels of space, then scan-test it at the finished size.";
    try {
      QRCode.create(linkDestination(value.url), { errorCorrectionLevel: "M" });
    } catch {
      return "This link is too long for a QR code. Use a shorter destination link.";
    }
  }
  return "";
}
export function qrMarkup(url) {
  const destination = linkDestination(url);
  if (!destination) return "";
  const modules = QRCode.create(destination, {
    errorCorrectionLevel: "M",
  }).modules;
  let path = "";
  for (let y = 0; y < modules.size; y++)
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(y, x)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
  const dimension = modules.size + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="${dimension}" height="${dimension}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path fill="#000000" d="${path}"/></svg>`;
}
export function creativeLinkSvg(value, width, height) {
  const link = cleanCreativeLink(value, width, height);
  if (
    (!link.showQr && !link.showLink) ||
    creativeLinkProblem(link, width, height)
  )
    return "";
  const url = linkDestination(link.url),
    caption = link.label.trim() || new URL(url).hostname;
  const heightPx = (link.showQr ? link.size : 0) + (link.showLink ? 40 : 0);
  const qr = link.showQr
    ? qrMarkup(url).replace(
        /width="\d+" height="\d+"/,
        `width="${link.size}" height="${link.size}"`,
      )
    : "";
  // User values enter only escaped text/attributes; geometry and QR paths are generated locally.
  return `<g data-creative-link="true" transform="translate(${link.x} ${link.y})"><a href="${escape(url)}" target="_blank" rel="noopener noreferrer"><title>${escape(url)}</title><rect width="${link.size}" height="${heightPx}" fill="#ffffff"/>${qr}${link.showLink ? `<text x="${link.size / 2}" y="${(link.showQr ? link.size : 0) + 25}" font-family="Arial,sans-serif" font-size="${Math.min(16, link.size / Math.max(8, caption.length * 0.62))}" text-anchor="middle" fill="#000000">${escape(caption)}</text>` : ""}</a></g>`;
}
export function packetLinkHtml(value) {
  const link = cleanCreativeLink({ ...value, x: 0, y: 0 }, 240, 300);
  const markup = creativeLinkSvg(link, 240, 300);
  return markup
    ? `<div class="packet-link"><svg xmlns="http://www.w3.org/2000/svg" width="${link.size}" height="${(link.showQr ? link.size : 0) + (link.showLink ? 40 : 0)}">${markup}</svg></div>`
    : "";
}

export function drawCreativeLink(ctx, value, width, height) {
  const link = cleanCreativeLink(value, width, height);
  const problem = creativeLinkProblem(link, width, height);
  if (problem) throw new Error(problem);
  if (!link.showQr && !link.showLink) return;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(
    link.x,
    link.y,
    link.size,
    (link.showQr ? link.size : 0) + (link.showLink ? 40 : 0),
  );
  if (link.showQr) {
    const modules = QRCode.create(linkDestination(link.url), {
      errorCorrectionLevel: "M",
    }).modules;
    const unit = link.size / (modules.size + 8);
    ctx.fillStyle = "#000000";
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++)
        if (modules.get(y, x)) {
          const left = Math.round((x + 4) * unit),
            top = Math.round((y + 4) * unit);
          ctx.fillRect(
            link.x + left,
            link.y + top,
            Math.round((x + 5) * unit) - left,
            Math.round((y + 5) * unit) - top,
          );
        }
  }
  if (link.showLink) {
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = "16px Arial";
    ctx.fillText(
      link.label.trim() || new URL(link.url).hostname,
      link.x + link.size / 2,
      link.y + (link.showQr ? link.size : 0) + 25,
      link.size - 8,
    );
  }
  ctx.restore();
}

import test from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import {
  cleanCreativeLink,
  creativeLinkProblem,
  linkDestination,
  qrMarkup,
  creativeLinkSvg,
  drawCreativeLink,
} from "../src/lib/creativeLink.mjs";
import {
  MATERIALS,
  newProject,
  cleanProjectData,
  projectHandoff,
} from "../src/lib/inceptionProject.mjs";
import {
  flyerSvg,
  flyerTemplate,
  packetHtml,
  sanitizePacket,
} from "../src/lib/eventCreative.mjs";
const url = "https://example.com/deals?source=sign&offer=fall#claim";
const link = {
  url,
  label: "Claim this offer",
  showQr: true,
  showLink: true,
  size: 200,
};
test("exported vector QR independently decodes the exact destination with a quiet zone", () => {
  const svg = qrMarkup(url),
    dimension = Number(svg.match(/viewBox="0 0 (\d+)/)[1]),
    scale = 8,
    size = dimension * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (const [, x, y] of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g))
    for (let row = 0; row < scale; row++)
      for (let col = 0; col < scale; col++) {
        const pos =
          ((Number(y) * scale + row) * size + Number(x) * scale + col) * 4;
        data[pos] = data[pos + 1] = data[pos + 2] = 0;
      }
  assert.equal(jsQR(data, size, size)?.data, url);
  assert.ok(svg.includes('fill="#ffffff"'));
});
test("all supported artwork types preserve links in save, templates and approved handoff", () => {
  for (const m of MATERIALS) {
    const p = newProject(m.id, { name: "Offer" });
    p.data.design.boxes = [];
    p.data.design.link = cleanCreativeLink(link, m.width, m.height);
    const clean = cleanProjectData(JSON.parse(JSON.stringify(p.data)));
    assert.equal(clean.design.link.url, url);
    assert.equal(flyerTemplate(clean.design).link.url, url);
    const svg = flyerSvg(clean.design, clean.facts, "");
    assert.ok(svg.includes('data-creative-link="true"'));
    assert.ok(svg.includes("source=sign&amp;offer=fall#claim"));
    const handoff = projectHandoff({
      ...p,
      data: clean,
      status: "approved",
      version: 1,
    });
    assert.equal(handoff.link.url, url);
    assert.ok(handoff.artwork_svg.includes('data-creative-link="true"'));
  }
});
test("unsafe destinations never become anchors or QR; labels and HTTPS attributes are escaped", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "https://user:secret@example.com",
    "http://example.com",
    "https://example.com/ bad",
  ]) {
    assert.equal(linkDestination(url), "");
    assert.ok(creativeLinkProblem({ ...link, url }));
    assert.equal(creativeLinkSvg({ ...link, url }, 850, 1100), "");
  }
  const svg = creativeLinkSvg(
    { ...link, label: '<img onerror="bad">' },
    850,
    1100,
  );
  assert.ok(svg.includes("&lt;img"));
  assert.ok(!svg.includes("<img"));
  assert.equal(creativeLinkProblem(undefined), "");
  assert.equal(creativeLinkSvg(undefined, 850, 1100), "");
  assert.ok(creativeLinkProblem({ ...link, size: 30 }));
});
test("packet maps, layouts and itinerary share the saved footer link", () => {
  const data = sanitizePacket({
    link,
    layouts: { spaces: [{ name: "Tent", width: 40, length: 60, items: [] }] },
  });
  assert.equal(data.link.url, url);
  const html = packetHtml({ id: "test", name: "Test", status: "draft" }, data);
  assert.equal((html.match(/data-creative-link="true"/g) || []).length, 3);
  assert.ok(html.includes("Course activities"));
  assert.ok(html.includes("Itinerary"));
});
test("raster overlay independently decodes, stays in bounds and rejects invalid links", () => {
  const width = 400,
    height = 250,
    data = new Uint8ClampedArray(width * height * 4).fill(255);
  const ctx = {
    fillStyle: "",
    save() {},
    restore() {},
    fillText() {},
    fillRect(x, y, w, h) {
      for (let row = Math.round(y); row < Math.round(y + h); row++)
        for (let col = Math.round(x); col < Math.round(x + w); col++) {
          assert.ok(row >= 0 && row < height && col >= 0 && col < width);
          const pos = (row * width + col) * 4;
          data[pos] =
            data[pos + 1] =
            data[pos + 2] =
              this.fillStyle === "#000000" ? 0 : 255;
        }
    },
  };
  drawCreativeLink(ctx, { ...link, x: 500, y: 500 }, width, height);
  assert.equal(jsQR(data, width, height)?.data, url);
  assert.throws(
    () =>
      drawCreativeLink(ctx, { ...link, url: "javascript:bad" }, width, height),
    /HTTPS/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseAutoResizer,
  imagePlacement,
  resizeDimensions,
  resizeFilename,
  RESIZE_PRESETS,
} from "../src/lib/imageResize.mjs";

test("Auto Resizer is offered only to current EIG-role memberships", () => {
  const now = Date.parse("2026-10-06T20:00:00Z");
  const membership = {
    organization: { slug: "elevated-impact-group" },
    role: "eig_admin",
    status: "active",
  };
  assert.equal(canUseAutoResizer([membership], now), true);
  for (const change of [
    { role: "organization_admin" },
    { role: "event_coordinator" },
    { role: "passenger" },
    { status: "revoked" },
    { organization: { slug: "customer-hangar" } },
    { access_starts_at: "2026-10-07T00:00:00Z" },
    { access_ends_at: "2026-10-06T19:00:00Z" },
    { access_ends_at: "bad date" },
  ])
    assert.equal(canUseAutoResizer([{ ...membership, ...change }], now), false);
  assert.equal(canUseAutoResizer([], now), false);
  assert.equal(canUseAutoResizer(null, now), false);
});

test("Fit preserves proportions; crop respects the selected subject and covers the frame", () => {
  assert.deepEqual(imagePlacement(400, 200, 200, 200), {
    x: 0,
    y: 50,
    drawWidth: 200,
    drawHeight: 100,
    scale: 0.5,
  });
  assert.equal(imagePlacement(400, 200, 200, 200, "crop", 0, 0.5).x, 0);
  assert.equal(imagePlacement(400, 200, 200, 200, "crop", 1, 0.5).x, -200);
  const zoomed = imagePlacement(400, 200, 200, 200, "crop", 0.75, 0.5, 2);
  assert.equal(zoomed.x, -500);
  assert.equal(zoomed.drawWidth, 800);
  for (const preset of RESIZE_PRESETS) {
    const size = resizeDimensions(preset.width, preset.height);
    const placement = imagePlacement(
      300,
      900,
      size.width,
      size.height,
      "crop",
      1,
      0,
    );
    assert.ok(placement.x <= 0 && placement.y <= 0);
    assert.ok(placement.x + placement.drawWidth >= size.width - 0.00001);
    assert.ok(placement.y + placement.drawHeight >= size.height - 0.00001);
  }
  assert.throws(() => resizeDimensions("", 200));
  assert.throws(() => resizeDimensions(200.5, 200));
  assert.throws(() => resizeDimensions(4097, 200));
  assert.throws(() => imagePlacement(0, 200, 200, 200));
  assert.equal(
    resizeFilename("../EIG logo.png", "eig-logo", 512, 512, "jpeg"),
    "EIG-logo_eig-logo_512x512.jpg",
  );
});

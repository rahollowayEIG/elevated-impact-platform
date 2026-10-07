const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
(async () => {
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4188, strictPort: true },
  });
  await server.listen();
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const base =
    process.env.EVENT_BUILDER_TEST_URL ||
    "http://127.0.0.1:4188/tests/event-builder.html";
  try {
    await page.goto(base);
    await fs.mkdir("test-results/event-builder", { recursive: true });
    await page.screenshot({
      path: "test-results/event-builder/initial-desktop.png",
      fullPage: true,
    });
    await page.getByText("No saved packet yet", { exact: true }).waitFor();
    assert.equal(await page.locator("vite-error-overlay").count(), 0);
    await page
      .getByRole("combobox", { name: /Select text box/ })
      .selectOption({ label: "1. name" });
    const original = await page.getByLabel("X", { exact: true }).inputValue();
    await page
      .getByRole("button", { name: "name text box", exact: true })
      .focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      Number(await page.getByLabel("X", { exact: true }).inputValue()),
      Number(original) + 5,
    );
    await page.getByLabel("Font size", { exact: true }).fill("50");
    const corner = page.getByLabel("Resize text box", { exact: true });
    const bounds = await corner.boundingBox();
    const beforeWidth = Number(
      await page.getByLabel("Box width", { exact: true }).inputValue(),
    );
    await page.mouse.move(bounds.x + 8, bounds.y + 8);
    await page.mouse.down();
    await page.mouse.move(bounds.x - 30, bounds.y + 8, { steps: 3 });
    await page.mouse.up();
    assert.ok(
      Number(await page.getByLabel("Box width", { exact: true }).inputValue()) <
        beforeWidth,
    );
    await page
      .getByRole("button", { name: "Save event packet", exact: true })
      .click();
    await page
      .getByText("Event packet saved. Version 1.", { exact: true })
      .waitFor();
    await page.reload();
    await page.getByText("Saved · Version 1", { exact: true }).waitFor();
    await page
      .getByRole("combobox", { name: /Select text box/ })
      .selectOption({ label: "1. name" });
    assert.equal(
      await page.getByLabel("Font size", { exact: true }).inputValue(),
      "50",
    );
    await fs.mkdir("test-results/event-builder", { recursive: true });
    await page.screenshot({
      path: "test-results/event-builder/flyer-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Itinerary", exact: true }).click();
    await page
      .getByRole("button", { name: "+ Itinerary item", exact: true })
      .click();
    await page.getByLabel("Start time", { exact: true }).fill("17:30");
    await page.getByLabel("End time", { exact: true }).fill("19:30");
    await page.getByLabel("Activity", { exact: true }).fill("Community Dinner");
    await page.getByLabel("Location", { exact: true }).fill("Event tent");
    await page
      .getByLabel("Responsible person", { exact: true })
      .fill("Coordinator");
    await page
      .getByRole("button", { name: "Save event packet", exact: true })
      .click();
    await page
      .getByText("Event packet saved. Version 2.", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Buildings & tents", exact: true })
      .click();
    const frame = page.frameLocator("iframe");
    await frame
      .getByRole("button", { name: '60" round table', exact: false })
      .waitFor();
    await frame
      .getByRole("button", { name: '60" round table', exact: false })
      .click();
    await page
      .getByRole("button", { name: "Save event packet", exact: true })
      .click();
    await page
      .getByText("Event packet saved. Version 3.", { exact: true })
      .waitFor();
    await page.reload();
    await page.getByText("Saved · Version 3", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Buildings & tents", exact: true })
      .click();
    await frame.locator("#itemList .item-row").waitFor();
    assert.equal(await frame.locator("#itemList .item-row").count(), 1);
    await page
      .getByRole("button", { name: "Invitations & signs", exact: true })
      .click();
    await page
      .getByRole("button", { name: "+ Material request", exact: true })
      .click();
    await page.getByLabel("Quantity", { exact: true }).fill("80");
    await page
      .getByLabel("Size / specifications", { exact: true })
      .fill("5 x 7 inches");
    await page
      .getByLabel("Wording", { exact: true })
      .fill("Community Dinner — June 12 at 5:30 PM");
    await page
      .getByRole("button", { name: "Save event packet", exact: true })
      .click();
    await page
      .getByText("Event packet saved. Version 4.", { exact: true })
      .waitFor();
    const order = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export EIC order request", exact: true })
      .click();
    const orderFile = await (await order).path();
    const handoff = JSON.parse(await fs.readFile(orderFile, "utf8"));
    assert.equal(handoff.items[0].quantity, 80);
    assert.equal(handoff.master_event_id, "synthetic-master");
    assert.equal(handoff.order_status, "draft_request");
    await page
      .getByRole("button", { name: "Sponsor builder", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Load workbook starter catalog",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Search sponsor builder", { exact: true })
      .fill("Tee");
    assert.ok((await page.locator("tbody tr").count()) > 0);
    await page.getByLabel("Search sponsor builder", { exact: true }).fill("");
    await page
      .getByLabel("Search sponsor builder", { exact: true })
      .fill("Tee Sign Sponsor");
    await page.getByRole("button", { name: "Manage", exact: true }).click();
    await page.getByLabel("Price (USD)", { exact: true }).fill("100");
    await page.getByLabel("Offer alone", { exact: true }).check();
    await page
      .getByRole("button", { name: "Sales & fulfillment", exact: true })
      .click();
    await page
      .getByRole("button", { name: "+ Add sponsor sale", exact: true })
      .click();
    await page
      .getByLabel("Sponsor / customer", { exact: true })
      .fill("Synthetic Sponsor");
    await page
      .getByRole("combobox", { name: /^Offer/ })
      .selectOption({ label: "Tee Sign Sponsor" });
    await page
      .getByLabel("Receipt / reference", { exact: true })
      .fill("Synthetic receipt");
    await page
      .getByLabel("Payment received (manual record)", { exact: true })
      .check();
    assert.equal(
      await page.getByLabel("Quantity", { exact: true }).isDisabled(),
      true,
    );
    await page.getByLabel("Hole / placement", { exact: true }).fill("Hole 8");
    await page
      .getByLabel("Wording / instructions", { exact: true })
      .fill("Thank you Synthetic Sponsor");
    await page.getByLabel("Size", { exact: true }).fill("18 x 24");
    await page
      .getByRole("button", { name: "Save event packet", exact: true })
      .click();
    await page
      .getByText("Event packet saved. Version 5.", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Course games & vendors", exact: true })
      .click();
    await page
      .getByLabel("Actual course image", { exact: true })
      .setInputFiles({
        name: "synthetic-course.png",
        mimeType: "image/png",
        buffer: await page.screenshot({
          clip: { x: 0, y: 0, width: 500, height: 300 },
        }),
      });
    await page.locator(".course-map-canvas img").waitFor();
    await page
      .locator(".course-map-canvas img")
      .click({ position: { x: 80, y: 80 } });
    const pin = page.locator(".course-pin");
    const pinBounds = await pin.boundingBox();
    await page.mouse.move(pinBounds.x + 10, pinBounds.y + 10);
    await page.mouse.down();
    await page.mouse.move(pinBounds.x + 90, pinBounds.y + 50, { steps: 5 });
    await page.mouse.up();
    assert.equal(await page.locator(".course-pin").count(), 1);
    await page
      .getByLabel("Activity / vendor label", { exact: true })
      .fill("Closest to pin — Hole 8");
    await page
      .getByRole("button", { name: "Save event packet", exact: true })
      .click();
    await page
      .getByText("Event packet saved. Version 6.", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Packet export", exact: true })
      .click();
    const packet = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Download printable packet / Save PDF",
        exact: true,
      })
      .click();
    const html = await fs.readFile(await (await packet).path(), "utf8");
    assert.ok(html.includes("Community Dinner"));
    assert.ok(html.includes("5 x 7 inches"));
    assert.ok(html.includes("Community Dinner — June 12 at 5:30 PM"));
    assert.ok(
      html.includes("Sponsors &amp;") ||
        html.includes("Sponsors & fulfillment"),
    );
    assert.ok(html.includes("60"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Invitations & signs", exact: true })
      .click();
    await page.screenshot({
      path: "test-results/event-builder/materials-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await page.evaluate(() => (window.packetFixture.conflict = true));
    await page
      .getByRole("button", { name: "+ Material request", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save event packet", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Someone saved newer" })
      .waitFor();
    await page
      .getByRole("button", { name: "Packet export", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", {
          name: "Download printable packet / Save PDF",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: bound flyer editing; save/reopen; itinerary; embedded layout save/reopen; sponsor catalog; material context handoff; complete packet download; mobile width; stale-save export block; no browser errors.",
    );
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

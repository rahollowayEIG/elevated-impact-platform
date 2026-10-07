const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
(async () => {
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4191, strictPort: true },
  });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
      ...(process.env.CHROME_HEADLESS_SHELL === "1"
        ? { args: ["--no-sandbox", "--disable-gpu", "--single-process"] }
        : {}),
    });
    const page = await browser.newPage({
      viewport: { width: 1360, height: 950 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await fs.mkdir("test-results/inception-apex", { recursive: true });
    await page.goto("http://127.0.0.1:4191/tests/inception-apex.html");
    await page
      .getByText("Your next idea starts here.", { exact: true })
      .waitFor();
    assert.equal(await page.locator("vite-error-overlay").count(), 0);
    await page.screenshot({
      path: "test-results/inception-apex/dashboard-desktop.png",
      fullPage: true,
    });
    await page.locator(".ia-material-flyer").click();
    await page
      .getByLabel("Connect to an event", { exact: true })
      .selectOption("synthetic-event");
    await page.getByLabel("Project name", { exact: true }).fill("Dinner flyer");
    await page
      .getByRole("button", { name: "Open designer", exact: true })
      .click();
    await page
      .getByLabel("Select text box", { exact: true })
      .selectOption({ label: "1. name" });
    await page.getByLabel("Font size", { exact: true }).fill("48");
    const logo = await page.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = 120; canvas.height = 60;
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "#d81c22"; ctx.fillRect(0, 0, 120, 60);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await page.getByLabel("Add logo or photo", { exact: true }).setInputFiles({
      name: "sponsor-logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(logo, "base64"),
    });
    await page.getByLabel("Image X", { exact: true }).fill("100");
    await page
      .getByRole("button", { name: "sponsor-logo.png image", exact: true })
      .focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.getByLabel("Image X", { exact: true }).inputValue(),
      "105",
    );
    await page
      .getByRole("button", {
        name: "Details & creative direction",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Creative direction", { exact: true })
      .fill("Navy, red accents, relaxed outdoor event");
    await page.getByLabel("Save as a favorite", { exact: true }).check();
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await page
      .getByText("Project saved. Version 1.", { exact: true })
      .waitFor();
    await page.reload();
    await page.getByRole("button", { name: /Dinner flyer.*Favorite/ }).click();
    await page
      .getByRole("button", {
        name: "Details & creative direction",
        exact: true,
      })
      .click();
    assert.equal(
      await page.getByLabel("Creative direction", { exact: true }).inputValue(),
      "Navy, red accents, relaxed outdoor event",
    );
    await page.getByRole("button", { name: "Design", exact: true }).click();
    await page
      .getByLabel("Select image", { exact: true })
      .selectOption({ label: "sponsor-logo.png" });
    assert.equal(
      await page.getByLabel("Image X", { exact: true }).inputValue(),
      "105",
    );
    await page
      .getByRole("button", { name: "Preview & approve", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save & approve design", exact: true })
      .click();
    await page
      .getByText("Design approved. Version 2.", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Attach to event packet", exact: true })
      .click();
    await page.getByText(/Approved design attached/).waitFor();
    assert.deepEqual(
      await page.evaluate(() =>
        window.inceptionFixture.attached.map((p) => p.version),
      ),
      [2],
    );
    const requestDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download production request", exact: true })
      .click();
    const requestFile = await (await requestDownload).path();
    const request = JSON.parse(await fs.readFile(requestFile, "utf8"));
    assert.equal(request.source_app, "InceptionApex");
    assert.equal(request.artwork_version, 2);
    assert.equal(request.order_status, "draft_request");
    assert.ok(!request.artwork_svg.includes("DRAFT DESIGN"));
    assert.ok(request.artwork_svg.includes("data:image/png"));
    await page.screenshot({
      path: "test-results/inception-apex/approved-proof-desktop.png",
      fullPage: true,
    });
    await page
      .getByLabel("Project name", { exact: true })
      .fill("Revised dinner flyer");
    assert.equal(
      await page
        .getByRole("button", {
          name: "Download production request",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    await page.evaluate(() => {
      window.inceptionFixture.conflict = true;
    });
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await page.getByText(/Someone saved a newer version/).waitFor();
    assert.ok(
      (await page.locator(".ia-project-state").innerText()).includes(
        "Unsaved changes",
      ),
    );
    const backupDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download project backup", exact: true })
      .click();
    const backup = JSON.parse(
      await fs.readFile(await (await backupDownload).path(), "utf8"),
    );
    assert.equal(backup.name, "Revised dinner flyer");
    assert.equal(backup.data.design.images.length, 1);
    await page.getByRole("button", { name: "My designs", exact: true }).click();
    await page.getByLabel("Search designs", { exact: true }).fill("dinner");
    await page.getByLabel("Show", { exact: true }).selectOption("favorites");
    assert.equal(await page.locator(".ia-library tbody tr").count(), 1);
    await page.getByRole("button", { name: "Project", exact: true }).click();
    assert.equal(
      await page.locator("th").first().getAttribute("aria-sort"),
      "ascending",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/inception-apex/dashboard-mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.getByRole("button", { name: /Dinner flyer.*Favorite/ }).click();
    await page
      .getByRole("button", {
        name: "Details & creative direction",
        exact: true,
      })
      .click();
    await page.screenshot({
      path: "test-results/inception-apex/details-mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.deepEqual(errors, []);
    process.stdout.write(
      "InceptionApex desktop/mobile, logo editing, saved projects, approval, handoff, conflict recovery and backups passed.\n",
    );
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

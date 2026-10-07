const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
(async () => {
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4198, strictPort: true },
  });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
    });
    const page = await browser.newPage({
      viewport: { width: 1360, height: 950 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await fs.mkdir("test-results/social-media", { recursive: true });
    await page.goto("http://127.0.0.1:4198/tests/social-media.html");
    await page
      .getByRole("button", { name: "New campaign", exact: true })
      .waitFor();
    await page.getByRole("button", { name: /^Physical spaces/ }).click();
    await page.getByLabel("Search opportunities", { exact: true }).fill("hole");
    assert.equal(
      await page.getByRole("button", { name: /^Build hole/ }).count(),
      2,
    );
    await page
      .getByRole("button", { name: "Build hole-in-one challenge", exact: true })
      .click();
    await page
      .getByLabel("Campaign name", { exact: true })
      .fill("Car challenge");
    await page
      .getByLabel("Event context", { exact: true })
      .selectOption("synthetic-event");
    await page
      .getByLabel("Sponsor or partner", { exact: true })
      .fill("A & B Motors");
    await page.getByLabel("Headline", { exact: true }).fill("Win a <car>");
    await page
      .getByLabel("Message", { exact: true })
      .fill("Hole 7 par 3. See the approved official contest rules.");
    await page
      .getByLabel("Destination link", { exact: true })
      .fill("https://example.com/rules?a=1&b=2");
    await page.getByLabel("Course website", { exact: true }).check();
    await page
      .getByLabel("Desired publish time", { exact: true })
      .fill("2027-06-12T09:00");
    assert.equal(
      await page
        .getByRole("button", { name: "Download website ad", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: "Publish · connection pending",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByText("Draft saved. Version 1. Nothing has been published.", {
        exact: true,
      })
      .waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: "Car challenge", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Sponsor or partner", { exact: true }).inputValue(),
      "A & B Motors",
    );
    assert.equal(
      await page
        .getByLabel("Desired publish time", { exact: true })
        .inputValue(),
      "2027-06-12T09:00",
    );
    assert.equal(
      await page.getByLabel("Event context", { exact: true }).isDisabled(),
      true,
    );
    await page
      .getByRole("button", { name: "Save as reviewed", exact: true })
      .click();
    await page
      .getByText(
        "Reviewed campaign saved. Version 2. Nothing has been published.",
        { exact: true },
      )
      .waitFor();
    const adDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download website ad", exact: true })
      .click();
    const html = await fs.readFile(await (await adDownload).path(), "utf8");
    assert.ok(html.includes("Win a &lt;car&gt;"));
    assert.ok(html.includes("A &amp; B Motors"));
    assert.ok(html.includes("a=1&amp;b=2"));
    assert.ok(!html.includes("<script"));
    await page.screenshot({
      path: "test-results/social-media/campaign-desktop.png",
      fullPage: true,
    });
    await page.getByLabel("Message", { exact: true }).fill("Changed offer");
    assert.equal(
      await page
        .getByRole("button", { name: "Download website ad", exact: true })
        .isDisabled(),
      true,
    );
    page.once("dialog", (d) => d.dismiss());
    await page
      .getByRole("button", { name: "New campaign", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Campaign name", { exact: true }).inputValue(),
      "Car challenge",
    );
    await page.evaluate(() => {
      window.socialFixture.conflict = true;
    });
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "newer version" })
      .waitFor();
    const backupDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download draft backup", exact: true })
      .click();
    const backup = JSON.parse(
      await fs.readFile(await (await backupDownload).path(), "utf8"),
    );
    assert.equal(backup.data.body, "Changed offer");
    assert.equal(backup.status, "draft");
    assert.equal(backup.version, 2);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: "test-results/social-media/campaign-mobile.png",
      fullPage: true,
    });
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Close campaign", exact: true })
      .click();
    await page.getByLabel("Search campaigns", { exact: true }).fill("car");
    await page
      .getByLabel("Show campaigns", { exact: true })
      .selectOption("reviewed");
    assert.equal(
      await page
        .getByRole("button", { name: "Car challenge", exact: true })
        .count(),
      1,
    );
    await page
      .getByRole("button", { name: /^Campaign/ })
      .filter({ hasText: "Campaign" })
      .first()
      .click();
    assert.deepEqual(errors, []);
    console.log(
      "Social campaign desktop/mobile, opportunities, save/reopen, review, escaped ad export, stale saves, backups and unsaved guards passed.",
    );
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

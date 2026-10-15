const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

(async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ server: { host: "127.0.0.1", port: 4198, strictPort: true } });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await fs.mkdir("test-results/eig-build-lab", { recursive: true });
    await page.goto("http://127.0.0.1:4198/tests/eig-build-lab.html");
    await page.getByRole("heading", { name: /Build Lab Project Architect/ }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Download reusable JSON" }).count(), 0);
    await page.getByRole("button", { name: "Load InceptionApex pilot" }).click();
    assert.equal(await page.getByLabel("What are we doing?").inputValue(), "ui_review");
    await page.getByRole("button", { name: /Create draft blueprint/ }).click();
    await page.getByText("Evaluate a reusable tool first").waitFor();
    await page.getByText("InceptionApex creative studio", { exact: false }).waitFor();
    const proposals = page.locator(".bl-suggestion");
    assert.equal(await proposals.count(), 6);
    await proposals.first().getByRole("button", { name: /Accept/ }).click();
    assert.match(await page.locator(".bl-suggestions").innerText(), /1 accepted or edited/);
    const ui = proposals.filter({ hasText: "Run a cosmetic and interaction audit" });
    assert.match(await ui.innerText(), /InceptionApex UI & Workflow Improvement/);
    await ui.getByRole("button", { name: "Revise" }).click();
    const suggestedCopy = await ui.getByLabel("Revised requirement").inputValue();
    assert.match(suggestedCopy, /form-label contrast/);
    assert.match(suggestedCopy, /InceptionApex/);
    await ui.getByText(/Auto-filled from your project goal/).waitFor();
    await ui.getByLabel("Revised requirement").fill("Standardize flyer button hierarchy and mobile previews.");
    await ui.getByRole("button", { name: "Save revision" }).click();
    assert.equal(await ui.locator(".state-edit").count(), 1);
    const prototype = proposals.filter({ hasText: "Build one end-to-end example" });
    await prototype.getByRole("button", { name: /Reject/ }).click();
    assert.equal(await prototype.locator(".state-reject").count(), 1);
    await page.getByText(/Your project and review decisions save automatically/).waitFor();
    await page.waitForFunction(() => window.buildLabHarness.dirty === false);
    // Navigating away must no longer destroy the working blueprint or reviews.
    await page.getByRole("button", { name: /EIG Command Center/ }).click();
    await page.getByRole("button", { name: "Return to Build Lab" }).click();
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".state-accept").count(), 1);
    assert.equal(await page.locator(".state-edit").count(), 1);
    assert.equal(await page.locator(".state-reject").count(), 1);
    // Editing a revision without saving must also survive exit/reentry.
    await ui.getByRole("button", { name: "Revise" }).click();
    await ui.getByLabel("Revised requirement").fill("Halfway through revising this proposal.");
    await page.getByRole("button", { name: /EIG Command Center/ }).click();
    await page.getByRole("button", { name: "Return to Build Lab" }).click();
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await ui.getByLabel("Revised requirement").inputValue(), "Halfway through revising this proposal.");
    await ui.getByRole("button", { name: "Cancel" }).click();
    // A browser reload should restore the current owner draft as well.
    await page.reload();
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".state-accept").count(), 1);
    assert.equal(await page.locator(".state-edit").count(), 1);
    assert.equal(await page.locator(".state-reject").count(), 1);
    await page.screenshot({ path: "test-results/eig-build-lab/review-desktop.png", fullPage: true });

    const mdWait = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download readable blueprint" }).click();
    const md = await mdWait;
    assert.match(await fs.readFile(await md.path(), "utf8"), /Standardize flyer button hierarchy/);
    assert.equal(await page.evaluate(() => window.buildLabHarness.dirty), false);

    const jsonWait = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download reusable JSON" }).click();
    const jsonFile = await jsonWait;
    const jsonData = JSON.parse(await fs.readFile(await jsonFile.path(), "utf8"));
    assert.equal(jsonData.status, "draft_requires_review");
    assert.equal(jsonData.suggestions.find((x) => x.id === "ui").review, "edit");
    assert.equal(await page.evaluate(() => window.buildLabHarness.dirty), false);

    await page.getByLabel("Goal and definition of success").fill("Make the design editor simpler on mobile and desktop.");
    await page.getByRole("button", { name: /Regenerate as next draft version/ }).click();
    await page.getByText("Draft blueprint · version 2").waitFor();
    assert.match(await page.locator(".bl-suggestions").innerText(), /6 awaiting review/);

    await page.getByLabel("Import Build Lab JSON").setInputFiles({
      name: "original-eig-blueprint.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(jsonData)),
    });
    await page.getByText(/Blueprint reopened from your local file/).waitFor();
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".state-edit").count(), 1);
    assert.equal(await page.locator(".state-reject").count(), 1);
    // The same browser cannot restore a different owner's saved work.
    await page.evaluate(() => window.buildLabHarness.setOwner("22222222-2222-4222-8222-222222222222"));
    await page.getByText("Your blueprint appears here").waitFor();
    assert.equal(await page.getByLabel("Project name").inputValue(), "");
    await page.evaluate(() => window.buildLabHarness.setOwner("11111111-1111-4111-8111-111111111111"));
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".state-edit").count(), 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/eig-build-lab/review-mobile.png", fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log("Build Lab browser pilot passed.");
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

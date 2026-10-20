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
    // Master Scanner gets its own owner-authenticated, read-only client path.
    // This fixture checks UI/search/review persistence. Separate unit tests
    // read the committed source, compare actual dated database metadata and
    // test server-side authorization before any files are read.
    const masterFixture = {
      schemaVersion: 1, kind: "eig_build_lab_master_scan", target: "elevationpilot",
      scannerVersion: "source-plus-dated-schema-v1", sourceVersion: "a".repeat(40),
      inspectedAt: "2026-10-20T22:00:00.000Z",
      sourceFingerprint: "d".repeat(64),
      files: [{ path: "src/PlatformApp.jsx", lines: 1000, kind: "source" }],
      modules: [
        { id: "event-builder", title: "Event Builder", priority: "high",
          status: "evidence_present", sourceStatus: "source_marker_found",
          uiStatus: "ui_marker_found", testStatus: "test_code_found", dbStatus: "tables_in_dated_snapshot",
          evidence: [{ kind: "ui", path: "src/PlatformApp.jsx", line: 8, excerpt: "<EieEventSetupSteps" }],
          tables: [{ table: "events", production: true, sandbox: true }],
          nextCheck: "Run an authorized Sandbox event-creation and save/reopen browser test." },
        { id: "invoices", title: "EIG Invoicing", priority: "high",
          status: "not_observed_in_sample", sourceStatus: "not_observed_in_sample",
          uiStatus: "not_observed_in_sample", testStatus: "not_sampled", dbStatus: "snapshot_gap",
          evidence: [], tables: [{ table: "invoices", production: false, sandbox: false }],
          nextCheck: "Check full repository before designing an invoice issuer." },
      ],
      summary: { modulesReviewed: 2, evidencePresent: 1, reviewNeeded: 0, notObservedInSample: 1 },
      database: {
        capturedOn: "2026-10-20", freshLiveQuery: false, productionTables: 71, sandboxTables: 71,
        missingInSandbox: [], missingInProduction: [],
        policyDifferences: [{ table: "events", productionPolicies: 4, sandboxPolicies: 5,
          productionRls: true, sandboxRls: true }],
        rlsDisabled: { production: [], sandbox: [] },
      },
      limitations: ["Static source inspection only.", "Dated schema metadata snapshot only."],
      safety: { readOnly: true, liveChanges: false, customerRowsRead: false,
        autoApproved: false, autoDeployed: false },
    };
    await page.route("**/api/eig-build-lab-master-scan", async (route) => {
      assert.equal(route.request().method(), "POST");
      assert.deepEqual(route.request().postDataJSON(), { target: "elevationpilot" });
      assert.match(route.request().headers().authorization || "", /Bearer synthetic-browser-test-token/);
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, report: masterFixture }) });
    });
    await page.getByRole("button", { name: /Run Read-Only Master Scan/ }).click();
    await page.locator(".blm-table").getByText("Event Builder", { exact: true }).waitFor();
    await page.locator(".blm-schema").getByText(/events:/).waitFor();
    assert.equal(await page.locator(".blm-table tbody tr").count(), 2);
    await page.getByLabel("Search Master Scanner modules").fill("invoice");
    assert.equal(await page.locator(".blm-table tbody tr").count(), 1);
    await page.getByLabel("Search Master Scanner modules").fill("");
    const masterRow = page.locator(".blm-table tbody tr").filter({ hasText: "Event Builder" });
    await masterRow.locator("summary").click();
    await masterRow.getByRole("button", { name: "Accept for follow-up" }).click();
    await page.waitForFunction(() => {
      const data = window.localStorage.getItem("eig:master-scan:v1:11111111-1111-4111-8111-111111111111");
      return data && JSON.parse(data).reviews["event-builder"]?.review === "accept";
    });
    await page.reload();
    const masterRestored = page.locator(".blm-table tbody tr").filter({ hasText: "Event Builder" });
    await masterRestored.locator("summary").click();
    assert.match(await masterRestored.innerText(), /Review: accept/);
    assert.equal(await page.locator(".blm-root").getByRole("button", { name: "Export JSON" }).count(), 1);

    // The scanner is mocked here to exercise authenticated UI and local
    // review persistence; separate server tests read actual first-party files.
    const scanFixture = {
      schemaVersion: 1, kind: "eig_build_lab_code_scan",
      target: "inception_apex", targetLabel: "InceptionApex",
      sourceVersion: "a".repeat(40), sourceFingerprint: "b".repeat(64),
      inspectedAt: "2026-10-15T14:00:00.000Z", scannerVersion: "inception-code-v1",
      files: [
        { path: "src/components/InceptionApex.jsx", lines: 1361 },
        { path: "src/components/inception-apex.css", lines: 623 },
      ],
      findings: [
        {
          id: "ia-native-confirm", category: "Workflow", priority: "medium",
          title: "Review native confirmation dialogs",
          observation: "First-party source calls window.confirm during navigation.",
          recommendation: "Consider a reusable confirmation component.",
          provenance: "observed_in_first_party_source", review: "pending",
          evidence: [{ path: "src/components/InceptionApex.jsx", line: 232, excerpt: "window.confirm(" }],
        },
        {
          id: "ia-form-focus", category: "Accessibility", priority: "low",
          title: "Check field focus indicators",
          observation: "Stylesheet defines focus-visible on buttons.",
          recommendation: "Inspect field focus on mobile and keyboard.",
          provenance: "observed_in_first_party_source", review: "pending",
          evidence: [{ path: "src/components/inception-apex.css", line: 393, excerpt: ".ia-app button:focus-visible {" }],
        },
      ],
      limitations: "Static source inspection only, not a runtime UI test.",
      safety: { readOnly: true, liveChanges: false, autoApproved: false },
    };
    await page.route("**/api/eig-build-lab-scan", async (route) => {
      assert.equal(route.request().method(), "POST");
      assert.equal(route.request().postDataJSON().target, "inception_apex");
      assert.match(route.request().headers().authorization || "", /Bearer synthetic-browser-test-token/);
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, report: scanFixture }) });
    });
    await page.getByRole("button", { name: /Inspect InceptionApex source/ }).click();
    await page.getByText("Review native confirmation dialogs").waitFor();
    await page.getByRole("button", { name: "Download source report JSON" }).waitFor();
    const firstScanFinding = page.locator(".bl-scan-finding").filter({ hasText: "Review native confirmation dialogs" });
    await firstScanFinding.locator("summary").click();
    await firstScanFinding.getByText(/src\/components\/InceptionApex.jsx:232/).waitFor();
    await firstScanFinding.getByRole("button", { name: "Accept" }).click();
    assert.equal(await firstScanFinding.locator(".state-accept").count(), 1);
    await page.getByRole("button", { name: /EIG Command Center/ }).click();
    await page.getByRole("button", { name: "Return to Build Lab" }).click();
    await page.getByText("Review native confirmation dialogs").waitFor();
    assert.equal(await page.locator(".bl-scan-finding .state-accept").count(), 1);
    await page.reload();
    await page.getByText("Review native confirmation dialogs").waitFor();
    assert.equal(await page.locator(".bl-scan-finding .state-accept").count(), 1);
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
    assert.equal(await page.locator(".bl-suggestions .state-accept").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-edit").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-reject").count(), 1);
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
    assert.equal(await page.locator(".bl-suggestions .state-accept").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-edit").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-reject").count(), 1);
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
    await page.getByText(/Blueprint reopened\. It will now be saved automatically/).waitFor();
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".bl-suggestions .state-edit").count(), 1);
    assert.equal(await page.locator(".bl-suggestions .state-reject").count(), 1);
    // The same browser cannot restore a different owner's saved work.
    await page.evaluate(() => window.buildLabHarness.setOwner("22222222-2222-4222-8222-222222222222"));
    await page.getByText("Your blueprint appears here").waitFor();
    assert.equal(await page.getByLabel("Project name").inputValue(), "");
    await page.evaluate(() => window.buildLabHarness.setOwner("11111111-1111-4111-8111-111111111111"));
    await page.getByText("Draft blueprint · version 1").waitFor();
    assert.equal(await page.locator(".bl-suggestions .state-edit").count(), 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/eig-build-lab/review-mobile.png", fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    // Also preserve a partially typed mission before Generate is clicked.
    const partial = await browser.newPage({ viewport: { width: 950, height: 850 } });
    await partial.goto("http://127.0.0.1:4198/tests/eig-build-lab.html");
    await partial.getByLabel("Project name").fill("Draft without a blueprint");
    await partial.getByLabel("Goal and definition of success").fill("Save this unfinished idea too.");
    await partial.getByRole("button", { name: /EIG Command Center/ }).click();
    await partial.getByRole("button", { name: "Return to Build Lab" }).click();
    assert.equal(await partial.getByLabel("Project name").inputValue(), "Draft without a blueprint");
    assert.equal(await partial.getByLabel("Goal and definition of success").inputValue(), "Save this unfinished idea too.");
    await partial.reload();
    assert.equal(await partial.getByLabel("Project name").inputValue(), "Draft without a blueprint");
    assert.equal(await partial.getByRole("button", { name: "Download reusable JSON" }).count(), 0);
    await partial.close();
    assert.deepEqual(errors, []);
    console.log("Build Lab browser pilot passed.");
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

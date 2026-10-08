const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
(async () => {
  process.env.VITE_SUPABASE_URL = "https://budget-fixture.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "budget-synthetic-public-key";
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4193, strictPort: true },
  });
  await server.listen();
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1360, height: 950 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let acceptDialog = true;
  page.on("dialog", (d) => (acceptDialog ? d.accept() : d.dismiss()));
  let saved = null,
    history = [],
    conflict = false,
    deny = false,
    received = 80000,
    clock = Date.now();
  const calls = [];
  const sources = () => ({
    refreshed_at: new Date(++clock).toISOString(),
    registration_count: 10,
    status_only_paid_count: 0,
    sponsor_plan_version: 1,
    income: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        source_key: "registration",
        name: "EIE registrations",
        category: "Registration",
        vendor: "EIE roster",
        notes: "System amounts",
        target_cents: 0,
        committed_cents: 100000,
        received_cents: received,
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        source_key: "sponsors",
        name: "Sponsor Builder sales",
        category: "Sponsorship",
        vendor: "Saved event packet",
        notes: "Saved sales",
        target_cents: 50000,
        committed_cents: 20000,
        received_cents: 20000,
      },
    ],
  });
  const result = () => ({
    budget: saved,
    sources: sources(),
    history,
    history_count: saved?.version || 0,
  });
  await page.route("https://budget-fixture.supabase.co/**", async (route) => {
    const req = route.request(),
      headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "content-type": "application/json",
      };
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (deny)
      return route.fulfill({
        status: 403,
        headers,
        body: JSON.stringify({
          code: "42501",
          message: "Authorized event budget access is required",
        }),
      });
    const body = req.postDataJSON();
    calls.push({ url: req.url(), body });
    assert.equal(body.p_event_id, "40000000-0000-0000-0000-000000000001");
    if (req.url().endsWith("/read_eie_event_budget"))
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(result()),
      });
    assert.ok(req.url().endsWith("/save_eie_event_budget"));
    if (conflict || body.p_expected_version !== (saved?.version || 0))
      return route.fulfill({
        status: 409,
        headers,
        body: JSON.stringify({
          code: "40001",
          message:
            "Someone saved a newer budget. Export your draft, then reload before saving.",
        }),
      });
    saved = {
      event_id: body.p_event_id,
      data: body.p_data,
      version: (saved?.version || 0) + 1,
      updated_by: "synthetic-editor",
    };
    history.unshift({
      version: saved.version,
      created_at: new Date().toISOString(),
      actor_user_id: "synthetic-editor",
    });
    return route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify(result()),
    });
  });
  try {
    await page.goto("http://127.0.0.1:4193/tests/event-budget.html");
    await page
      .getByText("No saved budget yet · USD", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Add manual cost", exact: true })
      .click();
    await page.getByLabel("Item name", { exact: true }).fill("Meals");
    await page.getByLabel(/^Category/).selectOption("Food & beverage");
    await page.getByLabel("Quantity", { exact: true }).fill("10");
    await page.getByLabel("Unit estimate (USD)", { exact: true }).fill("25.00");
    await page.getByLabel("Actual total (USD)", { exact: true }).fill("270.00");
    await page.getByLabel("Paid total (USD)", { exact: true }).fill("100.00");
    await page.getByRole("button", { name: "Apply item", exact: true }).click();
    assert.ok(
      (await page.locator(".budget-stats").innerText()).includes("$900.00"),
    );
    acceptDialog = false;
    await page
      .getByRole("button", { name: "Event directory", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("heading", { name: "Plan the event. Know the numbers." })
        .count(),
      1,
    );
    acceptDialog = true;
    await page.getByRole("button", { name: "Edit planning settings" }).click();
    await page.getByLabel("Event net / fundraising goal (USD)").fill("1000.00");
    await page.getByLabel("Contingency reserve (%)").fill("10");
    await page
      .getByLabel("EIE registration income target (USD)")
      .fill("1200.00");
    await page.getByRole("button", { name: "Apply settings" }).click();
    await page.getByRole("tab", { name: "Income (0)", exact: true }).click();
    await page
      .getByRole("button", { name: "Add manual income", exact: true })
      .click();
    await page
      .getByLabel("Item name", { exact: true })
      .fill("Outside donation");
    await page.getByLabel(/^Category/).selectOption("Donation");
    await page.getByLabel("Target (USD)", { exact: true }).fill("100");
    await page.getByLabel("Committed total (USD)", { exact: true }).fill("50");
    await page.getByLabel("Received (USD)", { exact: true }).fill("100");
    await page.getByRole("button", { name: "Apply item", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Received income cannot exceed" })
      .waitFor();
    await page.getByLabel("Received (USD)", { exact: true }).fill("25");
    await page.getByRole("button", { name: "Apply item", exact: true }).click();
    await page
      .getByRole("button", { name: "Save budget", exact: true })
      .click();
    await page.getByText("Budget saved. Version 1.", { exact: true }).waitFor();
    assert.equal(saved.data.costs[0].unit_cents, 2500);
    assert.equal(saved.data.income.length, 1);
    assert.ok(!saved.data.income.some((r) => r.source_key));
    await page.reload();
    await page.getByText("Saved · Version 1 · USD", { exact: true }).waitFor();
    await page
      .getByLabel("Budget notes", { exact: true })
      .fill("Keep outside costs separate");
    received = 90000;
    await page
      .getByRole("button", { name: "Refresh system totals", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.querySelector(".budget-stats").innerText.includes("$1,025.00"), null, {timeout:10000}
    );
    assert.equal(
      await page.getByLabel("Budget notes", { exact: true }).inputValue(),
      "Keep outside costs separate",
    );
    conflict = true;
    await page
      .getByRole("button", { name: "Save budget", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Someone saved a newer budget" })
      .waitFor();
    assert.equal(
      await page.getByLabel("Budget notes", { exact: true }).inputValue(),
      "Keep outside costs separate",
    );
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export budget CSV", exact: true })
      .click();
    const d = await downloaded;
    const csv = await fs.readFile(await d.path(), "utf8");
    assert.ok(csv.includes("System income"));
    assert.ok(csv.includes("Unsaved draft"));
    assert.ok(csv.includes("Keep outside costs separate"));
    assert.ok(csv.includes("System totals refreshed"));
    conflict = false;
    await page
      .getByRole("button", { name: "Save budget", exact: true })
      .click();
    await page.getByText("Budget saved. Version 2.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit Meals", exact: true }).click();
    await page.getByLabel("Actual total (USD)", { exact: true }).fill("0");
    await page.getByLabel("Paid total (USD)", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Apply item", exact: true }).click();
    await page
      .getByRole("button", { name: "Help me find sponsors", exact: true })
      .click();
    await page.getByText("sponsors opened", { exact: true }).waitFor();
    assert.equal(saved.version, 3);
    assert.equal(saved.data.costs[0].actual_cents, 0);
    await page.getByRole("button", { name: "Budget", exact: true }).click();
    await page.getByText("Saved · Version 3 · USD", { exact: true }).waitFor();
    await fs.mkdir("test-results/event-budget", { recursive: true });
    await page.screenshot({
      path: "test-results/event-budget/desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/event-budget/mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    deny = true;
    await page.reload();
    await page
      .getByRole("alert")
      .filter({ hasText: "Authorized event budget access" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Save budget", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "Budget browser passed: actual Supabase RPC payloads, sources, manual entries, validation, navigation protection, save/reopen, refresh preservation, conflicts, exports, sponsor handoff, access errors, mobile.",
    );
  } catch (e) {
    await fs.mkdir("test-results/event-budget", { recursive: true });
    await page.screenshot({
      path: "test-results/event-budget/failure.png",
      fullPage: true,
    });
    console.error((await page.locator("body").innerText()).slice(-3500));
    throw e;
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

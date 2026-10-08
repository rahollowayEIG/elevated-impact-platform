const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
(async () => {
  process.env.VITE_SUPABASE_URL = "https://social-fixture.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "social-synthetic-public-key";
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4192, strictPort: true },
  });
  await server.listen();
  let browser;
  const rows = [],
    requests = [],
    errors = [];
  let conflict = false,
    deny = false;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
    });
    const page = await browser.newPage({
      viewport: { width: 1360, height: 950 },
      timezoneId: "America/New_York",
    });
    page.setDefaultTimeout(12000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.route("https://social-fixture.supabase.co/**", async (route) => {
      const req = route.request(),
        headers = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "content-type": "application/json",
        };
      if (req.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      const path = new URL(req.url()).pathname;
      const body = req.method() === "POST" ? req.postDataJSON() : null;
      requests.push({ path, body });
      if (deny)
        return route.fulfill({
          status: 403,
          headers,
          body: JSON.stringify({
            code: "42501",
            message: "Authorized campaign access is required",
          }),
        });
      let response;
      if (path === "/rest/v1/social_campaigns") response = rows;
      else if (path === "/rest/v1/rpc/list_social_events")
        response = [
          {
            id: "40000000-0000-0000-0000-000000000001",
            name: "Community Golf Outing",
          },
        ];
      else {
        assert.equal(path, "/rest/v1/rpc/save_social_campaign");
        assert.equal(body.p_event_id, "40000000-0000-0000-0000-000000000001");
        const current = rows.find((r) => r.id === body.p_campaign_id);
        if (conflict || body.p_expected_version !== (current?.version || 0))
          return route.fulfill({
            status: 409,
            headers,
            body: JSON.stringify({
              code: "40001",
              message:
                "Someone saved a newer version. Download your changes, then reopen the campaign.",
            }),
          });
        response = {
          id: body.p_campaign_id,
          event_id: body.p_event_id,
          name: body.p_name,
          data: body.p_data,
          status: body.p_status,
          version: body.p_expected_version + 1,
          updated_at: new Date().toISOString(),
        };
        const index = rows.findIndex((r) => r.id === response.id);
        if (index >= 0) rows.splice(index, 1);
        rows.unshift(response);
      }
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(response),
      });
    });
    await fs.mkdir("test-results/social-media", { recursive: true });
    await page.goto("http://127.0.0.1:4192/tests/social-schedule.html");
    await page
      .getByRole("button", { name: "Use event countdown", exact: true })
      .click();
    await page
      .getByLabel("Campaign name", { exact: true })
      .fill("Community Countdown");
    await page
      .getByLabel("Event context", { exact: true })
      .selectOption("40000000-0000-0000-0000-000000000001");
    await page
      .getByLabel("Headline", { exact: true })
      .fill("Community Golf Outing");
    await page
      .getByLabel("Destination link", { exact: true })
      .fill("https://example.com/event");
    await page.getByLabel("Event hub", { exact: true }).uncheck();
    await page.getByLabel("Course website", { exact: true }).check();
    await page
      .getByLabel("Template anchor", { exact: true })
      .fill("2027-06-20T09:00");
    await page
      .getByRole("button", { name: "Build posting plan", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Post 1 time", { exact: true }).inputValue(),
      "2027-06-06T09:00",
    );
    assert.equal(
      await page.getByLabel("Post 4 time", { exact: true }).inputValue(),
      "2027-06-20T09:00",
    );
    await page
      .getByLabel("Post 1 message", { exact: true })
      .fill("Our verified opening announcement.");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByText("Draft saved. Version 1. Nothing has been published.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      rows[0].data.posts[0].body,
      "Our verified opening announcement.",
    );
    assert.deepEqual(rows[0].data.destinations, [
      "facebook",
      "instagram",
      "website",
    ]);
    await page.reload();
    await page
      .getByRole("button", { name: "Community Countdown", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Post 1 message", { exact: true }).inputValue(),
      "Our verified opening announcement.",
    );
    assert.equal(
      await page.getByLabel("Campaign time zone", { exact: true }).inputValue(),
      "America/New_York",
    );
    await page
      .getByLabel("Post 1 time", { exact: true })
      .fill("2027-06-01T09:00");
    await page
      .getByRole("button", { name: "Review & save posting plan", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "within the campaign dates" })
      .waitFor();
    assert.equal(rows[0].version, 1);
    await page
      .getByLabel("Post 1 time", { exact: true })
      .fill("2027-06-06T09:00");
    await page
      .getByRole("button", { name: "Review & save posting plan", exact: true })
      .click();
    await page
      .getByText(
        "Posting plan reviewed and saved. Version 2. Ready for manual posting; automatic publishing pending.",
        { exact: true },
      )
      .waitFor();
    await page
      .locator(".sm-editor")
      .screenshot({ path: "test-results/social-media/schedule-editor.png" });
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download posting calendar", exact: true })
      .click();
    const ics = await fs.readFile(await (await download).path(), "utf8");
    assert.ok(ics.includes("DTSTART:20270606T130000Z"));
    assert.equal(
      ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT").length,
      4,
    );
    assert.ok(ics.includes("Our verified opening announcement."));
    await page
      .getByRole("button", { name: "Close campaign", exact: true })
      .click();
    await page.getByLabel("Calendar month", { exact: true }).fill("2027-06");
    await page
      .getByRole("heading", {
        name: "June 2027 · 4 planned posts",
        exact: true,
      })
      .waitFor();
    await page
      .getByLabel("Schedule review state", { exact: true })
      .selectOption("draft");
    await page
      .getByText(
        "No saved posts match this month and filter. Save your plan or select another month.",
        { exact: true },
      )
      .waitFor();
    await page
      .getByLabel("Schedule review state", { exact: true })
      .selectOption("reviewed");
    await page
      .getByLabel("Search scheduled posts", { exact: true })
      .fill("verified opening");
    assert.equal(await page.locator(".sm-calendar-post").count(), 1);
    await page
      .getByRole("button", { name: "Agenda view", exact: true })
      .click();
    await page.getByRole("button", { name: /^Planned time/ }).click();
    assert.equal(await page.locator(".sm-calendar tbody tr").count(), 1);
    await page.getByLabel("Search scheduled posts", { exact: true }).fill("");
    await page
      .getByRole("button", { name: "Calendar view", exact: true })
      .click();
    await page.screenshot({
      path: "test-results/social-media/schedule-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: "test-results/social-media/schedule-mobile.png",
      fullPage: true,
    });
    await page.locator(".sm-calendar-post").first().click();
    await page
      .getByLabel("Post 1 message", { exact: true })
      .fill("Changed after review.");
    assert.equal(
      await page
        .getByRole("button", { name: "Download posting calendar", exact: true })
        .isDisabled(),
      true,
    );
    conflict = true;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "newer version" })
      .waitFor();
    const backup = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download draft backup", exact: true })
      .click();
    const json = JSON.parse(
      await fs.readFile(await (await backup).path(), "utf8"),
    );
    assert.equal(json.data.posts[0].body, "Changed after review.");
    conflict = false;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByText("Draft saved. Version 3. Nothing has been published.", {
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Use as new campaign", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Event context", { exact: true }).isDisabled(),
      false,
    );
    assert.equal(
      await page.getByLabel("Post 1 message", { exact: true }).inputValue(),
      "Changed after review.",
    );
    deny = true;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Authorized campaign access" })
      .waitFor();
    assert.equal(rows.length, 1);
    assert.equal(
      await page
        .getByRole("button", {
          name: "Publish · connection pending",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    assert.ok(
      requests.some(
        (r) =>
          r.path.endsWith("/save_social_campaign") &&
          r.body.p_data.posts.length === 4,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "Campaign templates, real client RPC contract, date validation, save/reopen/review, calendar search/filter/sort, ICS, duplicate/reset, stale draft recovery, denial and mobile passed.",
    );
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

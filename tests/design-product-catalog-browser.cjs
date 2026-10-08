const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { PNG } = require("pngjs");
(async () => {
  process.env.VITE_SUPABASE_URL = "https://catalog-fixture.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "fixture-key";
  const { newDesignProduct, cleanDesignProduct, designForProduct } =
    await import("../src/lib/designProducts.mjs");
  const { materialDesign } = await import("../src/lib/inceptionProject.mjs");
  const products = ["Tee sign", "Banner", "Flyer", "Swag artwork"].map(
    (name, i) =>
      cleanDesignProduct({
        ...newDesignProduct(["sign", "banner", "flyer", "swag"][i]),
        name,
        status: "active",
        version: 1,
        category: i < 2 ? "signage" : i === 2 ? "marketing" : "swag",
      }),
  );
  for (let i = 0; i < 10; i++)
    products.push(
      cleanDesignProduct({
        ...newDesignProduct(),
        name: `Starter ${i}`,
        version: 1,
        status: "active",
      }),
    );
  let conflict = false;
  const requests = [];
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4194, strictPort: true },
  });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const errors = [];
    async function pageFor(manager = true) {
      const page = await browser.newPage({
        viewport: { width: 1360, height: 950 },
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => d.accept());
      await page.route(
        "https://catalog-fixture.supabase.co/**",
        async (route) => {
          const req = route.request(),
            url = new URL(req.url()),
            body = req.postDataJSON();
          requests.push({
            method: req.method(),
            path: url.pathname,
            query: url.search,
            body,
          });
          const reply = (data, status = 200, headers = {}) =>
            route.fulfill({
              status,
              contentType: "application/json",
              headers: {
                "access-control-expose-headers": "content-range",
                ...headers,
              },
              body: JSON.stringify(data),
            });
          if (url.pathname.endsWith("/rpc/design_product_catalog_access"))
            return reply({ can_read: true, can_manage: manager });
          if (url.pathname.endsWith("/rpc/save_design_product")) {
            if (!manager)
              return reply(
                {
                  code: "42501",
                  message: "Active EIG catalog management access is required",
                },
                403,
              );
            const current = products.find((p) => p.id === body.p_product_id);
            if (
              conflict ||
              (current?.version || 0) !== body.p_expected_version
            ) {
              conflict = false;
              return reply(
                {
                  code: "40001",
                  message:
                    "Someone saved a newer product version. Your changes are still here; reopen the product before saving.",
                },
                409,
              );
            }
            const saved = cleanDesignProduct({
              id: body.p_product_id,
              version: body.p_expected_version + 1,
              name: body.p_name,
              category: body.p_category,
              material: body.p_material,
              status: body.p_status,
              description: body.p_description,
              definition: body.p_definition,
              updated_at: new Date().toISOString(),
            });
            const i = products.findIndex((p) => p.id === saved.id);
            if (i < 0) products.push(saved);
            else products[i] = saved;
            return reply(saved);
          }
          if (url.pathname.endsWith("/eic_design_products")) {
            let allowed = products.filter(
              (p) => manager || p.status === "active",
            );
            if (url.searchParams.has("id")) {
              const p = allowed.find(
                (p) => p.id === url.searchParams.get("id").slice(3),
              );
              return p
                ? reply(p)
                : reply(
                    { code: "PGRST116", message: "Product unavailable" },
                    406,
                  );
            }
            const q = url.searchParams.get("name");
            if (q)
              allowed = allowed.filter((p) =>
                p.name
                  .toLowerCase()
                  .includes(q.slice(7, -1).toLowerCase().replace(/\\/g, "")),
              );
            for (const key of ["category", "status"])
              if (url.searchParams.has(key))
                allowed = allowed.filter(
                  (p) => p[key] === url.searchParams.get(key).slice(3),
                );
            const order = (url.searchParams.get("order") || "name.asc").split(
                ",",
              )[0],
              ascending = order.endsWith(".asc"),
              field = order.slice(0, -4);
            const key = field.includes("canvas_width")
              ? "width"
              : field.includes("canvas_height")
                ? "height"
                : field;
            const value = (p) =>
              key === "width"
                ? p.definition.canvas_width
                : key === "height"
                  ? p.definition.canvas_height
                  : p[key];
            allowed.sort(
              (a, b) =>
                (typeof value(a) === "number"
                  ? value(a) - value(b)
                  : String(value(a)).localeCompare(String(value(b)))) *
                (ascending ? 1 : -1),
            );
            const count = allowed.length,
              offset = Number(url.searchParams.get("offset") || 0),
              limit = Number(url.searchParams.get("limit") || 12);
            return reply(
              allowed.slice(offset, offset + limit).map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                category: p.category,
                material: p.material,
                status: p.status,
                version: p.version,
                width: p.definition.canvas_width,
                height: p.definition.canvas_height,
                image: p.definition.image,
              })),
              200,
              {
                "content-range": `${offset}-${Math.min(count, offset + limit) - 1}/${count}`,
              },
            );
          }
          return reply({ message: "Unexpected fixture request" }, 500);
        },
      );
      await page.goto("http://127.0.0.1:4194/tests/inception-apex.html");
      await page
        .getByRole("button", { name: "Product Catalog", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: /matching products/ })
        .waitFor();
      return page;
    }
    await fs.mkdir("test-results/design-product-catalog", { recursive: true });
    const page = await pageFor();
    assert.equal(await page.locator(".dpc-app tbody tr").count(), 12);
    await page
      .getByRole("button", { name: "Next products", exact: true })
      .click();
    await page.getByText("Page 2 of 2", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Add product", exact: true })
      .click();
    await page
      .getByLabel("Catalog product name", { exact: true })
      .fill("Sponsor tee sign");
    await page.getByLabel("Product canvas width", { exact: true }).fill("1000");
    await page.getByLabel("Product canvas height", { exact: true }).fill("700");
    await page
      .getByLabel("Product finished size", { exact: true })
      .fill("24 × 18 in");
    await page
      .getByLabel("Product printable area", { exact: true })
      .fill("Front face");
    await page
      .getByLabel("Product QR corner", { exact: true })
      .selectOption("bottom-left");
    await page.getByLabel("Product QR size", { exact: true }).fill("200");
    const source = newDesignProduct();
    source.definition = {
      ...source.definition,
      canvas_width: 1000,
      canvas_height: 700,
    };
    const template = designForProduct(
      source.definition,
      materialDesign("sign"),
    );
    template.link = {
      ...template.link,
      url: "https://example.com/private-event",
      showQr: true,
    };
    await page
      .getByLabel("Upload product starter template", { exact: true })
      .setInputFiles({
        name: "starter.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(template)),
      });
    const image = new PNG({ width: 80, height: 60 });
    image.data.fill(255);
    await page
      .getByLabel("Upload product image", { exact: true })
      .setInputFiles({
        name: "sign.png",
        mimeType: "image/png",
        buffer: PNG.sync.write(image),
      });
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await page
      .getByText("Saved Sponsor tee sign · Version 1.", { exact: true })
      .waitFor();
    const saved = products.find((p) => p.name === "Sponsor tee sign");
    assert.equal(saved.status, "draft");
    assert.equal(saved.definition.template.link.url, "");
    assert.ok(saved.definition.image.startsWith("data:image/"));
    await page
      .getByLabel("Product availability", { exact: true })
      .selectOption("active");
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await page
      .getByText("Saved Sponsor tee sign · Version 2.", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Close product details", exact: true })
      .click();
    await page
      .getByLabel("Search product names", { exact: true })
      .fill("Sponsor tee");
    await page
      .getByRole("button", { name: "Edit Sponsor tee sign", exact: true })
      .waitFor();
    assert.equal(await page.locator(".dpc-app tbody tr").count(), 1);
    await page.getByRole("button", { name: "Width", exact: false }).click();
    await page
      .locator('th[aria-sort="ascending"]')
      .filter({ hasText: "Width" })
      .waitFor();
    await page
      .getByRole("button", { name: "Edit Sponsor tee sign", exact: true })
      .click();
    await page
      .getByLabel("Product production notes", { exact: true })
      .fill("Retain my unsaved note");
    conflict = true;
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "newer product version" })
      .waitFor();
    assert.equal(
      await page
        .getByLabel("Product production notes", { exact: true })
        .inputValue(),
      "Retain my unsaved note",
    );
    await page
      .getByRole("button", { name: "Close product details", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Customize Sponsor tee sign", exact: true })
      .click();
    await page
      .getByLabel("Project name", { exact: true })
      .fill("Tee sponsor artwork");
    await page
      .getByRole("button", { name: "Open designer", exact: true })
      .click();
    assert.equal(
      await page.locator(".flyer-canvas").getAttribute("viewBox"),
      "0 0 1000 700",
    );
    assert.equal(
      await page.getByLabel("Link / QR size", { exact: true }).count(),
      0,
    );
    await page
      .getByLabel("Destination link", { exact: true })
      .fill("https://example.com/sponsor");
    await page.getByLabel("Show QR code", { exact: true }).check();
    assert.equal(
      await page.getByLabel("Link X", { exact: true }).inputValue(),
      "24",
    );
    assert.equal(
      await page.getByLabel("Link / QR size", { exact: true }).inputValue(),
      "200",
    );
    await page
      .getByRole("button", { name: "Save to My Designs", exact: true })
      .click();
    await page
      .getByText("Saved to My Designs. Version 1.", { exact: true })
      .waitFor();
    // Update catalog after saving; the saved artwork must retain its original geometry/version.
    products.find(
      (p) => p.name === "Sponsor tee sign",
    ).definition.canvas_width = 1200;
    products.find((p) => p.name === "Sponsor tee sign").version = 3;
    await page.reload();
    await page.getByRole("button", { name: "My Designs", exact: true }).click();
    await page
      .getByLabel("Search designs", { exact: true })
      .fill("Tee sponsor artwork");
    await page.getByRole("button", { name: /^Tee sponsor artwork\b/ }).click();
    assert.equal(
      await page.locator(".flyer-canvas").getAttribute("viewBox"),
      "0 0 1000 700",
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
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download production request", exact: true })
      .click();
    const handoff = JSON.parse(
      await fs.readFile(await (await download).path(), "utf8"),
    );
    assert.equal(handoff.catalog_product.version, 2);
    assert.equal(handoff.catalog_product.canvas_width, 1000);
    assert.equal(handoff.catalog_product.print_area, "Front face");
    assert.equal(handoff.production.size, "24 × 18 in");
    await page
      .getByRole("button", { name: "Product Catalog", exact: true })
      .click();
    await page
      .getByLabel("Search product names", { exact: true })
      .fill("Sponsor tee");
    await page
      .getByRole("button", { name: "Edit Sponsor tee sign", exact: true })
      .click();
    // Remove starter before changing geometry in this synthetic catalog update.
    await page
      .getByRole("button", {
        name: "Remove custom starter template",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Product availability", { exact: true })
      .selectOption("archived");
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await page
      .getByText("Saved Sponsor tee sign · Version 4.", { exact: true })
      .waitFor();
    await page.getByText('1 matching product',{exact:true}).waitFor();
    await page.screenshot({
      path: "test-results/design-product-catalog/desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/design-product-catalog/mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const viewer = await pageFor(false);
    assert.equal(
      await viewer
        .getByRole("button", { name: "Add product", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await viewer.getByRole("button", { name: /^Edit / }).count(),
      0,
    );
    await viewer
      .getByLabel("Search product names", { exact: true })
      .fill("Sponsor tee");
    await viewer
      .getByText("No products match. Try another search or filter.", {
        exact: true,
      })
      .waitFor();
    assert.ok(
      requests.some(
        (r) =>
          r.path.endsWith("/rpc/save_design_product") &&
          r.body.p_expected_version === 1,
      ),
    );
    assert.ok(
      requests.some((r) =>
        decodeURIComponent(r.query).includes("definition->canvas_width.asc"),
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: actual product client requests; add/edit/publish/archive; image/template; search/sort/pagination; stale-save protection; product-to-artwork; My Designs; versioned production export; viewer controls; mobile.",
    );
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

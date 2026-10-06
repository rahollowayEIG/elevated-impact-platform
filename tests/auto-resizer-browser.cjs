const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

(async () => {
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4192, strictPort: true },
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
    await fs.mkdir("test-results/auto-resizer", { recursive: true });
    await page.goto("http://127.0.0.1:4192/tests/inception-apex.html");
    await page
      .getByText("Your next idea starts here.", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Open Auto Resizer", exact: true })
        .count(),
      0,
    );
    await page.goto("http://127.0.0.1:4192/tests/inception-apex.html?eig=1");
    await page
      .getByRole("button", { name: "Open Auto Resizer", exact: true })
      .click();
    const downloadButton = page.getByRole("button", {
      name: "Download resized image",
      exact: true,
    });
    assert.equal(await downloadButton.isEnabled(), false);
    const source = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 200;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#d81c22";
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = "#1d245d";
      ctx.fillRect(200, 0, 200, 200);
      ctx.fillStyle = "white";
      ctx.font = "bold 48px sans-serif";
      ctx.fillText("EIG", 157, 105);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const upload = page.getByLabel("Upload image", { exact: true });
    await upload.setInputFiles({
      name: "EIG-artwork.png",
      mimeType: "image/png",
      buffer: Buffer.from(source, "base64"),
    });
    async function waitOutput(w, h, previous = "") {
      await page.waitForFunction(
        ({ w, h, previous }) => {
          const img = document.querySelector(".ia-resized-image");
          return (
            img?.complete &&
            img.naturalWidth === w &&
            img.naturalHeight === h &&
            img.src !== previous
          );
        },
        { w, h, previous },
      );
      return page.locator(".ia-resized-image").getAttribute("src");
    }
    async function pixel(x, y) {
      return page.evaluate(
        async ({ x, y }) => {
          const blob = await (
            await fetch(document.querySelector(".ia-resized-image").src)
          ).blob();
          const bitmap = await createImageBitmap(blob),
            canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          return Array.from(ctx.getImageData(x, y, 1, 1).data);
        },
        { x, y },
      );
    }
    let url = await waitOutput(2048, 2048);
    assert.deepEqual(await pixel(50, 50), [0, 0, 0, 0]);
    const pngDownload = page.waitForEvent("download");
    await downloadButton.click();
    const png = await pngDownload;
    assert.equal(
      png.suggestedFilename(),
      "EIG-artwork_shopify-product_2048x2048.png",
    );
    const bytes = await fs.readFile(await png.path());
    assert.equal(bytes.readUInt32BE(16), 2048);
    assert.equal(bytes.readUInt32BE(20), 2048);
    await page
      .getByLabel("Export format", { exact: true })
      .selectOption("jpeg");
    url = await waitOutput(2048, 2048, url);
    assert.deepEqual(await pixel(50, 50), [255, 255, 255, 255]);
    await page
      .getByLabel("Image destination", { exact: true })
      .selectOption("eig-hub-art");
    url = await waitOutput(1200, 340, url);
    assert.equal(
      await page.getByLabel("Image framing", { exact: true }).inputValue(),
      "fit",
    );
    await page
      .getByLabel("Image destination", { exact: true })
      .selectOption("custom");
    await page.getByLabel("Width (pixels)", { exact: true }).fill("200");
    await page.getByLabel("Height (pixels)", { exact: true }).fill("200");
    await page.getByLabel("Export format", { exact: true }).selectOption("png");
    await page
      .getByLabel("Image framing", { exact: true })
      .selectOption("crop");
    url = await waitOutput(200, 200, url);
    await page.getByLabel("Horizontal focal point", { exact: true }).fill("0");
    url = await waitOutput(200, 200, url);
    assert.deepEqual(await pixel(50, 180), [216, 28, 34, 255]);
    await page.getByLabel("Horizontal focal point", { exact: true }).fill("1");
    url = await waitOutput(200, 200, url);
    assert.deepEqual(await pixel(50, 180), [29, 36, 93, 255]);
    await page
      .getByRole("button", {
        name: "Choose focal point on original image",
        exact: true,
      })
      .focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal(
      await page
        .getByLabel("Horizontal focal point", { exact: true })
        .inputValue(),
      "0.98",
    );
    await waitOutput(200, 200, url);
    await page
      .getByLabel("Describe the changes you want", { exact: true })
      .fill("Keep the full EIG logo. Leave room for sponsor text.");
    const notesDownload = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Download change instructions",
        exact: true,
      })
      .click();
    const notes = await notesDownload;
    const instructions = await fs.readFile(await notes.path(), "utf8");
    assert.ok(
      instructions.includes(
        "Keep the full EIG logo. Leave room for sponsor text.",
      ),
    );
    assert.ok(instructions.includes("200 x 200 pixels"));
    await page.getByLabel("Width (pixels)", { exact: true }).fill("");
    assert.equal(await downloadButton.isEnabled(), false);
    await page.getByLabel("Width (pixels)", { exact: true }).fill("200");
    await waitOutput(200, 200);
    await upload.setInputFiles({
      name: "bad.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
    await page.getByRole("alert").filter({ hasText: "Choose a PNG" }).waitFor();
    await upload.setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
    await page.getByRole("alert").waitFor();
    await upload.setInputFiles({
      name: "EIG-artwork.png",
      mimeType: "image/png",
      buffer: Buffer.from(source, "base64"),
    });
    await waitOutput(200, 200);
    await page
      .getByLabel("Image destination", { exact: true })
      .selectOption("eig-hero");
    await waitOutput(1920, 1080);
    await page.screenshot({
      path: "test-results/auto-resizer/desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/auto-resizer/mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.getByRole("button", { name: "My designs", exact: true }).click();
    await page
      .getByRole("button", { name: "Open Auto Resizer", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    process.stdout.write(
      "Auto Resizer EIG-only menu, destination sizes, PNG transparency, JPEG background, focal crops, notes export, invalid inputs and mobile passed.\n",
    );
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

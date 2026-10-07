import { Zip, ZipPassThrough, strToU8 } from "fflate";
import {
  imagePlacement,
  resizeFilename,
  resizeDimensions,
} from "./imageResize.mjs";

export const IMAGE_MIME = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
export const MAX_BATCH_BYTES = 50 * 1024 * 1024;
export const MAX_INPUT_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGES = 20;

export async function openResizeImage(file) {
  if (
    !Object.values(IMAGE_MIME).includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error(
      "Choose a PNG, JPEG or WebP image up to 20 MB. Animated files are exported as a still image.",
    );
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 25000000)
      throw new Error("Use an image of 25 megapixels or less.");
    return bitmap;
  } catch (e) {
    bitmap?.close();
    throw new Error(bitmap ? e.message : "That image could not be opened.");
  }
}

export async function encodeResizeImage(bitmap, settings, item) {
  const { width, height } = resizeDimensions(settings.width, settings.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!settings.transparent || settings.format === "jpeg") {
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const p = imagePlacement(
    bitmap.width,
    bitmap.height,
    width,
    height,
    settings.mode,
    item.focal.x,
    item.focal.y,
    item.zoom,
  );
  ctx.drawImage(bitmap, p.x, p.y, p.drawWidth, p.drawHeight);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, IMAGE_MIME[settings.format], settings.quality),
  );
  // Release the full canvas backing store before decoding another batch image.
  canvas.width = canvas.height = 1;
  if (!blob || blob.type !== IMAGE_MIME[settings.format])
    throw new Error(
      "This browser cannot export that format. Choose PNG or JPEG.",
    );
  if (blob.size >= 20 * 1024 * 1024)
    throw new Error(
      "This export exceeds 20 MB. Choose JPEG/WebP, reduce quality or use smaller dimensions.",
    );
  return {
    blob,
    width,
    height,
    filename: resizeFilename(
      item.name,
      settings.presetId,
      width,
      height,
      settings.format,
    ),
  };
}

export function changeInstructions(item, output, settings) {
  return `InceptionApex — image change request\n\nImage: ${output.filename}\nDestination: ${settings.destination}\nSize: ${output.width} x ${output.height} pixels\nFraming: ${settings.mode === "fit" ? "Fit entire image" : "Crop to fill"}\nFormat: ${settings.format.toUpperCase()}\n\nRequested changes:\n${item.notes.trim()}\n\nResize/crop controls determine this image export. Other requested edits still need to be performed and reviewed.\n`;
}

export async function buildResizeBatch(
  items,
  settings,
  { signal, onProgress = () => {} } = {},
) {
  const check = () => {
    if (signal?.aborted)
      throw new DOMException("Batch cancelled.", "AbortError");
  };
  const chunks = [];
  let bytes = 0,
    zipError;
  const zip = new Zip((err, chunk) => {
    if (err) {
      zipError = err;
      return;
    }
    bytes += chunk.length;
    if (bytes > MAX_BATCH_BYTES)
      zipError = new Error(
        "The batch ZIP exceeds 50 MB. Use a smaller size, JPEG/WebP or fewer images.",
      );
    if (!zipError) chunks.push(chunk);
  });
  const used = new Set(),
    manifest = [];
  const add = (name, data) => {
    check();
    const stream = new ZipPassThrough(name);
    stream.mtime = new Date(2020, 0, 1); // Stable archive bytes let Drive retries reuse the same request.
    zip.add(stream);
    stream.push(data, true);
    if (zipError) throw zipError;
  };
  try {
    for (let i = 0; i < items.length; i++) {
      check();
      const item = items[i];
      onProgress({ completed: i, total: items.length, name: item.name });
      const bitmap = await openResizeImage(item.file);
      let output;
      try {
        check();
        output = await encodeResizeImage(bitmap, settings, item);
      } finally {
        bitmap.close();
      }
      check();
      const original = output.filename;
      let suffix = 2;
      while (used.has(output.filename))
        output.filename = original.replace(/\.[^.]+$/, `-${suffix++}$&`);
      used.add(output.filename);
      add(output.filename, new Uint8Array(await output.blob.arrayBuffer()));
      if (item.notes.trim())
        add(
          output.filename.replace(/\.[^.]+$/, "_changes.txt"),
          strToU8(changeInstructions(item, output, settings)),
        );
      manifest.push({
        source: item.name,
        exported: output.filename,
        width: output.width,
        height: output.height,
        focal: item.focal,
        zoom: item.zoom,
        changes: item.notes.trim(),
      });
    }
    add(
      "resize-manifest.json",
      strToU8(
        JSON.stringify(
          {
            destination: settings.destination,
            framing: settings.mode,
            format: settings.format,
            images: manifest,
          },
          null,
          2,
        ),
      ),
    );
    zip.end();
    if (zipError) throw zipError;
    check();
    onProgress({ completed: items.length, total: items.length, name: "" });
    return {
      blob: new Blob(chunks, { type: "application/zip" }),
      filename: `InceptionApex_${settings.presetId}_${settings.width}x${settings.height}_${items.length}-images.zip`,
    };
  } catch (e) {
    zip.terminate();
    throw e;
  }
}

export function downloadResizeFile(output) {
  const url = output.url || URL.createObjectURL(output.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = output.filename;
  link.click();
  if (!output.url) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import { sanitizeFlyer, flyerTemplate } from "./eventCreative.mjs";
import { cleanCreativeLink } from "./creativeLink.mjs";

export const PRODUCT_CATEGORIES = [
  ["signage", "Signs & banners"],
  ["marketing", "Marketing materials"],
  ["swag", "Swag"],
  ["apparel", "Apparel"],
  ["gifts", "Gifts"],
  ["books", "Books & programs"],
  ["displays", "Digital displays"],
  ["other", "Other"],
];
export const PRODUCT_THEMES = [
  ["classic", "Classic EIG"],
  ["fairway", "Fairway"],
  ["celebration", "Celebration"],
];
export const PRODUCT_CORNERS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];
const materials = [
  "flyer",
  "invitation",
  "sign",
  "banner",
  "swag",
  "book",
  "display",
];
const text = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const integer = (v, min, max, fallback) =>
  Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max
    ? Number(v)
    : fallback;
export function newDesignProduct(material = "sign") {
  return {
    id: crypto.randomUUID(),
    version: 0,
    name: "",
    category: "signage",
    material,
    status: "draft",
    description: "",
    definition: {
      canvas_width: 1200,
      canvas_height: 900,
      finished_size: "",
      print_area: "",
      safe_inset: 24,
      theme: "classic",
      qr_size: 180,
      qr_corner: "bottom-right",
      image: "",
      notes: "",
      template: null,
    },
  };
}
export function cleanProductDefinition(v = {}) {
  const width = integer(v.canvas_width, 300, 2400, 1200),
    height = integer(v.canvas_height, 300, 3000, 900);
  const inset = integer(
    v.safe_inset,
    0,
    Math.floor(Math.min(width, height) / 3),
    24,
  );
  let template = null;
  if (v.template) {
    template = flyerTemplate(v.template);
    // Catalog starters are shared deliberately, but never distribute a customer's destination URL.
    template.link = cleanCreativeLink({}, template.width, template.height);
  }
  return {
    canvas_width: width,
    canvas_height: height,
    finished_size: text(v.finished_size, 160),
    print_area: text(v.print_area, 160),
    safe_inset: inset,
    theme: PRODUCT_THEMES.some(([id]) => id === v.theme) ? v.theme : "classic",
    qr_size: integer(
      v.qr_size,
      80,
      Math.min(width, height - 40) - inset * 2,
      Math.min(180, Math.min(width, height - 40) - inset * 2),
    ),
    qr_corner: PRODUCT_CORNERS.includes(v.qr_corner)
      ? v.qr_corner
      : "bottom-right",
    image:
      typeof v.image === "string" &&
      v.image.length <= 350000 &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v.image)
        ? v.image
        : "",
    notes: text(v.notes, 1500),
    template,
  };
}
export function cleanDesignProduct(v) {
  return {
    ...v,
    name: text(v.name, 160).trim(),
    description: text(v.description, 1000),
    category: PRODUCT_CATEGORIES.some(([id]) => id === v.category)
      ? v.category
      : "other",
    material: materials.includes(v.material) ? v.material : "sign",
    status: ["draft", "active", "archived"].includes(v.status)
      ? v.status
      : "draft",
    definition: cleanProductDefinition(v.definition),
  };
}
export function productProblem(p) {
  if (!p.name?.trim()) return "Enter a product name.";
  const d = p.definition;
  if (new TextEncoder().encode(JSON.stringify(d)).byteLength > 790000)
    return "The product image and starter template together are too large. Use smaller artwork files.";
  for (const [key, min, max, label] of [
    ["canvas_width", 300, 2400, "Canvas width"],
    ["canvas_height", 300, 3000, "Canvas height"],
  ])
    if (
      !Number.isInteger(Number(d[key])) ||
      Number(d[key]) < min ||
      Number(d[key]) > max
    )
      return `${label} must be a whole number between ${min} and ${max} pixels.`;
  const smallest = Math.min(Number(d.canvas_width), Number(d.canvas_height));
  if (
    !Number.isInteger(Number(d.safe_inset)) ||
    Number(d.safe_inset) < 0 ||
    Number(d.safe_inset) > Math.floor(smallest / 3)
  )
    return "Keep the safe inset between 0 and one third of the shorter canvas side.";
  if (
    !Number.isInteger(Number(d.qr_size)) ||
    Number(d.qr_size) < 80 ||
    Number(d.qr_size) >
      Math.min(Number(d.canvas_width), Number(d.canvas_height) - 40) -
        Number(d.safe_inset) * 2
  )
    return "Choose a QR size of at least 80 pixels that fits inside the safe area.";
  if (
    d.template &&
    (d.template.width !== Number(d.canvas_width) ||
      d.template.height !== Number(d.canvas_height))
  )
    return "The starter template must match the canvas dimensions. Remove it or import a matching template.";
  return "";
}
export function productSnapshot(product) {
  const p = cleanDesignProduct(product);
  const { image, template, ...specs } = p.definition;
  return {
    id: p.id,
    version: p.version,
    name: p.name,
    material: p.material,
    category: p.category,
    ...specs,
  };
}
export function cleanProductSnapshot(v) {
  if (
    !v ||
    !/^[0-9a-f-]{36}$/i.test(v.id || "") ||
    !Number.isInteger(v.version) ||
    v.version < 1
  )
    return null;
  return productSnapshot({
    id: v.id,
    version: v.version,
    name: v.name,
    material: v.material,
    category: v.category,
    definition: v,
  });
}
export function productLinkDefaults(specs) {
  const d = cleanProductDefinition(specs),
    size = d.qr_size;
  return cleanCreativeLink(
    {
      size,
      x: d.qr_corner.endsWith("right")
        ? d.canvas_width - size - d.safe_inset
        : d.safe_inset,
      y: d.qr_corner.startsWith("bottom")
        ? d.canvas_height - size - 40 - d.safe_inset
        : Math.max(24, d.safe_inset),
    },
    d.canvas_width,
    d.canvas_height,
  );
}
export function designForProduct(specs, base, useTemplate = true) {
  const d = cleanProductDefinition(specs);
  if (useTemplate && d.template)
    return { ...d.template, link: productLinkDefaults(d) };
  const width = d.canvas_width,
    height = d.canvas_height,
    inset = d.safe_inset;
  const sx = (width - inset * 2) / base.width,
    sy = (height - inset * 2) / base.height;
  return sanitizeFlyer({
    ...base,
    width,
    height,
    link: productLinkDefaults(d),
    boxes: base.boxes.map((b) => ({
      ...b,
      x: inset + b.x * sx,
      y: inset + b.y * sy,
      width: b.width * sx,
      height: b.height * sy,
      fontSize: Math.max(8, b.fontSize * Math.min(sx, sy)),
    })),
    images: (base.images || []).map((i) => ({
      ...i,
      x: inset + i.x * sx,
      y: inset + i.y * sy,
      width: i.width * sx,
      height: i.height * sy,
    })),
  });
}
export function catalogDesignProblem(data) {
  const c = data.catalog;
  return c &&
    (data.design.width !== c.canvas_width ||
      data.design.height !== c.canvas_height)
    ? "This product uses a fixed canvas. Apply a product starter or load a matching-size template before saving."
    : "";
}

export async function productImage(file) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 8000000
  )
    throw new Error("Choose a PNG, JPEG or WebP product image under 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/webp", 0.8);
    if (image.length > 350000)
      throw new Error("Use a simpler or smaller product image.");
    return image;
  } finally {
    bitmap.close();
  }
}

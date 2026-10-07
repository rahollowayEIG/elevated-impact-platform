import {
  FLYER_FIELDS,
  newFlyer,
  sanitizeFlyer,
  flyerTemplate,
  flyerSvg,
  flyerOverflow,
} from "./eventCreative.mjs";

export const MATERIALS = [
  {
    id: "flyer",
    label: "Flyer",
    detail: "Event details, your way",
    width: 850,
    height: 1100,
    code: "FL",
  },
  {
    id: "invitation",
    label: "Invitation",
    detail: "A personal invitation",
    width: 700,
    height: 1000,
    code: "IN",
  },
  {
    id: "sign",
    label: "Sponsor sign",
    detail: "Sponsors in the spotlight",
    width: 1200,
    height: 900,
    code: "SG",
  },
  {
    id: "banner",
    label: "Banner",
    detail: "Make room for a big idea",
    width: 1800,
    height: 600,
    code: "BN",
  },
  {
    id: "swag",
    label: "Gifts & swag",
    detail: "Start with the imprint artwork",
    width: 900,
    height: 900,
    code: "SW",
  },
  {
    id: "book",
    label: "Book cover",
    detail: "Outing programs and yardage books",
    width: 850,
    height: 1100,
    code: "BK",
  },
  {
    id: "display",
    label: "Digital display",
    detail: "Artwork for your screens",
    width: 1600,
    height: 900,
    code: "DS",
  },
];
export const FACT_FIELDS = FLYER_FIELDS.filter((f) => f !== "custom");
const text = (v, limit = 1500) =>
  typeof v === "string" ? v.slice(0, limit) : "";
export function materialById(id) {
  const material = MATERIALS.find((m) => m.id === id);
  if (!material) throw new Error("Choose a supported design type.");
  return material;
}
export function materialDesign(type, theme = "classic") {
  const material = materialById(type),
    base = newFlyer(theme);
  base.name = material.label;
  const sx = material.width / base.width,
    sy = material.height / base.height;
  base.width = material.width;
  base.height = material.height;
  base.background = theme === "classic" ? "#1d245d" : base.background;
  base.accent = theme === "classic" ? "#d81c22" : base.accent;
  base.boxes = base.boxes.map((b) => ({
    ...b,
    x: Math.round(b.x * sx),
    y: Math.round(b.y * sy),
    width: Math.round(b.width * sx),
    height: Math.round(b.height * sy),
    fontSize: Math.max(12, Math.round(b.fontSize * Math.min(sx, sy))),
  }));
  if (["sign", "banner", "swag", "display"].includes(type)) {
    base.boxes = [
      {
        ...base.boxes[0],
        x: material.width * 0.07,
        y: material.height * 0.19,
        width: material.width * 0.86,
        height: material.height * 0.34,
        align: "center",
        fontSize: type === "banner" ? 76 : 64,
      },
      {
        ...base.boxes[5],
        id: "subtitle",
        x: material.width * 0.1,
        y: material.height * 0.61,
        width: material.width * 0.8,
        height: material.height * 0.24,
        align: "center",
        fontSize: type === "banner" ? 36 : 28,
        source: "custom",
        text: "",
      },
    ];
  }
  return sanitizeFlyer(base);
}
export function cleanFacts(value) {
  return Object.fromEntries(
    FACT_FIELDS.map((key) => [key, text(value?.[key])]),
  );
}
export function cleanProjectData(value) {
  if (!value || typeof value !== "object")
    throw new Error("This project could not be read.");
  return {
    design: sanitizeFlyer(value.design),
    facts: cleanFacts(value.facts),
    brief: text(value.brief, 4000),
    favorite: value.favorite === true,
    production: {
      product: text(value.production?.product, 160),
      size: text(value.production?.size, 160),
      notes: text(value.production?.notes, 1500),
    },
  };
}
export function newProject(type, facts = {}) {
  const material = materialById(type);
  return {
    id: crypto.randomUUID(),
    name: ((facts.name ? facts.name + " · " : "") + material.label).slice(
      0,
      160,
    ),
    material: type,
    event_id: null,
    version: 0,
    status: "draft",
    data: cleanProjectData({
      design: materialDesign(type),
      facts: { name: "Your headline", ...facts },
    }),
  };
}
export function projectBrief(project) {
  const data = cleanProjectData(project.data);
  return (
    "Create background artwork for a " +
    materialById(project.material).label.toLowerCase() +
    ". Keep wording as separate editable text. Preserve supplied logos, brand identity, event facts and actual geography. Do not invent sponsors, measurements, prices or dates.\n\n" +
    "Canvas: " +
    data.design.width +
    " × " +
    data.design.height +
    " pixels.\n" +
    "Creative direction: " +
    data.brief +
    "\nProduct / output: " +
    data.production.product +
    " · " +
    data.production.size +
    "\n\n" +
    FACT_FIELDS.filter((k) => data.facts[k])
      .map((k) => k + ": " + data.facts[k])
      .join("\n")
  );
}
export function projectHandoff(project) {
  if (
    project.status !== "approved" ||
    project.version < 1 ||
    flyerOverflow(project.data.design, project.data.facts).length
  )
    throw new Error(
      "Save and approve a design that fits before preparing an order.",
    );
  const data = cleanProjectData(project.data);
  return {
    schema_version: 1,
    source_app: "InceptionApex",
    project_id: project.id,
    artwork_version: project.version,
    organization_id: project.organization_id || null,
    event_id: project.event_id || null,
    master_event_id: project.master_event_id || null,
    material: project.material,
    name: project.name,
    production: data.production,
    facts: data.facts,
    artwork_svg: flyerSvg(data.design, data.facts, ""),
    routing: { artwork: "InceptionApex", orders: "EIC" },
    order_status: "draft_request",
  };
}
export function projectTemplate(project) {
  return flyerTemplate(project.data.design);
}
export function visibleProjects(rows, query, filter, sort) {
  const q = query.trim().toLowerCase();
  return rows
    .filter(
      (r) =>
        (filter === "all" ||
          (filter === "favorites" ? r.data?.favorite : r.status === filter)) &&
        (!q ||
          [r.name, materialById(r.material).label, r.event_name, r.status].some(
            (v) =>
              String(v || "")
                .toLowerCase()
                .includes(q),
          )),
    )
    .map((r, index) => ({ r, index }))
    .sort((a, b) => {
      const av =
          sort.field === "material"
            ? materialById(a.r.material).label
            : a.r[sort.field] || "",
        bv =
          sort.field === "material"
            ? materialById(b.r.material).label
            : b.r[sort.field] || "";
      return (
        String(av).localeCompare(String(bv), undefined, {
          sensitivity: "base",
        }) * (sort.ascending ? 1 : -1) || a.index - b.index
      );
    })
    .map(({ r }) => r);
}

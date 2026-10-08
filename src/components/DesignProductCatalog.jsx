import React, { useEffect, useMemo, useRef, useState } from "react";
import { designProductStore } from "../lib/designProductStore.js";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_THEMES,
  PRODUCT_CORNERS,
  newDesignProduct,
  cleanProductDefinition,
  productProblem,
  productImage,
  designForProduct,
} from "../lib/designProducts.mjs";
import {
  MATERIALS,
  materialById,
  materialDesign,
} from "../lib/inceptionProject.mjs";
import { flyerSvg } from "../lib/eventCreative.mjs";
import "./design-product-catalog.css";

export default function DesignProductCatalog({
  store = designProductStore,
  onCustomize,
  onDirtyChange,
}) {
  const [access, setAccess] = useState(null),
    [rows, setRows] = useState([]),
    [count, setCount] = useState(0);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(0);
  const [sort, setSort] = useState({ field: "name", ascending: true }),
    [refresh, setRefresh] = useState(0);
  const [draft, setDraft] = useState(null),
    [dirty, setDirty] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const inflight = useRef(false),
    epoch = useRef(0);
  useEffect(() => {
    onDirtyChange?.(dirty || busy);
    return () => onDirtyChange?.(false);
  }, [dirty, busy, onDirtyChange]);
  useEffect(() => {
    let stopped = false;
    store
      .capabilities()
      .then((a) => {
        if (!stopped) {
          if (!a.can_read)
            throw new Error(
              "An active verified account is required to open the catalog.",
            );
          setAccess(a);
        }
      })
      .catch((e) => {
        if (!stopped) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      stopped = true;
    };
  }, [store]);
  useEffect(() => {
    if (!access) return;
    const current = ++epoch.current;
    setLoading(true);
    const timer = setTimeout(() => {
      store
        .list({ query, category, status, sort, page })
        .then((result) => {
          if (current !== epoch.current) return;
          if (page > 0 && result.count <= page * 12) {
            setPage(Math.max(0, Math.ceil(result.count / 12) - 1));
            return;
          }
          setRows(result.rows);
          setCount(result.count);
          setLoading(false);
        })
        .catch((e) => {
          if (current === epoch.current) {
            setError(e.message);
            setRows([]);
            setCount(0);
            setLoading(false);
          }
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      epoch.current++;
    };
  }, [store, access, query, category, status, sort, page, refresh]);
  const problem = draft ? productProblem(draft) : "";
  const preview = useMemo(() => {
    if (!draft || productProblem(draft)) return "";
    try {
      return (
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          flyerSvg(
            designForProduct(
              draft.definition,
              materialDesign(draft.material, draft.definition.theme),
            ),
            { name: draft.name },
            "STARTER ARTWORK",
          ),
        )
      );
    } catch {
      return "";
    }
  }, [draft]);
  function leave() {
    return !dirty || window.confirm("Discard unsaved product changes?");
  }
  function change(patch) {
    setDraft((p) => ({ ...p, ...patch }));
    setDirty(true);
    setNotice("");
    setError("");
  }
  function spec(key, value) {
    change({ definition: { ...draft.definition, [key]: value } });
  }
  function add() {
    if (inflight.current || !leave()) return;
    setDraft(newDesignProduct());
    setDirty(true);
    setError("");
    setNotice("");
  }
  async function open(row, customize = false) {
    if (inflight.current || !leave()) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const p = await store.read(row.id);
      if (customize) {
        if (p.status !== "active")
          throw new Error(
            "This product is no longer available. Choose an available product.",
          );
        onCustomize(p);
      } else {
        setDraft(p);
        setDirty(false);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    if (inflight.current || problem) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await store.save(draft);
      setDraft(saved);
      setDirty(false);
      setRefresh((r) => r + 1);
      setNotice(`Saved ${saved.name} · Version ${saved.version}.`);
    } catch (e) {
      setError(e.message || "Unable to save this product.");
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  async function upload(e, template = false) {
    const file = e.target.files?.[0];
    if (!file || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    try {
      if (template) {
        if (file.size > 750000)
          throw new Error("Use an InceptionApex shared template under 750 KB.");
        const next = cleanProductDefinition({
          ...draft.definition,
          template: JSON.parse(await file.text()),
        });
        const issue = productProblem({ ...draft, definition: next });
        if (issue) throw new Error(issue);
        change({ definition: next });
      } else spec("image", await productImage(file));
    } catch (e) {
      setError(e.message || "Unable to read this file.");
    } finally {
      e.target.value = "";
      inflight.current = false;
      setBusy(false);
    }
  }
  function sortBy(field) {
    setPage(0);
    setSort((s) => ({
      field,
      ascending: s.field === field ? !s.ascending : true,
    }));
  }
  function heading(field, label) {
    return (
      <th
        aria-sort={
          sort.field === field
            ? sort.ascending
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        <button type="button" onClick={() => sortBy(field)}>
          {label}
          {sort.field === field ? (sort.ascending ? " ↑" : " ↓") : ""}
        </button>
      </th>
    );
  }
  return (
    <section className="dpc-app" aria-labelledby="dpc-title">
      <header className="dpc-heading">
        <div>
          <p className="platform-eyebrow">Products to design</p>
          <h2 id="dpc-title">Product Catalog</h2>
          <p>Choose a product and make the design yours.</p>
        </div>
        {access?.can_manage && (
          <button
            type="button"
            className="platform-primary-button"
            disabled={busy}
            onClick={add}
          >
            Add product
          </button>
        )}
      </header>
      {error && (
        <p className="platform-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ia-notice" role="status">
          {notice}
        </p>
      )}
      {draft && access?.can_manage && (
        <form
          className="dpc-editor"
          onSubmit={save}
          aria-label="Product details"
        >
          <h3>{draft.version ? "Edit product" : "Add product"}</h3>
          <fieldset disabled={busy}>
            <div className="dpc-fields">
              <label>
                Product name
                <input
                  aria-label="Catalog product name"
                  maxLength={160}
                  required
                  value={draft.name}
                  onChange={(e) => change({ name: e.target.value })}
                />
              </label>
              <label>
                Category
                <select
                  aria-label="Catalog category"
                  value={draft.category}
                  onChange={(e) => change({ category: e.target.value })}
                >
                  {PRODUCT_CATEGORIES.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Design type
                <select
                  aria-label="Catalog design type"
                  value={draft.material}
                  onChange={(e) => change({ material: e.target.value })}
                >
                  {MATERIALS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Availability
                <select
                  aria-label="Product availability"
                  value={draft.status}
                  onChange={(e) => change({ status: e.target.value })}
                >
                  <option value="draft">Draft · EIG only</option>
                  <option value="active">Available to designers</option>
                  <option value="archived">Archived · EIG only</option>
                </select>
              </label>
              <label className="dpc-wide">
                Description
                <textarea
                  maxLength={1000}
                  value={draft.description}
                  onChange={(e) => change({ description: e.target.value })}
                />
              </label>
              <label>
                Canvas width (pixels)
                <input
                  aria-label="Product canvas width"
                  type="number"
                  min={300}
                  max={2400}
                  required
                  value={draft.definition.canvas_width}
                  onChange={(e) => spec("canvas_width", e.target.value)}
                />
              </label>
              <label>
                Canvas height (pixels)
                <input
                  aria-label="Product canvas height"
                  type="number"
                  min={300}
                  max={3000}
                  required
                  value={draft.definition.canvas_height}
                  onChange={(e) => spec("canvas_height", e.target.value)}
                />
              </label>
              <label>
                Finished product size
                <input
                  aria-label="Product finished size"
                  maxLength={160}
                  placeholder="Supplier’s actual size, including units"
                  value={draft.definition.finished_size}
                  onChange={(e) => spec("finished_size", e.target.value)}
                />
              </label>
              <label>
                Printable area / surface
                <input
                  aria-label="Product printable area"
                  maxLength={160}
                  placeholder="Front face, shirt chest, towel imprint…"
                  value={draft.definition.print_area}
                  onChange={(e) => spec("print_area", e.target.value)}
                />
              </label>
              <label>
                Safe inset (pixels)
                <input
                  aria-label="Product safe inset"
                  type="number"
                  min={0}
                  required
                  value={draft.definition.safe_inset}
                  onChange={(e) => spec("safe_inset", e.target.value)}
                />
              </label>
              <label>
                Starter style
                <select
                  aria-label="Product starter style"
                  value={draft.definition.theme}
                  onChange={(e) => spec("theme", e.target.value)}
                >
                  {PRODUCT_THEMES.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Default QR corner
                <select
                  aria-label="Product QR corner"
                  value={draft.definition.qr_corner}
                  onChange={(e) => spec("qr_corner", e.target.value)}
                >
                  {PRODUCT_CORNERS.map((c) => (
                    <option key={c} value={c}>
                      {c.replace("-", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Default QR size (pixels)
                <input
                  aria-label="Product QR size"
                  type="number"
                  min={80}
                  required
                  value={draft.definition.qr_size}
                  onChange={(e) => spec("qr_size", e.target.value)}
                />
              </label>
              <label>
                Product image
                <input
                  aria-label="Upload product image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => upload(e)}
                />
              </label>
              <label>
                Shared starter template
                <input
                  aria-label="Upload product starter template"
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => upload(e, true)}
                />
              </label>
              <label className="dpc-wide">
                Production notes
                <textarea
                  aria-label="Product production notes"
                  maxLength={1500}
                  value={draft.definition.notes}
                  onChange={(e) => spec("notes", e.target.value)}
                />
              </label>
            </div>
            <p>
              The canvas is the artwork for one printable surface. The safe
              inset adds an editor guide and positions starter artwork; it is
              not supplier bleed or a cut line. Product sizes and production
              notes should come from your supplier.
            </p>
            <p>
              Starter artwork is shared with this product. Upload the JSON file
              from “Share template” in InceptionApex; bound event wording and
              destination URLs are cleared.
            </p>
            <div className="dpc-previews">
              {draft.definition.image && (
                <div>
                  <h4>Product image</h4>
                  <img
                    src={draft.definition.image}
                    alt={`${draft.name || "New product"} reference`}
                  />
                  <button type="button" onClick={() => spec("image", "")}>
                    Remove product image
                  </button>
                </div>
              )}
              {preview && (
                <div>
                  <h4>Starter artwork</h4>
                  <img src={preview} alt="Product starter artwork preview" />
                </div>
              )}
            </div>
            {draft.definition.template && (
              <button type="button" onClick={() => spec("template", null)}>
                Remove custom starter template
              </button>
            )}
            {problem && <p role="alert">{problem}</p>}
            <div className="ia-actions">
              <button
                type="submit"
                className="platform-primary-button"
                disabled={!dirty || !!problem}
              >
                Save product
              </button>
              <button
                type="button"
                className="platform-secondary-button"
                onClick={() => {
                  if (leave()) {
                    setDraft(null);
                    setDirty(false);
                    setError("");
                  }
                }}
              >
                Close product details
              </button>
            </div>
          </fieldset>
          {busy && <p role="status">Working on your product…</p>}
        </form>
      )}
      <div className="dpc-filters">
        <label>
          Search product names
          <input
            type="search"
            aria-label="Search product names"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Filter category
          <select
            aria-label="Filter catalog category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All categories</option>
            {PRODUCT_CATEGORIES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {access?.can_manage && (
          <label>
            Filter availability
            <select
              aria-label="Filter product availability"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All products</option>
              <option value="active">Available</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        )}
      </div>
      {loading ? (
        <p role="status">Loading products…</p>
      ) : (
        <>
          <p role="status">
            {count} matching product{count === 1 ? "" : "s"}
          </p>
          <div className="dpc-table-wrap">
            <table>
              <thead>
                <tr>
                  {heading("name", "Product")}
                  {heading("category", "Category")}
                  {heading("material", "Design type")}
                  {heading("width", "Width")}
                  {heading("height", "Height")}
                  {access?.can_manage && heading("status", "Availability")}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="dpc-product-name">
                        {row.image && (
                          <img src={row.image} alt="" loading="lazy" />
                        )}
                        <div>
                          <strong>{row.name}</strong>
                          <p>{row.description}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {PRODUCT_CATEGORIES.find(
                        ([id]) => id === row.category,
                      )?.[1] || row.category}
                    </td>
                    <td>{materialById(row.material).label}</td>
                    <td>{row.width} px</td>
                    <td>{row.height} px</td>
                    {access?.can_manage && (
                      <td>
                        {row.status === "active"
                          ? "Available"
                          : row.status === "draft"
                            ? "Draft"
                            : "Archived"}
                      </td>
                    )}
                    <td>
                      <div className="dpc-row-actions">
                        {row.status === "active" && (
                          <button
                            type="button"
                            disabled={busy}
                            className="platform-primary-button"
                            onClick={() => open(row, true)}
                            aria-label={`Customize ${row.name}`}
                          >
                            Customize this product
                          </button>
                        )}
                        {access?.can_manage && (
                          <button
                            type="button"
                            disabled={busy}
                            className="platform-secondary-button"
                            onClick={() => open(row)}
                            aria-label={`Edit ${row.name}`}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p>No products match. Try another search or filter.</p>
          )}
          <div className="dpc-pagination">
            <button
              type="button"
              disabled={page === 0 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous products
            </button>
            <span>
              Page {page + 1} of {Math.max(1, Math.ceil(count / 12))}
            </span>
            <button
              type="button"
              disabled={(page + 1) * 12 >= count || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              Next products
            </button>
          </div>
        </>
      )}
    </section>
  );
}

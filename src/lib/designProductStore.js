import { supabase } from "./supabase";
import { cleanDesignProduct, productProblem } from "./designProducts.mjs";
function checked(error) {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error?.code))
    return new Error(
      "The product catalog is awaiting setup. Existing design tools are still available.",
    );
  return error;
}
export const designProductStore = {
  async capabilities() {
    const { data, error } = await supabase.rpc("design_product_catalog_access");
    if (error) throw checked(error);
    return data;
  },
  async list({
    query = "",
    category = "all",
    status = "all",
    sort = { field: "name", ascending: true },
    page = 0,
  } = {}) {
    let request = supabase
      .from("eic_design_products")
      .select(
        "id,name,description,category,material,status,version,updated_at,width:definition->canvas_width,height:definition->canvas_height,image:definition->>image",
        { count: "exact" },
      );
    if (query.trim())
      request = request.ilike(
        "name",
        "%" + query.trim().replace(/[\\%_]/g, (c) => "\\" + c) + "%",
      );
    if (category !== "all") request = request.eq("category", category);
    if (status !== "all") request = request.eq("status", status);
    const field =
      sort.field === "width"
        ? "definition->canvas_width"
        : sort.field === "height"
          ? "definition->canvas_height"
          : ["name", "category", "material", "status", "updated_at"].includes(
                sort.field,
              )
            ? sort.field === "updated_at"
              ? sort.field
              : `sort_${sort.field}`
            : "sort_name";
    const { data, error, count } = await request
      .order(field, { ascending: sort.ascending })
      .order("id")
      .range(page * 12, page * 12 + 11);
    if (error) throw checked(error);
    return { rows: data || [], count: count || 0 };
  },
  async read(id) {
    const { data, error } = await supabase
      .from("eic_design_products")
      .select(
        "id,name,description,category,material,status,version,definition,created_at,updated_at",
      )
      .eq("id", id)
      .single();
    if (error) throw checked(error);
    return cleanDesignProduct(data);
  },
  async save(product) {
    const issue = productProblem(product);
    if (issue) throw new Error(issue);
    const p = cleanDesignProduct(product);
    const { data, error } = await supabase.rpc("save_design_product", {
      p_product_id: p.id,
      p_expected_version: p.version,
      p_name: p.name,
      p_category: p.category,
      p_material: p.material,
      p_status: p.status,
      p_description: p.description,
      p_definition: p.definition,
    });
    if (error) throw checked(error);
    return cleanDesignProduct(data);
  },
};

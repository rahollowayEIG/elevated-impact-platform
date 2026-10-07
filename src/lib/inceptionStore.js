import { supabase } from "./supabase";
import { cleanProjectData } from "./inceptionProject.mjs";
import { sanitizePacket } from "./eventCreative.mjs";

function problem(error) {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error?.code))
    return new Error(
      "The design workspace is awaiting setup. Your work has not been saved; you can download a project backup.",
    );
  return error;
}
function checked(row) {
  return { ...row, data: cleanProjectData(row.data) };
}
export const inceptionStore = {
  async list() {
    const { data, error } = await supabase
      .from("inception_projects")
      .select(
        "id,name,material,status,version,event_id,organization_id,master_event_id,updated_at,favorite:data->favorite",
      )
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw problem(error);
    return data.map((row) => ({
      ...row,
      data: { favorite: row.favorite === true },
    }));
  },
  async read(id) {
    const { data, error } = await supabase
      .from("inception_projects")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw problem(error);
    return checked(data);
  },
  async events() {
    const { data, error } = await supabase.rpc("list_inception_events");
    if (error) throw problem(error);
    return data || [];
  },
  async save(project, status = "draft") {
    const { data, error } = await supabase.rpc("save_inception_project", {
      p_project_id: project.id,
      p_expected_version: project.version,
      p_name: project.name,
      p_material: project.material,
      p_event_id: project.event_id,
      p_data: cleanProjectData(project.data),
      p_status: status,
    });
    if (error) throw problem(error);
    return checked(data);
  },
  async attach(project) {
    const { data, error } = await supabase.rpc("attach_inception_project", {
      p_project_id: project.id,
      p_expected_version: project.version,
    });
    if (error) throw problem(error);
    return data;
  },
  async packet(event) {
    const { data, error } = await supabase
      .from("event_builder_assets")
      .select("data,version")
      .eq("event_id", event.id)
      .maybeSingle();
    if (error) throw problem(error);
    return data ? { ...data, data: sanitizePacket(data.data) } : null;
  },
};

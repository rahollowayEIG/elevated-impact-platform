import { supabase } from "./supabase";
import { cleanCampaignData } from "./socialCampaign.mjs";
function problem(error) {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error?.code))
    return new Error(
      "Campaign storage is awaiting setup. Download a draft backup to keep your work.",
    );
  return error;
}
const checked = (row) => ({ ...row, data: cleanCampaignData(row.data) });
export const socialStore = {
  async list() {
    const { data, error } = await supabase
      .from("social_campaigns")
      .select("*")
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw problem(error);
    return data.map(checked);
  },
  async events() {
    const { data, error } = await supabase.rpc("list_inception_events");
    if (error) throw problem(error);
    return data || [];
  },
  async save(campaign, status) {
    const { data, error } = await supabase.rpc("save_social_campaign", {
      p_campaign_id: campaign.id,
      p_expected_version: campaign.version,
      p_name: campaign.name,
      p_event_id: campaign.event_id,
      p_data: cleanCampaignData(campaign.data),
      p_status: status,
    });
    if (error) throw problem(error);
    return checked(data);
  },
};

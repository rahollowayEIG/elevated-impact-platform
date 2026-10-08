import { supabase } from "./supabase";
import { budgetProblem } from "./eventBudget.mjs";
function checked(error) {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error?.code))
    return new Error(
      "The budget workspace is awaiting setup. Your changes have not been saved.",
    );
  return error;
}
export const eventBudgetStore = {
  async load(eventId) {
    const { data, error } = await supabase.rpc("read_eie_event_budget", {
      p_event_id: eventId,
    });
    if (error) throw checked(error);
    return data;
  },
  async save(eventId, version, budget) {
    const problem = budgetProblem(budget);
    if (problem) throw new Error(problem);
    const { data, error } = await supabase.rpc("save_eie_event_budget", {
      p_event_id: eventId,
      p_expected_version: version,
      p_data: budget,
    });
    if (error) throw checked(error);
    return data;
  },
};

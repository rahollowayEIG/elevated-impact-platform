const { createClient } = require("@supabase/supabase-js");
const { createBuildLabPreviewAccessHandler } = require("../server/eig-build-lab-preview-access.cjs");

const env = (name) => process.env[name];
const check = createBuildLabPreviewAccessHandler({
  env,
  async verifyUser(token) {
    const url = env("VITE_SUPABASE_URL");
    const key = env("VITE_SUPABASE_ANON_KEY");
    if (!url || !key) throw new Error("Auth environment unavailable");
    const publicClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await publicClient.auth.getUser(token);
    if (error || !data?.user) throw new Error("Invalid login");
    return { id: data.user.id };
  },
  async membershipsForUser(userId, token) {
    const url = env("VITE_SUPABASE_URL");
    const key = env("VITE_SUPABASE_ANON_KEY");
    if (!url || !key) throw new Error("Membership auth unavailable");
    const caller = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer " + token } },
    });
    return caller.from("organization_memberships")
      .select("role,status,access_starts_at,access_ends_at,organization:organizations(slug)")
      .eq("user_id", userId).eq("role", "eig_admin").eq("status", "active");
  },
});

// Branch-preview only. Uses existing public Supabase credentials and caller
// RLS, not a Supabase service-role key or a production Edge Function.
module.exports = check;

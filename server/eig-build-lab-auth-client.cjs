// Shared narrow Supabase authentication for owner-only Build Lab preview APIs.
// Uses the existing public anon key and the CALLER'S bearer token/RLS.
// Never uses a service-role token, bypasses RLS or authorizes any mutation.
const { createClient } = require("@supabase/supabase-js");

function buildLabPreviewAuthProviders(env = (name) => process.env[name]) {
  const credentials = () => {
    const url = env("VITE_SUPABASE_URL");
    const key = env("VITE_SUPABASE_ANON_KEY");
    if (!url || !key) throw new Error("Build Lab authentication unavailable");
    return { url, key };
  };
  return {
    async verifyUser(token) {
      const { url, key } = credentials();
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.getUser(token);
      if (error || !data?.user) throw new Error("Invalid login");
      return { id: data.user.id };
    },
    async membershipsForUser(userId, token) {
      const { url, key } = credentials();
      const caller = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: "Bearer " + token } },
      });
      return caller.from("organization_memberships")
        .select("role,status,access_starts_at,access_ends_at,organization:organizations(slug)")
        .eq("user_id", userId).eq("role", "eig_admin").eq("status", "active");
    },
  };
}
module.exports = { buildLabPreviewAuthProviders };

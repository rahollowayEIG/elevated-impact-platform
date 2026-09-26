export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export function cleanUsername(value: unknown) {
  return String(value || "").trim().replace(/^@/, "").toLowerCase().slice(0, 30);
}

export function cleanMessage(value: unknown) {
  return String(value || "").trim().slice(0, 2000);
}

export function displayProfile(profile: any) {
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || (profile.username ? "@" + profile.username : "ElevationPilot User"),
  };
}

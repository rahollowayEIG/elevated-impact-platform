// SANDBOX-ONLY source port from deployed Live golf-my-registrations.
// Live source SHA-256: d5bd4ef7bd47bf1254956f7dd7679dea956d40c2fc9d09efd7d769a1941d4133
// Sandbox-specific differences: backend pin and canonical origin CORS.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "https://elevationpilot-sandbox.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (url !== "https://publruuuyvpggogrrgwp.supabase.co" || !serviceKey) {
    return json({ success: false, error: "Sandbox service is not configured." }, 503);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ success: false, error: "Sign in required." }, 401);

    const { data: passenger } = await admin
      .from("passengers")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const filters = ["user_id.eq." + user.id];
    if (passenger?.id) filters.push("passenger_id.eq." + passenger.id);

    const { data: ownRows, error: ownError } = await admin
      .from("golf_registrations")
      .select("*")
      .or(filters.join(","))
      .order("created_at", { ascending: false });
    if (ownError) throw ownError;

    const groups: any[] = [];
    const seen = new Set<string>();

    for (const own of ownRows || []) {
      if (!own.team_id || !own.event_id) {
        groups.push({ role: "golfer", registration: own, team: null, members: [own] });
        continue;
      }

      const key = own.event_id + ":" + own.team_id;
      if (seen.has(key)) continue;
      seen.add(key);

      const { data: team, error: teamError } = await admin
        .from("golf_registration_teams")
        .select("*")
        .eq("event_id", own.event_id)
        .eq("team_id", own.team_id)
        .maybeSingle();
      if (teamError) throw teamError;
      if (!team) continue;

      const { data: members, error: memberError } = await admin
        .from("golf_registrations")
        .select("*")
        .eq("event_id", own.event_id)
        .eq("team_id", own.team_id)
        .order("created_at", { ascending: true });
      if (memberError) throw memberError;

      // The Glow Golf cart pilot can show existing per-slot payment records without
      // exposing payer emails or Stripe IDs. This remains read-only.
      let paymentShares: any[] = [];
      if (own.event_id === "5032048e-7d42-42aa-9dd3-5976734e87de") {
        const { data: shares, error: shareError } = await admin
          .from("golf_team_payment_shares")
          .select("registration_id,slot_number,amount_due,amount_paid,status")
          .eq("team_id", team.id);
        if (shareError) throw shareError;
        paymentShares = shares || [];
      }

      groups.push({
        role: team.captain_user_id === user.id ? "captain" : "teammate",
        registration: own,
        team,
        members: members || [],
        payment_shares: paymentShares,
      });
    }

    return json({ success: true, groups });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Unable to load registrations." }, 400);
  }
});

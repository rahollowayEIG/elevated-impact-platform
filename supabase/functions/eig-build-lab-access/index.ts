import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.99.3";
import { createEigBuildLabAccessHandler } from "./handler.mjs";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Keep Supabase gateway JWT verification enabled on deployment.
// The handler additionally authenticates token, live session,
// exact configured owner UUID and current EIG admin membership.
Deno.serve(createEigBuildLabAccessHandler({
  admin,
  env: (key: string) => Deno.env.get(key),
}));

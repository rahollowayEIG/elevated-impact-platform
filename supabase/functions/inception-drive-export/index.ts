import { createClient } from "npm:@supabase/supabase-js@2.99.3";
import { createDriveHandler } from "./handler.mjs";
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
Deno.serve(
  createDriveHandler({ admin, env: (name: string) => Deno.env.get(name) }),
);

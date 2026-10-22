import { createClient } from "npm:@supabase/supabase-js@2.99.3";
import { createCanvaOAuthHandler } from "./handler.mjs";

// Draft only: deploy only after migration and security gates in documentation.
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {auth:{persistSession:false,autoRefreshToken:false}}
);
Deno.serve(createCanvaOAuthHandler({admin,env:(name:string)=>Deno.env.get(name)}));

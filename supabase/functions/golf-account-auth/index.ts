import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const reservedUsernames = new Set([
  'admin', 'administrator', 'root', 'system', 'support', 'security', 'billing',
  'elevatedimpactgroup', 'elevationpilot', 'eig', 'pilot', 'copilot', 'co-pilot',
  'atc', 'airport', 'maincabin', 'main-cabin', 'squawk', 'squawkbox', 'help', 'info',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const body = await req.json();
    const action = String(body?.action || '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Account service is not configured.' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === 'username_available') {
      const username = String(body?.username || '').trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
        return json({ available: false, error: 'Username must be 3-30 characters and use letters, numbers, dots, dashes, or underscores.' }, 400);
      }
      if (reservedUsernames.has(username)) {
        return json({ available: false, error: 'That username is reserved.' }, 400);
      }

      const { data, error } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .limit(1);
      if (error) throw error;
      return json({ available: !data?.length });
    }

    if (action === 'sign_in') {
      const identifier = String(body?.identifier || '').trim();
      const password = String(body?.password || '');
      if (!identifier || !password) {
        return json({ error: 'Enter your email or username and password.' });
      }

      let email = identifier;
      if (!identifier.includes('@')) {
        const { data: profile, error: profileError } = await admin
          .from('profiles')
          .select('id')
          .ilike('username', identifier)
          .maybeSingle();

        if (profileError || !profile?.id) {
          return json({ error: 'Invalid email/username or password.' });
        }

        const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
        if (userError || !userData?.user?.email) {
          return json({ error: 'Invalid email/username or password.' });
        }
        email = userData.user.email;
      }

      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await authClient.auth.signInWithPassword({ email, password });
      if (error || !data?.session || !data?.user) {
        return json({ error: 'Invalid email/username or password.' });
      }

      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    return json({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to process account request.' }, 500);
  }
});
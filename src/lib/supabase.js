import { createClient } from '@supabase/supabase-js';
import { assertSandboxSupabaseTarget } from '../sandbox/sandboxSupabaseGate.mjs';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
assertSandboxSupabaseTarget(supabaseUrl, { enabled: import.meta.env.VITE_ELEVATIONPILOT_SANDBOX === 'true', key: supabaseAnonKey });

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = Boolean(supabase);

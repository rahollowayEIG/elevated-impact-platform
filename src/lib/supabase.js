import { createClient } from '@supabase/supabase-js';
import { assertSandboxSupabaseTarget } from '../sandbox/sandboxSupabaseGate.mjs';
import { createSandboxGuardedFetch } from '../sandbox/sandboxBrowserFetchGuard.mjs';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isSandbox = import.meta.env.VITE_ELEVATIONPILOT_SANDBOX === 'true';
const sandboxReadOnlyPreview = isSandbox &&
  import.meta.env.VITE_SANDBOX_READONLY_PREVIEW_ENABLED === 'true';
assertSandboxSupabaseTarget(supabaseUrl, { enabled: isSandbox, key: supabaseAnonKey });

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, isSandbox
      ? { global: { fetch: createSandboxGuardedFetch(globalThis.fetch.bind(globalThis), {
          appOrigin: globalThis.location?.origin,
          sandboxSupabaseUrl: supabaseUrl,
          readOnly: sandboxReadOnlyPreview,
        }) } }
      : undefined)
  : null;

export const isSupabaseConfigured = Boolean(supabase);

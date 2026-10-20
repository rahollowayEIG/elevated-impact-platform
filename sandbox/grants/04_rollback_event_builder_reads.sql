-- ROLLBACK: ISOLATED SUPABASE SANDBOX ONLY.
-- This reverses 03_sandbox_event_builder_reads.sql; it does not touch
-- the earlier 01_sandbox_ui_read_only.sql grants or existing Live RLS.
DROP POLICY IF EXISTS "sandbox member read fictional sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "sandbox member read fictional master events" ON public.events;
REVOKE SELECT ON TABLE public.event_offers,public.golf_event_payment_settings,
  public.events,public.sponsors FROM authenticated;
REVOKE EXECUTE ON FUNCTION app_private.is_event_coordinator_for_master(uuid)
  FROM authenticated;

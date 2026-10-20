-- SANDBOX ONLY rollback for 01_sandbox_atomic_event_details.sql.
-- Safe while feature flag disabled. Do not run against Live.
REVOKE EXECUTE ON FUNCTION public.sandbox_save_practice_event_details(uuid,timestamptz,jsonb)
 FROM authenticated,anon,PUBLIC;
DROP FUNCTION IF EXISTS public.sandbox_save_practice_event_details(uuid,timestamptz,jsonb);
REVOKE EXECUTE ON FUNCTION sandbox_ops.save_practice_event_details(uuid,timestamptz,jsonb)
 FROM authenticated,anon,PUBLIC;
DROP FUNCTION IF EXISTS sandbox_ops.save_practice_event_details(uuid,timestamptz,jsonb);
REVOKE USAGE ON SCHEMA sandbox_ops FROM authenticated;

-- SANDBOX ONLY: rollback of 07_sandbox_budget_read_only.sql.
-- Does not affect earlier read-only permissions, profiles or active sessions.
REVOKE EXECUTE ON FUNCTION public.read_eie_event_budget(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION eig_private.read_event_budget(uuid) FROM authenticated;

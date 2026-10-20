-- ROLLBACK FOR ISOLATED SANDBOX ONLY.
-- Reverses grants in 05_sandbox_event_packet_read_only.sql.
-- The approved user's non-privileged public.profiles record is intentionally
-- retained: deleting it can disrupt normal Auth/account management and is not
-- needed to revoke access to Event Packet.
REVOKE SELECT ON TABLE public.event_builder_assets FROM authenticated;
REVOKE EXECUTE ON FUNCTION eig_private.can_manage_event_assets(uuid)
  FROM authenticated;
REVOKE USAGE ON SCHEMA eig_private FROM authenticated;

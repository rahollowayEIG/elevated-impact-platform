-- SANDBOX ONLY: remove the narrow Registration Details practice save.
-- Does not touch Event Details save, its private helper schema access,
-- or the fictional event's existing settings/offers/payment rows.
REVOKE EXECUTE ON FUNCTION public.sandbox_save_practice_registration_details(uuid,timestamptz,jsonb)
  FROM authenticated,anon,PUBLIC;
DROP FUNCTION IF EXISTS public.sandbox_save_practice_registration_details(uuid,timestamptz,jsonb);
REVOKE EXECUTE ON FUNCTION sandbox_ops.save_practice_registration_details(uuid,timestamptz,jsonb)
  FROM authenticated,anon,PUBLIC;
DROP FUNCTION IF EXISTS sandbox_ops.save_practice_registration_details(uuid,timestamptz,jsonb);

-- SANDBOX PROJECT publruuuyvpggogrrgwp ONLY.
-- Read-only access to the ORIGINAL EIE Budget pane's existing public RPC.
-- The public wrapper delegates to eig_private.read_event_budget, whose
-- SECURITY DEFINER implementation requires a verified current Auth session
-- AND a matching role-backed event membership/assignment. It is not a write.
DO $sandbox_guard$
BEGIN
  IF to_regclass('sandbox_ops.practice_testers') IS NULL
     OR (SELECT count(*) FROM sandbox_ops.practice_testers WHERE enabled) <> 1
     OR EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS DISTINCT FROM TRUE)
     OR EXISTS (SELECT 1 FROM public.organization_memberships WHERE role='eig_admin')
     OR EXISTS (SELECT 1 FROM public.profiles WHERE role='super_admin')
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       JOIN sandbox_ops.practice_testers t ON t.tester_user_id=p.id
       JOIN auth.users u ON u.id=p.id
       WHERE t.enabled AND p.role='user' AND p.account_status='active'
         AND u.email_confirmed_at IS NOT NULL
     )
     OR EXISTS (
       SELECT 1 FROM public.golf_registration_events e
       JOIN public.organizations o ON o.id=e.organization_id
       WHERE o.is_test IS DISTINCT FROM TRUE
     ) THEN
    RAISE EXCEPTION 'Refusing non-isolated or unverified Sandbox budget grant';
  END IF;

  -- Only the existing, audited read-only RPC may become executable.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='read_eie_event_budget'
      AND pg_get_function_identity_arguments(p.oid)='p_event_id uuid'
      AND p.prosecdef IS FALSE
      AND pg_get_function_result(p.oid)='jsonb'
  )
  OR NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='eig_private' AND p.proname='read_event_budget'
      AND pg_get_function_identity_arguments(p.oid)='target_event_id uuid'
      AND p.prosecdef IS TRUE
      AND pg_get_function_result(p.oid)='jsonb'
  ) THEN
    RAISE EXCEPTION 'Budget read RPC signatures unexpectedly changed: review before granting';
  END IF;
END $sandbox_guard$;

-- eig_private schema USAGE was scoped to authenticated in the previous
-- Event Packet read-only migration. Do not expose this schema through the API.
GRANT EXECUTE ON FUNCTION eig_private.read_event_budget(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_eie_event_budget(uuid) TO authenticated;

-- Intentionally NO budget/table SELECT or WRITE grants, NO save RPC access,
-- NO Live migration and NO publication/payment/email/Google integrations.

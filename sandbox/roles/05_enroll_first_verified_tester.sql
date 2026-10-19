-- OPERATOR-ONLY TEMPLATE: first approved Sandbox tester.
-- Intentionally NOT an automated migration.
-- NEVER run against Live (aszixzrdayrivungodwq).
-- Supabase project target: publruuuyvpggogrrgwp (ElevationPilot-Sandbox).
--
-- Prerequisite: an explicitly invited Auth user with verified email already
-- exists in the separate Sandbox Auth project, created via the supported
-- Supabase Auth Admin API / Dashboard. This template NEVER creates Auth users.
--
-- Replace the marker below with the explicitly approved exact email before
-- running. A missing account, wrong environment or repeat execution aborts.
DO $enroll_first_tester$
DECLARE
  v_email text := lower('REPLACE_WITH_APPROVED_SANDBOX_EMAIL');
  v_user_id uuid;
  v_organization_id uuid;
  v_count integer;
BEGIN
  IF v_email = 'replace_with_approved_sandbox_email'
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Provide an approved, verified Sandbox tester email';
  END IF;

  IF to_regclass('sandbox_ops.demo_personas') IS NULL
    OR to_regclass('sandbox_ops.practice_testers') IS NULL
    OR (SELECT count(*) FROM sandbox_ops.demo_personas) <> 5
    OR EXISTS(SELECT 1 FROM public.organizations WHERE is_test IS NOT TRUE)
    OR EXISTS(SELECT 1 FROM public.organization_memberships WHERE role='eig_admin') THEN
    RAISE EXCEPTION 'Refusing enrollment outside a locked, fictional Sandbox';
  END IF;

  IF (SELECT count(*) FROM sandbox_ops.practice_testers) <> 0 THEN
    RAISE EXCEPTION 'First-tester bootstrap requires an empty tester allowlist';
  END IF;

  SELECT o.id INTO STRICT v_organization_id
  FROM public.organizations o
  WHERE o.slug='sandbox-practice-club'
    AND o.is_test IS TRUE AND o.status='active';

  SELECT count(*) INTO v_count
  FROM auth.users
  WHERE lower(email)=v_email
    AND email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Exactly one previously verified Sandbox Auth user is required';
  END IF;

  SELECT u.id INTO STRICT v_user_id
  FROM auth.users u
  WHERE lower(u.email)=v_email
    AND u.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL;

  IF EXISTS(
    SELECT 1 FROM public.organization_memberships m
    WHERE m.user_id=v_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.event_assignments a
    WHERE a.user_id=v_user_id
  ) THEN
    RAISE EXCEPTION 'Unexpected existing role assignments; manual review required';
  END IF;

  INSERT INTO sandbox_ops.practice_testers(
    tester_user_id,practice_organization_id,allowed_roles,active_role,enabled
  ) VALUES (
    v_user_id,v_organization_id,
    ARRAY['pilot','co_pilot','atc','passenger']::text[],
    'passenger',true
  );

  RAISE NOTICE 'A verified first Sandbox tester is enrolled; no passwords, tokens or Live memberships were copied';
END
$enroll_first_tester$;

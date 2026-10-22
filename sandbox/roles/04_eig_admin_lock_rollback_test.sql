-- ELEVATIONPILOT SANDBOX ONLY. All test state and temporary grants ROLL BACK.
-- This test does not provision actual logins, copy real credentials or deliver mail.
-- Project: publruuuyvpggogrrgwp only.
BEGIN;
DO $seed$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_org uuid;
  v_eig uuid;
  v_rejected boolean := false;
BEGIN
  IF to_regclass('sandbox_ops.demo_personas') IS NULL
    OR to_regclass('sandbox_ops.practice_testers') IS NULL
    OR EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS NOT TRUE) THEN
    RAISE EXCEPTION 'Not the isolated Sandbox project';
  END IF;
  SELECT id INTO STRICT v_org FROM public.organizations
    WHERE slug = 'sandbox-practice-club' AND is_test IS TRUE;
  SELECT id INTO STRICT v_eig FROM public.organizations
    WHERE slug = 'elevated-impact-group' AND is_test IS TRUE;

  PERFORM set_config('sandbox.lock.test_user', v_uid::text, true);
  INSERT INTO auth.users(id,aud,role,email,created_at,updated_at)
    VALUES(v_uid,'authenticated','authenticated','eig-lock-test@sandbox.invalid',now(),now());
  INSERT INTO sandbox_ops.practice_testers
    (tester_user_id,practice_organization_id,allowed_roles,active_role,enabled)
    VALUES(v_uid,v_org,ARRAY['passenger','pilot']::text[],'passenger',true);

  BEGIN
    UPDATE sandbox_ops.practice_testers SET
      allowed_roles = ARRAY['passenger','pilot','eig_admin']::text[]
      WHERE tester_user_id = v_uid;
  EXCEPTION WHEN check_violation THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'EIG Admin was allowed into business sandbox role allowlist';
  END IF;

  v_rejected := false;
  BEGIN
    UPDATE sandbox_ops.practice_testers SET active_role = 'eig_admin'
    WHERE tester_user_id = v_uid;
  EXCEPTION WHEN check_violation THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'EIG Admin was activated for a business sandbox';
  END IF;

  -- Simulate an EIG staff member who has HQ membership. Their entry into
  -- the customer-facing practice role service must be DENIED.
  INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
    VALUES(v_eig,v_uid,'eig_admin','active');
END
$seed$;

-- SELECT only within this temporary transaction, never persistent app grants.
GRANT SELECT ON public.organizations, public.organization_memberships,
  public.golf_registration_events TO authenticated;
SET LOCAL ROLE authenticated;
DO $check$
DECLARE
  v_uid uuid := current_setting('sandbox.lock.test_user')::uuid;
  v_result jsonb;
  v_denied boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_uid::text,true);
  v_result := public.sandbox_practice_role_status();
  IF v_result->>'authorized' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'EIG headquarters member was authorized in customer sandbox';
  END IF;
  BEGIN
    PERFORM public.sandbox_switch_practice_role('pilot');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%EIG staff cannot enter business practice sandboxes%' THEN
      v_denied := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'EIG staff could switch to a customer practice role';
  END IF;
  v_denied := false;
  BEGIN
    PERFORM public.sandbox_switch_practice_role('eig_admin');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Unsupported practice role%' THEN
      v_denied := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'EIG Admin direct RPC request was accepted';
  END IF;
END
$check$;
RESET ROLE;
ROLLBACK;

-- Verifies no permanent synthetic users, grants or membership rows.
SELECT (SELECT count(*) FROM auth.users) AS persistent_auth_users,
       (SELECT count(*) FROM sandbox_ops.practice_testers) AS persistent_testers,
       (SELECT count(*) FROM public.organization_memberships WHERE role='eig_admin') AS persistent_admin_memberships,
       (SELECT count(*) FROM information_schema.role_table_grants
          WHERE table_schema='public' AND grantee IN ('anon','authenticated')) AS persistent_client_table_grants;

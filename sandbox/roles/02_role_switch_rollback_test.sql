-- SANDBOX PROJECT ONLY. Every synthetic Auth user, temporary GRANT,
-- membership transition, and audit entry created below is ROLLED BACK.
-- Do not run this outside publruuuyvpggogrrgwp.
BEGIN;
DO $seed$
DECLARE
  v_tester uuid := gen_random_uuid();
  v_unapproved uuid := gen_random_uuid();
  v_org uuid;
BEGIN
  IF to_regclass('sandbox_ops.practice_testers') IS NULL OR
     (SELECT count(*) FROM sandbox_ops.demo_personas) <> 5 OR
     EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS NOT TRUE) THEN
    RAISE EXCEPTION 'This is not the isolated practice project';
  END IF;
  SELECT id INTO STRICT v_org FROM public.organizations
    WHERE slug = 'sandbox-practice-club' AND is_test=true;
  PERFORM set_config('sandbox.switch.test_user',v_tester::text,true);
  PERFORM set_config('sandbox.switch.unapproved_user',v_unapproved::text,true);

  -- Transient FK parents: not supported production account provisioning.
  INSERT INTO auth.users(id,aud,role,email,created_at,updated_at)
  VALUES
    (v_tester,'authenticated','authenticated','role-switch-test@sandbox.invalid',now(),now()),
    (v_unapproved,'authenticated','authenticated','role-switch-rejected@sandbox.invalid',now(),now());
  INSERT INTO sandbox_ops.practice_testers
    (tester_user_id,practice_organization_id,allowed_roles,active_role,enabled)
  VALUES
    (v_tester,v_org,ARRAY['passenger','pilot','co_pilot','atc']::text[],'passenger',true);
END
$seed$;

-- Grants here exist only INSIDE this transaction. Persistent sandbox direct
-- client app-table grants stay disabled after ROLLBACK.
GRANT SELECT ON public.organization_memberships,public.event_assignments,
  public.golf_registration_events,public.organizations TO authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_eig_admin(),
  public.is_organization_member(uuid),
  public.has_organization_role(uuid,text[]),
  public.is_event_assigned(uuid) TO authenticated;

SET LOCAL ROLE authenticated;
DO $check$
DECLARE
  v_tester uuid := current_setting('sandbox.switch.test_user')::uuid;
  v_unapproved uuid := current_setting('sandbox.switch.unapproved_user')::uuid;
  v_result jsonb;
  v_role text;
BEGIN
  -- Authenticated but UNENROLLED: no entitlements, no role switch.
  PERFORM set_config('request.jwt.claim.sub',v_unapproved::text,true);
  v_result := public.sandbox_practice_role_status();
  IF v_result->>'authorized' <> 'false' THEN
    RAISE EXCEPTION 'Unapproved tester received permissions';
  END IF;
  BEGIN
    PERFORM public.sandbox_switch_practice_role('pilot');
    RAISE EXCEPTION 'UNAPPROVED_ROLE_SWITCH_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'UNAPPROVED_ROLE_SWITCH_SUCCEEDED' OR
       SQLERRM NOT LIKE '%not authorized%' THEN RAISE;
    END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  v_result := public.sandbox_practice_role_status();
  IF v_result->>'authorized' <> 'true' OR v_result->>'active_role' <> 'passenger'
    OR jsonb_array_length(v_result->'roles') <> 4 THEN
    RAISE EXCEPTION 'Approved tester status denied or wrong role list';
  END IF;
  PERFORM public.sandbox_switch_practice_role('pilot');
  SELECT m.role INTO v_role FROM public.organization_memberships m WHERE m.user_id=v_tester;
  IF v_role <> 'organization_admin' THEN RAISE EXCEPTION 'Pilot membership not assigned'; END IF;

  PERFORM public.sandbox_switch_practice_role('co_pilot');
  SELECT m.role INTO v_role FROM public.organization_memberships m WHERE m.user_id=v_tester;
  IF v_role <> 'organization_staff' THEN RAISE EXCEPTION 'Co-Pilot membership not assigned'; END IF;

  PERFORM public.sandbox_switch_practice_role('atc');
  IF EXISTS(SELECT 1 FROM public.organization_memberships WHERE user_id=v_tester) OR
     NOT EXISTS(SELECT 1 FROM public.event_assignments
                WHERE user_id=v_tester AND role='event_coordinator') THEN
    RAISE EXCEPTION 'ATC assignment boundaries failed';
  END IF;

  PERFORM public.sandbox_switch_practice_role('passenger');
  IF EXISTS(SELECT 1 FROM public.organization_memberships WHERE user_id=v_tester) OR
     EXISTS(SELECT 1 FROM public.event_assignments WHERE user_id=v_tester) THEN
    RAISE EXCEPTION 'Passenger retained elevated memberships';
  END IF;
  BEGIN
    PERFORM public.sandbox_switch_practice_role('eig_admin');
    RAISE EXCEPTION 'UNAUTHORIZED_EIG_ADMIN_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'UNAUTHORIZED_EIG_ADMIN_SUCCEEDED' OR
       SQLERRM NOT LIKE '%not authorized%' THEN RAISE;
    END IF;
  END;
  v_result := public.sandbox_practice_role_status();
  IF v_result->>'active_role' <> 'passenger' THEN
    RAISE EXCEPTION 'Final sandbox role mismatch';
  END IF;
END
$check$;
RESET ROLE;

DO $check_audit$
DECLARE
  v_tester uuid := current_setting('sandbox.switch.test_user')::uuid;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM sandbox_ops.practice_role_audit
    WHERE tester_user_id = v_tester;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Expected four audited role transitions, found %',v_count;
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_memberships
             WHERE user_id=v_tester) OR
     EXISTS (SELECT 1 FROM public.event_assignments WHERE user_id=v_tester) THEN
    RAISE EXCEPTION 'Unexpected final practice permissions';
  END IF;
END
$check_audit$;
ROLLBACK;
-- Only pre-existing sandbox data should remain after this point.
SELECT (SELECT count(*) FROM sandbox_ops.practice_testers) AS persisted_testers,
       (SELECT count(*) FROM sandbox_ops.practice_role_audit) AS persisted_role_switches,
       (SELECT count(*) FROM auth.users) AS persistent_auth_users,
       (SELECT count(*) FROM information_schema.role_table_grants
        WHERE table_schema='public' AND grantee='authenticated') AS persistent_authenticated_table_grants;

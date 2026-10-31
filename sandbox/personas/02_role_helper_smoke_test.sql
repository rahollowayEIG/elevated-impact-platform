-- SANDBOX ONLY. Database role-helper assertions with TEMPORARY fake identities.
-- Must be run as a single script. Its transaction always rolls back.
-- Never use this script to provision sign-in accounts.
BEGIN;
DO $sandbox_role_test$
DECLARE
  v_eig uuid;
  v_club uuid;
  v_event uuid;
  v_admin uuid := gen_random_uuid();
  v_pilot uuid := gen_random_uuid();
  v_copilot uuid := gen_random_uuid();
  v_atc uuid := gen_random_uuid();
  v_passenger uuid := gen_random_uuid();
BEGIN
  IF to_regclass('sandbox_ops.demo_personas') IS NULL THEN
    RAISE EXCEPTION 'Not the designated sandbox: demo persona marker missing';
  END IF;
  IF (SELECT count(*) FROM sandbox_ops.demo_personas) <> 5 THEN
    RAISE EXCEPTION 'Not the expected sandbox demo fixture';
  END IF;
  SELECT id INTO STRICT v_eig FROM public.organizations
    WHERE slug='elevated-impact-group' AND is_test=true;
  SELECT id INTO STRICT v_club FROM public.organizations
    WHERE slug='sandbox-practice-club' AND is_test=true;
  SELECT id INTO STRICT v_event FROM public.golf_registration_events
    WHERE event_key='sandbox-practice-scramble' AND status='draft';

  -- Ephemeral FK parents only. No login identities, passwords, email delivery,
  -- real users or permanent auth.users rows. All changes ROLLBACK below.
  INSERT INTO auth.users(id,aud,role,email,created_at,updated_at,
    raw_app_meta_data,raw_user_meta_data)
  VALUES
    (v_admin,'authenticated','authenticated','transient-admin@sandbox.invalid',now(),now(),'{"sandbox_ephemeral":true}'::jsonb,'{}'::jsonb),
    (v_pilot,'authenticated','authenticated','transient-pilot@sandbox.invalid',now(),now(),'{"sandbox_ephemeral":true}'::jsonb,'{}'::jsonb),
    (v_copilot,'authenticated','authenticated','transient-copilot@sandbox.invalid',now(),now(),'{"sandbox_ephemeral":true}'::jsonb,'{}'::jsonb),
    (v_atc,'authenticated','authenticated','transient-atc@sandbox.invalid',now(),now(),'{"sandbox_ephemeral":true}'::jsonb,'{}'::jsonb),
    (v_passenger,'authenticated','authenticated','transient-passenger@sandbox.invalid',now(),now(),'{"sandbox_ephemeral":true}'::jsonb,'{}'::jsonb);

  INSERT INTO public.organization_memberships (organization_id,user_id,role,status)
  VALUES (v_eig,v_admin,'eig_admin','active'),
         (v_club,v_pilot,'organization_admin','active'),
         (v_club,v_copilot,'organization_staff','active');
  INSERT INTO public.event_assignments (event_id,user_id,role,status)
  VALUES (v_event,v_atc,'event_coordinator','active');

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  IF NOT public.is_eig_admin() OR NOT public.is_organization_member(v_eig)
      OR public.is_event_assigned(v_event) THEN
    RAISE EXCEPTION 'EIG administrator boundaries failed';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_pilot::text,true);
  IF public.is_eig_admin() OR NOT public.is_organization_member(v_club)
      OR NOT public.has_organization_role(v_club,ARRAY['organization_admin']::text[])
      OR public.is_event_assigned(v_event) THEN
    RAISE EXCEPTION 'Pilot boundaries failed';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_copilot::text,true);
  IF public.is_eig_admin() OR NOT public.is_organization_member(v_club)
      OR public.has_organization_role(v_club,ARRAY['organization_admin']::text[])
      OR NOT public.has_organization_role(v_club,ARRAY['organization_staff']::text[]) THEN
    RAISE EXCEPTION 'Co-Pilot boundaries failed';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_atc::text,true);
  IF public.is_eig_admin() OR public.is_organization_member(v_club)
      OR NOT public.is_event_assigned(v_event)
      OR NOT app_private.is_event_coordinator(v_event)
      OR NOT app_private.is_event_coordinator_for_org(v_club) THEN
    RAISE EXCEPTION 'ATC event-scoped boundaries failed';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_passenger::text,true);
  IF public.is_eig_admin() OR public.is_organization_member(v_club)
      OR public.is_event_assigned(v_event)
      OR app_private.is_event_coordinator(v_event) THEN
    RAISE EXCEPTION 'Passenger boundaries failed';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','',true);
END
$sandbox_role_test$;
ROLLBACK;
-- Confirm the entire test was discarded. No real Auth users were created.
SELECT
  (SELECT count(*) FROM auth.users) AS remaining_auth_users,
  (SELECT count(*) FROM sandbox_ops.demo_personas WHERE auth_user_id IS NOT NULL) AS provisioned_personas,
  (SELECT count(*) FROM public.organization_memberships) AS persistent_memberships,
  (SELECT count(*) FROM public.event_assignments) AS persistent_event_assignments;

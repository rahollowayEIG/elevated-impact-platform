-- SANDBOX ONLY. Full RLS row-visibility smoke test, with ephemeral mock Auth users.
-- Every test-only insert and temporary GRANT is rolled back at the end.
BEGIN;
DO $sandbox_rls_seed$
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
  IF to_regclass('sandbox_ops.demo_personas') IS NULL OR
     (SELECT count(*) FROM sandbox_ops.demo_personas) <> 5 THEN
    RAISE EXCEPTION 'Not the expected sandbox environment';
  END IF;
  SELECT id INTO STRICT v_eig FROM public.organizations
    WHERE slug='elevated-impact-group' AND is_test=true;
  SELECT id INTO STRICT v_club FROM public.organizations
    WHERE slug='sandbox-practice-club' AND is_test=true;
  SELECT id INTO STRICT v_event FROM public.golf_registration_events
    WHERE event_key='sandbox-practice-scramble' AND status='draft';

  PERFORM set_config('sandbox.test.admin',v_admin::text,true);
  PERFORM set_config('sandbox.test.pilot',v_pilot::text,true);
  PERFORM set_config('sandbox.test.copilot',v_copilot::text,true);
  PERFORM set_config('sandbox.test.atc',v_atc::text,true);
  PERFORM set_config('sandbox.test.passenger',v_passenger::text,true);

  INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
  VALUES
    (v_admin,'authenticated','authenticated','rls-admin@sandbox.invalid',now(),now()),
    (v_pilot,'authenticated','authenticated','rls-pilot@sandbox.invalid',now(),now()),
    (v_copilot,'authenticated','authenticated','rls-copilot@sandbox.invalid',now(),now()),
    (v_atc,'authenticated','authenticated','rls-atc@sandbox.invalid',now(),now()),
    (v_passenger,'authenticated','authenticated','rls-passenger@sandbox.invalid',now(),now());

  INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
  VALUES
    (v_eig,v_admin,'eig_admin','active'),
    (v_club,v_pilot,'organization_admin','active'),
    (v_club,v_copilot,'organization_staff','active');
  INSERT INTO public.event_assignments(event_id,user_id,role,status)
  VALUES (v_event,v_atc,'event_coordinator','active');
END
$sandbox_rls_seed$;

-- ALL GRANTS ARE TRANSACTIONAL AND WILL BE ROLLED BACK.
GRANT SELECT ON public.organizations,public.golf_registration_events,
  public.contacts,public.events,public.organization_memberships,
  public.event_assignments TO authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_eig_admin(),
  public.is_organization_member(uuid),
  public.has_organization_role(uuid,text[]),
  public.is_event_assigned(uuid) TO authenticated;

SET LOCAL ROLE authenticated;
DO $sandbox_rls_check$
DECLARE
  v_role text;
  v_org integer;
  v_event integer;
  v_contact integer;
  v_master integer;
  v_expected_org integer;
  v_expected_event integer;
BEGIN
  FOR v_role,v_expected_org,v_expected_event IN
    VALUES ('admin',2,1),('pilot',1,1),('copilot',1,1),
           ('atc',1,1),('passenger',0,0)
  LOOP
    PERFORM set_config('request.jwt.claim.sub',current_setting('sandbox.test.'||v_role),true);
    SELECT count(*) INTO v_org FROM public.organizations;
    SELECT count(*) INTO v_event FROM public.golf_registration_events;
    IF v_org <> v_expected_org OR v_event <> v_expected_event THEN
      RAISE EXCEPTION 'RLS role % saw % organizations and % golf events, expected % and %',
        v_role,v_org,v_event,v_expected_org,v_expected_event;
    END IF;
    SELECT count(*) INTO v_contact FROM public.contacts;
    IF v_role IN ('pilot','copilot') AND v_contact <> 1 THEN
      RAISE EXCEPTION '% must see one practice contact, saw %',v_role,v_contact;
    END IF;
    IF v_role IN ('atc','passenger') AND v_contact <> 0 THEN
      RAISE EXCEPTION '% must not see unrelated contact records',v_role;
    END IF;
    IF v_role='atc' OR v_role='passenger' THEN
      SELECT count(*) INTO v_master FROM public.events;
      IF (v_role='atc' AND v_master<>1) OR (v_role='passenger' AND v_master<>0) THEN
        RAISE EXCEPTION 'Master event read policy mismatch for role %',v_role;
      END IF;
    END IF;
  END LOOP;
END
$sandbox_rls_check$;
RESET ROLE;
ROLLBACK;
SELECT (SELECT count(*) FROM auth.users) AS remaining_auth_users,
       (SELECT count(*) FROM public.organization_memberships) AS remaining_memberships,
       (SELECT count(*) FROM public.event_assignments) AS remaining_event_assignments,
       (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='authenticated') AS persisted_authenticated_grants;

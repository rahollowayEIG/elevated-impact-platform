-- SANDBOX ONLY. Connect Auth Admin-created test users to safe fictional roles.
-- Does not create Auth users, passwords, emails, payments, or invitations.
-- Run AFTER creating users through the Supabase Authentication > Users dashboard
-- (or the separate official Auth Admin API script).
DO $sandbox_link_existing_users$
DECLARE
  p record;
  v_id uuid;
  v_practice_org uuid;
  v_eig_org uuid;
  v_event uuid;
  v_first text;
  v_username text;
BEGIN
  IF to_regclass('sandbox_ops.demo_personas') IS NULL OR
     (SELECT COUNT(*) FROM sandbox_ops.demo_personas) <> 5 THEN
    RAISE EXCEPTION 'Refusing to link users outside the designated sandbox persona fixture';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users
             WHERE email IS NULL OR lower(email) NOT LIKE '%@sandbox.invalid') THEN
    RAISE EXCEPTION 'Sandbox contains non-demo Auth users; inspect manually before linking';
  END IF;
  SELECT id INTO STRICT v_practice_org FROM public.organizations
    WHERE slug='sandbox-practice-club' AND is_test=true;
  SELECT id INTO STRICT v_eig_org FROM public.organizations
    WHERE slug='elevated-impact-group' AND is_test=true;
  SELECT id INTO STRICT v_event FROM public.golf_registration_events
    WHERE event_key='sandbox-practice-scramble' AND status='draft'
      AND organization_id = v_practice_org;

  FOR p IN SELECT * FROM sandbox_ops.demo_personas ORDER BY persona_key LOOP
    SELECT id INTO v_id FROM auth.users
      WHERE lower(email) = p.email
        AND email_confirmed_at IS NOT NULL
        AND deleted_at IS NULL;
    IF v_id IS NULL THEN
      CONTINUE; -- User not created or not confirmed yet.
    END IF;
    v_first := split_part(p.display_name,' ',1);
    v_username := 'sandbox_'||replace(p.persona_key,'_','');
    UPDATE sandbox_ops.demo_personas SET auth_user_id=v_id
      WHERE persona_key=p.persona_key AND
            (auth_user_id IS NULL OR auth_user_id=v_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Persona already linked to another user: %',p.persona_key; END IF;

    INSERT INTO public.profiles(id,first_name,last_name,display_name,username,role)
    VALUES (v_id,v_first,'Demo',p.display_name,v_username,'user')
    ON CONFLICT (id) DO NOTHING;

    IF p.persona_key = 'eig_admin' THEN
      INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
      VALUES(v_eig_org,v_id,'eig_admin','active')
      ON CONFLICT (organization_id,user_id) DO NOTHING;
    ELSIF p.persona_key IN ('pilot','co_pilot') THEN
      INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
      VALUES(v_practice_org,v_id,
        CASE p.persona_key WHEN 'pilot' THEN 'organization_admin' ELSE 'organization_staff' END,
        'active')
      ON CONFLICT (organization_id,user_id) DO NOTHING;
    ELSIF p.persona_key = 'atc' THEN
      INSERT INTO public.event_assignments(event_id,user_id,role,status)
      VALUES(v_event,v_id,'event_coordinator','active')
      ON CONFLICT (event_id,user_id) DO NOTHING;
    ELSIF p.persona_key = 'passenger' THEN
      INSERT INTO public.passengers(auth_user_id,first_name,last_name,preferred_name,status,claimed_at)
      VALUES(v_id,v_first,'Demo',v_first,'claimed',now())
      ON CONFLICT (auth_user_id) DO NOTHING;
    END IF;
  END LOOP;
END
$sandbox_link_existing_users$;
SELECT (SELECT count(*) FROM sandbox_ops.demo_personas WHERE auth_user_id IS NOT NULL) AS ready_demo_personas,
       (SELECT count(*) FROM sandbox_ops.demo_personas WHERE auth_user_id IS NULL) AS remaining_demo_personas;

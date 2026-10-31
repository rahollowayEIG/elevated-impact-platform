-- SANDBOX ONLY: protect business training spaces against global EIG Admin role.
-- The internal EIG testing environment must be isolated separately.
-- Apply only to Supabase project publruuuyvpggogrrgwp. NEVER to Live.
-- No real users, other tenant data, email credentials or tokens are imported.
DO $lock_eig$
BEGIN
  IF to_regclass('sandbox_ops.demo_personas') IS NULL
    OR to_regclass('sandbox_ops.practice_testers') IS NULL
    OR EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS NOT TRUE)
    OR NOT EXISTS (
      SELECT 1 FROM public.organizations
      WHERE slug='sandbox-practice-club' AND is_test IS TRUE
    ) THEN
    RAISE EXCEPTION 'Refusing EIG role lockdown outside the isolated Sandbox';
  END IF;
  IF EXISTS (
    SELECT 1 FROM sandbox_ops.practice_testers t
    WHERE t.active_role = 'eig_admin'
       OR 'eig_admin' = ANY(t.allowed_roles)
  ) THEN
    RAISE EXCEPTION 'Existing admin practice users require manual review first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_memberships m
    JOIN public.organizations o ON o.id=m.organization_id
    WHERE m.role='eig_admin' AND o.slug='elevated-impact-group'
  ) THEN
    RAISE EXCEPTION 'EIG Admin accounts in shared practice database require separation';
  END IF;
END
$lock_eig$;

ALTER TABLE sandbox_ops.practice_testers
  DROP CONSTRAINT practice_roles_allowed;
ALTER TABLE sandbox_ops.practice_testers
  ADD CONSTRAINT practice_roles_allowed CHECK (
    allowed_roles <@ ARRAY['pilot','co_pilot','atc','passenger']::text[]
  );
ALTER TABLE sandbox_ops.practice_testers
  DROP CONSTRAINT practice_roles_not_empty;
ALTER TABLE sandbox_ops.practice_testers
  ADD CONSTRAINT practice_roles_not_empty CHECK (cardinality(allowed_roles) BETWEEN 1 AND 4);

CREATE OR REPLACE FUNCTION public.sandbox_practice_role_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $status$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_roles text[];
  v_org uuid;
  v_has_event boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('authorized', false, 'roles', jsonb_build_array());
  END IF;
  SELECT t.active_role, t.allowed_roles, t.practice_organization_id
    INTO v_role, v_roles, v_org
    FROM sandbox_ops.practice_testers t
    JOIN public.organizations o ON o.id = t.practice_organization_id
    WHERE t.tester_user_id = v_uid AND t.enabled AND o.is_test IS TRUE
      AND o.slug <> 'elevated-impact-group' AND o.status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        JOIN public.organizations h ON h.id = m.organization_id
        WHERE m.user_id = v_uid AND m.role = 'eig_admin'
          AND h.slug = 'elevated-impact-group'
      );
  IF NOT FOUND THEN
    RETURN jsonb_build_object('authorized', false, 'roles', jsonb_build_array());
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.golf_registration_events e
    WHERE e.organization_id = v_org AND e.status = 'draft') INTO v_has_event;
  RETURN jsonb_build_object(
    'authorized', true, 'active_role', v_role,
    'roles', to_jsonb(v_roles), 'has_practice_event', v_has_event
  );
END
$status$;

CREATE OR REPLACE FUNCTION public.sandbox_switch_practice_role(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $switch$
DECLARE
  v_uid uuid := auth.uid();
  v_previous text;
  v_roles text[];
  v_org uuid;
    v_event uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to the independent Sandbox first';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('pilot','co_pilot','atc','passenger') THEN
    RAISE EXCEPTION 'Unsupported practice role';
  END IF;

  -- Serializes concurrent role changes and does not trust a UI-selected user.
  SELECT t.active_role, t.allowed_roles, t.practice_organization_id
    INTO v_previous, v_roles, v_org
    FROM sandbox_ops.practice_testers t
    WHERE t.tester_user_id = v_uid AND t.enabled
    FOR UPDATE;
  IF NOT FOUND OR NOT (p_role = ANY(v_roles)) THEN
    RAISE EXCEPTION 'This practice role is not authorized for your Sandbox account';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations o
                 WHERE o.id = v_org AND o.is_test IS TRUE
                   AND o.status = 'active' AND o.slug <> 'elevated-impact-group') THEN
    RAISE EXCEPTION 'A separate, active fictional practice organization is required';
  END IF;
  -- EIG headquarters membership is incompatible with merchant practice.
  -- Staff administration belongs to a separate EIG-only sandbox project.
  IF EXISTS (
    SELECT 1 FROM public.organization_memberships m
    JOIN public.organizations h ON h.id = m.organization_id
    WHERE m.user_id = v_uid AND m.role = 'eig_admin'
      AND h.slug = 'elevated-impact-group'
  ) THEN
    RAISE EXCEPTION 'EIG staff cannot enter business practice sandboxes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.is_test IS NOT TRUE) THEN
    RAISE EXCEPTION 'Sandbox safety gate detected non-practice organizations';
  END IF;

  -- Reject mixed membership contexts; do not "clean up" other organizations.
  IF EXISTS (SELECT 1 FROM public.organization_memberships m
             WHERE m.user_id = v_uid AND m.organization_id <> v_org) THEN
    RAISE EXCEPTION 'Unexpected organization memberships: inspect before switching roles';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_assignments a
             JOIN public.golf_registration_events e ON e.id = a.event_id
             WHERE a.user_id = v_uid AND e.organization_id IS DISTINCT FROM v_org) THEN
    RAISE EXCEPTION 'Unexpected event assignments: inspect before switching roles';
  END IF;

  IF p_role = 'atc' THEN
    SELECT e.id INTO v_event FROM public.golf_registration_events e
    WHERE e.organization_id = v_org AND e.status = 'draft'
    ORDER BY e.created_at, e.id LIMIT 1;
    IF v_event IS NULL THEN
      RAISE EXCEPTION 'Create a draft practice event as Pilot before testing ATC';
    END IF;
  END IF;

  -- No unrelated tenant, live auth account, or external integration changes.
  DELETE FROM public.event_assignments a USING public.golf_registration_events e
    WHERE a.event_id = e.id AND a.user_id = v_uid AND e.organization_id = v_org;
  DELETE FROM public.organization_memberships m
    WHERE m.user_id = v_uid AND m.organization_id = v_org;

  IF p_role = 'pilot' THEN
    INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
      VALUES(v_org,v_uid,'organization_admin','active');
  ELSIF p_role = 'co_pilot' THEN
    INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
      VALUES(v_org,v_uid,'organization_staff','active');
  ELSIF p_role = 'atc' THEN
    INSERT INTO public.event_assignments(event_id,user_id,role,status)
      VALUES(v_event,v_uid,'event_coordinator','active');
  END IF;
  -- Passenger means no special membership. A test passenger/profile should
  -- be provisioned once through supported Auth Admin operations.

  UPDATE sandbox_ops.practice_testers SET active_role = p_role, updated_at = now()
    WHERE tester_user_id = v_uid;
  INSERT INTO sandbox_ops.practice_role_audit
    (tester_user_id,practice_organization_id,previous_role,selected_role)
    VALUES(v_uid,v_org,v_previous,p_role);
  RETURN jsonb_build_object('authorized',true,'active_role',p_role);
END
$switch$;

COMMENT ON FUNCTION public.sandbox_switch_practice_role(text) IS
  'SANDBOX ONLY: merchant practice role switching, no EIG Administrator role. Internal EIG sandbox must be separate.';

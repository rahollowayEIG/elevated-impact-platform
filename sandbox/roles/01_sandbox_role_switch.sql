-- ELEVATIONPILOT SANDBOX ONLY.
-- Apply manually ONLY to project publruuuyvpggogrrgwp after review.
-- Do not include in production migrations; does NOT provision users or copy
-- credentials. This changes memberships for explicitly enrolled sandbox
-- testers, not identity tokens. All underlying app RLS still applies.
--
-- Deny setup if live data or the fictional sandbox setup is absent.
DO $guard$
BEGIN
  IF to_regclass('sandbox_ops.demo_personas') IS NULL
     OR (SELECT count(*) FROM sandbox_ops.demo_personas) <> 5
     OR (SELECT count(*) FROM public.organizations
           WHERE slug IN ('elevated-impact-group','sandbox-practice-club')
             AND is_test IS TRUE) <> 2
     OR EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS NOT TRUE) THEN
    RAISE EXCEPTION 'Refusing to install sandbox role switching outside the isolated fictional project';
  END IF;
END
$guard$;

CREATE TABLE IF NOT EXISTS sandbox_ops.practice_testers (
  tester_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  allowed_roles text[] NOT NULL DEFAULT ARRAY['passenger']::text[],
  active_role text NOT NULL DEFAULT 'passenger',
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_roles_not_empty CHECK (cardinality(allowed_roles) BETWEEN 1 AND 5),
  CONSTRAINT practice_roles_allowed CHECK (allowed_roles <@ ARRAY['eig_admin','pilot','co_pilot','atc','passenger']::text[]),
  CONSTRAINT practice_roles_active_check CHECK (active_role = ANY(allowed_roles))
);

ALTER TABLE sandbox_ops.practice_testers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sandbox_ops.practice_testers FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS sandbox_ops.practice_role_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  previous_role text NOT NULL,
  selected_role text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sandbox_ops.practice_role_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sandbox_ops.practice_role_audit FROM PUBLIC, anon, authenticated;

-- A client gets only the roles that a server-side operator assigned to the
-- authenticated sandbox user. No caller-supplied email, UUID or identity.
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
      AND o.slug <> 'elevated-impact-group' AND o.status = 'active';
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

-- Actual role switch: update ONLY the logged-in user's memberships under
-- explicitly fictional, sandbox-scoped organizations in one transaction.
-- The app reloads afterward, so ordinary RLS checks run on current records.
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
  v_headquarters uuid;
  v_event uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to the independent Sandbox first';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('eig_admin','pilot','co_pilot','atc','passenger') THEN
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
  SELECT o.id INTO v_headquarters
    FROM public.organizations o
    WHERE o.slug = 'elevated-impact-group' AND o.is_test IS TRUE AND o.status = 'active';
  IF v_headquarters IS NULL THEN
    RAISE EXCEPTION 'Fictional headquarters fixture is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.is_test IS NOT TRUE) THEN
    RAISE EXCEPTION 'Sandbox safety gate detected non-practice organizations';
  END IF;

  -- Reject mixed membership contexts; do not "clean up" other organizations.
  IF EXISTS (SELECT 1 FROM public.organization_memberships m
             WHERE m.user_id = v_uid AND m.organization_id NOT IN (v_org, v_headquarters)) THEN
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
    WHERE m.user_id = v_uid AND m.organization_id IN (v_org, v_headquarters);

  IF p_role = 'eig_admin' THEN
    INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
      VALUES(v_headquarters,v_uid,'eig_admin','active');
  ELSIF p_role = 'pilot' THEN
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

REVOKE ALL ON FUNCTION public.sandbox_practice_role_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sandbox_switch_practice_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sandbox_practice_role_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_switch_practice_role(text) TO authenticated;

COMMENT ON FUNCTION public.sandbox_switch_practice_role(text) IS
  'SANDBOX ONLY: authorized test persona selection within fictional organizations; never deploy to Live.';

-- ISOLATED ELEVATIONPILOT SANDBOX PROJECT publruuuyvpggogrrgwp ONLY.
-- Completes the existing Event Packet SELECT path. NEVER run against Live.
-- Existing event_builder_assets RLS policy calls eig_private.can_manage_event_assets,
-- which validates a real verified user, active Auth session, current profile
-- and authorized organization membership or ATC event assignment.
DO $safety$
DECLARE v_uid uuid;
BEGIN
  IF to_regclass('sandbox_ops.practice_testers') IS NULL
    OR (SELECT count(*) FROM sandbox_ops.practice_testers WHERE enabled) <> 1
    OR EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS DISTINCT FROM TRUE)
    OR EXISTS (SELECT 1 FROM public.organization_memberships WHERE role = 'eig_admin')
    OR EXISTS (SELECT 1 FROM public.golf_registration_events WHERE status = 'published')
    OR (SELECT count(*) FROM public.golf_registrations) <> 0 THEN
    RAISE EXCEPTION 'Refusing non-isolated or unexpected Sandbox state';
  END IF;

  SELECT tester_user_id INTO v_uid FROM sandbox_ops.practice_testers WHERE enabled;
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Approved tester must have a verified independent Sandbox login';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.sessions s WHERE s.user_id = v_uid
      AND (s.not_after IS NULL OR s.not_after > now())
  ) THEN
    RAISE EXCEPTION 'Approved tester must have a current Sandbox session';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unexpected elevated Sandbox profile';
  END IF;
END $safety$;

-- The original Live-compatible profile gate requires an active profile.
-- Provision only the existing, verified Sandbox tester and never elevate role.
-- No Live profile metadata, phone, DOB, or account secrets are copied.
INSERT INTO public.profiles(id,role,account_status)
SELECT t.tester_user_id,'user','active'
FROM sandbox_ops.practice_testers t
JOIN auth.users u ON u.id=t.tester_user_id AND u.email_confirmed_at IS NOT NULL
WHERE t.enabled
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=t.tester_user_id);

-- The eig_private schema is not an exposed Data API schema. Before this change
-- authenticated had EXECUTE on zero of its 24 functions. Grant only this
-- pure authorization predicate; privileged save methods remain inaccessible.
GRANT USAGE ON SCHEMA eig_private TO authenticated;
GRANT EXECUTE ON FUNCTION eig_private.can_manage_event_assets(uuid)
  TO authenticated;

-- Existing event_builder_assets_authorized_read policy still checks exact
-- authorized event and valid account/session. No INSERT/UPDATE/DELETE grants.
GRANT SELECT ON TABLE public.event_builder_assets TO authenticated;

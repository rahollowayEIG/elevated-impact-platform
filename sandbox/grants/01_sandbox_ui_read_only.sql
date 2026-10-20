-- SANDBOX ONLY: narrow SELECT grants to existing Live ElevationPilot read paths.
-- Must never run on the Live Supabase project. No real users or customer data.
-- Prerequisite: exactly one approved practice tester, fictional organizations only.
DO $safety$
BEGIN
  IF to_regclass('sandbox_ops.practice_testers') IS NULL THEN
    RAISE EXCEPTION 'Refusing non-Sandbox project: practice tester table missing';
  END IF;
  IF (SELECT count(*) FROM sandbox_ops.practice_testers WHERE enabled) <> 1
     OR EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS DISTINCT FROM TRUE)
     OR EXISTS (SELECT 1 FROM public.organization_memberships WHERE role = 'eig_admin') THEN
    RAISE EXCEPTION 'Refusing non-practice or unexpected Sandbox membership state';
  END IF;
END $safety$;

-- These functions already back Live RLS predicates. Only self-scoped checks.
-- The private schema is intentionally not exposed through the PostgREST API.
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  app_private.is_event_coordinator(uuid),
  app_private.is_event_coordinator_for_org(uuid)
TO authenticated;
GRANT EXECUTE ON FUNCTION
  public.is_eig_admin(),
  public.is_organization_member(uuid),
  public.has_organization_role(uuid,text[]),
  public.is_event_assigned(uuid)
TO authenticated;

-- The existing, identical-to-Live RLS policies still decide WHAT rows each
-- enrolled tester may read. No INSERT, UPDATE, DELETE, TRUNCATE or write-RPC
-- privilege is granted here. Do not copy Live grants wholesale.
GRANT SELECT ON TABLE
  public.organizations,
  public.organization_memberships,
  public.profiles,
  public.products,
  public.organization_product_entitlements,
  public.organization_profiles,
  public.golf_registration_events,
  public.golf_registrations,
  public.event_assignments,
  public.event_requests,
  public.passengers
TO authenticated;

-- This only prepares backend reads. The full UI remains locked unless the
-- independent Sandbox-only, read-only preview entry is enabled and tested.

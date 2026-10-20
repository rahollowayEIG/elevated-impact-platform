-- APPLY TO ISOLATED SUPABASE SANDBOX PROJECT publruuuyvpggogrrgwp ONLY.
-- Purpose: allow original EIE Event Builder read-only inspection with existing
-- authenticated user and role-based RLS, with no writes or Live integrations.
DO $safety$
BEGIN
  IF to_regclass('sandbox_ops.practice_testers') IS NULL
     OR (SELECT count(*) FROM sandbox_ops.practice_testers WHERE enabled) <> 1
     OR (SELECT count(*) FROM public.organizations WHERE is_test IS DISTINCT FROM TRUE) > 0
     OR EXISTS (SELECT 1 FROM public.organization_memberships WHERE role='eig_admin') THEN
    RAISE EXCEPTION 'Not an approved fictional Sandbox; refusing permissions';
  END IF;
END $safety$;

-- Existing RLS already checks tenant memberships for offers and payment
-- settings; private helper ensures ATC reads on master events and sponsors.
GRANT SELECT ON TABLE
  public.event_offers,
  public.golf_event_payment_settings,
  public.events,
  public.sponsors
TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_event_coordinator_for_master(uuid)
TO authenticated;

-- The Live master-events and sponsor policies support ATC, but not Pilot.
-- These Sandbox-only SELECT policies give fictional practice organization
-- members the matching reads. Authorization is based on DB memberships, NOT
-- mutable client metadata or URL-selected user IDs.
CREATE POLICY "sandbox member read fictional master events"
ON public.events FOR SELECT TO authenticated
USING (
  public.is_organization_member(organization_id)
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id=events.organization_id
      AND o.is_test IS TRUE
      AND o.slug <> 'elevated-impact-group'
  )
);

CREATE POLICY "sandbox member read fictional sponsors"
ON public.sponsors FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organizations o ON o.id=e.organization_id
    WHERE e.id=sponsors.event_id
      AND o.is_test IS TRUE
      AND public.is_organization_member(e.organization_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.golf_registration_events ge
    JOIN public.organizations o ON o.id=ge.organization_id
    WHERE ge.id=sponsors.event_id
      AND o.is_test IS TRUE
      AND public.is_organization_member(ge.organization_id)
  )
);

-- Intentionally NO table writes, NO payment/email functions, NO changes to
-- Supabase Live, and NO global full-workspace enablement.

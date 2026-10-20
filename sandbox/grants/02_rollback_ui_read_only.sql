-- MANUAL ROLLBACK (Sandbox project only). Do not run on Live.
REVOKE SELECT ON TABLE public.organizations,public.organization_memberships,
  public.profiles,public.products,public.organization_product_entitlements,
  public.organization_profiles,public.golf_registration_events,
  public.golf_registrations,public.event_assignments,public.event_requests,
  public.passengers FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_eig_admin(),
  public.is_organization_member(uuid),public.has_organization_role(uuid,text[]),
  public.is_event_assigned(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION app_private.is_event_coordinator(uuid),
  app_private.is_event_coordinator_for_org(uuid) FROM authenticated;
REVOKE USAGE ON SCHEMA app_private FROM authenticated;

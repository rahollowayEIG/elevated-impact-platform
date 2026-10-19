-- SANDBOX ONLY. Four reviewed read-only access predicates used by Squawk/event policies.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION app_private.can_view_squawk_recipient_list(target_message_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and target_message_id is not null
    and exists (
      select 1
      from public.squawk_messages sm
      join public.squawk_threads st on st.id = sm.thread_id
      where sm.id = target_message_id
        and (
          sm.created_by = (select auth.uid())
          or public.is_eig_admin()
          or public.has_organization_role(
            st.organization_id,
            array['organization_admin'::text, 'organization_staff'::text]
          )
        )
    );
$function$;
CREATE OR REPLACE FUNCTION app_private.is_event_coordinator(target_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and target_event_id is not null
    and exists (
      select 1
      from public.event_assignments ea
      where ea.event_id = target_event_id
        and ea.user_id = (select auth.uid())
        and ea.status = 'active'
        and ea.role = 'event_coordinator'
        and (ea.access_starts_at is null or ea.access_starts_at <= now())
        and (ea.access_ends_at is null or ea.access_ends_at >= now())
    );
$function$;
CREATE OR REPLACE FUNCTION app_private.is_event_coordinator_for_master(target_master_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and target_master_event_id is not null
    and exists (
      select 1
      from public.event_assignments ea
      join public.golf_registration_events ge on ge.id = ea.event_id
      where ge.master_event_id = target_master_event_id
        and ea.user_id = (select auth.uid())
        and ea.status = 'active'
        and ea.role = 'event_coordinator'
        and (ea.access_starts_at is null or ea.access_starts_at <= now())
        and (ea.access_ends_at is null or ea.access_ends_at >= now())
    );
$function$;
CREATE OR REPLACE FUNCTION app_private.is_event_coordinator_for_org(target_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and target_org_id is not null
    and exists (
      select 1
      from public.event_assignments ea
      join public.golf_registration_events ge on ge.id = ea.event_id
      where ge.organization_id = target_org_id
        and ea.user_id = (select auth.uid())
        and ea.status = 'active'
        and ea.role = 'event_coordinator'
        and (ea.access_starts_at is null or ea.access_starts_at <= now())
        and (ea.access_ends_at is null or ea.access_ends_at >= now())
    );
$function$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated;

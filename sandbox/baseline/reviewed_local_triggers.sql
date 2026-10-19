-- SANDBOX ONLY: six manually reviewed local trigger routines and their matching triggers.
-- These routines update only sandbox rows. No external calls or production data.
CREATE OR REPLACE FUNCTION public.eig_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.eig_touch_updated_at() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.golf_cancel_empty_team()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.team_id IS NOT NULL
     AND OLD.registration_status = 'active'
     AND NEW.registration_status IN ('cancelled', 'withdrawn')
     AND NOT EXISTS (
       SELECT 1 FROM public.golf_registrations r
       WHERE r.event_id = OLD.event_id AND r.team_id = OLD.team_id
         AND r.registration_status = 'active'
     )
  THEN
    UPDATE public.golf_registration_teams t
    SET status = 'cancelled', updated_at = now()
    WHERE t.event_id = OLD.event_id AND t.team_id = OLD.team_id
      AND t.status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.golf_cancel_empty_team() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.golf_release_cancelled_team_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'cancelled' THEN
    NEW.entry_number := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.golf_release_cancelled_team_number() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.normalize_profile_username()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.username is null or btrim(new.username) = '' then
    new.username := null;
    return new;
  end if;

  new.username := lower(btrim(new.username));

  if new.username !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'Username must be 3-30 characters and use letters, numbers, dots, dashes, or underscores.';
  end if;

  if new.username = any (array[
    'admin','administrator','root','system','support','security','billing',
    'elevatedimpactgroup','elevationpilot','eig','pilot','copilot','co-pilot',
    'atc','airport','maincabin','main-cabin','squawk','squawkbox','help','info'
  ]::text[]) then
    raise exception 'That username is reserved.';
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.normalize_profile_username() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.set_organization_profile_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.set_organization_profile_updated_at() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER event_registration_fields_updated_at BEFORE UPDATE ON event_registration_fields FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_golf_registration_events_updated_at BEFORE UPDATE ON golf_registration_events FOR EACH ROW EXECUTE FUNCTION eig_touch_updated_at();
CREATE TRIGGER golf_release_cancelled_team_number BEFORE INSERT OR UPDATE ON golf_registration_teams FOR EACH ROW EXECUTE FUNCTION golf_release_cancelled_team_number();
CREATE TRIGGER golf_cancel_empty_team AFTER UPDATE OF registration_status ON golf_registrations FOR EACH ROW EXECUTE FUNCTION golf_cancel_empty_team();
CREATE TRIGGER golfers_updated_at BEFORE UPDATE ON golfers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER organization_profiles_updated_at BEFORE UPDATE ON organization_profiles FOR EACH ROW EXECUTE FUNCTION set_organization_profile_updated_at();
CREATE TRIGGER passenger_billing_profiles_set_updated_at BEFORE UPDATE ON passenger_billing_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER passenger_contacts_set_updated_at BEFORE UPDATE ON passenger_contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER passenger_event_results_set_updated_at BEFORE UPDATE ON passenger_event_results FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER passenger_payment_methods_set_updated_at BEFORE UPDATE ON passenger_payment_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER passenger_profiles_set_updated_at BEFORE UPDATE ON passenger_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER passengers_set_updated_at BEFORE UPDATE ON passengers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER platform_invitations_set_updated_at BEFORE UPDATE ON platform_invitations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER normalize_profile_username_trigger BEFORE INSERT OR UPDATE OF username ON profiles FOR EACH ROW EXECUTE FUNCTION normalize_profile_username();
CREATE TRIGGER registration_field_values_updated_at BEFORE UPDATE ON registration_field_values FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER registration_types_updated_at BEFORE UPDATE ON registration_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER team_registrations_updated_at BEFORE UPDATE ON team_registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

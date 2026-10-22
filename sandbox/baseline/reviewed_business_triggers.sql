-- SANDBOX ONLY: reviewed local DB triggers. No external integration, secrets or production data.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION eig_private.capture_account_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  before_value jsonb;
  after_value jsonb;
  target_id uuid;
  actor_id uuid;
  headers jsonb;
begin
  if tg_table_name = 'profiles' then
    before_value := jsonb_build_object('account_status', old.account_status);
    after_value := jsonb_build_object('account_status', new.account_status);
    target_id := new.id;
  elsif tg_table_name = 'users' then
    before_value := jsonb_build_object('banned_until', old.banned_until);
    after_value := jsonb_build_object('banned_until', new.banned_until);
    target_id := new.id;
  else
    before_value := jsonb_build_object('role',old.role,'status',old.status,'access_starts_at',old.access_starts_at,'access_ends_at',old.access_ends_at);
    after_value := jsonb_build_object('role',new.role,'status',new.status,'access_starts_at',new.access_starts_at,'access_ends_at',new.access_ends_at);
    target_id := new.user_id;
  end if;
  if before_value is not distinct from after_value then return new; end if;
  actor_id := auth.uid();
  -- Only the trusted service-role client may supply an actor header.
  if auth.role() = 'service_role' then
    headers := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
    if coalesce(headers->>'x-eig-actor-id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      actor_id := (headers->>'x-eig-actor-id')::uuid;
    end if;
  end if;
  insert into public.platform_account_audit(target_user_id, actor_user_id, action, before_state, after_state)
  values(target_id,actor_id,case tg_table_name when 'profiles' then 'account_status_changed' when 'users' then 'sign_in_lock_changed' else tg_table_name || '_changed' end,before_value,after_value);
  return new;
end $function$;
REVOKE ALL ON FUNCTION "eig_private"."capture_account_change"() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION private.enforce_golf_event_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_master_event_id uuid;
  v_max_golfers integer;
  v_current_occupied integer;
  v_new_occupies boolean;
begin
  v_new_occupies :=
    coalesce(new.registration_status, 'active') = 'active'
    and coalesce(new.spot_hold_status, 'active') not in ('released', 'expired');

  if not v_new_occupies then
    return new;
  end if;

  select gre.master_event_id
    into v_master_event_id
  from public.golf_registration_events gre
  where gre.id = new.event_id;

  if v_master_event_id is null then
    return new;
  end if;

  select e.max_golfers
    into v_max_golfers
  from public.events e
  where e.id = v_master_event_id
  for update;

  if v_max_golfers is null or v_max_golfers <= 0 then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select count(*)
      into v_current_occupied
    from public.golf_registrations gr
    where gr.event_id = new.event_id
      and gr.id <> new.id
      and coalesce(gr.registration_status, 'active') = 'active'
      and coalesce(gr.spot_hold_status, 'active') not in ('released', 'expired');
  else
    select count(*)
      into v_current_occupied
    from public.golf_registrations gr
    where gr.event_id = new.event_id
      and coalesce(gr.registration_status, 'active') = 'active'
      and coalesce(gr.spot_hold_status, 'active') not in ('released', 'expired');
  end if;

  if v_current_occupied >= v_max_golfers then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Event capacity reached. Maximum participants: %s.',
        v_max_golfers
      );
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION "private"."enforce_golf_event_capacity"() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.eie_reconcile_payment_coverage_registration_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Coverage updates themselves must not recursively trigger reconciliation.
  IF pg_trigger_depth()>1 OR current_user NOT IN ('service_role','postgres') THEN
    RETURN NULL;
  END IF;
  IF TG_OP='DELETE' THEN
    PERFORM public.eie_sync_captain_all_payment_coverage(OLD.event_id,OLD.team_id);
    IF OLD.payment_for_team_id IS NOT NULL AND OLD.payment_for_team_id<>OLD.team_id THEN
      PERFORM public.eie_sync_captain_all_payment_coverage(OLD.event_id,OLD.payment_for_team_id);
    END IF;
    RETURN NULL;
  END IF;
  IF TG_OP='UPDATE' AND (
    OLD.event_id IS DISTINCT FROM NEW.event_id
    OR OLD.team_id IS DISTINCT FROM NEW.team_id
    OR OLD.payment_for_team_id IS DISTINCT FROM NEW.payment_for_team_id
  ) THEN
    PERFORM public.eie_sync_captain_all_payment_coverage(OLD.event_id,OLD.team_id);
    IF OLD.payment_for_team_id IS NOT NULL AND OLD.payment_for_team_id<>OLD.team_id THEN
      PERFORM public.eie_sync_captain_all_payment_coverage(OLD.event_id,OLD.payment_for_team_id);
    END IF;
  END IF;
  PERFORM public.eie_sync_captain_all_payment_coverage(NEW.event_id,NEW.team_id);
  IF NEW.payment_for_team_id IS NOT NULL AND NEW.payment_for_team_id<>NEW.team_id THEN
    PERFORM public.eie_sync_captain_all_payment_coverage(NEW.event_id,NEW.payment_for_team_id);
  END IF;
  RETURN NULL;
END
$function$;
REVOKE ALL ON FUNCTION "public"."eie_reconcile_payment_coverage_registration_trigger"() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.eie_reconcile_payment_coverage_team_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF pg_trigger_depth()>1 OR current_user NOT IN ('service_role','postgres') THEN
    RETURN NULL;
  END IF;
  PERFORM public.eie_sync_captain_all_payment_coverage(NEW.event_id,NEW.team_id);
  RETURN NULL;
END
$function$;
REVOKE ALL ON FUNCTION "public"."eie_reconcile_payment_coverage_team_trigger"() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.eie_sync_captain_all_payment_coverage(p_event_id uuid, p_team_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_team_id uuid;
  v_mode text;
  v_source_count integer;
  v_payer_id uuid;
  v_fee numeric;
  v_paid numeric;
  v_status text;
  v_refunded timestamptz;
  v_covered_status text;
  v_updated integer := 0;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN
    RAISE EXCEPTION 'Service authorization is required';
  END IF;
  IF p_event_id IS NULL OR p_team_key IS NULL THEN RETURN 0; END IF;

  SELECT id, payment_mode INTO v_team_id, v_mode
  FROM public.golf_registration_teams
  WHERE event_id=p_event_id AND team_id=p_team_key;
  IF NOT FOUND OR v_mode <> 'captain_all' THEN RETURN 0; END IF;

  -- Do not touch teams already using payment allocation shares.
  IF EXISTS (
    SELECT 1 FROM public.golf_team_payment_shares s
    WHERE s.team_id=v_team_id AND (s.amount_due>0 OR s.amount_paid>0 OR s.status IN ('paid','waived','refunded'))
  ) THEN RETURN 0; END IF;

  -- A fee payer may leave the playing team but still fund the old team.
  SELECT count(*) INTO v_source_count
  FROM public.golf_registrations r
  WHERE r.event_id=p_event_id
    AND coalesce(r.payment_for_team_id,r.team_id)=p_team_key
    AND r.registration_status='active' AND r.price>0;
  
IF v_source_count <> 1 THEN
    -- A golfer arriving at an unpaid team cannot carry old team coverage.
    -- Clear only inherited coverage links, never a real person's payment.
    UPDATE public.golf_registrations r
    SET payment_status='pending',payment_covered_by_registration_id=NULL
    WHERE r.event_id=p_event_id AND r.team_id=p_team_key
      AND r.registration_status='active'
      AND coalesce(r.price,0)=0 AND coalesce(r.amount_paid,0)=0
      AND r.stripe_payment_intent_id IS NULL
      AND r.stripe_checkout_session_id IS NULL
      AND r.refunded_at IS NULL
      AND r.payment_covered_by_registration_id IS NOT NULL;
    RETURN 0;
  END IF;

  SELECT r.id,r.price,r.amount_paid,r.payment_status,r.refunded_at
  INTO v_payer_id,v_fee,v_paid,v_status,v_refunded
  FROM public.golf_registrations r
  WHERE r.event_id=p_event_id
    AND coalesce(r.payment_for_team_id,r.team_id)=p_team_key
    AND r.registration_status='active' AND r.price>0;

  v_covered_status := CASE
    WHEN v_refunded IS NOT NULL THEN NULL
    WHEN v_status='comp' THEN 'comp'
    WHEN v_status='paid' AND coalesce(v_paid,0)>=v_fee THEN 'paid'
    ELSE NULL
  END;

  IF v_covered_status IS NULL THEN
    -- Only undo coverage *this routine* attached, never an independent payment.
    UPDATE public.golf_registrations r
    SET payment_status='pending',payment_covered_by_registration_id=NULL
    WHERE r.event_id=p_event_id AND r.team_id=p_team_key
      AND r.registration_status='active' AND r.id<>v_payer_id
      AND r.price=0 AND coalesce(r.amount_paid,0)=0
      AND r.stripe_payment_intent_id IS NULL
      AND r.stripe_checkout_session_id IS NULL
      AND r.refunded_at IS NULL
      AND r.payment_covered_by_registration_id IS NOT NULL;
  ELSE
    -- Includes TBA positions; only names change when a teammate claims one.
    UPDATE public.golf_registrations r
    SET payment_status=v_covered_status,
        payment_covered_by_registration_id=v_payer_id
    WHERE r.event_id=p_event_id AND r.team_id=p_team_key
      AND r.registration_status='active' AND r.id<>v_payer_id
      AND r.price=0 AND coalesce(r.amount_paid,0)=0
      AND r.stripe_payment_intent_id IS NULL
      AND r.stripe_checkout_session_id IS NULL
      AND r.refunded_at IS NULL
      AND (
        r.payment_covered_by_registration_id IS NOT NULL
        OR (
          r.payment_reference IS NULL OR r.payment_reference='team_member'
        ) AND r.payment_status IN ('pending','paid','comp')
      )
      AND (
        r.payment_status IS DISTINCT FROM v_covered_status
        OR r.payment_covered_by_registration_id IS DISTINCT FROM v_payer_id
      );
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END
$function$;
REVOKE ALL ON FUNCTION "public"."eie_sync_captain_all_payment_coverage"(uuid, text) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.keep_structured_event_divisions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  structured_divisions jsonb;
begin
  select jsonb_agg(item->>'name' order by ordinality)
  into structured_divisions
  from public.golf_event_setup s,
       jsonb_array_elements(s.division_details) with ordinality as d(item, ordinality)
  where s.event_key = new.event_key
    and coalesce(item->>'name','') <> '';

  if structured_divisions is not null then
    new.divisions := structured_divisions;
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION "public"."keep_structured_event_divisions"() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.protect_profile_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.role is distinct from old.role
     and current_user <> 'postgres'
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Role changes require administrative access.';
  end if;
  return new;
end;
$function$;
REVOKE ALL ON FUNCTION "public"."protect_profile_role"() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER platform_assignment_history AFTER UPDATE OF role, status, access_starts_at, access_ends_at ON event_assignments FOR EACH ROW EXECUTE FUNCTION eig_private.capture_account_change();
CREATE TRIGGER keep_structured_event_divisions_before_write BEFORE INSERT OR UPDATE ON golf_registration_events FOR EACH ROW EXECUTE FUNCTION keep_structured_event_divisions();
CREATE TRIGGER trg_eie_team_payment_coverage_team AFTER UPDATE OF captain_registration_id, payment_mode ON golf_registration_teams FOR EACH ROW EXECUTE FUNCTION eie_reconcile_payment_coverage_team_trigger();
CREATE TRIGGER trg_eie_team_payment_coverage_registration AFTER INSERT OR DELETE OR UPDATE OF event_id, team_id, registration_status, price, payment_status, amount_paid, refunded_at, payment_reference, payment_covered_by_registration_id, payment_for_team_id ON golf_registrations FOR EACH ROW EXECUTE FUNCTION eie_reconcile_payment_coverage_registration_trigger();
CREATE TRIGGER trg_enforce_golf_event_capacity BEFORE INSERT OR UPDATE OF event_id, registration_status, spot_hold_status ON golf_registrations FOR EACH ROW EXECUTE FUNCTION private.enforce_golf_event_capacity();
CREATE TRIGGER platform_membership_history AFTER UPDATE OF role, status, access_starts_at, access_ends_at ON organization_memberships FOR EACH ROW EXECUTE FUNCTION eig_private.capture_account_change();
CREATE TRIGGER platform_profile_history AFTER UPDATE OF account_status ON profiles FOR EACH ROW EXECUTE FUNCTION eig_private.capture_account_change();
CREATE TRIGGER protect_profile_role_trigger BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

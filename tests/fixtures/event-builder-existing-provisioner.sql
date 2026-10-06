CREATE OR REPLACE FUNCTION public.create_eie_quick_registration_event(p_organization_id uuid, p_name text, p_course text, p_event_start date, p_event_end date DEFAULT NULL::date, p_registration_format text DEFAULT 'team'::text, p_team_size integer DEFAULT 4, p_max_golfers integer DEFAULT NULL::integer, p_registration_deadline date DEFAULT NULL::date, p_items jsonb DEFAULT '[]'::jsonb, p_allow_online boolean DEFAULT true, p_allow_clubhouse boolean DEFAULT true, p_allow_split_team_payments boolean DEFAULT true, p_convenience_fee_type text DEFAULT 'percent'::text, p_convenience_fee_value numeric DEFAULT 3, p_clubhouse_hold_days integer DEFAULT 3, p_allow_card_guarantee boolean DEFAULT true, p_auto_charge_at_deadline boolean DEFAULT true, p_google_calendar_sync_enabled boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org record;
  v_master_event_id uuid;
  v_golf_event_id uuid;
  v_product_id uuid;
  v_slug_base text;
  v_slug text;
  v_event_key text;
  v_suffix integer := 1;
  v_dates jsonb;
  v_settings jsonb;
  v_primary_price numeric := 0;
  v_item jsonb;
  v_item_count integer := 0;
  v_registration_count integer := 0;
  v_sort integer := 0;
  v_offer_type text;
  v_charge_by text;
  v_item_name text;
  v_item_price numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not (
    public.is_eig_admin()
    or public.has_organization_role(
      p_organization_id,
      array['organization_admin'::text,'organization_staff'::text]
    )
  ) then
    raise exception 'Pilot or authorized ATC access is required.';
  end if;

  select o.id, o.name, o.slug, o.status
  into v_org
  from public.organizations o
  where o.id = p_organization_id;

  if v_org.id is null or v_org.status <> 'active' then
    raise exception 'Active Hangar not found.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Event name is required.';
  end if;

  if p_event_start is null then
    raise exception 'Event date is required.';
  end if;

  if p_event_end is not null and p_event_end < p_event_start then
    raise exception 'End date cannot be before the event date.';
  end if;

  if p_registration_format not in ('individual','team') then
    raise exception 'Registration format must be individual or team.';
  end if;

  if p_registration_format = 'team' and (p_team_size < 2 or p_team_size > 12) then
    raise exception 'Team size must be between 2 and 12.';
  end if;

  if p_registration_format = 'individual' then
    p_team_size := 1;
    p_allow_split_team_payments := false;
  end if;

  if p_convenience_fee_type not in ('none','percent','flat') then
    raise exception 'Unsupported convenience fee type.';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Pricing items must be an array.';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_item_name := nullif(trim(coalesce(v_item->>'name','')), '');
    v_offer_type := coalesce(nullif(v_item->>'item_type',''), 'other');
    v_charge_by := coalesce(nullif(v_item->>'charge_by',''), 'player');
    v_item_price := coalesce(nullif(v_item->>'price','')::numeric, 0);

    if v_item_name is null then
      raise exception 'Every pricing item needs a name.';
    end if;
    if v_offer_type not in ('registration','add_on','package','sponsorship','donation','other') then
      raise exception 'Unsupported pricing item type: %', v_offer_type;
    end if;
    if v_charge_by not in ('player','team','order','flat') then
      raise exception 'Unsupported charge method: %', v_charge_by;
    end if;
    if v_item_price < 0 then
      raise exception 'Pricing item amounts cannot be negative.';
    end if;

    v_item_count := v_item_count + 1;
    if v_offer_type = 'registration' then
      v_registration_count := v_registration_count + 1;
      if v_registration_count = 1 then
        v_primary_price := v_item_price;
      end if;
    end if;
  end loop;

  if v_item_count = 0 then
    raise exception 'Add at least one pricing item.';
  end if;

  if v_registration_count = 0 then
    raise exception 'Add at least one Registration pricing item.';
  end if;

  v_slug_base := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug_base := trim(both '-' from v_slug_base);
  if v_slug_base = '' then
    v_slug_base := 'event-' || to_char(p_event_start, 'YYYYMMDD');
  end if;

  v_slug := v_slug_base;
  while exists (
    select 1 from public.golf_registration_events e where e.public_slug = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_slug_base || '-' || v_suffix::text;
  end loop;

  v_event_key := coalesce(nullif(v_org.slug,''), 'hangar') || '-' || v_slug;

  v_dates := case
    when p_event_end is not null and p_event_end <> p_event_start
      then jsonb_build_array(p_event_start::text, p_event_end::text)
    else jsonb_build_array(p_event_start::text)
  end;

  v_settings := jsonb_build_object(
    'setup_path', 'quick_registration',
    'registration_format', p_registration_format,
    'team_size', p_team_size,
    'allow_team_name', false,
    'allow_partial_team', true,
    'allow_split_team_payments', coalesce(p_allow_split_team_payments,false),
    'registration_deadline', case when p_registration_deadline is null then null else p_registration_deadline::text end,
    'participant_fields_status', 'defaults_created',
    'hub_setup_status', 'needs_setup',
    'dob', 'optional',
    'gender', 'optional',
    'division', 'optional',
    'membership', 'optional',
    'ghin', 'optional'
  );

  insert into public.events (
    organization_id, name, date, location, golfers, event_type, event_date,
    golfer_count, status, slug, registration_deadline, max_golfers,
    registration_status, is_published
  ) values (
    p_organization_id, trim(p_name), p_event_start,
    nullif(trim(coalesce(p_course,'')), ''), 0, 'Golf Outing', p_event_start,
    0, 'draft', v_slug,
    case when p_registration_deadline is null then null else p_registration_deadline::timestamptz end,
    p_max_golfers, 'draft', false
  )
  returning id into v_master_event_id;

  insert into public.golf_registration_events (
    organization_id, event_key, name, course, event_dates,
    member_price, non_member_price, divisions, field_settings, status,
    public_slug, master_event_id, google_calendar_sync_enabled,
    google_calendar_sync_status
  ) values (
    p_organization_id, v_event_key, trim(p_name),
    nullif(trim(coalesce(p_course,'')), ''), v_dates,
    v_primary_price, v_primary_price, '[]'::jsonb, v_settings, 'draft',
    v_slug, v_master_event_id, coalesce(p_google_calendar_sync_enabled,true),
    case when coalesce(p_google_calendar_sync_enabled,true) then 'pending' else 'not_synced' end
  )
  returning id into v_golf_event_id;

  insert into public.golf_event_payment_settings (
    organization_id, event_id, allow_online, allow_clubhouse, price_mode,
    team_payment_mode, allow_split_team_payments, convenience_fee_type,
    convenience_fee_value, clubhouse_hold_mode, clubhouse_hold_days,
    allow_card_guarantee, auto_charge_at_deadline,
    failed_charge_grace_hours, reminders_enabled
  ) values (
    p_organization_id, v_golf_event_id,
    coalesce(p_allow_online,true), coalesce(p_allow_clubhouse,true),
    'per_player', 'captain_all', coalesce(p_allow_split_team_payments,false),
    p_convenience_fee_type, coalesce(p_convenience_fee_value,0),
    'days', greatest(1, least(365, coalesce(p_clubhouse_hold_days,3))),
    coalesce(p_allow_card_guarantee,true),
    coalesce(p_auto_charge_at_deadline,true),
    24, true
  );

  v_sort := 0;
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_item_name := trim(v_item->>'name');
    v_offer_type := coalesce(nullif(v_item->>'item_type',''), 'other');
    v_charge_by := coalesce(nullif(v_item->>'charge_by',''), 'player');
    v_item_price := coalesce(nullif(v_item->>'price','')::numeric, 0);

    insert into public.event_offers (
      organization_id, master_event_id, golf_event_id,
      source_app, source_module, offer_type, name, description,
      price, charge_by, is_required, is_default,
      availability_start, availability_end, coupon_eligible,
      visibility, status, sort_order, created_by, metadata
    ) values (
      p_organization_id, v_master_event_id, v_golf_event_id,
      'eie', 'quick_registration', v_offer_type, v_item_name,
      nullif(trim(coalesce(v_item->>'description','')), ''),
      v_item_price, v_charge_by,
      coalesce((v_item->>'required')::boolean, false),
      (v_offer_type = 'registration' and v_sort = 0),
      nullif(v_item->>'available_start','')::date,
      nullif(v_item->>'available_end','')::date,
      true, 'public', 'active', v_sort, auth.uid(),
      jsonb_build_object('created_from','quick_registration')
    );
    v_sort := v_sort + 1;
  end loop;

  insert into public.event_registration_fields
    (event_id, field_key, label, field_type, applies_to, requirement_status, is_system_field, include_in_internal_export, include_in_golf_genius_export, sort_order, status)
  values
    (v_master_event_id, 'first_name', 'First Name', 'short_text', 'golfer', 'required', true, true, true, 10, 'active'),
    (v_master_event_id, 'last_name', 'Last Name', 'short_text', 'golfer', 'required', true, true, true, 20, 'active'),
    (v_master_event_id, 'email', 'Email', 'email', 'golfer', 'required', true, true, false, 30, 'active'),
    (v_master_event_id, 'phone', 'Phone', 'phone', 'golfer', 'required', true, true, false, 40, 'active');

  select id into v_product_id
  from public.products
  where product_key = 'golf_event_registration'
  limit 1;

  if v_product_id is not null then
    insert into public.event_product_entitlements (
      event_id, product_id, status, enabled_by, settings
    ) values (
      v_golf_event_id, v_product_id, 'active', auth.uid(),
      jsonb_build_object('source','eie_quick_registration')
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'master_event_id', v_master_event_id,
    'golf_event_id', v_golf_event_id,
    'event_key', v_event_key,
    'public_slug', v_slug,
    'organization_id', p_organization_id,
    'next_step', 'hub_setup'
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.create_eie_quick_registration_event(p_organization_id uuid, p_name text, p_course text, p_event_start date, p_event_end date, p_registration_format text, p_team_size integer, p_max_golfers integer, p_registration_deadline date, p_items jsonb, p_allow_online boolean, p_allow_clubhouse boolean, p_allow_split_team_payments boolean, p_convenience_fee_type text, p_convenience_fee_value numeric, p_clubhouse_hold_days integer, p_allow_card_guarantee boolean, p_auto_charge_at_deadline boolean, p_google_calendar_sync_enabled boolean, p_event_start_time time without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
  v_master_event_id uuid;
  v_golf_event_id uuid;
begin
  v_result := public.create_eie_quick_registration_event(
    p_organization_id,
    p_name,
    p_course,
    p_event_start,
    p_event_end,
    p_registration_format,
    p_team_size,
    p_max_golfers,
    p_registration_deadline,
    p_items,
    p_allow_online,
    p_allow_clubhouse,
    p_allow_split_team_payments,
    p_convenience_fee_type,
    p_convenience_fee_value,
    p_clubhouse_hold_days,
    p_allow_card_guarantee,
    p_auto_charge_at_deadline,
    p_google_calendar_sync_enabled
  );

  if coalesce((v_result->>'success')::boolean, false) then
    v_master_event_id := nullif(v_result->>'master_event_id','')::uuid;
    v_golf_event_id := nullif(v_result->>'golf_event_id','')::uuid;

    if v_master_event_id is not null then
      update public.events
      set start_time = p_event_start_time
      where id = v_master_event_id;
    end if;

    if v_golf_event_id is not null then
      update public.golf_registration_events
      set field_settings = coalesce(field_settings, '{}'::jsonb)
        || jsonb_build_object(
          'event_start_time',
          case when p_event_start_time is null then null else to_char(p_event_start_time, 'HH24:MI') end
        )
      where id = v_golf_event_id;
    end if;
  end if;

  return v_result;
end;
$function$
;
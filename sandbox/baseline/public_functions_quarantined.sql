-- SANDBOX ONLY. Application function definitions are installed but not directly executable by clients.
-- Runtime integrations, RLS, RPC grants and external functions remain gated.
SET check_function_bodies = off;
CREATE OR REPLACE FUNCTION public.attach_inception_project(p_project_id uuid, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select eig_private.attach_inception(p_project_id,p_expected_version)$function$;
CREATE OR REPLACE FUNCTION public.create_eie_golf_event(p_organization_id uuid, p_name text, p_course text, p_event_start date, p_event_end date DEFAULT NULL::date, p_public_slug text DEFAULT NULL::text, p_registration_format text DEFAULT 'individual'::text, p_team_size integer DEFAULT 1, p_member_price numeric DEFAULT 0, p_non_member_price numeric DEFAULT 0, p_max_golfers integer DEFAULT NULL::integer, p_registration_deadline date DEFAULT NULL::date, p_contact_name text DEFAULT NULL::text, p_contact_email text DEFAULT NULL::text, p_contact_phone text DEFAULT NULL::text, p_team_payment_mode text DEFAULT 'captain_all'::text, p_allow_online boolean DEFAULT true, p_allow_clubhouse boolean DEFAULT true, p_convenience_fee_type text DEFAULT 'percent'::text, p_convenience_fee_value numeric DEFAULT 3, p_clubhouse_hold_days integer DEFAULT 3, p_allow_card_guarantee boolean DEFAULT true, p_auto_charge_at_deadline boolean DEFAULT true, p_google_calendar_sync_enabled boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org record;
  v_master_event_id uuid;
  v_golf_event_id uuid;
  v_event_key text;
  v_slug text;
  v_slug_base text;
  v_suffix integer := 1;
  v_dates jsonb;
  v_settings jsonb;
  v_product_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not (
    is_eig_admin()
    or has_organization_role(
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

  if p_registration_format not in ('individual','team') then
    raise exception 'Registration format must be individual or team.';
  end if;

  if p_registration_format = 'team' and (p_team_size < 2 or p_team_size > 12) then
    raise exception 'Team size must be between 2 and 12.';
  end if;

  if p_registration_format = 'individual' then
    p_team_size := 1;
    p_team_payment_mode := 'captain_all';
  end if;

  if p_team_payment_mode not in ('captain_all','split') then
    raise exception 'Unsupported team payment mode.';
  end if;

  if p_convenience_fee_type not in ('none','percent','flat') then
    raise exception 'Unsupported convenience fee type.';
  end if;

  if coalesce(p_member_price,0) < 0 or coalesce(p_non_member_price,0) < 0 then
    raise exception 'Registration prices cannot be negative.';
  end if;

  v_slug_base := lower(regexp_replace(
    coalesce(nullif(trim(p_public_slug), ''), trim(p_name)),
    '[^a-zA-Z0-9]+',
    '-',
    'g'
  ));
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

  v_settings := jsonb_strip_nulls(jsonb_build_object(
    'registration_format', p_registration_format,
    'team_size', p_team_size,
    'allow_team_name', false,
    'allow_partial_team', true,
    'team_payment_mode', p_team_payment_mode,
    'registration_deadline', case when p_registration_deadline is null then null else p_registration_deadline::text end,
    'registration_contact_name', nullif(trim(coalesce(p_contact_name,'')), ''),
    'registration_contact_email', nullif(lower(trim(coalesce(p_contact_email,''))), ''),
    'registration_contact_phone', nullif(trim(coalesce(p_contact_phone,'')), ''),
    'dob', 'optional',
    'gender', 'optional',
    'division', 'optional',
    'membership', 'optional',
    'ghin', 'optional'
  ));

  insert into public.events (
    organization_id,
    name,
    date,
    location,
    golfers,
    event_type,
    event_date,
    golfer_count,
    status,
    slug,
    start_time,
    registration_deadline,
    max_golfers,
    registration_status,
    is_published,
    organizer_name,
    organizer_email,
    organizer_phone
  ) values (
    p_organization_id,
    trim(p_name),
    p_event_start,
    nullif(trim(coalesce(p_course,'')), ''),
    0,
    'Golf Outing',
    p_event_start,
    0,
    'draft',
    v_slug,
    null,
    case when p_registration_deadline is null then null else p_registration_deadline::timestamptz end,
    p_max_golfers,
    'draft',
    false,
    nullif(trim(coalesce(p_contact_name,'')), ''),
    nullif(lower(trim(coalesce(p_contact_email,''))), ''),
    nullif(trim(coalesce(p_contact_phone,'')), '')
  )
  returning id into v_master_event_id;

  insert into public.golf_registration_events (
    organization_id,
    event_key,
    name,
    course,
    event_dates,
    member_price,
    non_member_price,
    divisions,
    field_settings,
    status,
    public_slug,
    master_event_id,
    google_calendar_sync_enabled,
    google_calendar_sync_status
  ) values (
    p_organization_id,
    v_event_key,
    trim(p_name),
    nullif(trim(coalesce(p_course,'')), ''),
    v_dates,
    coalesce(p_member_price,0),
    coalesce(p_non_member_price,0),
    '[]'::jsonb,
    v_settings,
    'draft',
    v_slug,
    v_master_event_id,
    coalesce(p_google_calendar_sync_enabled,true),
    case when coalesce(p_google_calendar_sync_enabled,true) then 'pending' else 'not_synced' end
  )
  returning id into v_golf_event_id;

  insert into public.golf_event_payment_settings (
    organization_id,
    event_id,
    allow_online,
    allow_clubhouse,
    price_mode,
    team_payment_mode,
    convenience_fee_type,
    convenience_fee_value,
    clubhouse_hold_mode,
    clubhouse_hold_days,
    allow_card_guarantee,
    auto_charge_at_deadline,
    failed_charge_grace_hours,
    reminders_enabled
  ) values (
    p_organization_id,
    v_golf_event_id,
    coalesce(p_allow_online,true),
    coalesce(p_allow_clubhouse,true),
    case when p_registration_format='team' then 'per_player' else 'per_player' end,
    p_team_payment_mode,
    p_convenience_fee_type,
    coalesce(p_convenience_fee_value,0),
    'days',
    greatest(1, least(365, coalesce(p_clubhouse_hold_days,3))),
    coalesce(p_allow_card_guarantee,true),
    coalesce(p_auto_charge_at_deadline,true),
    24,
    true
  );

  select id into v_product_id
  from public.products
  where product_key = 'golf_event_registration'
  limit 1;

  if v_product_id is not null then
    insert into public.event_product_entitlements (
      event_id,
      product_id,
      status,
      enabled_by,
      settings
    )
    values (
      v_golf_event_id,
      v_product_id,
      'active',
      auth.uid(),
      jsonb_build_object('source','eie_new_event')
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'master_event_id', v_master_event_id,
    'golf_event_id', v_golf_event_id,
    'event_key', v_event_key,
    'public_slug', v_slug,
    'organization_id', p_organization_id
  );
end;
$function$;
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
$function$;
CREATE OR REPLACE FUNCTION public.create_organization_workspace(p_name text, p_organization_type text DEFAULT 'business'::text, p_is_test boolean DEFAULT false)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org public.organizations;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_eig_admin() then
    raise exception 'Only EIG admins can create organizations';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Organization name is required';
  end if;

  v_base_slug := lower(trim(p_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '(^-+|-+$)', '', 'g');

  if v_base_slug = '' then
    v_base_slug := 'organization';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.organizations (
    name,
    slug,
    organization_type,
    status,
    is_test
  )
  values (
    trim(p_name),
    v_slug,
    coalesce(nullif(trim(p_organization_type), ''), 'business'),
    'active',
    coalesce(p_is_test, false)
  )
  returning * into v_org;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status,
    invited_by
  )
  values (
    v_org.id,
    auth.uid(),
    'organization_admin',
    'active',
    auth.uid()
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = excluded.status,
        updated_at = now();

  return v_org;
end;
$function$;
CREATE OR REPLACE FUNCTION public.create_organization_workspace(p_name text, p_organization_type text DEFAULT 'business'::text, p_is_test boolean DEFAULT false, p_primary_contact_name text DEFAULT NULL::text, p_primary_contact_email text DEFAULT NULL::text)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org public.organizations;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_eig_admin() then
    raise exception 'Only EIG admins can create organizations';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Organization name is required';
  end if;

  if nullif(trim(coalesce(p_primary_contact_email, '')), '') is null then
    raise exception 'Primary contact email is required';
  end if;

  v_base_slug := lower(trim(p_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '(^-+|-+$)', '', 'g');
  if v_base_slug = '' then v_base_slug := 'organization'; end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.organizations (name, slug, organization_type, status, is_test, onboarding_status)
  values (
    trim(p_name),
    v_slug,
    coalesce(nullif(trim(p_organization_type), ''), 'business'),
    'active',
    coalesce(p_is_test, false),
    'invited'
  )
  returning * into v_org;

  insert into public.organization_profiles (organization_id, primary_contact_name, primary_contact_email)
  values (
    v_org.id,
    nullif(trim(coalesce(p_primary_contact_name, '')), ''),
    lower(trim(p_primary_contact_email))
  );

  insert into public.organization_memberships (organization_id, user_id, role, status, invited_by)
  values (v_org.id, auth.uid(), 'eig_admin', 'active', auth.uid())
  on conflict (organization_id, user_id) do update
    set role = 'eig_admin', status = 'active', updated_at = now();

  return v_org;
end;
$function$;
CREATE OR REPLACE FUNCTION public.create_squawk_draft(p_organization_id uuid, p_event_id uuid, p_context_label text, p_message_kind text, p_visibility text, p_required_roles text[], p_safe_label text, p_requires_review boolean, p_subject text, p_body text, p_email_body text, p_sms_body text, p_audience_key text, p_channels text[], p_template_id uuid, p_recipients jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_thread_id uuid;
  v_message_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_organization_id is null or nullif(trim(p_context_label),'') is null then
    raise exception 'Organization and context are required';
  end if;
  if nullif(trim(p_body),'') is null then
    raise exception 'Message body is required';
  end if;
  if p_channels is null or cardinality(p_channels)=0 or not (p_channels <@ array['in_app','email','sms']::text[]) then
    raise exception 'At least one valid channel is required';
  end if;
  if jsonb_typeof(coalesce(p_recipients,'[]'::jsonb)) <> 'array' then
    raise exception 'Recipients must be an array';
  end if;

  select st.id into v_thread_id
  from public.squawk_threads st
  where st.organization_id=p_organization_id
    and st.event_id is not distinct from p_event_id
    and st.context_type=(case when p_event_id is null then 'cockpit' else 'event' end)
    and st.status='open'
  order by st.created_at
  limit 1;

  if v_thread_id is null then
    insert into public.squawk_threads(organization_id,event_id,context_type,context_label,created_by,status)
    values(p_organization_id,p_event_id,case when p_event_id is null then 'cockpit' else 'event' end,p_context_label,(select auth.uid()),'open')
    returning id into v_thread_id;
  end if;

  insert into public.squawk_messages(
    thread_id,created_by,message_kind,visibility,required_roles,safe_label,requires_review,status,
    audience_key,channels,template_id,metadata
  )
  values(
    v_thread_id,(select auth.uid()),p_message_kind,p_visibility,coalesce(p_required_roles,'{}'::text[]),
    coalesce(nullif(trim(p_safe_label),''),'Squawk Box message'),coalesce(p_requires_review,false),'draft',
    p_audience_key,p_channels,p_template_id,
    jsonb_build_object('recipient_count',jsonb_array_length(coalesce(p_recipients,'[]'::jsonb)),'composer_version',1)
  )
  returning id into v_message_id;

  insert into public.squawk_message_content(message_id,subject,body,in_app_body,email_body,sms_body)
  values(v_message_id,nullif(trim(p_subject),''),p_body,p_body,coalesce(nullif(p_email_body,''),p_body),nullif(p_sms_body,''));

  insert into public.squawk_message_recipients(
    message_id,user_id,contact_id,registration_id,recipient_type,channel,destination_masked,delivery_status
  )
  select
    v_message_id,r.user_id,r.contact_id,r.registration_id,r.recipient_type,r.channel,r.destination_masked,'pending'
  from jsonb_to_recordset(coalesce(p_recipients,'[]'::jsonb))
    as r(user_id uuid,contact_id uuid,registration_id uuid,recipient_type text,channel text,destination_masked text);

  insert into public.squawk_audit_log(organization_id,event_id,thread_id,message_id,actor_user_id,action,details)
  values(
    p_organization_id,p_event_id,v_thread_id,v_message_id,(select auth.uid()),'draft_created',
    jsonb_build_object('channels',p_channels,'audience_key',p_audience_key)
  );

  return v_message_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.design_product_catalog_access()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('can_read',eig_private.active_builder_session(),'can_manage',eig_private.can_manage_design_catalog())
$function$;
CREATE OR REPLACE FUNCTION public.eie_staff_fully_paid_team_swap(p_event_id uuid, p_a uuid, p_b uuid, p_actor uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  a public.golf_registrations%rowtype;
  b public.golf_registrations%rowtype;
  ta public.golf_registration_teams%rowtype;
  tb public.golf_registration_teams%rowtype;
  v_stamp timestamptz := now();
BEGIN
  IF current_user<>'service_role' OR p_actor IS NULL THEN
    RAISE EXCEPTION 'Staff service authorization is required';
  END IF;
  IF coalesce(btrim(p_reason),'')='' THEN
    RAISE EXCEPTION 'A staff reason is required for moving a team-fee purchaser';
  END IF;
  PERFORM 1 FROM public.golf_registration_events e
  WHERE e.id=p_event_id AND e.field_settings->>'registration_format'='team'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team event not found'; END IF;
  SELECT * INTO a FROM public.golf_registrations
  WHERE event_id=p_event_id AND id=p_a AND registration_status='active' FOR UPDATE;
  SELECT * INTO b FROM public.golf_registrations
  WHERE event_id=p_event_id AND id=p_b AND registration_status='active' FOR UPDATE;
  IF a.id IS NULL OR b.id IS NULL OR a.id=b.id OR a.team_id=b.team_id THEN
    RAISE EXCEPTION 'Choose two active golfers on different teams';
  END IF;
  SELECT * INTO ta FROM public.golf_registration_teams
  WHERE event_id=p_event_id AND team_id=a.team_id FOR UPDATE;
  SELECT * INTO tb FROM public.golf_registration_teams
  WHERE event_id=p_event_id AND team_id=b.team_id FOR UPDATE;
  IF ta.id IS NULL OR tb.id IS NULL
    OR ta.payment_mode<>'captain_all' OR tb.payment_mode<>'captain_all' THEN
    RAISE EXCEPTION 'Both teams must use full-team payment';
  END IF;
  IF a.id=ta.captain_registration_id OR b.id=tb.captain_registration_id THEN
    RAISE EXCEPTION 'Reassign captaincy before swapping a team captain';
  END IF;
  IF a.first_name='TBA' AND b.first_name='TBA' THEN
    RAISE EXCEPTION 'Select at least one named golfer';
  END IF;
  IF (a.price>0 AND (a.payment_status<>'paid' OR a.refunded_at IS NOT NULL
      OR coalesce(a.amount_paid,0)<a.price))
      OR (b.price>0 AND (b.payment_status<>'paid' OR b.refunded_at IS NOT NULL
      OR coalesce(b.amount_paid,0)<b.price)) THEN
    RAISE EXCEPTION 'Personal payment needs a financial review';
  END IF;
  IF EXISTS (SELECT 1 FROM public.golf_team_payment_shares s
    WHERE s.event_id=p_event_id AND s.team_id IN (ta.id,tb.id)) THEN
    RAISE EXCEPTION 'Payment share allocations require separate reconciliation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.golf_registrations r
    WHERE r.id IN (a.id,b.id) AND
      (r.refunded_at IS NOT NULL
      OR (coalesce(r.price,0)=0 AND (
        coalesce(r.amount_paid,0)>0
        OR r.stripe_payment_intent_id IS NOT NULL
        OR r.stripe_checkout_session_id IS NOT NULL
        OR (r.payment_status NOT IN ('pending','paid') AND r.payment_covered_by_registration_id IS NULL)
        OR (r.payment_status='paid' AND r.payment_covered_by_registration_id IS NULL)
      )))
  ) THEN RAISE EXCEPTION 'An individual payment requires separate review'; END IF;
  -- Exactly one fully paid original team-fee receipt for EACH team.
  IF EXISTS (
    SELECT x.team_id
    FROM (VALUES (a.team_id),(b.team_id)) x(team_id)
    LEFT JOIN public.golf_registrations payer
      ON payer.event_id=p_event_id
      AND coalesce(payer.payment_for_team_id,payer.team_id)=x.team_id
      AND payer.registration_status='active' AND payer.price>0
    GROUP BY x.team_id
    HAVING count(payer.id)<>1 OR
      count(payer.id) FILTER(WHERE payer.payment_status='paid'
       AND payer.refunded_at IS NULL AND coalesce(payer.amount_paid,0)>=payer.price)<>1
  ) THEN RAISE EXCEPTION 'Both teams must have one verified full-team payment'; END IF;

  UPDATE public.golf_registrations SET
    team_id=b.team_id,entry_number=tb.entry_number,
    payment_for_team_id=CASE WHEN a.price>0
      THEN coalesce(a.payment_for_team_id,a.team_id) ELSE a.payment_for_team_id END,
    google_sheet_synced_at=NULL,admin_note=left(p_reason,1500),
    admin_updated_at=v_stamp,admin_updated_by=p_actor
  WHERE id=a.id;
  UPDATE public.golf_registrations SET
    team_id=a.team_id,entry_number=ta.entry_number,
    payment_for_team_id=CASE WHEN b.price>0
      THEN coalesce(b.payment_for_team_id,b.team_id) ELSE b.payment_for_team_id END,
    google_sheet_synced_at=NULL,admin_note=left(p_reason,1500),
    admin_updated_at=v_stamp,admin_updated_by=p_actor
  WHERE id=b.id;

  PERFORM public.eie_sync_captain_all_payment_coverage(p_event_id,ta.team_id);
  PERFORM public.eie_sync_captain_all_payment_coverage(p_event_id,tb.team_id);
  IF EXISTS (
    SELECT 1 FROM public.golf_registrations r
    WHERE r.event_id=p_event_id AND r.team_id IN (ta.team_id,tb.team_id)
      AND r.registration_status='active' AND r.payment_status<>'paid'
  ) THEN RAISE EXCEPTION 'Payment coverage verification failed, swap rolled back'; END IF;

  UPDATE public.golf_team_invitations
  SET status='superseded',updated_at=v_stamp
  WHERE registration_id IN (a.id,b.id) AND status IN ('pending','send_failed');

  INSERT INTO public.golf_registration_admin_actions
    (registration_id,organization_id,event_id,action,reason,
     previous_payment_status,new_payment_status,
     previous_registration_status,new_registration_status,acted_by,metadata)
  VALUES
    (a.id,a.organization_id,p_event_id,'team_assignment_updated',p_reason,
     a.payment_status,a.payment_status,a.registration_status,a.registration_status,p_actor,
     jsonb_build_object('old_team',ta.team_id,'new_team',tb.team_id,'purchaser_allocation_kept',true)),
    (b.id,b.organization_id,p_event_id,'team_assignment_updated',p_reason,
     b.payment_status,b.payment_status,b.registration_status,b.registration_status,p_actor,
     jsonb_build_object('old_team',tb.team_id,'new_team',ta.team_id,'purchaser_allocation_kept',true));

  RETURN jsonb_build_object('success',true,'action','swap',
    'affected_registration_ids',jsonb_build_array(a.id,b.id),
    'from_entry_number',ta.entry_number,'to_entry_number',tb.entry_number);
END $function$;
CREATE OR REPLACE FUNCTION public.eie_staff_team_roster_update(p_event_id uuid, p_action text, p_registration_id uuid, p_other_registration_id uuid DEFAULT NULL::uuid, p_fields jsonb DEFAULT '{}'::jsonb, p_actor_user_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_event public.golf_registration_events%rowtype;
 a public.golf_registrations%rowtype;
 b public.golf_registrations%rowtype;
 ta public.golf_registration_teams%rowtype;
 tb public.golf_registration_teams%rowtype;
 a_was_tba boolean;
 b_was_tba boolean;
 email_next text;
 before_a jsonb;
 before_b jsonb;
 now_at timestamptz := now();
 new_status text;
begin
 if current_user <> 'service_role' then raise exception 'Service authorization is required'; end if;
 if p_actor_user_id is null then raise exception 'Staff actor is required'; end if;
 if p_action not in ('fill_tba','edit_player','swap','move_to_tba','transfer_captain') then
   raise exception 'Unsupported team action'; end if;
 select * into v_event from public.golf_registration_events where id=p_event_id for update;
 if not found or v_event.field_settings->>'registration_format' <> 'team' then
   raise exception 'Team event not found'; end if;
 select * into a from public.golf_registrations
 where id=p_registration_id and event_id=p_event_id and registration_status='active' for update;
 if not found then raise exception 'Active golfer not found'; end if;
 select * into ta from public.golf_registration_teams
 where event_id=p_event_id and team_id=a.team_id for update;
 if not found then raise exception 'Team not found'; end if;
 a_was_tba := coalesce(a.custom_fields->>'reserved_tba','false')='true' or upper(btrim(a.first_name))='TBA';
 before_a := jsonb_build_object('registration_id',a.id,'first_name',a.first_name,'last_name',a.last_name,
  'email',a.email,'user_id',a.user_id,'entry_number',a.entry_number,'team_id',a.team_id);
 if p_action in ('swap','move_to_tba','transfer_captain') then
   if p_other_registration_id is null or p_other_registration_id=p_registration_id then
     raise exception 'Choose a different golfer'; end if;
   select * into b from public.golf_registrations
   where id=p_other_registration_id and event_id=p_event_id and registration_status='active' for update;
   if not found then raise exception 'Second active golfer not found'; end if;
   select * into tb from public.golf_registration_teams
   where event_id=p_event_id and team_id=b.team_id for update;
   if not found then raise exception 'Second team not found'; end if;
   b_was_tba := coalesce(b.custom_fields->>'reserved_tba','false')='true' or upper(btrim(b.first_name))='TBA';
   before_b := jsonb_build_object('registration_id',b.id,'first_name',b.first_name,'last_name',b.last_name,
     'email',b.email,'user_id',b.user_id,'entry_number',b.entry_number,'team_id',b.team_id);
 end if;

 if p_action in ('fill_tba','edit_player') then
   if p_action='fill_tba' and (not a_was_tba or nullif(btrim(coalesce(a.email,'')),'') is not null) then
     raise exception 'Select a reserved TBA slot'; end if;
   if p_action='edit_player' and a_was_tba then raise exception 'Use Fill TBA Spot instead'; end if;
   if p_action='fill_tba' and (nullif(btrim(p_fields->>'first_name'),'') is null
        or nullif(btrim(p_fields->>'last_name'),'') is null
        or nullif(btrim(p_fields->>'email'),'') is null) then
     raise exception 'Name and email are required to fill a spot'; end if;
   email_next := lower(btrim(coalesce(p_fields->>'email',a.email,'')));
   if email_next !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
     raise exception 'Enter a valid email address'; end if;
   if p_action='edit_player' and a.user_id is not null and
      lower(coalesce(a.email,'')) is distinct from email_next then
     raise exception 'Claimed account email must be changed through Account Management'; end if;
   if exists (select 1 from public.golf_registrations r
      where r.event_id=p_event_id and r.team_id=a.team_id and r.id<>a.id
      and r.registration_status='active' and lower(coalesce(r.email,''))=email_next) then
      raise exception 'This email is already on that team'; end if;
   update public.golf_registrations r set
      first_name=coalesce(nullif(btrim(p_fields->>'first_name'),''),a.first_name),
      last_name=coalesce(nullif(btrim(p_fields->>'last_name'),''),a.last_name),
      email=email_next,
      phone=case when p_fields ? 'phone' then nullif(btrim(p_fields->>'phone'),'') else a.phone end,
      ghin_number=case when p_fields ? 'ghin_number' then nullif(btrim(p_fields->>'ghin_number'),'') else a.ghin_number end,
      division=case when p_fields ? 'division' then nullif(btrim(p_fields->>'division'),'') else a.division end,
      custom_fields=case when p_action='fill_tba' then coalesce(a.custom_fields,'{}'::jsonb)-'reserved_tba' else a.custom_fields end,
      passenger_claim_status=case when p_action='fill_tba' then 'unclaimed' else a.passenger_claim_status end,
      payment_status=case when p_action='fill_tba' and ta.payment_mode='captain_all' and r.price=0
        and exists(select 1 from public.golf_registrations cr where cr.id=ta.captain_registration_id and cr.payment_status='paid')
        then 'paid' else r.payment_status end,
      google_sheet_synced_at=null,
      admin_note=left(coalesce(p_reason,'Roster updated by event staff'),1500),
      admin_updated_at=now_at,admin_updated_by=p_actor_user_id
   where r.id=a.id;
   if p_action='fill_tba' or lower(coalesce(a.email,'')) is distinct from email_next then
     update public.golf_team_invitations set status='superseded',updated_at=now_at
     where registration_id=a.id and status in ('pending','send_failed');
   end if;
 elsif p_action='transfer_captain' then
   if ta.id<>tb.id then raise exception 'Captain must be on the same team'; end if;
   if a.id<>ta.captain_registration_id then raise exception 'Select the current captain first'; end if;
   if b_was_tba or b.user_id is null or b.passenger_claim_status<>'claimed' then
     raise exception 'The new captain must have a claimed Passenger account'; end if;
   update public.golf_registration_teams set
     captain_registration_id=b.id,captain_user_id=b.user_id,updated_at=now_at
   where id=ta.id;
 elsif p_action in ('swap','move_to_tba') then
   if ta.id=tb.id then raise exception 'Choose golfers on different teams'; end if;
   if p_action='swap' and (a_was_tba or b_was_tba) then
     raise exception 'Use Move Into TBA for an open spot'; end if;
   if p_action='move_to_tba' and (a_was_tba or not b_was_tba) then
     raise exception 'Choose a real golfer and a destination TBA slot'; end if;
   -- Captains own their teams' payment obligations. Never silently move
   -- the full-team charge, captaincy, or associated payment records.
   if a.id=ta.captain_registration_id or b.id=tb.captain_registration_id then
     raise exception 'Captain swaps need separate captain and team-payment review'; end if;
   -- Team-paid spots may be swapped: they have status Paid/Comp only because
   -- the original team fee payer covers them. Actual payer registrations,
   -- independent transactions, refunds and checkout sessions stay protected.
   if coalesce(a.price,0)>0 or coalesce(b.price,0)>0
      or coalesce(a.amount_paid,0)>0 or coalesce(b.amount_paid,0)>0
      or (a.payment_status<>'pending' and a.payment_covered_by_registration_id is null)
      or (b.payment_status<>'pending' and b.payment_covered_by_registration_id is null)
      or (a.paid_at is not null and a.payment_covered_by_registration_id is null)
      or (b.paid_at is not null and b.payment_covered_by_registration_id is null)
      or a.refunded_at is not null or b.refunded_at is not null
      or a.stripe_checkout_session_id is not null or b.stripe_checkout_session_id is not null
      or a.stripe_payment_intent_id is not null or b.stripe_payment_intent_id is not null then
     raise exception 'Golfer has a personal payment, Comp, or checkout record requiring staff review'; end if;
   if (a.payment_covered_by_registration_id is not null and
       (a.payment_status not in ('paid','comp') or
        coalesce(a.payment_reference,'')<>'team_member' or
        not exists (select 1 from public.golf_registrations f
          where f.id=a.payment_covered_by_registration_id
            and f.event_id=p_event_id and f.team_id=a.team_id
            and f.registration_status='active' and f.price>0
            and f.payment_status=a.payment_status and f.refunded_at is null
            and (f.payment_status='comp' or coalesce(f.amount_paid,0)>=f.price))))
     or (b.payment_covered_by_registration_id is not null and
       (b.payment_status not in ('paid','comp') or
        coalesce(b.payment_reference,'')<>'team_member' or
        not exists (select 1 from public.golf_registrations f
          where f.id=b.payment_covered_by_registration_id
            and f.event_id=p_event_id and f.team_id=b.team_id
            and f.registration_status='active' and f.price>0
            and f.payment_status=b.payment_status and f.refunded_at is null
            and (f.payment_status='comp' or coalesce(f.amount_paid,0)>=f.price)))) then
     raise exception 'Team coverage is not verified for this golfer; review payment before moving'; end if;
   -- Existing share-payment allocations need a transaction-level reassignment.
   if exists(
     select 1 from public.golf_team_payment_shares s
     where s.event_id=p_event_id and s.team_id in (ta.id,tb.id)
   ) then
     raise exception 'Team share payments need reconciliation before roster changes'; end if;

   -- Team numbers stay with their teams. Move each complete registration
   -- between the teams; the record ID, account and payment history are not copied.
   update public.golf_registrations set
     team_id=tb.team_id,entry_number=tb.entry_number,
     google_sheet_synced_at=null,
     admin_note=left(coalesce(p_reason,'Staff changed golfer team'),1500),
     admin_updated_at=now_at,admin_updated_by=p_actor_user_id
   where id=a.id;
   update public.golf_registrations set
     team_id=ta.team_id,entry_number=ta.entry_number,
     google_sheet_synced_at=null,
     admin_note=left(coalesce(p_reason,'Staff changed golfer team'),1500),
     admin_updated_at=now_at,admin_updated_by=p_actor_user_id
   where id=b.id;
   -- Invite tokens for a former team cannot be reused after a move.
   -- The staff Edge Function re-invites unclaimed golfers on their new team.
   update public.golf_team_invitations set status='superseded',updated_at=now_at
     where registration_id in (a.id,b.id) and status in ('pending','send_failed');
 end if;

 if p_action in ('fill_tba','swap','move_to_tba') then
   update public.golf_registration_teams t set
     status=case when
       (select count(*) from public.golf_registrations r where r.event_id=t.event_id and r.team_id=t.team_id and r.registration_status='active')>=t.team_size
       and not exists(select 1 from public.golf_registrations r where r.event_id=t.event_id and r.team_id=t.team_id and r.registration_status='active' and (r.custom_fields->>'reserved_tba'='true' or upper(btrim(r.first_name))='TBA'))
       then 'roster_complete' else 'roster_incomplete' end,
     updated_at=now_at
   where t.id=ta.id or (p_action in ('swap','move_to_tba') and t.id=tb.id);
 end if;

 insert into public.golf_registration_admin_actions(registration_id,organization_id,event_id,action,reason,
     previous_payment_status,new_payment_status,previous_registration_status,new_registration_status,acted_by,metadata)
 values(a.id,a.organization_id,p_event_id,'team_assignment_updated',p_reason,
     a.payment_status,a.payment_status,a.registration_status,a.registration_status,p_actor_user_id,
     jsonb_build_object('before',before_a,'other_before',before_b,'fee_records_unchanged',true));
 if p_action in ('swap','move_to_tba') then
   insert into public.golf_registration_admin_actions(registration_id,organization_id,event_id,action,reason,
       previous_payment_status,new_payment_status,previous_registration_status,new_registration_status,acted_by,metadata)
   values(b.id,b.organization_id,p_event_id,'team_assignment_updated',p_reason,
       b.payment_status,b.payment_status,b.registration_status,b.registration_status,p_actor_user_id,
       jsonb_build_object('before',before_b,'other_before',before_a,'fee_records_unchanged',true));
 end if;
 return jsonb_build_object('success',true,'action',p_action,'from_entry_number',ta.entry_number,
   'to_entry_number',case when p_action in ('swap','move_to_tba') then tb.entry_number else null end,
   'affected_registration_ids',case when p_action in ('swap','move_to_tba') then jsonb_build_array(a.id,b.id) else jsonb_build_array(a.id) end);
end
$function$;
CREATE OR REPLACE FUNCTION public.golf_claim_manual_captain_invitation(p_invitation_id uuid, p_user_id uuid, p_passenger_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 inv public.golf_team_invitations%rowtype;
 reg public.golf_registrations%rowtype;
 tm public.golf_registration_teams%rowtype;
 claimed_at timestamptz := now();
begin
 if current_user <> 'service_role' then raise exception 'Service authorization required'; end if;
 if p_invitation_id is null or p_user_id is null or p_passenger_id is null then
   raise exception 'Missing claimed captain identity'; end if;
 select * into inv from public.golf_team_invitations where id=p_invitation_id for update;
 if not found then raise exception 'Invitation not found'; end if;
 if inv.status not in ('pending','send_failed') or inv.expires_at <= claimed_at then
   raise exception 'Invitation is no longer active'; end if;
 select * into reg from public.golf_registrations where id=inv.registration_id for update;
 if not found or reg.registration_status <> 'active' then
   raise exception 'Active captain registration not found'; end if;
 select * into tm from public.golf_registration_teams where id=inv.team_id for update;
 if not found or tm.event_id <> inv.event_id or tm.team_id <> reg.team_id or
    tm.captain_registration_id <> reg.id or inv.slot_number <> 1 or reg.event_id <> inv.event_id then
   raise exception 'Invitation does not match the team captain'; end if;
 if lower(btrim(coalesce(reg.email,''))) <> lower(btrim(inv.email)) then
   raise exception 'The team captain email no longer matches this invitation'; end if;
 if reg.user_id is not null and reg.user_id <> p_user_id then
   raise exception 'Captain registration already claimed by another account'; end if;
 if tm.captain_user_id is not null and tm.captain_user_id <> p_user_id then
   raise exception 'Captain permissions already belong to another account'; end if;
 if exists (select 1 from public.passengers p where p.id=p_passenger_id and p.auth_user_id<>p_user_id) then
   raise exception 'Passenger account mismatch'; end if;
 update public.golf_registrations set user_id=p_user_id,passenger_id=p_passenger_id,
   passenger_claim_status='claimed',passenger_claimed_at=claimed_at where id=reg.id;
 update public.golf_registration_teams set captain_user_id=p_user_id,updated_at=claimed_at where id=tm.id;
 update public.golf_team_invitations set status='completed',completed_at=claimed_at,
   last_error=null,updated_at=claimed_at where id=inv.id;
 return reg.id;
end $function$;
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    display_name,
    username
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(trim(concat(new.raw_user_meta_data ->> 'first_name', ' ', new.raw_user_meta_data ->> 'last_name')), ''),
      new.email
    ),
    nullif(trim(new.raw_user_meta_data ->> 'username'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.has_organization_role(org_id uuid, allowed_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and (om.access_starts_at is null or om.access_starts_at <= now())
      and (om.access_ends_at is null or om.access_ends_at >= now())
      and om.role = any(allowed_roles)
  );
$function$;
CREATE OR REPLACE FUNCTION public.is_eig_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = auth.uid()
      and om.status = 'active'
      and (om.access_starts_at is null or om.access_starts_at <= now())
      and (om.access_ends_at is null or om.access_ends_at >= now())
      and om.role = 'eig_admin'
      and o.slug = 'elevated-impact-group'
  );
$function$;
CREATE OR REPLACE FUNCTION public.is_event_assigned(target_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.event_assignments ea
    where ea.event_id = target_event_id
      and ea.user_id = auth.uid()
      and ea.status = 'active'
      and (ea.access_starts_at is null or ea.access_starts_at <= now())
      and (ea.access_ends_at is null or ea.access_ends_at >= now())
  );
$function$;
CREATE OR REPLACE FUNCTION public.is_organization_member(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and (om.access_starts_at is null or om.access_starts_at <= now())
      and (om.access_ends_at is null or om.access_ends_at >= now())
  );
$function$;
CREATE OR REPLACE FUNCTION public.list_inception_events()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
select eig_private.inception_events()
$function$;
CREATE OR REPLACE FUNCTION public.list_social_events()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'organization_id',organization_id) order by updated_at desc),'[]'::jsonb)
from (select id,name,organization_id,updated_at from public.golf_registration_events where eig_private.can_manage_social_event(id) order by updated_at desc limit 200) e
$function$;
CREATE OR REPLACE FUNCTION public.organization_has_product(target_organization_id uuid, target_product_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.organization_product_entitlements ope
    join public.products p on p.id = ope.product_id
    where ope.organization_id = target_organization_id
      and p.product_key = target_product_key
      and ope.status in ('active', 'trial')
      and ope.starts_at <= now()
      and (ope.ends_at is null or ope.ends_at > now())
  );
$function$;
CREATE OR REPLACE FUNCTION public.platform_assert_active_admin(p_actor_id uuid, p_actor_session_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select eig_private.assert_active_admin(p_actor_id,p_actor_session_id)
$function$;
CREATE OR REPLACE FUNCTION public.platform_revoke_account_sessions(p_actor_id uuid, p_actor_session_id uuid, p_target_id uuid, p_request_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select eig_private.revoke_account_sessions(p_actor_id,p_actor_session_id,p_target_id,p_request_id,p_reason)
$function$;
CREATE OR REPLACE FUNCTION public.read_eie_event_budget(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select eig_private.read_event_budget(p_event_id)$function$;
CREATE OR REPLACE FUNCTION public.save_design_product(p_product_id uuid, p_expected_version integer, p_name text, p_category text, p_material text, p_status text, p_description text, p_definition jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select eig_private.save_design_product(p_product_id,p_expected_version,p_name,p_category,p_material,p_status,p_description,p_definition)
$function$;
CREATE OR REPLACE FUNCTION public.save_eie_event_budget(p_event_id uuid, p_expected_version integer, p_data jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select eig_private.save_event_budget(p_event_id,p_expected_version,p_data)$function$;
CREATE OR REPLACE FUNCTION public.save_event_builder_assets(p_event_id uuid, p_expected_version integer, p_data jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select eig_private.save_event_assets(p_event_id,p_expected_version,p_data) $function$;
CREATE OR REPLACE FUNCTION public.save_inception_project(p_project_id uuid, p_expected_version integer, p_name text, p_material text, p_event_id uuid, p_data jsonb, p_status text DEFAULT 'draft'::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
select eig_private.save_inception(p_project_id,p_expected_version,p_name,p_material,p_event_id,p_data,p_status)
$function$;
CREATE OR REPLACE FUNCTION public.save_social_campaign(p_campaign_id uuid, p_expected_version integer, p_name text, p_event_id uuid, p_data jsonb, p_status text DEFAULT 'draft'::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select eig_private.save_social(p_campaign_id,p_expected_version,p_name,p_event_id,p_data,p_status)$function$;
RESET check_function_bodies;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

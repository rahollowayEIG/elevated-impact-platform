-- SANDBOX ONLY: schema logic, not database records. Privileges are denied to ordinary clients.
-- Source definitions were checked for production endpoints, credentials, network/OS calls and hardcoded emails.
SET check_function_bodies = off;
CREATE OR REPLACE FUNCTION eig_private.active_builder_session()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id join public.profiles p on p.id=u.id
where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and u.email_confirmed_at is not null
and (s.not_after is null or s.not_after>now()) and (u.banned_until is null or u.banned_until<=now()) and p.account_status='active');
$function$;
CREATE OR REPLACE FUNCTION eig_private.assert_active_admin(actor_id uuid, actor_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id join public.profiles p on p.id=u.id
    where s.id=actor_session_id and u.id=actor_id and u.email_confirmed_at is not null
      and (s.not_after is null or s.not_after > now())
      and (u.banned_until is null or u.banned_until <= now())
      and coalesce(p.account_status,'active')='active'
      and (p.role='super_admin' or exists(select 1 from public.organization_memberships m where m.user_id=u.id and m.role='eig_admin' and m.status='active'
        and (m.access_starts_at is null or m.access_starts_at <= now()) and (m.access_ends_at is null or m.access_ends_at >= now())))) then
    raise exception 'An active, verified EIG administrator session is required' using errcode='42501';
  end if;
end $function$;
CREATE OR REPLACE FUNCTION eig_private.attach_inception(p_id uuid, p_expected integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.inception_projects; packet public.event_builder_assets; next_data jsonb; designs jsonb;
begin
  select * into r from public.inception_projects where id=p_id for update;
  if not found or r.event_id is null or not eig_private.can_access_inception(r.owner_user_id,r.event_id) then raise exception 'Authorized event project access is required' using errcode='42501'; end if;
  if p_expected is null or r.version<>p_expected then raise exception 'The project changed. Reopen it before attaching.' using errcode='40001'; end if;
  if r.status<>'approved' then raise exception 'Approve the design before attaching it'; end if;
  -- Serialize with other packet saves, which update the same row with a version check.
  insert into public.event_builder_assets(event_id,data,version,updated_by) values(r.event_id,'{}'::jsonb,1,auth.uid()) on conflict do nothing;
  select * into packet from public.event_builder_assets where event_id=r.event_id for update;
  select coalesce(jsonb_agg(d),'[]'::jsonb) into designs from jsonb_array_elements(coalesce(packet.data->'designs','[]'::jsonb)) d
    where d->>'project_id'<>r.id::text;
  if jsonb_array_length(designs)>=30 then raise exception 'The packet holds up to 30 approved design snapshots'; end if;
  designs:=designs||jsonb_build_array(jsonb_build_object('project_id',r.id,'version',r.version,'name',r.name,'material',r.material,
    'approved_at',r.approved_at,'design',r.data->'design','facts',r.data->'facts'));
  next_data:=packet.data||jsonb_build_object('designs',designs);
  if octet_length(next_data::text)>=6000000 then raise exception 'The packet is too large. Export this artwork separately.'; end if;
  update public.event_builder_assets set data=next_data,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
    where event_id=r.event_id returning * into packet;
  insert into public.event_builder_asset_audit(event_id,version,actor_user_id) values(r.event_id,packet.version,auth.uid());
  return jsonb_build_object('event_id',r.event_id,'packet_version',packet.version,'project_version',r.version);
end $function$;
CREATE OR REPLACE FUNCTION eig_private.can_access_inception(p_owner uuid, p_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select eig_private.active_builder_session() and
    case when p_event is null then p_owner=auth.uid() else eig_private.can_manage_event_assets(p_event) end
$function$;
CREATE OR REPLACE FUNCTION eig_private.can_access_social(p_owner uuid, p_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select eig_private.active_builder_session() and case when p_event is null then p_owner=auth.uid() else eig_private.can_manage_social_event(p_event) end
$function$;
CREATE OR REPLACE FUNCTION eig_private.can_manage_design_catalog()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select eig_private.active_builder_session() and exists(
    select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and m.role='eig_admin' and m.status='active'
      and o.slug='elevated-impact-group' and o.status='active'
      and (m.access_starts_at is null or m.access_starts_at<=now())
      and (m.access_ends_at is null or m.access_ends_at>now())
  )
$function$;
CREATE OR REPLACE FUNCTION eig_private.can_manage_event_assets(target_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(select 1 from public.golf_registration_events e
    where e.id=target_event_id and exists(select 1 from auth.users u join public.profiles p on p.id=u.id
      where u.id=auth.uid() and u.email_confirmed_at is not null and p.account_status='active'
      and (u.banned_until is null or u.banned_until<=now())
      and exists(select 1 from auth.sessions s where s.user_id=u.id and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()))
      and (p.role='super_admin' or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
        where m.user_id=u.id and m.status='active' and (m.access_starts_at is null or m.access_starts_at<=now()) and (m.access_ends_at is null or m.access_ends_at>=now())
        and ((m.organization_id=e.organization_id and m.role in ('organization_admin','organization_staff')) or (m.role='eig_admin' and o.slug='elevated-impact-group')))
        or exists(select 1 from public.event_assignments a where a.user_id=u.id and a.event_id=e.id and a.status='active' and a.role='event_coordinator'
        and (a.access_starts_at is null or a.access_starts_at<=now()) and (a.access_ends_at is null or a.access_ends_at>=now())))));
$function$;
CREATE OR REPLACE FUNCTION eig_private.can_manage_event_budget(target_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select eig_private.active_builder_session() and exists(
  select 1 from public.golf_registration_events e join public.organizations org on org.id=e.organization_id
  where e.id=target_event_id and org.status='active' and (
   exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='super_admin')
   or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and m.status='active' and o.status='active'
    and (m.access_starts_at is null or m.access_starts_at<=now()) and (m.access_ends_at is null or m.access_ends_at>now())
    and ((m.organization_id=e.organization_id and m.role in ('organization_admin','organization_staff')) or (m.role='eig_admin' and o.slug='elevated-impact-group')))
   or exists(select 1 from public.event_assignments a where a.user_id=auth.uid() and a.event_id=e.id and a.status='active' and a.role='event_coordinator'
    and (a.access_starts_at is null or a.access_starts_at<=now()) and (a.access_ends_at is null or a.access_ends_at>now()))));
$function$;
CREATE OR REPLACE FUNCTION eig_private.can_manage_social_event(target_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select eig_private.active_builder_session() and exists(
  select 1 from public.golf_registration_events e join public.organizations org on org.id=e.organization_id
  where e.id=target_event_id and org.status='active' and (
   exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='super_admin')
   or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and m.status='active' and o.status='active'
    and (m.access_starts_at is null or m.access_starts_at<=now()) and (m.access_ends_at is null or m.access_ends_at>now())
    and ((m.organization_id=e.organization_id and m.role in ('organization_admin','organization_staff')) or (m.role='eig_admin' and o.slug='elevated-impact-group')))
   or exists(select 1 from public.event_assignments a where a.user_id=auth.uid() and a.event_id=e.id and a.status='active' and a.role='event_coordinator'
    and (a.access_starts_at is null or a.access_starts_at<=now()) and (a.access_ends_at is null or a.access_ends_at>now()))));
$function$;
CREATE OR REPLACE FUNCTION eig_private.clean_social_schedule(p_data jsonb, p_review boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare posts jsonb:=coalesce(p_data->'posts','[]'::jsonb); cleaned jsonb:='[]'; p jsonb; ids uuid[]:='{}'; post_id uuid; at_time timestamptz; starts timestamptz; ends timestamptz; zone text:=p_data->>'time_zone'; template text:=coalesce(p_data->>'template_id','');
begin
  if jsonb_typeof(posts)<>'array' or jsonb_array_length(posts)>24 then raise exception 'Use no more than 24 posts per campaign' using errcode='22023'; end if;
  if template not in ('','countdown','spotlight','weekly-deal','registration') or coalesce(jsonb_typeof(p_data->'template_id'),'string')<>'string'
    or coalesce(jsonb_typeof(p_data->'template_anchor'),'string')<>'string' or length(coalesce(p_data->>'template_anchor',''))>16
    or coalesce(jsonb_typeof(p_data->'template_offer'),'string')<>'string' or length(coalesce(p_data->>'template_offer',''))>2000
    then raise exception 'Invalid campaign template' using errcode='22023'; end if;
  if jsonb_array_length(posts)>0 then
    if zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception 'Choose a valid campaign time zone' using errcode='22023'; end if;
    if coalesce(p_data->>'desired_at','')<>'' then starts:=eig_private.social_post_instant(p_data->>'desired_at',zone); end if;
    if coalesce(p_data->>'ends_at','')<>'' then ends:=eig_private.social_post_instant(p_data->>'ends_at',zone); end if;
    if starts is not null and ends is not null and ends<starts then raise exception 'Campaign end must be on or after its start' using errcode='22023'; end if;
    if p_review and (starts is null or ends is null) then raise exception 'Set the campaign start and end before reviewing its schedule' using errcode='22023'; end if;
  end if;
  for p in select value from jsonb_array_elements(posts) loop
    if jsonb_typeof(p)<>'object' or coalesce(jsonb_typeof(p->'id'),'')<>'string' or (p->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(jsonb_typeof(p->'label'),'')<>'string' or length(trim(p->>'label')) not between 1 and 160
      or coalesce(jsonb_typeof(p->'body'),'')<>'string' or length(p->>'body')>2000
      or coalesce(jsonb_typeof(p->'local_at'),'')<>'string' or length(p->>'local_at')>16 then raise exception 'Invalid planned post' using errcode='22023'; end if;
    post_id:=(p->>'id')::uuid;
    if post_id=any(ids) then raise exception 'Use a unique post identifier' using errcode='22023'; end if;
    ids:=array_append(ids,post_id); at_time:=null;
    if p_review and (length(trim(p->>'body'))=0 or p->>'local_at'='') then raise exception 'Add a message and posting time before review' using errcode='22023'; end if;
    if p->>'local_at'<>'' then
      at_time:=eig_private.social_post_instant(p->>'local_at',zone);
      if (starts is not null and at_time<starts) or (ends is not null and at_time>ends) then raise exception 'Posting time must fall within the campaign dates' using errcode='22023'; end if;
    end if;
    cleaned:=cleaned||jsonb_build_array(jsonb_build_object('id',post_id,'label',p->>'label','body',p->>'body','local_at',p->>'local_at','scheduled_at',at_time));
  end loop;
  return jsonb_build_object('posts',cleaned,'template_id',template,'template_anchor',coalesce(p_data->>'template_anchor',''),'template_offer',coalesce(p_data->>'template_offer',''));
end $function$;
CREATE OR REPLACE FUNCTION eig_private.event_budget_sources(target_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare reg_committed numeric; reg_received numeric; reg_count integer; paid_without_amount integer; source_plan jsonb; sponsor_target numeric; sponsor_paid numeric; plan_version integer; comp_value numeric; comp_spots integer; comp_fees integer;
begin
 if not eig_private.can_manage_event_budget(target_event_id) then raise exception 'Authorized event budget access is required' using errcode='42501'; end if;
 -- One row per registration. Team captain carries the team price; do not add team shares again.
 -- Keep money retained on cancelled/withdrawn registrations; omit full refunds and comps.
 select coalesce(sum(case when payment_status='comp' or payment_status='refunded' or refunded_at is not null then 0
  when registration_status='active' and coalesce(spot_hold_status,'') not in ('released','expired') then greatest(coalesce(price,0),net_received)
  else net_received end),0),coalesce(sum(net_received),0),count(*) filter(where registration_status='active' and coalesce(spot_hold_status,'') not in ('released','expired')),
 count(*) filter(where payment_status='paid' and amount_paid is null and refunded_at is null)
 into reg_committed,reg_received,reg_count,paid_without_amount
 from (select r.*,case when payment_status in ('comp','refunded') or refunded_at is not null then 0
   when amount_paid is not null then least(greatest(coalesce(price,0),0),greatest(amount_paid-case when payment_reference='clubhouse' then 0 else coalesce(convenience_fee,0) end,0))
   when payment_status='paid' then greatest(coalesce(price,0),0) else 0 end as net_received
  from public.golf_registrations r where r.event_id=target_event_id) r;
 -- Read-only value of complimentary entries, distinct from cash received.
 -- A paid/Comp team fee is held on the captain's priced registration.
 -- Covered $0 teammates count as spots, but must not add to face value.
 select coalesce(sum(greatest(coalesce(price,0),0)),0),count(*),
        count(*) filter (where coalesce(price,0)>0)
   into comp_value,comp_spots,comp_fees
   from public.golf_registrations
   where event_id=target_event_id and payment_status='comp'
     and registration_status='active'
     and coalesce(spot_hold_status,'') not in ('released','expired')
     and refunded_at is null;
 select data->'sponsors',version into source_plan,plan_version from public.event_builder_assets where event_id=target_event_id;
 select coalesce(sum(greatest(coalesce((s->>'quantity')::numeric,0),0)*greatest(coalesce((s->>'unit_price')::numeric,0),0)),0),
 coalesce(sum(case when s->>'paid'='true' then greatest(coalesce((s->>'quantity')::numeric,0),0)*greatest(coalesce((s->>'unit_price')::numeric,0),0) else 0 end),0)
 into sponsor_target,sponsor_paid from jsonb_array_elements(case when jsonb_typeof(source_plan->'sales')='array' then source_plan->'sales' else '[]'::jsonb end) s;
 return jsonb_build_object('refreshed_at',now(),'registration_count',reg_count,'status_only_paid_count',paid_without_amount,'sponsor_plan_version',plan_version,
  'comps',jsonb_build_object('value_cents',round(comp_value*100),'spot_count',comp_spots,'fee_count',comp_fees),
  'income',jsonb_build_array(
   jsonb_build_object('id','00000000-0000-0000-0000-000000000001','source_key','registration','name','EIE registrations','category','Registration','vendor','EIE roster','notes','Event registration amounts; convenience fees excluded. Full refunds and comps excluded. Paid status used when no amount is recorded.', 'target_cents',0,'committed_cents',round(reg_committed*100),'received_cents',round(reg_received*100)),
   jsonb_build_object('id','00000000-0000-0000-0000-000000000002','source_key','sponsors','name','Sponsor Builder sales','category','Sponsorship','vendor','Saved event packet','notes','Saved sales are targets until marked paid. Legacy sponsor tables are not added again.', 'target_cents',round(sponsor_target*100),'committed_cents',round(sponsor_paid*100),'received_cents',round(sponsor_paid*100))));
end $function$;
CREATE OR REPLACE FUNCTION eig_private.inception_events()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from (
  select id,organization_id,master_event_id,name,course,event_dates,public_slug,status,
    jsonb_build_object('event_start_time',field_settings->>'event_start_time','hub_venue_address',field_settings->>'hub_venue_address',
      'hub_description',field_settings->>'hub_description','hub_food_beverage',field_settings->>'hub_food_beverage',
      'hub_gifts_prizes',field_settings->>'hub_gifts_prizes','registration_contact_name',field_settings->>'registration_contact_name',
      'registration_contact_email',field_settings->>'registration_contact_email','registration_contact_phone',field_settings->>'registration_contact_phone',
      'event_kind',field_settings->>'event_kind') as field_settings
  from public.golf_registration_events where eig_private.can_manage_event_assets(id) order by updated_at desc limit 200
) e
$function$;
CREATE OR REPLACE FUNCTION eig_private.read_event_budget(target_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; history jsonb;
begin
 if not eig_private.can_manage_event_budget(target_event_id) then raise exception 'Authorized event budget access is required' using errcode='42501'; end if;
 select to_jsonb(b) into result from public.eie_event_budgets b where event_id=target_event_id;
 select coalesce(jsonb_agg(v order by version desc),'[]'::jsonb) into history from
 (select version,actor_user_id,created_at from public.eie_event_budget_versions where event_id=target_event_id order by version desc limit 10) v;
 return jsonb_build_object('budget',result,'sources',eig_private.event_budget_sources(target_event_id),'history',history,'history_count',coalesce((result->>'version')::integer,0));
end $function$;
CREATE OR REPLACE FUNCTION eig_private.revoke_account_sessions(actor_id uuid, actor_session_id uuid, target_id uuid, request_id uuid, reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare prior public.platform_account_audit; revoked_count integer; result jsonb;
begin
  perform eig_private.assert_active_admin(actor_id,actor_session_id);
  if target_id=actor_id then raise exception 'Cannot revoke your own administrator sessions here' using errcode='42501'; end if;
  if request_id is null or length(trim(coalesce(reason,''))) not between 1 and 500 then
    raise exception 'A request ID and reason are required' using errcode='22023';
  end if;
  -- Serialize this target and make uncertain network retries idempotent.
  perform 1 from auth.users where id=target_id for update;
  if not found then raise exception 'Target account not found' using errcode='P0002'; end if;
  select * into prior from public.platform_account_audit a where a.request_id=revoke_account_sessions.request_id;
  if found then
    if prior.target_user_id<>target_id or prior.actor_user_id<>actor_id or prior.action<>'sessions_revoked' then
      raise exception 'Request ID already belongs to another action' using errcode='22023';
    end if;
    return prior.after_state;
  end if;
  delete from auth.sessions where user_id=target_id;
  get diagnostics revoked_count = row_count;
  -- Legacy sessionless refresh tokens must not keep this account signed in.
  delete from auth.refresh_tokens where user_id=target_id::text;
  result := jsonb_build_object('sessions_revoked',revoked_count,'user_id',target_id);
  insert into public.platform_account_audit(target_user_id,actor_user_id,action,reason,request_id,after_state)
  values(target_id,actor_id,'sessions_revoked',trim(reason),request_id,result);
  return result;
end $function$;
CREATE OR REPLACE FUNCTION eig_private.save_design_product(p_id uuid, p_expected integer, p_name text, p_category text, p_material text, p_status text, p_description text, p_definition jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.eic_design_products;
begin
  if not eig_private.can_manage_design_catalog() then raise exception 'Active EIG catalog management access is required' using errcode='42501'; end if;
  if p_id is null or p_expected is null or p_expected<0 or p_name is null or length(trim(p_name)) not between 1 and 160
    or p_category is null or p_category not in ('signage','marketing','swag','apparel','gifts','books','displays','other')
    or p_material is null or p_material not in ('flyer','invitation','sign','banner','swag','book','display')
    or p_status is null or p_status not in ('draft','active','archived') or p_description is null or length(p_description)>1000
    or not eig_private.valid_design_product_definition(p_definition) then raise exception 'Invalid product specifications' using errcode='22023'; end if;
  select * into r from public.eic_design_products where id=p_id for update;
  if found then
    if r.version<>p_expected then raise exception 'Someone saved a newer product version. Your changes are still here; reopen the product before saving.' using errcode='40001'; end if;
    update public.eic_design_products set name=trim(p_name),category=p_category,material=p_material,status=p_status,description=p_description,
      definition=p_definition,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning * into r;
  else
    if p_expected<>0 then raise exception 'Reopen the product before saving' using errcode='40001'; end if;
    insert into public.eic_design_products(id,name,category,material,status,description,definition,created_by,updated_by)
      values(p_id,trim(p_name),p_category,p_material,p_status,p_description,p_definition,auth.uid(),auth.uid()) returning * into r;
  end if;
  insert into public.eic_design_product_versions(product_id,version,snapshot,actor_user_id) values(r.id,r.version,to_jsonb(r),auth.uid());
  return to_jsonb(r);
end $function$;
CREATE OR REPLACE FUNCTION eig_private.save_event_assets(target_event_id uuid, expected_version integer, asset_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result public.event_builder_assets;
begin
  if auth.uid() is null or not eig_private.can_manage_event_assets(target_event_id) then raise exception 'Authorized event access is required' using errcode='42501'; end if;
  if asset_data is null or jsonb_typeof(asset_data)<>'object' or octet_length(asset_data::text)>=6000000 or expected_version<0 then raise exception 'Invalid event packet data'; end if;
  if expected_version=0 then
    insert into public.event_builder_assets(event_id,data,version,updated_by) values(target_event_id,asset_data,1,auth.uid())
    on conflict do nothing returning * into result;
  else
    update public.event_builder_assets set data=asset_data,version=version+1,updated_by=auth.uid(),updated_at=now()
    where event_id=target_event_id and version=expected_version returning * into result;
  end if;
  if result.event_id is null then raise exception 'Someone saved newer event packet changes. Reload before editing.' using errcode='40001'; end if;
  insert into public.event_builder_asset_audit(event_id,version,actor_user_id) values(target_event_id,result.version,auth.uid());
  return to_jsonb(result);
end $function$;
CREATE OR REPLACE FUNCTION eig_private.save_event_budget(target_event_id uuid, expected_version integer, budget_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare saved public.eie_event_budgets; sources jsonb;
begin
 if not eig_private.can_manage_event_budget(target_event_id) then raise exception 'Authorized event budget access is required' using errcode='42501'; end if;
 if expected_version is null or expected_version<0 or not eig_private.valid_event_budget(budget_data) then raise exception 'Invalid event budget data'; end if;
 sources:=eig_private.event_budget_sources(target_event_id);
 if expected_version=0 then
  insert into public.eie_event_budgets(event_id,data,version,updated_by) values(target_event_id,budget_data,1,auth.uid()) on conflict do nothing returning * into saved;
 else
  update public.eie_event_budgets set data=budget_data,version=version+1,updated_by=auth.uid(),updated_at=now()
   where event_id=target_event_id and version=expected_version returning * into saved;
 end if;
 if saved.event_id is null then raise exception 'Someone saved a newer budget. Export your draft, then reload before saving.' using errcode='40001'; end if;
 insert into public.eie_event_budget_versions(event_id,version,data,source_snapshot,actor_user_id) values(target_event_id,saved.version,saved.data,sources,auth.uid());
 return eig_private.read_event_budget(target_event_id);
end $function$;
CREATE OR REPLACE FUNCTION eig_private.save_inception(p_id uuid, p_expected integer, p_name text, p_material text, p_event uuid, p_data jsonb, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.inception_projects; e public.golf_registration_events;
begin
  if not eig_private.active_builder_session() then raise exception 'An active verified account session is required' using errcode='42501'; end if;
  if p_id is null or p_expected is null or p_expected<0 or p_name is null or length(trim(p_name)) not between 1 and 160
    or p_material is null or p_material not in ('flyer','invitation','sign','banner','swag','book','display')
    or p_status is null or p_status not in ('draft','approved','archived')
    or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>=4500000
    or coalesce(jsonb_typeof(p_data->'design'),'')<>'object' or coalesce(jsonb_typeof(p_data->'facts'),'')<>'object'
    or coalesce(jsonb_typeof(p_data->'design'->'boxes'),'')<>'array'
    or jsonb_array_length(p_data->'design'->'boxes')>40 then raise exception 'Invalid creative project data' using errcode='22023'; end if;
  if p_event is not null then
    if not eig_private.can_manage_event_assets(p_event) then raise exception 'Authorized event access is required' using errcode='42501'; end if;
    select * into e from public.golf_registration_events where id=p_event;
  end if;
  select * into r from public.inception_projects where id=p_id for update;
  if found then
    if not eig_private.can_access_inception(r.owner_user_id,r.event_id) then raise exception 'Project access is required' using errcode='42501'; end if;
    if p_event is distinct from r.event_id or p_material is distinct from r.material then raise exception 'Create a new project to change its event or material'; end if;
    if r.version<>p_expected then raise exception 'Someone saved a newer version. Download your changes, then reopen the project.' using errcode='40001'; end if;
    update public.inception_projects set name=trim(p_name),data=p_data,status=p_status,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp(),
      approved_at=case when p_status='approved' then clock_timestamp() end,approved_by=case when p_status='approved' then auth.uid() end
    where id=p_id returning * into r;
  else
    if p_expected<>0 then raise exception 'Project access is required' using errcode='42501'; end if;
    insert into public.inception_projects(id,owner_user_id,organization_id,event_id,master_event_id,name,material,status,data,version,updated_by,approved_at,approved_by)
    values(p_id,auth.uid(),e.organization_id,p_event,e.master_event_id,trim(p_name),p_material,p_status,p_data,1,auth.uid(),
      case when p_status='approved' then clock_timestamp() end,case when p_status='approved' then auth.uid() end) returning * into r;
  end if;
  insert into public.inception_project_versions(project_id,version,name,status,data,actor_user_id)
    values(r.id,r.version,r.name,r.status,r.data,auth.uid());
  return to_jsonb(r);
end $function$;
CREATE OR REPLACE FUNCTION eig_private.save_social(p_id uuid, p_expected integer, p_name text, p_event uuid, p_data jsonb, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.social_campaigns; event_org uuid; next_data jsonb; field text; max_size integer;
begin
  if not eig_private.active_builder_session() then raise exception 'An active verified account session is required' using errcode='42501'; end if;
  if p_id is null or p_expected is null or p_expected<0 or p_name is null or length(trim(p_name)) not between 1 and 160
    or p_status is null or p_status not in ('draft','reviewed','archived') or p_data is null or jsonb_typeof(p_data)<>'object'
    or octet_length(p_data::text)>=100000 or coalesce(jsonb_typeof(p_data->'destinations'),'')<>'array'
    or jsonb_array_length(p_data->'destinations')>9 then raise exception 'Invalid campaign data' using errcode='22023'; end if;
  foreach field in array array['headline','body','sponsor','link','image','cta','desired_at','ends_at','opportunity','time_zone'] loop
    max_size:=case when field='body' then 6000 when field in ('link','image') then 2048 when field in ('cta','time_zone') then 80 when field in ('desired_at','ends_at','opportunity') then 40 else 160 end;
    if coalesce(jsonb_typeof(p_data->field),'string')<>'string' or length(coalesce(p_data->>field,''))>max_size then raise exception 'Invalid campaign field' using errcode='22023'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_data->'destinations') d where jsonb_typeof(d)<>'string' or d#>>'{}' not in ('facebook','instagram','linkedin','tiktok','youtube','x','hub','website','display')) then raise exception 'Invalid campaign destination' using errcode='22023'; end if;
  foreach field in array array['link','image'] loop
    if coalesce(p_data->>field,'')<>'' and ((p_data->>field)!~'^https://[^[:space:]<>]+$' or (p_data->>field)~'^https://[^/]*@') then raise exception 'Use a full HTTPS public URL' using errcode='22023'; end if;
  end loop;
  if p_status='reviewed' and (length(trim(coalesce(p_data->>'body','')))=0 or jsonb_array_length(p_data->'destinations')=0) then raise exception 'Add a message and destination before review' using errcode='22023'; end if;
  next_data:=jsonb_build_object('headline',coalesce(p_data->>'headline',''),'body',coalesce(p_data->>'body',''),'sponsor',coalesce(p_data->>'sponsor',''),
    'link',coalesce(p_data->>'link',''),'image',coalesce(p_data->>'image',''),'cta',coalesce(p_data->>'cta',''),'desired_at',coalesce(p_data->>'desired_at',''),
    'ends_at',coalesce(p_data->>'ends_at',''),'time_zone',coalesce(p_data->>'time_zone',''),'opportunity',coalesce(p_data->>'opportunity',''),'destinations',p_data->'destinations') || eig_private.clean_social_schedule(p_data,p_status='reviewed');
  if p_event is not null then
    if not eig_private.can_manage_social_event(p_event) then raise exception 'Authorized event access is required' using errcode='42501'; end if;
    select organization_id into event_org from public.golf_registration_events where id=p_event;
  end if;
  select * into r from public.social_campaigns where id=p_id for update;
  if found then
    if not eig_private.can_access_social(r.owner_user_id,r.event_id) then raise exception 'Campaign access is required' using errcode='42501'; end if;
    if p_event is distinct from r.event_id then raise exception 'Create a new campaign to change its event' using errcode='22023'; end if;
    if r.version<>p_expected then raise exception 'Someone saved a newer version. Download your changes, then reopen the campaign.' using errcode='40001'; end if;
    if not (p_data ? 'posts') and jsonb_array_length(coalesce(r.data->'posts','[]'::jsonb))>0 then raise exception 'Refresh the app before editing this campaign posting plan' using errcode='22023'; end if;
    update public.social_campaigns set name=trim(p_name),data=next_data,status=p_status,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp(),
      reviewed_at=case when p_status='reviewed' then clock_timestamp() end,reviewed_by=case when p_status='reviewed' then auth.uid() end where id=p_id returning * into r;
  else
    if p_expected<>0 then raise exception 'Campaign access is required' using errcode='42501'; end if;
    insert into public.social_campaigns(id,owner_user_id,organization_id,event_id,name,data,status,version,updated_by,reviewed_at,reviewed_by)
    values(p_id,auth.uid(),event_org,p_event,trim(p_name),next_data,p_status,1,auth.uid(),case when p_status='reviewed' then clock_timestamp() end,case when p_status='reviewed' then auth.uid() end) returning * into r;
  end if;
  insert into public.social_campaign_versions(campaign_id,version,name,status,data,actor_user_id) values(r.id,r.version,r.name,r.status,r.data,auth.uid());
  return to_jsonb(r);
end $function$;
CREATE OR REPLACE FUNCTION eig_private.social_post_instant(p_local text, p_zone text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare wall timestamp; instant timestamptz;
begin
  if p_local is null or p_local !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
    or substring(p_local,1,4)::integer not between 2000 and 2100 then raise exception 'Use a valid posting date between 2000 and 2100' using errcode='22023'; end if;
  if p_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_zone)
    then raise exception 'Choose a valid campaign time zone' using errcode='22023'; end if;
  wall:=p_local::timestamp;
  if to_char(wall,'YYYY-MM-DD"T"HH24:MI')<>p_local then raise exception 'Use a valid posting date' using errcode='22023'; end if;
  instant:=wall at time zone p_zone;
  if instant at time zone p_zone<>wall then raise exception 'Posting time does not exist because of a clock change' using errcode='22023'; end if;
  if exists(select 1 from generate_series(-144,144) n where n<>0 and (instant + n*interval '15 minutes') at time zone p_zone=wall)
    then raise exception 'Posting time occurs twice because of a clock change; choose another time or UTC' using errcode='22023'; end if;
  return instant;
end $function$;
RESET check_function_bodies;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA eig_private FROM PUBLIC, anon, authenticated;

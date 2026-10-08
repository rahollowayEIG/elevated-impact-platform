-- Saved posting plans only. No provider jobs, posts, ad serving, email, or payments.
alter table public.social_campaigns drop constraint social_campaigns_data_check;
alter table public.social_campaigns add constraint social_campaigns_data_check
check(jsonb_typeof(data)='object' and octet_length(data::text)<100000);

create function eig_private.social_post_instant(p_local text,p_zone text) returns timestamptz
language plpgsql stable security invoker set search_path='' as $$
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
end $$;
revoke all on function eig_private.social_post_instant(text,text) from public,anon;
grant execute on function eig_private.social_post_instant(text,text) to authenticated;

create function eig_private.clean_social_schedule(p_data jsonb,p_review boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
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
end $$;
revoke all on function eig_private.clean_social_schedule(jsonb,boolean) from public,anon;
grant execute on function eig_private.clean_social_schedule(jsonb,boolean) to authenticated;

create function eig_private.can_manage_social_event(target_event_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
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
$$;
revoke all on function eig_private.can_manage_social_event(uuid) from public,anon;
grant execute on function eig_private.can_manage_social_event(uuid) to authenticated;


create or replace function eig_private.can_access_social(p_owner uuid,p_event uuid) returns boolean
language sql stable security invoker set search_path='' as $$
select eig_private.active_builder_session() and case when p_event is null then p_owner=auth.uid() else eig_private.can_manage_social_event(p_event) end
$$;
revoke all on function eig_private.can_access_social(uuid,uuid) from public,anon;
grant execute on function eig_private.can_access_social(uuid,uuid) to authenticated;

create or replace function eig_private.save_social(p_id uuid,p_expected integer,p_name text,p_event uuid,p_data jsonb,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function eig_private.save_social(uuid,integer,text,uuid,jsonb,text) from public,anon;
grant execute on function eig_private.save_social(uuid,integer,text,uuid,jsonb,text) to authenticated;


create function public.list_social_events() returns jsonb
language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'organization_id',organization_id) order by updated_at desc),'[]'::jsonb)
from (select id,name,organization_id,updated_at from public.golf_registration_events where eig_private.can_manage_social_event(id) order by updated_at desc limit 200) e
$$;
revoke all on function public.list_social_events() from public,anon;
grant execute on function public.list_social_events() to authenticated;

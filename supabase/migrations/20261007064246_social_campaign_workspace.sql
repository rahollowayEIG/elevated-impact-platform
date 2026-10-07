-- Draft preparation only: no provider tokens, public ads, schedules or publishing jobs.
-- Reuses the existing verified interactive account/session and event-management boundaries.
create table public.social_campaigns (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id),
  organization_id uuid references public.organizations(id),
  event_id uuid references public.golf_registration_events(id),
  name text not null check(length(trim(name)) between 1 and 160),
  status text not null check(status in ('draft','reviewed','archived')),
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<30000),
  version integer not null check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  check((event_id is null and organization_id is null) or (event_id is not null and organization_id is not null))
);
create index social_campaign_owner_updated on public.social_campaigns(owner_user_id,updated_at desc);
create index social_campaign_event_updated on public.social_campaigns(event_id,updated_at desc);
create table public.social_campaign_versions (
  campaign_id uuid not null references public.social_campaigns(id),
  version integer not null,
  name text not null,
  status text not null,
  data jsonb not null,
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(campaign_id,version)
);
alter table public.social_campaigns enable row level security;
alter table public.social_campaign_versions enable row level security;
revoke all on public.social_campaigns,public.social_campaign_versions from public,anon,authenticated;
grant select on public.social_campaigns,public.social_campaign_versions to authenticated;
grant all on public.social_campaigns,public.social_campaign_versions to service_role;

create function eig_private.can_access_social(p_owner uuid,p_event uuid) returns boolean
language sql stable security invoker set search_path='' as $$
select eig_private.active_builder_session() and case when p_event is null then p_owner=auth.uid() else eig_private.can_manage_event_assets(p_event) end
$$;
revoke all on function eig_private.can_access_social(uuid,uuid) from public,anon;
grant execute on function eig_private.can_access_social(uuid,uuid) to authenticated;
create policy social_authorized_read on public.social_campaigns for select to authenticated
using(eig_private.can_access_social(owner_user_id,event_id));
create policy social_versions_authorized_read on public.social_campaign_versions for select to authenticated
using(exists(select 1 from public.social_campaigns c where c.id=campaign_id));

-- The private definer is required for CAS + immutable revision writes. It grants no account/provider authority.
create function eig_private.save_social(p_id uuid,p_expected integer,p_name text,p_event uuid,p_data jsonb,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.social_campaigns; event_org uuid; next_data jsonb; field text; max_size integer;
begin
  if not eig_private.active_builder_session() then raise exception 'An active verified account session is required' using errcode='42501'; end if;
  if p_id is null or p_expected is null or p_expected<0 or p_name is null or length(trim(p_name)) not between 1 and 160
    or p_status is null or p_status not in ('draft','reviewed','archived') or p_data is null or jsonb_typeof(p_data)<>'object'
    or octet_length(p_data::text)>=30000 or coalesce(jsonb_typeof(p_data->'destinations'),'')<>'array'
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
    'ends_at',coalesce(p_data->>'ends_at',''),'time_zone',coalesce(p_data->>'time_zone',''),'opportunity',coalesce(p_data->>'opportunity',''),'destinations',p_data->'destinations');
  if p_event is not null then
    if not eig_private.can_manage_event_assets(p_event) then raise exception 'Authorized event access is required' using errcode='42501'; end if;
    select organization_id into event_org from public.golf_registration_events where id=p_event;
  end if;
  select * into r from public.social_campaigns where id=p_id for update;
  if found then
    if not eig_private.can_access_social(r.owner_user_id,r.event_id) then raise exception 'Campaign access is required' using errcode='42501'; end if;
    if p_event is distinct from r.event_id then raise exception 'Create a new campaign to change its event' using errcode='22023'; end if;
    if r.version<>p_expected then raise exception 'Someone saved a newer version. Download your changes, then reopen the campaign.' using errcode='40001'; end if;
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
create function public.save_social_campaign(p_campaign_id uuid,p_expected_version integer,p_name text,p_event_id uuid,p_data jsonb,p_status text default 'draft')
returns jsonb language sql security invoker set search_path='' as $$select eig_private.save_social(p_campaign_id,p_expected_version,p_name,p_event_id,p_data,p_status)$$;
revoke all on function public.save_social_campaign(uuid,integer,text,uuid,jsonb,text) from public,anon;
grant execute on function public.save_social_campaign(uuid,integer,text,uuid,jsonb,text) to authenticated;

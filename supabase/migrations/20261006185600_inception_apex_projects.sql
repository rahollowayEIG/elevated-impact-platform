-- Requires the Event Builder migration for the shared session/event authorization helpers.
-- Private projects use the existing ElevationPilot identity. Event projects require active event authority.
create table public.inception_projects (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id),
  organization_id uuid references public.organizations(id),
  event_id uuid references public.golf_registration_events(id),
  master_event_id uuid references public.events(id),
  name text not null check(length(trim(name)) between 1 and 160),
  material text not null check(material in ('flyer','invitation','sign','banner','swag','book','display')),
  status text not null default 'draft' check(status in ('draft','approved','archived')),
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<4500000),
  version integer not null check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  check((event_id is null and organization_id is null and master_event_id is null) or (event_id is not null and organization_id is not null))
);
create index inception_project_owner on public.inception_projects(owner_user_id,updated_at desc);
create index inception_project_event on public.inception_projects(event_id,updated_at desc);
create table public.inception_project_versions (
  project_id uuid not null references public.inception_projects(id),
  version integer not null,
  name text not null,
  status text not null,
  data jsonb not null,
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(project_id,version)
);
alter table public.inception_projects enable row level security;
alter table public.inception_project_versions enable row level security;
revoke all on public.inception_projects,public.inception_project_versions from public,anon,authenticated;
grant select on public.inception_projects,public.inception_project_versions to authenticated;
grant all on public.inception_projects,public.inception_project_versions to service_role;

create function eig_private.can_access_inception(p_owner uuid,p_event uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select eig_private.active_builder_session() and
    case when p_event is null then p_owner=auth.uid() else eig_private.can_manage_event_assets(p_event) end
$$;
revoke all on function eig_private.can_access_inception(uuid,uuid) from public,anon;
grant execute on function eig_private.can_access_inception(uuid,uuid) to authenticated;
create policy inception_private_projects on public.inception_projects for select to authenticated
using(eig_private.can_access_inception(owner_user_id,event_id));
create policy inception_private_versions on public.inception_project_versions for select to authenticated
using(exists(select 1 from public.inception_projects p where p.id=project_id));

create function eig_private.inception_events() returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from (
  select id,organization_id,master_event_id,name,course,event_dates,public_slug,status,
    jsonb_build_object('event_start_time',field_settings->>'event_start_time','hub_venue_address',field_settings->>'hub_venue_address',
      'hub_description',field_settings->>'hub_description','hub_food_beverage',field_settings->>'hub_food_beverage',
      'hub_gifts_prizes',field_settings->>'hub_gifts_prizes','registration_contact_name',field_settings->>'registration_contact_name',
      'registration_contact_email',field_settings->>'registration_contact_email','registration_contact_phone',field_settings->>'registration_contact_phone',
      'event_kind',field_settings->>'event_kind') as field_settings
  from public.golf_registration_events where eig_private.can_manage_event_assets(id) order by updated_at desc limit 200
) e
$$;
revoke all on function eig_private.inception_events() from public,anon;
grant execute on function eig_private.inception_events() to authenticated;
create function public.list_inception_events() returns jsonb language sql security invoker set search_path='' as $$
select eig_private.inception_events()
$$;
revoke all on function public.list_inception_events() from public,anon;
grant execute on function public.list_inception_events() to authenticated;

-- Definer mutation is narrow: fresh session/scope, immutable context, compare-and-swap, immutable version audit.
create function eig_private.save_inception(p_id uuid,p_expected integer,p_name text,p_material text,p_event uuid,p_data jsonb,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function eig_private.save_inception(uuid,integer,text,text,uuid,jsonb,text) from public,anon;
grant execute on function eig_private.save_inception(uuid,integer,text,text,uuid,jsonb,text) to authenticated;
create function public.save_inception_project(p_project_id uuid,p_expected_version integer,p_name text,p_material text,p_event_id uuid,p_data jsonb,p_status text default 'draft')
returns jsonb language sql security invoker set search_path='' as $$
select eig_private.save_inception(p_project_id,p_expected_version,p_name,p_material,p_event_id,p_data,p_status)
$$;
revoke all on function public.save_inception_project(uuid,integer,text,text,uuid,jsonb,text) from public,anon;
grant execute on function public.save_inception_project(uuid,integer,text,text,uuid,jsonb,text) to authenticated;

-- Append an approved snapshot to the event packet, preserving planning tools and existing artwork.
create function eig_private.attach_inception(p_id uuid,p_expected integer) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function eig_private.attach_inception(uuid,integer) from public,anon;
grant execute on function eig_private.attach_inception(uuid,integer) to authenticated;
create function public.attach_inception_project(p_project_id uuid,p_expected_version integer) returns jsonb
language sql security invoker set search_path='' as $$select eig_private.attach_inception(p_project_id,p_expected_version)$$;
revoke all on function public.attach_inception_project(uuid,integer) from public,anon;
grant execute on function public.attach_inception_project(uuid,integer) to authenticated;

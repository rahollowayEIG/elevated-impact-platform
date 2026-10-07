-- Additive creative storage only. Existing event, inquiry, payment and booking policies stay unchanged.
create schema if not exists eig_private;
create function eig_private.active_builder_session() returns boolean
language sql stable security definer set search_path='' as $$
select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id join public.profiles p on p.id=u.id
where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and u.email_confirmed_at is not null
and (s.not_after is null or s.not_after>now()) and (u.banned_until is null or u.banned_until<=now()) and p.account_status='active');
$$;
revoke all on function eig_private.active_builder_session() from public,anon;
grant usage on schema eig_private to authenticated;
grant execute on function eig_private.active_builder_session() to authenticated;
create table public.event_builder_assets (
  event_id uuid primary key references public.golf_registration_events(id),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data)='object' and octet_length(data::text)<6000000),
  version integer not null default 1 check (version>0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create table public.event_builder_asset_audit (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.golf_registration_events(id),
  version integer not null,
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index event_builder_asset_audit_event on public.event_builder_asset_audit(event_id,created_at desc);
alter table public.event_builder_assets enable row level security;
alter table public.event_builder_asset_audit enable row level security;
revoke all on public.event_builder_assets,public.event_builder_asset_audit from public,anon,authenticated;
grant select on public.event_builder_assets,public.event_builder_asset_audit to authenticated;
grant all on public.event_builder_assets,public.event_builder_asset_audit to service_role;

create schema if not exists eig_private;
grant usage on schema eig_private to authenticated,service_role;

create function eig_private.can_manage_event_assets(target_event_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
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
$$;
revoke all on function eig_private.can_manage_event_assets(uuid) from public,anon;
grant execute on function eig_private.can_manage_event_assets(uuid) to authenticated,service_role;
create policy event_builder_assets_authorized_read on public.event_builder_assets for select to authenticated using (eig_private.can_manage_event_assets(event_id));
create policy event_builder_asset_audit_authorized_read on public.event_builder_asset_audit for select to authenticated using (eig_private.can_manage_event_assets(event_id));

-- Definer scope is narrowly used for atomic compare-and-swap plus append-only audit.
-- It explicitly rechecks the current identity, session, scope and access window.
create function eig_private.save_event_assets(target_event_id uuid,expected_version integer,asset_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function eig_private.save_event_assets(uuid,integer,jsonb) from public,anon;
grant execute on function eig_private.save_event_assets(uuid,integer,jsonb) to authenticated,service_role;
create function public.save_event_builder_assets(p_event_id uuid,p_expected_version integer,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select eig_private.save_event_assets(p_event_id,p_expected_version,p_data) $$;
revoke all on function public.save_event_builder_assets(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_event_builder_assets(uuid,integer,jsonb) to authenticated;

-- No data backfill: history starts at deployment. Never retain session tokens.
create schema if not exists eig_private;
revoke all on schema eig_private from public, anon, authenticated;
grant usage on schema eig_private to service_role;

create table public.platform_account_audit (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  actor_user_id uuid,
  action text not null,
  outcome text not null default 'completed' check (outcome in ('requested','completed','failed')),
  reason text,
  before_state jsonb,
  after_state jsonb,
  request_id uuid unique,
  created_at timestamptz not null default clock_timestamp()
);
create index platform_account_audit_target_time on public.platform_account_audit(target_user_id, created_at desc, id);
alter table public.platform_account_audit enable row level security;
revoke all on public.platform_account_audit from public, anon, authenticated;
grant select, insert on public.platform_account_audit to service_role;

create function eig_private.capture_account_change() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function eig_private.capture_account_change() from public, anon, authenticated;

create trigger platform_profile_history after update of account_status on public.profiles
for each row execute function eig_private.capture_account_change();
create trigger platform_membership_history after update of role,status,access_starts_at,access_ends_at on public.organization_memberships
for each row execute function eig_private.capture_account_change();
create trigger platform_assignment_history after update of role,status,access_starts_at,access_ends_at on public.event_assignments
for each row execute function eig_private.capture_account_change();
create trigger platform_signin_history after update of banned_until on auth.users
for each row execute function eig_private.capture_account_change();

create function eig_private.assert_active_admin(actor_id uuid, actor_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function eig_private.assert_active_admin(uuid,uuid) from public, anon, authenticated;
grant execute on function eig_private.assert_active_admin(uuid,uuid) to service_role;

create function eig_private.revoke_account_sessions(actor_id uuid, actor_session_id uuid, target_id uuid, request_id uuid, reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function eig_private.revoke_account_sessions(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function eig_private.revoke_account_sessions(uuid,uuid,uuid,uuid,text) to service_role;

-- Exposed wrappers are invoker-only and exclusively service-role callable.
create function public.platform_revoke_account_sessions(p_actor_id uuid,p_actor_session_id uuid,p_target_id uuid,p_request_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
  select eig_private.revoke_account_sessions(p_actor_id,p_actor_session_id,p_target_id,p_request_id,p_reason)
$$;
revoke all on function public.platform_revoke_account_sessions(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.platform_revoke_account_sessions(uuid,uuid,uuid,uuid,text) to service_role;

create function public.platform_assert_active_admin(p_actor_id uuid,p_actor_session_id uuid)
returns void language sql security invoker set search_path='' as $$
  select eig_private.assert_active_admin(p_actor_id,p_actor_session_id)
$$;
revoke all on function public.platform_assert_active_admin(uuid,uuid) from public, anon, authenticated;
grant execute on function public.platform_assert_active_admin(uuid,uuid) to service_role;

-- Draft only. Do not run against production until migration baseline and staging isolation are repaired.
-- Canva OAuth belongs to an existing EIG account and does not create a new login or person.
-- Edge service role alone may see OAuth state, PKCE verifier or encrypted refresh tokens.

create table public.inception_canva_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_session_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code_verifier text not null check (length(code_verifier) between 43 and 128),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);
create index inception_canva_oauth_states_expiry_idx
  on public.inception_canva_oauth_states(expires_at);
create unique index inception_canva_oauth_one_pending_per_account_idx
  on public.inception_canva_oauth_states(actor_user_id) where consumed_at is null;

create table public.inception_canva_connections (
  actor_user_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  canva_user_id text not null check (length(canva_user_id) between 1 and 200),
  canva_team_id text not null check (length(canva_team_id) between 1 and 200),
  encrypted_refresh_token text not null check (length(encrypted_refresh_token) between 20 and 12000),
  granted_scopes text not null check (length(granted_scopes) between 1 and 1500),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inception_canva_connections_org_idx
  on public.inception_canva_connections(organization_id);

create table public.inception_canva_connection_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  action text not null check (action in ('connected','reconnected')),
  canva_user_id text not null,
  created_at timestamptz not null default now()
);
create index inception_canva_connection_audit_actor_idx
  on public.inception_canva_connection_audit(actor_user_id,created_at desc);

alter table public.inception_canva_oauth_states enable row level security;
alter table public.inception_canva_connections enable row level security;
alter table public.inception_canva_connection_audit enable row level security;

revoke all on public.inception_canva_oauth_states, public.inception_canva_connections,
  public.inception_canva_connection_audit from public, anon, authenticated;
grant select, insert, update, delete on public.inception_canva_oauth_states to service_role;
grant select, insert, update, delete on public.inception_canva_connections to service_role;
grant select on public.inception_canva_connection_audit to service_role;
grant usage, select on sequence public.inception_canva_connection_audit_id_seq to service_role;

create function eig_private.audit_inception_canva_connection() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.inception_canva_connection_audit
    (actor_user_id, organization_id, action, canva_user_id)
    values(new.actor_user_id, new.organization_id,
      case when tg_op='INSERT' then 'connected' else 'reconnected' end,
      new.canva_user_id);
  return new;
end $$;
revoke all on function eig_private.audit_inception_canva_connection()
  from public, anon, authenticated;
create trigger inception_canva_connections_audit
after insert or update on public.inception_canva_connections
for each row execute function eig_private.audit_inception_canva_connection();

comment on table public.inception_canva_oauth_states is
  'Short-lived one-use PKCE verifier and state hash; only Edge service role may access.';
comment on table public.inception_canva_connections is
  'EIG-admin pilot Canva connections; AES-GCM encrypted refresh token, keyed to existing platform account.';
comment on table public.inception_canva_connection_audit is
  'Append-only non-secret record of Canva connection creation and reconnection.';

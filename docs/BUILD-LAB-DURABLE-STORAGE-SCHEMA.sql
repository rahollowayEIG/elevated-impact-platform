-- PROPOSED Build Lab V1 storage schema. NOT APPLIED to any environment.
-- Reviewed migration required before rollout. Run only after owner/security approval.
-- Sensitive Build Lab evidence is server-only; no anon/authenticated table grants.
-- The existing central ElevationPilot Supabase project remains the sole database.
--
-- ROLLBACK PREP: export existing Build Lab records and inspect dependent routes
-- before migration. DO NOT drop these tables to undo an app release.

begin;

create table if not exists public.eig_build_lab_documents (
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  document_key text not null check (document_key in ('scan_history','work_buckets','manager_blueprint')),
  revision integer not null check (revision >= 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2400000),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, document_key)
);

create table if not exists public.eig_build_lab_document_revisions (
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  document_key text not null check (document_key in ('scan_history','work_buckets','manager_blueprint')),
  revision integer not null check (revision >= 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2400000),
  saved_at timestamptz not null default now(),
  primary key (owner_user_id, document_key, revision)
);

alter table public.eig_build_lab_documents enable row level security;
alter table public.eig_build_lab_document_revisions enable row level security;
-- No public policies are created. With all grants revoked, browser clients cannot
-- read or write these tables even if the API schema exposes the table names.
revoke all on table public.eig_build_lab_documents from public, anon, authenticated;
revoke all on table public.eig_build_lab_document_revisions from public, anon, authenticated;
grant select, insert, update on public.eig_build_lab_documents to service_role;
grant select, insert on public.eig_build_lab_document_revisions to service_role;

-- Atomic compare-and-swap with append-only revision history.
-- The server independently verifies exact owner identity and active session
-- BEFORE invoking this function using a server-only secret. Never use from browser.
-- No SECURITY DEFINER. Executes as service_role, not with escalated function rights.
create or replace function public.eig_build_lab_save_document(
 p_owner_user_id uuid,
 p_document_key text,
 p_expected_revision integer,
 p_payload jsonb
)
returns table(saved boolean, new_revision integer, saved_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
 v_revision integer;
 v_saved_at timestamptz;
 v_length integer;
begin
 if p_owner_user_id is null or p_document_key not in ('scan_history','work_buckets','manager_blueprint')
  or p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 2147483647
  or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
   raise exception 'Invalid Build Lab document input' using errcode = '22023';
 end if;
 v_length := octet_length(p_payload::text);
 if v_length > case p_document_key
    when 'scan_history' then 1800000 when 'work_buckets' then 2400000 else 600000 end then
   raise exception 'Build Lab document too large' using errcode = '22023';
 end if;

 if p_expected_revision = 0 then
   insert into public.eig_build_lab_documents(owner_user_id, document_key, revision, payload)
   values(p_owner_user_id,p_document_key,1,p_payload)
   on conflict do nothing
   returning revision,updated_at into v_revision,v_saved_at;
 else
   update public.eig_build_lab_documents d
      set payload=p_payload,revision=d.revision+1,updated_at=now()
    where d.owner_user_id=p_owner_user_id and d.document_key=p_document_key
      and d.revision=p_expected_revision
    returning d.revision,d.updated_at into v_revision,v_saved_at;
 end if;

 if v_revision is null then
   return query select false, coalesce(
     (select d.revision from public.eig_build_lab_documents d
       where d.owner_user_id=p_owner_user_id and d.document_key=p_document_key),0),
     null::timestamptz;
   return;
 end if;

 insert into public.eig_build_lab_document_revisions
   (owner_user_id,document_key,revision,payload,saved_at)
 values (p_owner_user_id,p_document_key,v_revision,p_payload,v_saved_at);

 return query select true,v_revision,v_saved_at;
end;
$function$;

revoke all on function public.eig_build_lab_save_document(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.eig_build_lab_save_document(uuid,text,integer,jsonb) to service_role;
commit;

-- Verification checklist, not executed by this file:
-- 1. Check RLS enabled, no anon/authenticated grants and EXECUTE absent for PUBLIC.
-- 2. Verify a browser anon/authenticated token cannot select/insert/update or call RPC.
-- 3. Verify owner-only server read/save; wrong owner, expired session, other tenant denied.
-- 4. Test revision 0 create -> 1, revision 1 write -> 2, stale revision 1 -> conflict.
-- 5. Verify revision payloads are immutable and no non-Build-Lab table changes occur.
-- 6. Test backup, restore and production UI before flipping feature flag.

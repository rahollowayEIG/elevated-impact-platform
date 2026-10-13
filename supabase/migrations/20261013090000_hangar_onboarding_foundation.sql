-- Reuse public.organizations / public.organization_profiles. Do not create a second advertiser table.
-- Database-side duplicate checks are mandatory even when the EIG UI preflights matches.

-- Existing active public venue/business listings keep their old visibility.
-- Newly provisioned Hangers start private until an authorized publishing action.
-- Adding with DEFAULT true is a one-time backwards-compatible data migration;
-- changing the default to false preserves existing records on subsequent runs.
alter table public.organizations
  add column if not exists public_directory_enabled boolean not null default true;
alter table public.organizations
  alter column public_directory_enabled set default false;

drop policy if exists "Public can read active venue organizations" on public.organizations;
create policy "Public can read active venue organizations" on public.organizations
  for select to anon
  using (
    status = 'active' and
    organization_type in ('business', 'golf_course', 'venue') and
    public_directory_enabled = true
  );

create table if not exists public.hangar_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('created')),
  source text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hangar_onboarding_events_organization_idx
  on public.hangar_onboarding_events (organization_id, created_at desc);
alter table public.hangar_onboarding_events enable row level security;
drop policy if exists hangar_onboarding_events_eig_read on public.hangar_onboarding_events;
create policy hangar_onboarding_events_eig_read on public.hangar_onboarding_events
  for select to authenticated using (public.is_eig_admin());
revoke all on public.hangar_onboarding_events from public, anon, authenticated;
grant select on public.hangar_onboarding_events to authenticated;

create or replace function public.begin_hangar_onboarding(
  p_name text,
  p_organization_type text default 'business',
  p_website_url text default null,
  p_primary_contact_name text default null,
  p_primary_contact_email text default null,
  p_is_test boolean default false,
  p_source text default 'eig_manual'
)
returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_type text := btrim(coalesce(p_organization_type, 'business'));
  v_website text := nullif(btrim(coalesce(p_website_url, '')), '');
  v_contact_name text := nullif(btrim(coalesce(p_primary_contact_name, '')), '');
  v_contact_email text := nullif(lower(btrim(coalesce(p_primary_contact_email, ''))), '');
  v_source text := btrim(coalesce(p_source, 'eig_manual'));
  v_name_key text;
  v_domain text := '';
  v_matches jsonb;
  v_org public.organizations%rowtype;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
begin
  if auth.uid() is null or not public.is_eig_admin() then
    raise exception 'EIG administrator access is required' using errcode = '42501';
  end if;
  if length(v_name) < 2 or length(v_name) > 160 then
    raise exception 'Enter a business name between 2 and 160 characters' using errcode = '22023';
  end if;
  if v_type not in ('business','golf_course','venue','nonprofit','school','publisher') then
    raise exception 'Unsupported Hanger type' using errcode = '22023';
  end if;
  if v_source not in ('eig_manual','hometown_magazine','ad_network','event','partner') then
    raise exception 'Unsupported onboarding source' using errcode = '22023';
  end if;
  if length(coalesce(v_contact_name,'')) > 160 or length(coalesce(v_contact_email,'')) > 320 then
    raise exception 'Contact information is too long' using errcode = '22023';
  end if;
  if v_contact_email is not null and v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid contact email' using errcode = '22023';
  end if;
  if v_website is not null then
    if length(v_website) > 500 or
       v_website !~* '^https://([a-z0-9-]+[.])+[a-z]{2,63}(/[[:graph:]]*)?$' then
      raise exception 'Enter a public HTTPS business website' using errcode = '22023';
    end if;
    v_domain := lower(split_part(
      regexp_replace(v_website, '^https://(www[.])?', '', 'i'), '/', 1));
    if left(v_domain, 4) = 'www.' then v_domain := substring(v_domain from 5); end if;
  end if;
  v_name_key := regexp_replace(lower(v_name), '[^[:alnum:]]', '', 'g');

  -- This lock covers both match and create, preventing two staff submissions
  -- from creating the same Hanger concurrently through this RPC.
  perform pg_advisory_xact_lock(hashtext('elevationpilot:hangar-onboarding'));
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', matches.id, 'name', matches.name, 'slug', matches.slug,
      'reason', matches.match_reason
    )), '[]'::jsonb) into v_matches
  from (
    select o.id, o.name, o.slug,
      case when regexp_replace(lower(o.name), '[^[:alnum:]]', '', 'g') = v_name_key
        then 'same_name' else 'same_website' end as match_reason
    from public.organizations o
    left join public.organization_profiles op on op.organization_id = o.id
    where o.is_test = coalesce(p_is_test, false)
      and (
        regexp_replace(lower(o.name), '[^[:alnum:]]', '', 'g') = v_name_key
        or (
          v_domain <> '' and
          lower(split_part(regexp_replace(coalesce(op.website_url,''), '^https://(www[.])?', '', 'i'), '/', 1)) = v_domain
        )
      )
    order by o.created_at, o.id
    limit 10
  ) matches;
  if jsonb_array_length(v_matches) > 0 then
    return jsonb_build_object('outcome', 'matches', 'candidates', v_matches);
  end if;

  v_base_slug := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '(^-+|-+$)', '', 'g');
  v_base_slug := left(coalesce(nullif(v_base_slug, ''), 'business'), 70);
  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.organizations (name, slug, organization_type, status, is_test, onboarding_status, public_directory_enabled)
  values (v_name, v_slug, v_type, 'active', coalesce(p_is_test, false), 'profile_incomplete', false)
  returning * into v_org;

  insert into public.organization_profiles
    (organization_id, primary_contact_name, primary_contact_email, website_url)
  values (v_org.id, v_contact_name, v_contact_email, v_website);

  -- No Pilot or per-Hanger EIG role is granted here. The authenticated EIG admin
  -- uses existing platform authority; a real Pilot must accept a separate invite.
  -- No paid product entitlement is created. The core Cockpit still exists.
  insert into public.hangar_onboarding_events
    (organization_id, actor_user_id, action, source, details)
  values (v_org.id, auth.uid(), 'created', v_source,
    jsonb_build_object('is_test', coalesce(p_is_test,false),
      'has_contact', v_contact_email is not null,
      'has_website', v_website is not null));
  return jsonb_build_object('outcome','created','organization',to_jsonb(v_org));
end
$body$;

revoke all on function public.begin_hangar_onboarding(
  text, text, text, text, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.begin_hangar_onboarding(
  text, text, text, text, text, boolean, text
) to authenticated;
